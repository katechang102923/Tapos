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
import { firebaseEnabled, firestore } from "./firebase";
import { createDefaultMenu } from "./menu-templates";
import { productFinalPrice } from "./pricing";
import { legacySelections } from "./product-options";
import type { AccessStatus, CashFlow, CashFlowItem, Category, DailyReport, DemoDatabase, Device, Order, OrderItem, OrderPayload, OrderStatus, Product, Promotion, Store, StoreMemberRole, StoreUserAccess, SubscriptionStatus, Table, User, UserPermissions } from "./types";

const storageKey = "light-qr-ordering-demo-db-v2";
const syncEventName = "light-qr-ordering-db-updated";

type StoreOptions = {
  storeId?: string;
  admin?: boolean;
  customerSessionId?: string;
  skipOrderList?: boolean;
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

function formatOrderNumber(source: "qr" | "pos", sequence: number) {
  return `${source === "pos" ? "P" : "Q"}${String(sequence).padStart(3, "0")}`;
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

function scopedQuery(collectionName: string, storeId?: string, admin?: boolean, customerSessionId?: string) {
  if (!firestore) return null;
  const ref = collection(firestore, collectionName);
  if (admin || !storeId || collectionName === "stores") return ref;
  if (collectionName === "orders" && customerSessionId) return query(ref, where("customerSessionId", "==", customerSessionId));
  return query(ref, where("storeId", "==", storeId));
}

export function useDemoStore(options: StoreOptions = {}) {
  const { storeId, admin = false, customerSessionId, skipOrderList = false } = options;
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
    const next: DemoDatabase = { stores: [], users: [], categories: [], products: [], orders: [], cashFlows: [], cashFlowItems: [], devices: [], tables: [], promotions: [] };
    const commit = () => {
      setDb({ ...next });
      setReady(true);
    };
    const handleError = (snapshotError: Error) => {
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
      : onSnapshot(
        collection(firestore, "stores"),
        (snapshot) => {
          next.stores = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Store);
        commit();
      },
      handleError
      );

    const collectionNames = skipOrderList ? ["categories", "products", "devices", "tables", "promotions"] : ["categories", "products", "orders", "cashFlows", "cashFlowItems", "devices", "tables", "promotions"];
    const unsubscribers = collectionNames.map((collectionName) => {
      const ref = scopedQuery(collectionName, storeId, admin, customerSessionId);
      if (!ref) return () => undefined;
      return onSnapshot(
        ref,
        (snapshot) => {
          (next as unknown as Record<string, unknown[]>)[collectionName] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
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

    return () => {
      unsubStores();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubUsers();
    };
  }, [admin, customerSessionId, skipOrderList, storeId, useFirestore]);

  useEffect(() => {
    if (!ready || useFirestore) return;
    saveLocalData(db);
  }, [db, ready, useFirestore]);

  const todayOrders = useMemo(() => {
    const today = new Date().toDateString();
    return db.orders.filter((order) => new Date(order.createdAt).toDateString() === today);
  }, [db.orders]);

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
    const id = useFirestore && firestore ? doc(collection(firestore, "orders")).id : newId("o");
    const buildOrder = (orderNumber: string): Order => stripUndefined({
      ...order,
      id,
      orderNumber,
      pickupNumber: orderNumber,
      status: blockReason ? "cancelled" : order.status ?? "pending",
      source,
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
      const orderRef = doc(db, "orders", id);
      const counterRef = doc(db, "counters", "orderNumbers");
      const counterKey = source === "pos" ? "pos" : "qr";
      const nextOrder = await runTransaction(db, async (transaction) => {
        const counterSnapshot = await transaction.get(counterRef);
        const counterData = counterSnapshot.exists() ? counterSnapshot.data() : {};
        const currentSequence = typeof counterData[counterKey] === "number" ? counterData[counterKey] : 1;
        const orderNumber = formatOrderNumber(source, currentSequence);
        const createdOrder = buildOrder(orderNumber);
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
      setDb((current) => ({
        ...current,
        orders: current.orders.map((order) => (order.id === orderId ? { ...order, status, updatedAt } : order))
      }));
      updateDoc(doc(firestore, "orders", orderId), { status, updatedAt }).catch((writeError: Error) => setError(writeError.message));
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
      updateDoc(doc(firestore, "orders", orderId), { status: "cancelled", rejectReason, updatedAt: new Date().toISOString() });
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
      ...initialData.orders.map((item) => setDoc(doc(db, "orders", item.id), item, { merge: true })),
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
    updateUserGlobalAccess
  };
}

