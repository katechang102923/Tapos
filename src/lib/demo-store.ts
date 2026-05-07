"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { initialData } from "./mock-data";
import { firebaseEnabled, firestore } from "./firebase";
import type { Category, DemoDatabase, Order, OrderStatus, Product, Store } from "./types";

const storageKey = "light-qr-ordering-demo-db-v2";
const syncEventName = "light-qr-ordering-db-updated";

type StoreOptions = {
  storeId?: string;
  admin?: boolean;
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

function optionDefaults(product: Product) {
  return Object.fromEntries(product.options.map((option) => [option.name, option.values[0] ?? ""]));
}

function scopedQuery(collectionName: string, storeId?: string, admin?: boolean) {
  if (!firestore) return null;
  const ref = collection(firestore, collectionName);
  if (admin || !storeId || collectionName === "stores") return ref;
  return query(ref, where("storeId", "==", storeId));
}

export function useDemoStore(options: StoreOptions = {}) {
  const { storeId, admin = false } = options;
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

    const unsubscribers = ["categories", "products", "orders"].map((collectionName) => {
      const ref = scopedQuery(collectionName, storeId, admin);
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

    return () => {
      unsubStores();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [admin, storeId, useFirestore]);

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

  function createOrder(order: Omit<Order, "id" | "orderNumber" | "pickupNumber" | "status" | "createdAt" | "updatedAt">) {
    const createdAt = new Date().toISOString();
    const sequence = db.orders.length + 1;
    const pickupSequence = db.orders.filter((item) => new Date(item.createdAt).toDateString() === new Date().toDateString()).length + 1;
    const id = useFirestore && firestore ? doc(collection(firestore, "orders")).id : newId("o");
    const nextOrder: Order = {
      ...order,
      id,
      orderNumber: `A${String(sequence).padStart(3, "0")}`,
      pickupNumber: String(pickupSequence).padStart(3, "0"),
      status: "new",
      createdAt,
      updatedAt: createdAt,
      items: order.items.map((item) => ({
        ...item,
        id: item.id || newId("oi"),
        orderId: id
      }))
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
    resetDemo,
    seedDemoData,
    updateOrderStatus,
    upsertCategory,
    upsertProduct,
    upsertStore
  };
}
