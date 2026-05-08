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
  setDoc,
  updateDoc,
  writeBatch,
  where
} from "firebase/firestore";
import { initialData } from "./mock-data";
import { firebaseEnabled, firestore } from "./firebase";
import { legacySelections } from "./product-options";
import type { Category, DemoDatabase, Order, OrderItem, OrderPayload, OrderStatus, Product, Store, User } from "./types";

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

function orderDayKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

    const storesRef = admin
      ? collection(firestore, "stores")
      : storeId
        ? query(collection(firestore, "stores"), where("__name__", "==", storeId))
        : collection(firestore, "stores");
    const unsubStores = onSnapshot(
      storesRef,
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

  function createOrder(order: OrderPayload) {
    const now = new Date();
    const createdAt = now.toISOString();
    const dayKey = orderDayKey(now);
    const sequence = db.orders.filter((item) => item.storeId === order.storeId && orderDayKey(new Date(item.createdAt)) === dayKey).length + 1;
    const id = useFirestore && firestore ? doc(collection(firestore, "orders")).id : newId("o");
    const orderNumber = String(sequence).padStart(3, "0");
    const nextOrder: Order = {
      ...order,
      id,
      orderNumber,
      pickupNumber: orderNumber,
      status: order.status ?? "pending",
      source: order.source ?? "qr",
      createdAt,
      updatedAt: createdAt,
      totalAmount: order.total,
      items: order.items.map((item) => ({
        ...item,
        id: item.id || newId("oi"),
        orderId: id
      })) as OrderItem[]
    };

    if (useFirestore && firestore) {
      setDoc(doc(firestore, "orders", id), nextOrder);
    } else {
      setDb((current) => ({ ...current, orders: [nextOrder, ...current.orders] }));
    }
    return nextOrder;
  }

  function updateOrderStatus(orderId: string, status: OrderStatus) {
    if (useFirestore && firestore) {
      updateDoc(doc(firestore, "orders", orderId), { status, updatedAt: new Date().toISOString() });
      return;
    }
    setDb((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
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

  async function deleteStoreCascade(targetStoreId: string) {
    if (useFirestore && firestore) {
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

      const linkedUsers = await getDocs(query(collection(db, "users"), where("storeId", "==", targetStoreId)));
      linkedUsers.docs.forEach((item) => batch.update(item.ref, { storeId: null }));
      await batch.commit();
      return;
    }

    setDb((current) => ({
      ...current,
      stores: current.stores.filter((store) => store.id !== targetStoreId),
      categories: current.categories.filter((category) => category.storeId !== targetStoreId),
      products: current.products.filter((product) => product.storeId !== targetStoreId),
      orders: current.orders.filter((order) => order.storeId !== targetStoreId),
      users: current.users.map((user) => (user.storeId === targetStoreId ? { ...user, storeId: null } : user))
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
        unitPrice: product.price,
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
    updateOrderStatus,
    rejectOrder,
    upsertCategory,
    upsertProduct,
    upsertStore
  };
}
