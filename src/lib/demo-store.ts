"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  where,
  type DocumentReference
} from "firebase/firestore";
import { initialData } from "./mock-data";
import { auth, firebaseEnabled, firestore } from "./firebase";
import { createDefaultMenu } from "./menu-templates";
import { productFinalPrice } from "./pricing";
import { legacySelections } from "./product-options";
import type { AccessStatus, CashFlow, CashFlowItem, Category, Customer, DailyReport, DemoDatabase, Device, MemberCoupon, MemberRules, Order, OrderItem, OrderPayload, OrderStatus, PlatformNotification, PointLog, PointLogType, Product, Promotion, RewardCoupon, SharedOptionGroup, Store, StoredValueLog, StoredValueLogType, StoreMemberRole, StoreUserAccess, SubscriptionStatus, Table, User, UserPermissions } from "./types";

const storageKey = "light-qr-ordering-demo-db-v2";
const syncEventName = "light-qr-ordering-db-updated";

type StoreOptions = {
  storeId?: string;
  admin?: boolean;
  customerSessionId?: string;
  skipOrderList?: boolean;
  loadCustomers?: boolean;
  todayOrdersOnly?: boolean; // Only query today's orders from Firestore (for POS/KDS optimization)
};

function loadLocalData(): DemoDatabase {
  if (typeof window === "undefined") return initialData;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return initialData;

  try {
    return JSON.parse(raw) as DemoDatabase;
  } catch {
    return initialData;
  }
}

