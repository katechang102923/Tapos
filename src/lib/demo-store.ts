"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
import type { Category, DemoDatabase, Order, OrderItem, OrderPayload, OrderStatus, Product, Store, StoreMemberRole, User } from "./types";

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
  if (roles.includes("owner")) return "owner";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("staff")) return "staff";
  if (roles.includes("viewer")) return "viewer";
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
    const next: DemoDatabase = { stores: [], users: [], categories: [], products: [], orders: [] };
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

    const collectionNames = skipOrderList ? ["categories", "products"] : ["categories", "products", "orders"];
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

  function resetDemo() {
    setDb(initialData);
  }

  async function createOrder(order: OrderPayload) {
    const now = new Date();
    const createdAt = now.toISOString();
    const source = order.source ?? "qr";
    const id = useFirestore && firestore ? doc(collection(firestore, "orders")).id : newId("o");
    const buildOrder = (orderNumber: string): Order => ({
      ...order,
      id,
      orderNumber,
      pickupNumber: orderNumber,
      status: order.status ?? "pending",
      source,
      createdAt,
      updatedAt: createdAt,
      totalAmount: order.total,
      items: order.items.map((item) => ({
        ...item,
        id: item.id || newId("oi"),
        orderId: id
      })) as OrderItem[]
    });

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
        transaction.set(orderRef, createdOrder);
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

  async function bindStoreUser(email: string, targetStoreId: string, memberRole: StoreMemberRole) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !targetStoreId) return;

    function nextUser(user: User): User {
      const memberships = { ...(user.memberships ?? {}), [targetStoreId]: memberRole };
      const storeIds = Array.from(new Set([...(user.storeIds ?? []), targetStoreId]));
      return {
        ...user,
        email: normalizedEmail,
        storeId: user.storeId ?? targetStoreId,
        storeIds,
        memberships,
        role: user.role === "admin" ? "admin" : platformRoleFromMemberships(memberships),
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
            role: memberRole,
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
            pending: true,
            approved: false,
            status: "pending",
            createdAt: now,
            updatedAt: now
          }, { merge: true });
        }
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
      delete memberships[targetStoreId];
      const storeIds = (user.storeIds ?? []).filter((id) => id !== targetStoreId);
      return {
        ...user,
        storeId: user.storeId === targetStoreId ? storeIds[0] ?? null : user.storeId,
        storeIds,
        memberships,
        role: user.role === "admin" ? "admin" : platformRoleFromMemberships(memberships),
        updatedAt: new Date().toISOString()
      };
    }

    if (useFirestore && firestore) {
      try {
        const userRef = doc(firestore, "users", userId);
        const user = db.users.find((item) => item.id === userId);
        if (!user) return;
        await setDoc(userRef, nextUser(user), { merge: true });
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

        const relatedCollections = ["products", "categories", "orders"];
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
          delete memberships[targetStoreId];
          const storeIds = (user.storeIds ?? []).filter((id) => id !== targetStoreId);
          batch.update(ref, {
            storeId: user.storeId === targetStoreId ? storeIds[0] ?? null : user.storeId ?? null,
            storeIds,
            memberships,
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
        delete memberships[targetStoreId];
        const storeIds = (user.storeIds ?? []).filter((id) => id !== targetStoreId);
        return user.storeId === targetStoreId || user.storeIds?.includes(targetStoreId) ? { ...user, storeId: user.storeId === targetStoreId ? storeIds[0] ?? null : user.storeId, storeIds, memberships } : user;
      })
    }));
  }

  function createMockOrder(targetStoreId: string) {
    const availableProducts = db.products.filter((product) => product.storeId === targetStoreId && product.isAvailable && !product.isSoldOut);
    if (availableProducts.length === 0) return null;

    const count = Math.min(3, Math.max(1, Math.floor(Math.random() * 4)));
    const selected = [...availableProducts].sort(() => Math.random() - 0.5).slice(0, count);
    const mode = Math.random() > 0.35 ? "dine-in" : "takeout";
    const tableNo = mode === "takeout" ? "外帶" : String(Math.floor(Math.random() * 12) + 1);
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
        note: Math.random() > 0.7 ? "少醬" : ""
      };
    });
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    return createOrder({
      storeId: targetStoreId,
      mode,
      tableNo,
      customerNote: Math.random() > 0.65 ? "趕時間，謝謝" : "",
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
      ...initialData.orders.map((item) => setDoc(doc(db, "orders", item.id), item, { merge: true }))
    ]);
  }

  return {
    db,
    todayOrders,
    ready,
    error,
    usingFirestore: useFirestore,
    createMockOrder,
    createOrder,
    deleteProduct,
    deleteStoreCascade,
    resetDemo,
    seedDemoData,
    importBreakfastMenu,
    bindStoreUser,
    unbindStoreUser,
    updateOrderStatus,
    rejectOrder,
    upsertCategory,
    upsertProduct,
    upsertStore
  };
}