function saveLocalData(db: DemoDatabase) {
  window.localStorage.setItem(storageKey, JSON.stringify(db));
  window.dispatchEvent(new Event(syncEventName));
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function pendingUserId(email: string) {
  return `pending-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function platformRoleFromMemberships(memberships: Record<string, StoreMemberRole>) {
  const roles = Object.values(memberships);
  if (roles.includes("owner") || roles.includes("manager")) return "merchant";
  if (roles.includes("staff")) return "kitchen";
  return "user";
}

function orderDayKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOrderNumber(source: "qr" | "pos" | "kiosk", sequence: number) {
  return `${source === "pos" ? "P" : source === "kiosk" ? "K" : "Q"}${String(sequence).padStart(3, "0")}`;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
  ) as T;
}

function isStoreClosed(store?: Store) {
  return !store || !store.isOpen || store.orderStatus === "closed";
}

function qrBlockReason(store: Store | undefined, mode: OrderPayload["mode"]) {
  if (isStoreClosed(store)) return "店家休息中";
  if (!store) return "店家休息中";
  if (mode === "takeout" && (store.takeoutOrderingEnabled ?? store.takeoutEnabled ?? true) === false) return "店家暫停外帶接單";
  if (mode === "dine-in" && (store.dineInOrderingEnabled ?? store.dineInEnabled ?? true) === false) return "店家暫停內用接單";
  return "";
}

function optionDefaults(product: Product) {
  return legacySelections(product);
}

function scopedQuery(collectionName: string, storeId?: string, admin?: boolean, customerSessionId?: string, todayOrdersOnly?: boolean) {
  if (!firestore) return null;
  if (!admin && !storeId && collectionName !== "stores") return null;
  if (collectionName === "orders" && storeId && !admin) {
    const ref = collection(firestore, "stores", storeId, "orders");
    if (customerSessionId) return query(ref, where("customerSessionId", "==", customerSessionId));
    if (todayOrdersOnly) return query(ref, where("createdAt", ">=", todayStartIso()));
    return ref;
  }
  if (collectionName === "stores" && !admin && !storeId) return null;
  const ref = collection(firestore, collectionName);
  if (admin || !storeId || collectionName === "stores") return ref;
  if (collectionName === "orders" && customerSessionId) return query(ref, where("customerSessionId", "==", customerSessionId));
  if (collectionName === "orders" && todayOrdersOnly) {
    return query(ref, where("storeId", "==", storeId), where("createdAt", ">=", todayStartIso()));
  }
  return query(ref, where("storeId", "==", storeId));
}

function generateMemberNo(existingCustomers: Customer[]): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `M${y}${m}${d}`;
  const todayNos = existingCustomers
    .map((c) => c.memberNo)
    .filter((no) => no.startsWith(prefix))
    .map((no) => parseInt(no.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = todayNos.length > 0 ? Math.max(...todayNos) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function calculatePointsEarned(totalAmount: number, settings?: { pointsEnabled?: boolean; pointsPerAmount?: number; pointsReward?: number }): number {
  if (!settings?.pointsEnabled) return 0;
  const perAmount = settings.pointsPerAmount ?? 100;
  const reward = settings.pointsReward ?? 1;
  if (perAmount <= 0) return 0;
  return Math.floor(totalAmount / perAmount) * reward;
}

const defaultMemberRules: MemberRules = {
  enablePoints: false,
  earnAmount: 100,
  earnPoints: 1,
  pointValue: 1,
  enableCouponExchange: true,
  birthdayRewardEnabled: false,
  birthdayRewardPoints: 0
};

function pointsFromRules(totalAmount: number, rules?: MemberRules | null): number {
  if (!rules?.enablePoints || rules.earnAmount <= 0 || rules.earnPoints <= 0) return 0;
  return Math.floor(totalAmount / rules.earnAmount) * rules.earnPoints;
}

function todayStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useDemoStore(options: StoreOptions = {}) {
  const { storeId, admin = false, customerSessionId, skipOrderList = false, loadCustomers = false, todayOrdersOnly = false } = options;
  const [db, setDb] = useState<DemoDatabase>(initialData);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const useFirestore = firebaseEnabled && Boolean(firestore);

  useEffect(() => {
    if (!useFirestore || !firestore) {
      setDb(loadLocalData());
      setReady(true);

      const sync = () => setDb(loadLocalData());
      window.addEventListener("storage", sync);
      window.addEventListener(syncEventName, sync);
      const interval = window.setInterval(sync, 1200);

      return () => {
        window.removeEventListener("storage", sync);
        window.removeEventListener(syncEventName, sync);
        window.clearInterval(interval);
      };
    }

    setReady(false);
    const next: DemoDatabase = { stores: [], users: [], categories: [], products: [], orders: [], cashFlows: [], cashFlowItems: [], devices: [], tables: [], promotions: [], platformNotifications: [], customers: [], pointLogs: [], storedValueLogs: [], rewardCoupons: [], memberCoupons: [], sharedOptionGroups: [] };
    const commit = () => {
      setDb({ ...next });
      setReady(true);
    };
    const handleError = (snapshotError: Error) => {
      console.error("[DemoStore] Firestore listener failed", {
        message: snapshotError.message,
        storeId,
        admin
      });
      setError(snapshotError.message);
      setReady(true);
    };

    const unsubStores = storeId && !admin
      ? onSnapshot(
          doc(firestore, "stores", storeId),
          (snapshot) => {
            next.stores = snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() } as Store] : [];
            commit();
          },
          handleError
        )
      : admin
        ? onSnapshot(
            collection(firestore, "stores"),
            (snapshot) => {
              next.stores = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Store);
              commit();
            },
            handleError
          )
        : () => undefined;

    const collectionNames = skipOrderList
      ? customerSessionId
        ? ["categories", "products", "tables", "promotions"]
        : ["categories", "products", "devices", "tables", "promotions"]
      : ["categories", "products", "orders", "cashFlows", "cashFlowItems", "devices", "tables", "promotions"];
    const unsubscribers = collectionNames.map((collectionName) => {
      const ref = scopedQuery(collectionName, storeId, admin, customerSessionId, todayOrdersOnly);
      if (!ref) return () => undefined;
      return onSnapshot(
        ref,
        (snapshot) => {
          const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
          if (collectionName === "orders") {
            const queryCondition = todayOrdersOnly ? `storeId == ${storeId} AND createdAt >= ${todayStartIso()}` : `storeId == ${storeId}`;
            console.log("[DemoStore] POS order listener", {
              currentStoreId: storeId,
              queryFullPath: `stores/${storeId}/orders`,
              statusFilter: "none",
              queryCondition,
              snapshotSize: snapshot.size,
              orders: docs.map((order) => ({
                orderId: (order as any).id,
                queueNumber: (order as any).pickupNumber ?? (order as any).orderNumber,
                storeId: (order as any).storeId,
                status: (order as any).status,
                source: (order as any).source,
                orderType: (order as any).orderType
              }))
            });
          }
          (next as unknown as Record<string, unknown[]>)[collectionName] = docs;
          commit();
        },
        handleError
      );
    });
    const unsubUsers = admin
      ? onSnapshot(
          collection(firestore, "users"),
          (snapshot) => {
            next.users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as User);
            commit();
          },
          handleError
        )
      : () => undefined;

    const unsubNotifications = admin
      ? onSnapshot(
          collection(firestore, "platformNotifications"),
          (snapshot) => {
            next.platformNotifications = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as PlatformNotification);
            commit();
          },
          () => undefined // silently ignore permission errors for non-admins
        )
      : () => undefined;

    const unsubCustomers = (loadCustomers && storeId)
      ? onSnapshot(
          collection(firestore, "stores", storeId, "members"),
          (snapshot) => {
            next.customers = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Customer);
            commit();
          },
          handleError
        )
      : () => undefined;

    const unsubPointLogs = (loadCustomers && storeId)
      ? onSnapshot(
          query(collection(firestore, "pointLogs"), where("storeId", "==", storeId)),
          (snapshot) => {
            next.pointLogs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as PointLog);
            commit();
          },
          handleError
        )
      : () => undefined;

    const unsubStoredValueLogs = (loadCustomers && storeId)
      ? onSnapshot(
          collection(firestore, "stores", storeId, "memberTransactions"),
          (snapshot) => {
            next.storedValueLogs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StoredValueLog);
            commit();
          },
          handleError
        )
      : () => undefined;

    const unsubSharedOptionGroups = storeId
      ? onSnapshot(
          query(collection(firestore, "sharedOptionGroups"), where("storeId", "==", storeId)),
          (snapshot) => {
            next.sharedOptionGroups = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SharedOptionGroup);
            commit();
          },
          () => undefined // silently ignore — feature is optional
        )
      : () => undefined;

    return () => {
      unsubStores();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubUsers();
      unsubNotifications();
      unsubCustomers();
      unsubPointLogs();
      unsubStoredValueLogs();
      unsubSharedOptionGroups();
    };
  }, [admin, customerSessionId, loadCustomers, skipOrderList, storeId, todayOrdersOnly, useFirestore]);

  useEffect(() => {
    if (!ready || useFirestore) return;
    saveLocalData(db);
  }, [db, ready, useFirestore]);

  const todayOrders = useMemo(() => {
    const today = new Date().toDateString();
    // When todayOrdersOnly, Firestore already filtered; for local mode filter here
    return db.orders.filter((order) => (!storeId || order.storeId === storeId) && new Date(order.createdAt).toDateString() === today);
  }, [db.orders, storeId]);

  const todayCashFlows = useMemo(() => {
    const today = new Date().toDateString();
    return (db.cashFlows ?? []).filter((cashFlow) => cashFlow.storeId === storeId && new Date(cashFlow.createdAt).toDateString() === today);
  }, [db.cashFlows, storeId]);

  function resetDemo() {
    setDb(initialData);
  }

  async function createOrder(order: OrderPayload) {
    const now = new Date();
    const createdAt = now.toISOString();
    const source = order.source ?? "qr";
    const store = db.stores.find((item) => item.id === order.storeId);
    const blockReason = source === "qr" ? qrBlockReason(store, order.mode) : "";
    const id = useFirestore && firestore ? doc(collection(firestore, "stores", order.storeId, "orders")).id : newId("o");
    const buildOrder = (orderNumber: string): Order => stripUndefined({
      ...order,
      id,
      orderNumber,
      pickupNumber: orderNumber,
      status: blockReason ? "cancelled" : order.status ?? "pending",
      source,
      memberId: order.memberId,
      memberPhone: order.memberPhone,
      memberName: order.memberName,
      rejectReason: blockReason || order.rejectReason,
      cancelReason: blockReason ? `${blockReason}，系統自動拒單` : order.cancelReason,
      createdAt,
      updatedAt: createdAt,
      totalAmount: order.total,
      items: order.items.map((item) => stripUndefined({
        ...item,
        id: item.id || newId("oi"),
        orderId: id
      })) as OrderItem[]
    } as Order);
    if (useFirestore && firestore) {
      const db = firestore;
      const orderRef = doc(db, "stores", order.storeId, "orders", id);
      const counterRef = doc(db, "counters", "orderNumbers");
      const counterKey = source === "pos" ? "pos" : source === "kiosk" ? "kiosk" : "qr";
      try {
        const nextOrder = await runTransaction(db, async (transaction) => {
          const counterSnapshot = await transaction.get(counterRef);
          const counterData = counterSnapshot.exists() ? counterSnapshot.data() : {};
          const currentSequence = typeof counterData[counterKey] === "number" ? counterData[counterKey] : 1;
          const orderNumber = formatOrderNumber(source, currentSequence);
          const createdOrder = buildOrder(orderNumber);
          const orderPath = `stores/${order.storeId}/orders/${id}`;
          console.log("[DemoStore] createOrder write", {
            currentUserUid: auth?.currentUser?.uid ?? null,
            currentUserEmail: auth?.currentUser?.email ?? null,
            orderId: id,
            queueNumber: createdOrder.pickupNumber ?? createdOrder.orderNumber,
            storeId: createdOrder.storeId,
            fullPath: orderPath,
            status: createdOrder.status,
            source: createdOrder.source,
            orderType: createdOrder.orderType
          });
          const nextCounters = {
            qr: typeof counterData.qr === "number" ? counterData.qr : 1,
            pos: typeof counterData.pos === "number" ? counterData.pos : 1,
            [counterKey]: currentSequence + 1
          };

          transaction.set(counterRef, nextCounters, { merge: true });
          transaction.set(orderRef, stripUndefined(createdOrder));
          return createdOrder;
        });
        setDb((current) => ({ ...current, orders: [nextOrder, ...current.orders.filter((item) => item.id !== id)] }));
        return nextOrder;
      } catch (writeError) {
        console.error("[DemoStore] createOrder failed", {
          message: writeError instanceof Error ? writeError.message : String(writeError),
          currentUserUid: auth?.currentUser?.uid ?? null,
          currentUserEmail: auth?.currentUser?.email ?? null,
          fullPath: `stores/${order.storeId}/orders/${id}`,
          requestStoreId: order.storeId,
          status: order.status ?? "pending",
          source
        });
        throw writeError;
      }
    } else {
      const sourceOrders = db.orders.filter((item) => item.source === source);
      const sequence = sourceOrders.length + 1;
      const nextOrder = buildOrder(formatOrderNumber(source, sequence));
      setDb((current) => ({ ...current, orders: [nextOrder, ...current.orders] }));
      return nextOrder;
    }
  }

  async function createCashFlow(cashFlow: Omit<CashFlow, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
    const now = new Date().toISOString();
    const id = cashFlow.id || (useFirestore && firestore ? doc(collection(firestore, "cashFlows")).id : newId("cashflow"));
    const nextCashFlow: CashFlow = {
      id,
      storeId: cashFlow.storeId,
      itemId: cashFlow.itemId,
      itemName: cashFlow.itemName,
      type: cashFlow.type,
      amount: Number(cashFlow.amount),
      category: cashFlow.category,
      note: cashFlow.note ?? "",
      createdBy: cashFlow.createdBy,
      createdAt: cashFlow.createdAt || now
    };

    if (useFirestore && firestore) {
      await setDoc(doc(firestore, "cashFlows", id), stripUndefined(nextCashFlow));
      setDb((current) => ({ ...current, cashFlows: [nextCashFlow, ...(current.cashFlows ?? []).filter((item) => item.id !== id)] }));
      return nextCashFlow;
    }

    setDb((current) => ({ ...current, cashFlows: [nextCashFlow, ...(current.cashFlows ?? []).filter((item) => item.id !== id)] }));
    return nextCashFlow;
  }

  async function upsertCashFlowItem(item: Omit<CashFlowItem, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string }) {
    const now = new Date().toISOString();
    const id = item.id || (useFirestore && firestore ? doc(collection(firestore, "cashFlowItems")).id : newId("cashflowitem"));
    const nextItem: CashFlowItem = {
      id,
      storeId: item.storeId,
      name: item.name,
      type: item.type,
      amountMode: item.amountMode,
      fixedAmount: item.fixedAmount,
      enabled: item.enabled,
      createdAt: item.createdAt || now,
      updatedAt: now
    };

    if (useFirestore && firestore) {
      await setDoc(doc(firestore, "cashFlowItems", id), stripUndefined(nextItem), { merge: true });
      setDb((current) => ({ ...current, cashFlowItems: [nextItem, ...(current.cashFlowItems ?? []).filter((cashItem) => cashItem.id !== id)] }));
      return nextItem;
    }

    setDb((current) => {
      const items = current.cashFlowItems ?? [];
      const exists = items.some((cashItem) => cashItem.id === id);
      return { ...current, cashFlowItems: exists ? items.map((cashItem) => (cashItem.id === id ? nextItem : cashItem)) : [nextItem, ...items] };
    });
    return nextItem;
  }

  async function upsertPromotion(promotion: Omit<Promotion, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string }) {
    const now = new Date().toISOString();
    const id = promotion.id || (useFirestore && firestore ? doc(collection(firestore, "promotions")).id : newId("promo"));
    const nextPromotion: Promotion = {
      id,
      storeId: promotion.storeId,
      name: promotion.name,
      enabled: promotion.enabled,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      type: promotion.type,
      targetCategories: promotion.targetCategories ?? [],
      targetProducts: promotion.targetProducts ?? [],
      buyQty: Number(promotion.buyQty ?? 0),
      freeQty: Number(promotion.freeQty ?? 0),
      discountPercent: Number(promotion.discountPercent ?? 0),
      discountAmount: Number(promotion.discountAmount ?? 0),
      stackable: Boolean(promotion.stackable),
      autoApply: promotion.autoApply ?? true,
      priority: Number(promotion.priority ?? 0),
      createdAt: promotion.createdAt || now,
      updatedAt: now
    };

    if (useFirestore && firestore) {
      await setDoc(doc(firestore, "promotions", id), stripUndefined(nextPromotion), { merge: true });
      setDb((current) => ({ ...current, promotions: [nextPromotion, ...(current.promotions ?? []).filter((item) => item.id !== id)] }));
      return nextPromotion;
    }

    setDb((current) => {
      const promotions = current.promotions ?? [];
      const exists = promotions.some((item) => item.id === id);
      return { ...current, promotions: exists ? promotions.map((item) => (item.id === id ? nextPromotion : item)) : [nextPromotion, ...promotions] };
    });
    return nextPromotion;
  }

  async function deletePromotion(promotionId: string) {
    if (useFirestore && firestore) {
      await deleteDoc(doc(firestore, "promotions", promotionId));
      setDb((current) => ({ ...current, promotions: (current.promotions ?? []).filter((item) => item.id !== promotionId) }));
      return;
    }

    setDb((current) => ({ ...current, promotions: (current.promotions ?? []).filter((item) => item.id !== promotionId) }));
  }

  function updateOrderStatus(orderId: string, status: OrderStatus) {
    const updatedAt = new Date().toISOString();
    if (useFirestore && firestore) {
      const targetStoreId = db.orders.find((order) => order.id === orderId)?.storeId ?? storeId;
      if (!targetStoreId) {
        setError("找不到訂單所屬店家，無法更新狀態。");
        return;
      }
      setDb((current) => ({
        ...current,
        orders: current.orders.map((order) => (order.id === orderId ? { ...order, status, updatedAt } : order))
      }));
      updateDoc(doc(firestore, "stores", targetStoreId, "orders", orderId), { status, updatedAt }).catch((writeError: Error) => setError(writeError.message));
      return;
    }
    setDb((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt } : order
      )
    }));
  }

  function rejectOrder(orderId: string, rejectReason: string) {
    if (useFirestore && firestore) {
      const targetStoreId = db.orders.find((order) => order.id === orderId)?.storeId ?? storeId;
      if (!targetStoreId) {
        setError("找不到訂單所屬店家，無法取消訂單。");
        return;
      }
      updateDoc(doc(firestore, "stores", targetStoreId, "orders", orderId), { status: "cancelled", rejectReason, updatedAt: new Date().toISOString() })
        .catch((writeError: Error) => setError(writeError.message));
      return;
    }
    setDb((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status: "cancelled", rejectReason, updatedAt: new Date().toISOString() } : order
      )
    }));
  }

  function upsertProduct(product: Product) {
    if (useFirestore && firestore) {
      const id = product.id || doc(collection(firestore, "products")).id;
      setDoc(doc(firestore, "products", id), { ...product, id }, { merge: true });
      return;
    }
    setDb((current) => {
      const exists = current.products.some((item) => item.id === product.id);
      return {
        ...current,
        products: exists
          ? current.products.map((item) => (item.id === product.id ? product : item))
          : [{ ...product, id: newId("p"), sort: product.sort || current.products.length + 1 }, ...current.products]
      };
    });
  }

  function deleteProduct(productId: string) {
    if (useFirestore && firestore) {
      deleteDoc(doc(firestore, "products", productId));
      return;
    }
    setDb((current) => ({
      ...current,
      products: current.products.filter((product) => product.id !== productId)
    }));
  }

  function upsertSharedOptionGroup(group: SharedOptionGroup) {
    const now = new Date().toISOString();
    const id = group.id || newId("sg");
    const record: SharedOptionGroup = { ...group, id, updatedAt: now, createdAt: group.createdAt || now };
    if (useFirestore && firestore) {
      setDoc(doc(firestore, "sharedOptionGroups", id), record, { merge: true });
      return;
    }
    setDb((current) => {
      const list = current.sharedOptionGroups ?? [];
      const exists = list.some((item) => item.id === id);
      return {
        ...current,
        sharedOptionGroups: exists ? list.map((item) => (item.id === id ? record : item)) : [...list, record]
      };
    });
  }

  function deleteSharedOptionGroup(groupId: string) {
    if (useFirestore && firestore) {
      deleteDoc(doc(firestore, "sharedOptionGroups", groupId));
      return;
    }
    setDb((current) => ({
      ...current,
      sharedOptionGroups: (current.sharedOptionGroups ?? []).filter((item) => item.id !== groupId)
    }));
  }

  function upsertCategory(category: Category) {
    if (useFirestore && firestore) {
      const id = category.id || doc(collection(firestore, "categories")).id;
      setDoc(doc(firestore, "categories", id), { ...category, id }, { merge: true });
      return;
    }
    setDb((current) => {
      const exists = current.categories.some((item) => item.id === category.id);
      return {
        ...current,
        categories: exists
          ? current.categories.map((item) => (item.id === category.id ? category : item))
          : [{ ...category, id: newId("cat") }, ...current.categories]
      };
    });
  }

  function upsertStore(store: Store) {
    if (useFirestore && firestore) {
      const id = store.id || doc(collection(firestore, "stores")).id;
      setDoc(doc(firestore, "stores", id), { ...store, id }, { merge: true });
      return;
    }
    setDb((current) => {
      const exists = current.stores.some((item) => item.id === store.id);
      return {
        ...current,
        stores: exists
          ? current.stores.map((item) => (item.id === store.id ? store : item))
          : [{ ...store, id: newId("store") }, ...current.stores]
      };
    });
  }

  function upsertDevice(device: Device) {
    const now = new Date().toISOString();
    const nextDevice = {
      ...device,
      id: device.id,
      createdAt: device.createdAt || now,
      updatedAt: now
    };
    if (useFirestore && firestore) {
      const id = device.id || doc(collection(firestore, "devices")).id;
      setDoc(doc(firestore, "devices", id), { ...nextDevice, id }, { merge: true }).catch((writeError: Error) => setError(writeError.message));
      return;
    }
    setDb((current) => {
      const devices = current.devices ?? [];
      const id = device.id || newId("device");
      const exists = devices.some((item) => item.id === id);
      return {
        ...current,
        devices: exists
          ? devices.map((item) => (item.id === id ? { ...nextDevice, id } : item))
          : [{ ...nextDevice, id }, ...devices]
      };
    });
  }

  function deleteDevice(deviceId: string) {
    if (useFirestore && firestore) {
      deleteDoc(doc(firestore, "devices", deviceId)).catch((writeError: Error) => setError(writeError.message));
      return;
    }
    setDb((current) => ({ ...current, devices: (current.devices ?? []).filter((device) => device.id !== deviceId) }));
  }

  async function upsertTable(table: Table) {
    const now = new Date().toISOString();
    const nextTable = {
      ...table,
      id: table.id,
      tableName: table.tableName || table.name || table.tableNo || "",
      enabled: table.enabled ?? table.isActive ?? true,
      createdAt: table.createdAt || now,
      updatedAt: now
    };
    if (useFirestore && firestore) {
      try {
        const id = table.id || doc(collection(firestore, "tables")).id;
        const payload = { ...nextTable, id };
        await setDoc(doc(firestore, "tables", id), payload, { merge: true });
        return payload as Table;
      } catch (writeError) {
        setError(writeError instanceof Error ? writeError.message : "Failed to save table");
        throw writeError;
      }
    }
    let savedTable: Table | undefined;
    setDb((current) => {
      const tables = current.tables ?? [];
      const id = table.id || newId("table");
      const exists = tables.some((item) => item.id === id);
      savedTable = { ...nextTable, id } as Table;
      return { ...current, tables: exists ? tables.map((item) => (item.id === id ? savedTable! : item)) : [savedTable, ...tables] };
    });
    return savedTable;
  }

  async function deleteTable(tableId: string) {
    if (useFirestore && firestore) {
      try {
        await deleteDoc(doc(firestore, "tables", tableId));
      } catch (writeError) {
        setError(writeError instanceof Error ? writeError.message : "Failed to delete table");
        throw writeError;
      }
      return;
    }
    setDb((current) => ({ ...current, tables: (current.tables ?? []).filter((table) => table.id !== tableId) }));
  }

  async function bindStoreUser(email: string, targetStoreId: string, memberRole: StoreMemberRole) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !targetStoreId) return;

    function nextUser(user: User): User {
      const memberships = { ...(user.memberships ?? {}), [targetStoreId]: memberRole };
      const storeRoles = { ...(user.storeRoles ?? {}), [targetStoreId]: memberRole };
      const storeIds = Array.from(new Set([...(user.storeIds ?? []), targetStoreId]));
      return {
        ...user,
        email: normalizedEmail,
        storeId: user.storeId ?? targetStoreId,
        storeIds,
        memberships,
        storeRoles,
        role: normalizedEmail === "ciut0000@gmail.com" && user.role === "admin" ? "admin" : platformRoleFromMemberships(memberships),
        pending: false,
        approved: true,
        status: "active",
        updatedAt: new Date().toISOString()
      };
    }

    if (useFirestore && firestore) {
      try {
        const usersByEmail = await getDocs(query(collection(firestore, "users"), where("email", "==", normalizedEmail)));
        const targetDoc = usersByEmail.docs[0];
        if (targetDoc) {
          const user = { id: targetDoc.id, ...targetDoc.data() } as User;
          await setDoc(doc(firestore, "users", targetDoc.id), nextUser(user), { merge: true });
        } else {
          const id = pendingUserId(normalizedEmail);
          const now = new Date().toISOString();
          await setDoc(doc(firestore, "pendingInvites", id), {
            id,
            email: normalizedEmail,
            storeId: targetStoreId,
            storeIds: [targetStoreId],
            memberships: { [targetStoreId]: memberRole },
            storeRoles: { [targetStoreId]: memberRole },
            role: memberRole,
            status: "pending",
            createdAt: now,
            updatedAt: now
          }, { merge: true });
          await setDoc(doc(firestore, "storeUserBindings", `${targetStoreId}_${id}`), {
            id: `${targetStoreId}_${id}`,
            email: normalizedEmail,
            userId: null,
            storeId: targetStoreId,
            storeRole: memberRole,
            status: "pending",
            createdAt: now,
            updatedAt: now
          }, { merge: true });
          await setDoc(doc(firestore, "users", id), {
            id,
            email: normalizedEmail,
            name: normalizedEmail,
            role: "user",
            storeId: targetStoreId,
            storeIds: [targetStoreId],
            memberships: { [targetStoreId]: memberRole },
            storeRoles: { [targetStoreId]: memberRole },
            pending: true,
            approved: false,
            status: "pending",
            createdAt: now,
            updatedAt: now
          }, { merge: true });
        }
        const bindingUserId = targetDoc?.id ?? pendingUserId(normalizedEmail);
        const bindingPayload = {
          id: `${targetStoreId}_${bindingUserId}`,
          email: normalizedEmail,
          userId: targetDoc?.id ?? null,
          storeId: targetStoreId,
          role: memberRole,
          storeRole: memberRole,
          status: targetDoc ? "active" : "pending",
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        await Promise.all([
          setDoc(doc(firestore, "storeUserBindings", `${targetStoreId}_${bindingUserId}`), bindingPayload, { merge: true }),
          setDoc(doc(firestore, "storeUsers", `${targetStoreId}_${bindingUserId}`), bindingPayload, { merge: true })
        ]);
      } catch (writeError) {
        console.error("bindUserToStore failed", writeError);
        setError(writeError instanceof Error ? writeError.message : "bindUserToStore failed");
        throw writeError;
      }
      return;
    }

    setDb((current) => {
      const existing = current.users.find((user) => user.email.toLowerCase() === normalizedEmail);
      if (existing) {
        return { ...current, users: current.users.map((user) => (user.id === existing.id ? nextUser(user) : user)) };
      }
      const id = pendingUserId(normalizedEmail);
      const now = new Date().toISOString();
      return {
        ...current,
        users: [{
          id,
          email: normalizedEmail,
          name: normalizedEmail,
          role: "user",
          storeId: targetStoreId,
          storeIds: [targetStoreId],
          memberships: { [targetStoreId]: memberRole },
          storeRoles: { [targetStoreId]: memberRole },
          pending: true,
          approved: false,
          status: "pending",
          createdAt: now,
          updatedAt: now
        }, ...current.users]
      };
    });
  }

  async function unbindStoreUser(userId: string, targetStoreId: string) {
    function nextUser(user: User): User {
      const memberships = { ...(user.memberships ?? {}) };
      const storeRoles = { ...(user.storeRoles ?? {}) };
      delete memberships[targetStoreId];
      delete storeRoles[targetStoreId];
      const storeIds = (user.storeIds ?? []).filter((id) => id !== targetStoreId);
      return {
        ...user,
        storeId: user.storeId === targetStoreId ? storeIds[0] ?? null : user.storeId,
        storeIds,
        memberships,
        storeRoles,
        role: user.email.toLowerCase() === "ciut0000@gmail.com" && user.role === "admin" ? "admin" : platformRoleFromMemberships(memberships),
        updatedAt: new Date().toISOString()
      };
    }

    if (useFirestore && firestore) {
      try {
        const userRef = doc(firestore, "users", userId);
        const user = db.users.find((item) => item.id === userId);
        if (!user) return;
        await Promise.all([
          setDoc(userRef, nextUser(user), { merge: true }),
          deleteDoc(doc(firestore, "storeUserBindings", `${targetStoreId}_${userId}`)),
          deleteDoc(doc(firestore, "storeUsers", `${targetStoreId}_${userId}`))
        ]);
      } catch (writeError) {
        console.error("bindUserToStore failed", writeError);
        setError(writeError instanceof Error ? writeError.message : "unbindStoreUser failed");
        throw writeError;
      }
      return;
    }

    setDb((current) => ({ ...current, users: current.users.map((user) => (user.id === userId ? nextUser(user) : user)) }));
  }

  function importBreakfastMenu(targetStoreId = storeId) {
    if (!targetStoreId) return;
    const targetStore = db.stores.find((item) => item.id === targetStoreId);
    if (targetStore?.demoBreakfastMenuImported) return;

    const menu = createDefaultMenu(targetStoreId, "breakfast");
    const nextStore = targetStore
      ? { ...targetStore, storeType: targetStore.storeType ?? "breakfast", demoBreakfastMenuImported: true }
      : undefined;

    if (useFirestore && firestore) {
      const db = firestore;
      const writes = [
        ...menu.categories.map((category) => setDoc(doc(db, "categories", category.id), category, { merge: true })),
        ...menu.products.map((product) => setDoc(doc(db, "products", product.id), product, { merge: true }))
      ];
      if (nextStore) writes.push(setDoc(doc(db, "stores", targetStoreId), nextStore, { merge: true }));
      Promise.all(writes).catch((writeError: Error) => setError(writeError.message));
    }

    setDb((current) => ({
      ...current,
      stores: current.stores.map((item) =>
        item.id === targetStoreId ? { ...item, storeType: item.storeType ?? "breakfast", demoBreakfastMenuImported: true } : item
      ),
      categories: [
        ...current.categories.filter((category) => !(category.storeId === targetStoreId && menu.categories.some((item) => item.id === category.id))),
        ...menu.categories
      ],
      products: [
        ...current.products.filter((product) => !(product.storeId === targetStoreId && menu.products.some((item) => item.id === product.id))),
        ...menu.products
      ]
    }));
  }

  async function deleteStoreCascade(targetStoreId: string) {
    if (useFirestore && firestore) {
      try {
        const db = firestore;
        const batch = writeBatch(db);
        batch.delete(doc(db, "stores", targetStoreId));

        const relatedCollections = ["products", "categories", "orders", "promotions", "storeUserBindings", "storeUsers", "pendingInvites", "pendingUsers"];
        const snapshots = await Promise.all(
          relatedCollections.map((collectionName) =>
            getDocs(query(collection(db, collectionName), where("storeId", "==", targetStoreId)))
          )
        );
        snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => batch.delete(item.ref)));

        const [linkedByStoreIds, linkedByStoreId] = await Promise.all([
          getDocs(query(collection(db, "users"), where("storeIds", "array-contains", targetStoreId))),
          getDocs(query(collection(db, "users"), where("storeId", "==", targetStoreId)))
        ]);
        const linkedUsers = new Map<string, { ref: DocumentReference; user: User }>();
        [...linkedByStoreIds.docs, ...linkedByStoreId.docs].forEach((item) => {
          linkedUsers.set(item.id, { ref: item.ref, user: { id: item.id, ...item.data() } as User });
        });
        linkedUsers.forEach(({ ref, user }) => {
          const memberships = { ...(user.memberships ?? {}) };
          const storeRoles = { ...(user.storeRoles ?? {}) };
          delete memberships[targetStoreId];
          delete storeRoles[targetStoreId];
          const storeIds = (user.storeIds ?? []).filter((id) => id !== targetStoreId);
          batch.update(ref, {
            storeId: user.storeId === targetStoreId ? storeIds[0] ?? null : user.storeId ?? null,
            storeIds,
            memberships,
            storeRoles,
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      } catch (writeError) {
        console.error("deleteStore failed", writeError);
        setError(writeError instanceof Error ? writeError.message : "deleteStore failed");
        throw writeError;
      }
      return;
    }

    setDb((current) => ({
      ...current,
      stores: current.stores.filter((store) => store.id !== targetStoreId),
      categories: current.categories.filter((category) => category.storeId !== targetStoreId),
      products: current.products.filter((product) => product.storeId !== targetStoreId),
      orders: current.orders.filter((order) => order.storeId !== targetStoreId),
      users: current.users.map((user) => {
        const memberships = { ...(user.memberships ?? {}) };
        const storeRoles = { ...(user.storeRoles ?? {}) };
        delete memberships[targetStoreId];
        delete storeRoles[targetStoreId];
        const storeIds = (user.storeIds ?? []).filter((id) => id !== targetStoreId);
        return user.storeId === targetStoreId || user.storeIds?.includes(targetStoreId) ? { ...user, storeId: user.storeId === targetStoreId ? storeIds[0] ?? null : user.storeId, storeIds, memberships, storeRoles } : user;
      })
    }));
  }

  function createMockOrder(targetStoreId: string) {
    const availableProducts = db.products.filter((product) => product.storeId === targetStoreId && product.isAvailable && !product.isSoldOut);
    if (availableProducts.length === 0) return null;

    const count = Math.min(3, Math.max(1, Math.floor(Math.random() * 4)));
    const selected = [...availableProducts].sort(() => Math.random() - 0.5).slice(0, count);
    const mode = Math.random() > 0.35 ? "dine-in" : "takeout";
    const tableNo = mode === "takeout" ? "憭葆" : String(Math.floor(Math.random() * 12) + 1);
    const items = selected.map((product) => {
      const quantity = Math.floor(Math.random() * 2) + 1;
      return {
        id: "",
        orderId: "",
        storeId: targetStoreId,
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: productFinalPrice(product),
        originalPrice: product.price,
        discountType: product.discountType ?? "none",
        discountValue: Number(product.discountValue ?? 0),
        finalPrice: productFinalPrice(product),
        selectedOptions: optionDefaults(product),
        note: Math.random() > 0.7 ? "撠" : ""
      };
    });
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    return createOrder({
      storeId: targetStoreId,
      mode,
      tableNo,
      customerNote: Math.random() > 0.65 ? "頞???雓?" : "",
      total,
      items
    });
  }

  async function seedDemoData() {
    if (!firestore) return;
    const db = firestore;
    await Promise.all([
      ...initialData.stores.map((item) => setDoc(doc(db, "stores", item.id), item, { merge: true })),
      ...initialData.categories.map((item) => setDoc(doc(db, "categories", item.id), item, { merge: true })),
      ...initialData.products.map((item) => setDoc(doc(db, "products", item.id), item, { merge: true })),
      ...initialData.orders.map((item) => setDoc(doc(db, "stores", item.storeId, "orders", item.id), item, { merge: true })),
      ...(initialData.cashFlows ?? []).map((item) => setDoc(doc(db, "cashFlows", item.id), item, { merge: true })),
      ...(initialData.cashFlowItems ?? []).map((item) => setDoc(doc(db, "cashFlowItems", item.id), item, { merge: true })),
      ...(initialData.promotions ?? []).map((item) => setDoc(doc(db, "promotions", item.id), item, { merge: true }))
    ]);
  }

  async function updateStoreSubscription(
    targetStoreId: string,
    patch: {
      subscriptionStatus?: SubscriptionStatus;
      subscriptionStartsAt?: string;
      subscriptionEndsAt?: string;
      trialEndsAt?: string;
    }
  ) {
    if (useFirestore && firestore) {
      // Firestore rejects undefined values — strip them before writing
      const firestorePatch = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      );
      try {
        await updateDoc(doc(firestore, "stores", targetStoreId), firestorePatch);
      } catch (writeError) {
        setError(writeError instanceof Error ? writeError.message : "updateStoreSubscription failed");
        throw writeError;
      }
      return;
    }
    setDb((current) => ({
      ...current,
      stores: current.stores.map((s) =>
        s.id !== targetStoreId ? s : { ...s, ...patch }
      )
    }));
  }

  async function updateUserStoreAccess(
    email: string,
    targetStoreId: string,
    access: Partial<StoreUserAccess>
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !targetStoreId) return;

    if (useFirestore && firestore) {
      const cleanAccess = Object.fromEntries(
        Object.entries(access).filter(([, v]) => v !== undefined)
      );
      try {
        const usersSnap = await getDocs(query(collection(firestore, "users"), where("email", "==", normalizedEmail)));
        if (!usersSnap.empty) {
          await updateDoc(usersSnap.docs[0].ref, { [`storeAccess.${targetStoreId}`]: cleanAccess });
        }
      } catch (writeError) {
        setError(writeError instanceof Error ? writeError.message : "updateUserStoreAccess failed");
        throw writeError;
      }
      return;
    }

    setDb((current) => ({
      ...current,
      users: current.users.map((u) =>
        u.email.toLowerCase() !== normalizedEmail
          ? u
          : {
              ...u,
              storeAccess: {
                ...(u.storeAccess ?? {}),
                [targetStoreId]: access
              }
            }
      )
    }));
  }

  async function updateUserGlobalAccess(
    userId: string,
    patch: { accessEndsAt?: string; accessStatus?: AccessStatus }
  ) {
    if (useFirestore && firestore) {
      const cleanPatch = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      );
      try {
        await updateDoc(doc(firestore, "users", userId), cleanPatch);
      } catch (writeError) {
        setError(writeError instanceof Error ? writeError.message : "updateUserGlobalAccess failed");
        throw writeError;
      }
      return;
    }
    setDb((current) => ({
      ...current,
      users: current.users.map((u) => (u.id !== userId ? u : { ...u, ...patch }))
    }));
  }

  async function updateUserStorePermissions(email: string, targetStoreId: string, permissions: Partial<UserPermissions>) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !targetStoreId) return;

    if (useFirestore && firestore) {
      try {
        const usersSnap = await getDocs(query(collection(firestore, "users"), where("email", "==", normalizedEmail)));
        if (!usersSnap.empty) {
          await updateDoc(usersSnap.docs[0].ref, { [`storePermissions.${targetStoreId}`]: permissions });
        }
      } catch (writeError) {
        console.error("updateUserStorePermissions failed", writeError);
        setError(writeError instanceof Error ? writeError.message : "updateUserStorePermissions failed");
        throw writeError;
      }
      return;
    }

    setDb((current) => ({
      ...current,
      users: current.users.map((u) =>
        u.email.toLowerCase() !== normalizedEmail
          ? u
          : {
              ...u,
              storePermissions: {
                ...(u.storePermissions ?? {}),
                [targetStoreId]: permissions
              }
            }
      )
    }));
  }

  async function saveDailyReport(report: DailyReport) {
    if (firebaseEnabled && firestore) {
      await setDoc(doc(firestore, "dailyReports", report.id), report);
    } else {
      setDb((prev) => {
        const existing = (prev.dailyReports ?? []).filter((r) => r.id !== report.id);
        const updated = { ...prev, dailyReports: [...existing, report] };
        saveLocalData(updated);
        return updated;
      });
    }
  }

  async function createCustomer(data: { storeId: string; name: string; phone: string; email?: string; birthday?: string; note?: string; createdBy?: string }): Promise<Customer> {
    const now = new Date().toISOString();
    const allCustomers = db.customers ?? [];
    const memberNo = generateMemberNo(allCustomers.filter((c) => c.storeId === data.storeId));
    const id = useFirestore && firestore ? doc(collection(firestore, "stores", data.storeId, "members")).id : newId("cust");
    const customer: Customer = stripUndefined({
      id,
      storeId: data.storeId,
      memberNo,
      name: data.name,
      phone: data.phone,
      email: data.email,
      birthday: data.birthday,
      note: data.note,
      points: 0,
      storedValueBalance: 0,
      balance: 0,
      totalSpent: 0,
      totalOrders: 0,
      createdAt: now,
      updatedAt: now
    });
    if (useFirestore && firestore) {
      await setDoc(doc(firestore, "stores", data.storeId, "members", id), customer);
      setDb((current) => ({ ...current, customers: [customer, ...(current.customers ?? [])] }));
      return customer;
    }
    setDb((current) => ({ ...current, customers: [customer, ...(current.customers ?? [])] }));
    return customer;
  }

  async function updateCustomer(customerId: string, patch: Partial<Pick<Customer, "name" | "phone" | "email" | "birthday">>) {
    const now = new Date().toISOString();
    const cleanPatch = { ...stripUndefined(patch), updatedAt: now };
    if (useFirestore && firestore) {
      const customer = (db.customers ?? []).find((item) => item.id === customerId);
      if (!customer?.storeId) throw new Error("找不到會員所屬店家，無法更新會員。");
      await updateDoc(doc(firestore, "stores", customer.storeId, "members", customerId), cleanPatch);
      setDb((current) => ({ ...current, customers: (current.customers ?? []).map((c) => c.id === customerId ? { ...c, ...cleanPatch } : c) }));
      return;
    }
    setDb((current) => ({ ...current, customers: (current.customers ?? []).map((c) => c.id === customerId ? { ...c, ...cleanPatch } : c) }));
  }

  function lookupCustomerByPhone(phone: string, targetStoreId: string): Customer | undefined {
    return (db.customers ?? []).find((c) => c.storeId === targetStoreId && c.phone === phone.trim());
  }

  function lookupCustomerByMemberNo(memberNo: string, targetStoreId: string): Customer | undefined {
    const value = memberNo.trim();
    return (db.customers ?? []).find((c) => c.storeId === targetStoreId && (c.id === value || c.memberNo === value.toUpperCase()));
  }

  async function adjustCustomerPoints(params: {
    customerId: string;
    storeId: string;
    type: PointLogType;
    points: number;
    orderId?: string;
    note?: string;
    createdBy?: string;
  }) {
    const now = new Date().toISOString();
    const id = useFirestore && firestore ? doc(collection(firestore, "pointLogs")).id : newId("pl");
    const log: PointLog = stripUndefined({
      id,
      storeId: params.storeId,
      customerId: params.customerId,
      type: params.type,
      points: params.points,
      orderId: params.orderId,
      note: params.note,
      createdAt: now,
      createdBy: params.createdBy
    });
    const customer = (db.customers ?? []).find((c) => c.id === params.customerId);
    const beforePoints = customer?.points ?? 0;
    const newPoints = Math.max(0, beforePoints + params.points);
    const customerPatch = { points: newPoints, updatedAt: now };
    const transactionType: StoredValueLogType = params.points >= 0 ? "points_add" : "points_use";
    const pointTransaction: StoredValueLog = stripUndefined({
      id: `${id}-tx`,
      storeId: params.storeId,
      customerId: params.customerId,
      memberId: params.customerId,
      memberName: customer?.name,
      type: transactionType,
      amount: 0,
      beforeBalance: customer?.balance ?? customer?.storedValueBalance ?? 0,
      afterBalance: customer?.balance ?? customer?.storedValueBalance ?? 0,
      beforePoints,
      afterPoints: newPoints,
      orderId: params.orderId,
      note: params.note,
      createdAt: now,
      createdBy: params.createdBy
    });

    if (useFirestore && firestore) {
      await Promise.all([
        setDoc(doc(firestore, "pointLogs", id), log),
        setDoc(doc(firestore, "stores", params.storeId, "memberTransactions", pointTransaction.id), pointTransaction),
        updateDoc(doc(firestore, "stores", params.storeId, "members", params.customerId), customerPatch)
      ]);
      setDb((current) => ({
        ...current,
        pointLogs: [log, ...(current.pointLogs ?? [])],
        customers: (current.customers ?? []).map((c) => c.id === params.customerId ? { ...c, ...customerPatch } : c)
      }));
      return log;
    }
    setDb((current) => ({
      ...current,
      pointLogs: [log, ...(current.pointLogs ?? [])],
      customers: (current.customers ?? []).map((c) => c.id === params.customerId ? { ...c, ...customerPatch } : c)
    }));
    return log;
  }

  async function adjustStoredValue(params: {
    customerId: string;
    storeId: string;
    type: StoredValueLogType;
    amount: number;
    orderId?: string;
    note?: string;
    createdBy?: string;
  }) {
    const now = new Date().toISOString();
    const customer = (db.customers ?? []).find((c) => c.id === params.customerId);
    const beforeBalance = customer?.balance ?? customer?.storedValueBalance ?? 0;
    const afterBalance = Math.max(0, beforeBalance + params.amount);
    const id = useFirestore && firestore ? doc(collection(firestore, "stores", params.storeId, "memberTransactions")).id : newId("svl");
    const log: StoredValueLog = stripUndefined({
      id,
      storeId: params.storeId,
      customerId: params.customerId,
      memberId: params.customerId,
      memberName: customer?.name,
      type: params.type,
      amount: params.amount,
      beforeBalance,
      afterBalance,
      beforePoints: customer?.points ?? 0,
      afterPoints: customer?.points ?? 0,
      orderId: params.orderId,
      note: params.note,
      createdAt: now,
      createdBy: params.createdBy
    });
    const customerPatch = { storedValueBalance: afterBalance, balance: afterBalance, updatedAt: now };

    if (useFirestore && firestore) {
      await Promise.all([
        setDoc(doc(firestore, "stores", params.storeId, "memberTransactions", id), log),
        updateDoc(doc(firestore, "stores", params.storeId, "members", params.customerId), customerPatch)
      ]);
      setDb((current) => ({
        ...current,
        storedValueLogs: [log, ...(current.storedValueLogs ?? [])],
        customers: (current.customers ?? []).map((c) => c.id === params.customerId ? { ...c, ...customerPatch } : c)
      }));
      return log;
    }
    setDb((current) => ({
      ...current,
      storedValueLogs: [log, ...(current.storedValueLogs ?? [])],
      customers: (current.customers ?? []).map((c) => c.id === params.customerId ? { ...c, ...customerPatch } : c)
    }));
    return log;
  }

  async function updateCustomerOrderStats(customerId: string, orderTotal: number) {
    const now = new Date().toISOString();
    const customer = (db.customers ?? []).find((c) => c.id === customerId);
    if (!customer) return;
    const patch = {
      totalSpent: (customer.totalSpent ?? 0) + orderTotal,
      totalOrders: (customer.totalOrders ?? 0) + 1,
      lastOrderAt: now,
      updatedAt: now
    };
    if (useFirestore && firestore) {
      await updateDoc(doc(firestore, "stores", customer.storeId, "members", customerId), patch);
      setDb((current) => ({ ...current, customers: (current.customers ?? []).map((c) => c.id === customerId ? { ...c, ...patch } : c) }));
      return;
    }
    setDb((current) => ({ ...current, customers: (current.customers ?? []).map((c) => c.id === customerId ? { ...c, ...patch } : c) }));
  }

  function getCalculatePointsEarned(totalAmount: number, targetStoreId: string): number {
    const store = db.stores.find((s) => s.id === targetStoreId);
    return pointsFromRules(totalAmount, store?.memberRules) || calculatePointsEarned(totalAmount, store?.memberSettings);
  }

  async function loadMemberRules(targetStoreId: string): Promise<MemberRules> {
    if (useFirestore && firestore) {
      const snapshot = await getDoc(doc(firestore, "stores", targetStoreId, "settings", "memberRules"));
      if (snapshot.exists()) return { ...defaultMemberRules, ...snapshot.data() } as MemberRules;
    }
    return db.stores.find((store) => store.id === targetStoreId)?.memberRules ?? defaultMemberRules;
  }

  async function upsertMemberRules(targetStoreId: string, rules: MemberRules) {
    if (firebaseEnabled && firestore) {
      await setDoc(doc(firestore, "stores", targetStoreId, "settings", "memberRules"), { ...rules, updatedAt: new Date().toISOString() }, { merge: true });
      return;
    }
    setDb((current) => {
      const existing = (current.memberRules ?? []).find((r) => (r as MemberRules & { storeId?: string }).storeId === targetStoreId);
      if (existing) {
        return { ...current, memberRules: (current.memberRules ?? []).map((r) => (r as MemberRules & { storeId?: string }).storeId === targetStoreId ? { ...rules, storeId: targetStoreId } : r) };
      }
      return { ...current, memberRules: [...(current.memberRules ?? []), { ...rules, storeId: targetStoreId }] };
    });
  }

  /**
   * Mark records older than retentionMonths as archive-eligible.
   * Does NOT delete them. Collections: orders, cashFlows, pointLogs, storedValueLogs.
   */
  async function markRecordsForArchive(targetStoreId: string, retentionMonths = 6) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);
    const cutoffIso = cutoff.toISOString();
    const now = new Date().toISOString();

    if (useFirestore && firestore) {
      try {
        const collections = ["orders", "cashFlows", "pointLogs", "storedValueLogs"];
        await Promise.all(collections.map(async (col) => {
          const snap = await getDocs(query(
            collection(firestore!, col),
            where("storeId", "==", targetStoreId),
            where("createdAt", "<", cutoffIso)
          ));
          const batch = writeBatch(firestore!);
          snap.docs.forEach((d) => {
            if (!d.data().archiveEligible) {
              batch.update(d.ref, { archiveEligible: true, archivedAt: null });
            }
          });
          if (snap.docs.length > 0) await batch.commit();
        }));
      } catch (e) {
        console.warn("markRecordsForArchive failed", e);
      }
      return;
    }

    // Local mode: mark in-memory
    setDb((current) => ({
      ...current,
      orders: current.orders.map((o) =>
        o.storeId === targetStoreId && o.createdAt < cutoffIso && !o.archiveEligible
          ? { ...o, archiveEligible: true, archivedAt: null }
          : o
      ),
      cashFlows: (current.cashFlows ?? []).map((c) =>
        c.storeId === targetStoreId && c.createdAt < cutoffIso && !c.archiveEligible
          ? { ...c, archiveEligible: true, archivedAt: null }
          : c
      ),
      pointLogs: (current.pointLogs ?? []).map((l) =>
        l.storeId === targetStoreId && l.createdAt < cutoffIso && !l.archiveEligible
          ? { ...l, archiveEligible: true, archivedAt: null }
          : l
      ),
      storedValueLogs: (current.storedValueLogs ?? []).map((l) =>
        l.storeId === targetStoreId && l.createdAt < cutoffIso && !l.archiveEligible
          ? { ...l, archiveEligible: true, archivedAt: null }
          : l
      )
    }));
    void now; // suppress unused warning
  }

  async function updateDailyReportBackup(
    reportId: string,
    patch: { backupDownloaded?: boolean; backupDownloadedAt?: string; backupFilesGenerated?: boolean; backupFileTypes?: string[]; retentionNoticeShown?: boolean }
  ) {
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (firebaseEnabled && firestore) {
      try {
        await updateDoc(doc(firestore, "dailyReports", reportId), cleanPatch);
      } catch (e) {
        console.warn("updateDailyReportBackup failed", e);
      }
      return;
    }
    setDb((current) => ({
      ...current,
      dailyReports: (current.dailyReports ?? []).map((r) => r.id === reportId ? { ...r, ...cleanPatch } : r)
    }));
  }

  async function markNotificationRead(notifId: string) {
    if (useFirestore && firestore) {
      try {
        await updateDoc(doc(firestore, "platformNotifications", notifId), { read: true });
      } catch (writeError) {
        setError(writeError instanceof Error ? writeError.message : "markNotificationRead failed");
        throw writeError;
      }
      return;
    }
    setDb((current) => ({
      ...current,
      platformNotifications: (current.platformNotifications ?? []).map((n) =>
        n.id === notifId ? { ...n, read: true } : n
      ),
    }));
  }

  async function loadDailyReport(reportStoreId: string, date: string): Promise<DailyReport | null> {
    const reportId = `${reportStoreId}-${date}`;
    if (firebaseEnabled && firestore) {
      const snap = await getDoc(doc(firestore, "dailyReports", reportId));
      return snap.exists() ? (snap.data() as DailyReport) : null;
    }
    return (db.dailyReports ?? []).find((r) => r.id === reportId) ?? null;
  }

  return {
    db,
    todayOrders,
    todayCashFlows,
    ready,
    error,
    usingFirestore: useFirestore,
    createMockOrder,
    createCashFlow,
    createOrder,
    upsertCashFlowItem,
    upsertPromotion,
    deletePromotion,
    deleteProduct,
    deleteStoreCascade,
    resetDemo,
    seedDemoData,
    importBreakfastMenu,
    bindStoreUser,
    deleteDevice,
    deleteTable,
    unbindStoreUser,
    updateOrderStatus,
    rejectOrder,
    upsertCategory,
    upsertProduct,
    upsertStore,
    upsertDevice,
    upsertTable,
    saveDailyReport,
    loadDailyReport,
    updateUserStorePermissions,
    updateStoreSubscription,
    updateUserStoreAccess,
    updateUserGlobalAccess,
    markNotificationRead,
    createCustomer,
    updateCustomer,
    lookupCustomerByPhone,
    lookupCustomerByMemberNo,
    adjustCustomerPoints,
    adjustStoredValue,
    updateCustomerOrderStats,
    getCalculatePointsEarned,
    loadMemberRules,
    upsertMemberRules,
    markRecordsForArchive,
    updateDailyReportBackup,
    upsertSharedOptionGroup,
    deleteSharedOptionGroup,
  };
}

