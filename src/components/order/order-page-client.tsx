"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { CheckCircle2, ChevronLeft, Minus, Plus, Search, Send, ShoppingCart } from "lucide-react";
import { ProductOptionModal } from "@/components/product-option-modal";
import { useDemoStore } from "@/lib/demo-store";
import { firebaseEnabled, firestore } from "@/lib/firebase";
import { selectionsTotal } from "@/lib/product-options";
import type { Order, OrderItem, OrderItemOption, OrderMode, OrderStatus, Product } from "@/lib/types";

type CartLine = {
  product: Product;
  quantity: number;
  selectedOptions: OrderItemOption[];
  note: string;
};

const statusSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: "pending", label: "等待接單" },
  { status: "accepted", label: "店家已接單" },
  { status: "cooking", label: "餐點製作中" },
  { status: "ready", label: "可取餐" }
];

function lineUnitPrice(line: CartLine) {
  return line.product.price + selectionsTotal(line.selectedOptions);
}

function statusRank(status: OrderStatus) {
  if (status === "completed" || status === "ready") return 3;
  if (status === "cooking") return 2;
  if (status === "accepted") return 1;
  return 0;
}

function customerStatusMessage(status: OrderStatus, rejectReason?: string) {
  if (status === "accepted") return "店家已接單";
  if (status === "cooking") return "餐點製作中";
  if (status === "ready") return "可取餐";
  if (status === "completed") return "訂單已完成";
  if (status === "cancelled") return `店家已取消訂單${rejectReason ? `：${rejectReason}` : ""}`;
  return "等待店家接單";
}

export function OrderPageClient({ storeId, tableId }: { storeId: string; tableId?: string }) {
  const [customerSessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    const key = `qr-order-session-${storeId}`;
    const current = window.localStorage.getItem(key);
    if (current) return current;
    const next = `customer-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    window.localStorage.setItem(key, next);
    return next;
  });
  const { db, createOrder } = useDemoStore({ storeId, customerSessionId, skipOrderList: true });
  const [mode, setMode] = useState<OrderMode>(tableId ? "dine-in" : "takeout");
  const [tableNo, setTableNo] = useState(tableId ?? "1");
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [choosingProduct, setChoosingProduct] = useState<Product | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

  const store = db.stores.find((item) => item.id === storeId);
  const lastOrder = trackedOrder ?? (lastOrderId ? db.orders.find((order) => order.id === lastOrderId) ?? null : null);
  const categories = db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort);
  const products = db.products
    .filter((item) => item.storeId === storeId)
    .filter((item) => activeCategory === "all" || item.categoryId === activeCategory)
    .filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.sort - b.sort);

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = useMemo(() => cart.reduce((sum, item) => sum + lineUnitPrice(item) * item.quantity, 0), [cart]);

  useEffect(() => {
    if (!lastOrderId || !firebaseEnabled || !firestore) return;
    return onSnapshot(doc(firestore, "orders", lastOrderId), (snapshot) => {
      if (snapshot.exists()) setTrackedOrder({ id: snapshot.id, ...snapshot.data() } as Order);
    });
  }, [lastOrderId]);

  function addToCart(product: Product) {
    if (!store?.isOpen || product.isSoldOut || !product.isAvailable) return;
    setChoosingProduct(product);
  }

  function confirmProductOptions(selectedOptions: OrderItemOption[]) {
    if (!choosingProduct) return;
    setCart((current) => [...current, { product: choosingProduct, quantity: 1, selectedOptions, note: "" }]);
    setChoosingProduct(null);
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function submitOrder() {
    if (cart.length === 0 || !store?.isOpen) return;
    const order = createOrder({
      storeId,
      mode,
      tableNo: mode === "takeout" ? "外帶" : tableId ?? tableNo,
      customerSessionId,
      customerNote,
      total,
      source: "qr",
      items: cart.map<OrderItem>((line) => ({
        id: "",
        orderId: "",
        storeId,
        productId: line.product.id,
        productName: line.product.name,
        quantity: line.quantity,
        unitPrice: lineUnitPrice(line),
        selectedOptions: line.selectedOptions,
        note: line.note
      }))
    });
    setLastOrderId(order.id);
    setTrackedOrder(order);
    setCart([]);
    setCustomerNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!store) return <div className="p-8 text-center text-steel">找不到店家</div>;

  return (
    <main className="min-h-screen bg-[#fff7e8] pb-32 lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="grid size-12 place-items-center rounded-lg bg-orange-50 text-ink">
            <ChevronLeft className="size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black text-ink">{store.name}</p>
            <p className={`text-base font-black ${store.isOpen ? "text-leaf" : "text-tomato"}`}>{store.isOpen ? "營業中" : "休息中"}</p>
          </div>
          <div className="rounded-lg bg-tomato px-4 py-3 text-base font-black text-white">{mode === "takeout" ? "外帶" : `${tableId ?? tableNo} 桌`}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-4 lg:grid-cols-[1fr_410px]">
        <section className="min-w-0">
          <div className="overflow-hidden rounded-lg bg-white shadow-soft">
            <div className="relative h-44 bg-ink sm:h-56">
              <img src={store.bannerUrl || store.logoUrl} alt={store.name} className="h-full w-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-sm font-black text-white/80">顧客 QR 點餐</p>
                <h1 className="text-4xl font-black">{store.name}</h1>
                <p className="mt-2 text-base font-bold text-white/90">{store.temporaryNotice || store.notice || "送出後請等待店家接單"}</p>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr]">
              <div className="grid grid-cols-2 rounded-lg bg-orange-50 p-1">
                {(["takeout", "dine-in"] as OrderMode[]).map((item) => (
                  <button key={item} onClick={() => setMode(item)} className={`rounded-md px-4 py-4 text-xl font-black ${mode === item ? "bg-white text-ink shadow-sm" : "text-steel"}`}>
                    {item === "dine-in" ? "內用" : "外帶"}
                  </button>
                ))}
              </div>
              <input value={tableId ?? tableNo} onChange={(event) => setTableNo(event.target.value)} disabled={mode === "takeout" || Boolean(tableId)} placeholder="桌號" className="rounded-lg border border-orange-200 bg-white px-4 py-4 text-xl font-black disabled:bg-stone-100" />
            </div>
          </div>

          {lastOrder && (
            <div className={`animate-success-pop mt-4 rounded-lg border-2 bg-white p-5 shadow-soft ${lastOrder.status === "cancelled" ? "border-tomato" : "border-leaf"}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={`flex items-center gap-2 text-base font-black ${lastOrder.status === "cancelled" ? "text-tomato" : "text-leaf"}`}>
                    <CheckCircle2 className="size-5" />
                    {customerStatusMessage(lastOrder.status, lastOrder.rejectReason)}
                  </p>
                  <p className="text-5xl font-black text-ink">取餐號 {lastOrder.pickupNumber}</p>
                  <p className="mt-1 font-mono text-sm font-bold text-steel">訂單號 {lastOrder.orderNumber}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2">
                {statusSteps.map((step, index) => {
                  const done = lastOrder.status !== "cancelled" && statusRank(lastOrder.status) >= index;
                  return <div key={step.status} className={`rounded-lg px-3 py-4 text-center text-base font-black ${done ? "bg-leaf text-white" : "bg-stone-100 text-stone-400"}`}>{step.label}</div>;
                })}
              </div>
              {lastOrder.status === "cancelled" && <p className="mt-3 rounded-lg bg-tomato/10 p-3 font-black text-tomato">取消原因：{lastOrder.rejectReason || "店家無法接單"}</p>}
            </div>
          )}

          <div className="sticky top-[73px] z-30 mt-4 space-y-3 bg-[#fff7e8] py-3">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-stone-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋餐點" className="w-full rounded-lg border border-orange-100 bg-white py-5 pl-13 pr-4 text-xl font-black shadow-sm outline-none focus:border-tomato" />
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {[{ id: "all", name: "全部" }, ...categories].map((category) => (
                <button key={category.id} onClick={() => setActiveCategory(category.id)} className={`shrink-0 rounded-lg px-6 py-4 text-lg font-black ${activeCategory === category.id ? "bg-ink text-white" : "bg-white text-steel shadow-sm"}`}>
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const disabled = !store.isOpen || !product.isAvailable || product.isSoldOut;
              return (
                <article key={product.id} className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${disabled ? "border-stone-200 opacity-60 grayscale" : "border-orange-100"}`}>
                  <div className="relative">
                    <img src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full object-cover" />
                    {product.isSoldOut && <div className="absolute inset-0 grid place-items-center bg-black/55"><span className="rounded-lg bg-white px-5 py-3 text-xl font-black text-ink">售完</span></div>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-black text-ink">{product.name}</h2>
                        <p className="mt-1 min-h-11 text-base leading-6 text-steel">{product.description}</p>
                      </div>
                      <p className="shrink-0 text-2xl font-black text-tomato">${product.price}</p>
                    </div>
                    <button onClick={() => addToCart(product)} disabled={disabled} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-4 text-base font-black text-white disabled:bg-stone-300">
                      <Plus className="size-5" />加入購物車
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="hidden lg:block lg:sticky lg:top-20 lg:h-fit">
          <CartPanel cart={cart} customerNote={customerNote} setCustomerNote={setCustomerNote} submitOrder={submitOrder} total={total} updateLine={updateLine} setCart={setCart} canSubmit={store.isOpen && cart.length > 0} />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white p-3 shadow-[0_-12px_30px_rgba(0,0,0,0.12)] lg:hidden">
        <details className="group mx-auto max-w-7xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg bg-ink px-4 py-5 text-white">
            <span className="flex items-center gap-2 text-xl font-black"><ShoppingCart className="size-6" />購物車 {totalQuantity} 件</span>
            <span className="text-2xl font-black">${total}</span>
          </summary>
          <div className="max-h-[66vh] overflow-y-auto pt-3">
            <CartPanel cart={cart} customerNote={customerNote} setCustomerNote={setCustomerNote} submitOrder={submitOrder} total={total} updateLine={updateLine} setCart={setCart} canSubmit={store.isOpen && cart.length > 0} />
          </div>
        </details>
      </div>
      {choosingProduct && <ProductOptionModal product={choosingProduct} onClose={() => setChoosingProduct(null)} onConfirm={confirmProductOptions} />}
    </main>
  );
}

function CartPanel({
  cart,
  customerNote,
  setCustomerNote,
  submitOrder,
  total,
  updateLine,
  setCart,
  canSubmit
}: {
  cart: CartLine[];
  customerNote: string;
  setCustomerNote: (value: string) => void;
  submitOrder: () => void;
  total: number;
  updateLine: (index: number, patch: Partial<CartLine>) => void;
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  canSubmit: boolean;
}) {
  return (
    <div className="rounded-lg border border-orange-100 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-2xl font-black text-ink"><ShoppingCart className="size-6" />購物車</h2>
      {cart.length === 0 ? (
        <p className="mt-4 rounded-lg bg-orange-50 p-5 text-center text-lg font-black text-steel">尚未選擇餐點</p>
      ) : (
        <div className="mt-4 space-y-3">
          {cart.map((line, index) => (
            <div key={`${line.product.id}-${index}`} className="rounded-lg border border-orange-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-ink">{line.product.name}</p>
                  <p className="text-sm font-semibold text-tomato">${lineUnitPrice(line)}</p>
                  {line.selectedOptions.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs font-bold text-steel">
                      {line.selectedOptions.map((option) => <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 14}px` }}>- {option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid size-10 place-items-center rounded-lg bg-orange-50"><Minus className="size-5 text-tomato" /></button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })} className="grid size-12 place-items-center rounded-lg bg-orange-50"><Minus className="size-6" /></button>
                  <span className="w-10 text-center text-2xl font-black">{line.quantity}</span>
                  <button onClick={() => updateLine(index, { quantity: line.quantity + 1 })} className="grid size-12 place-items-center rounded-lg bg-orange-50"><Plus className="size-6" /></button>
                </div>
                <p className="text-xl font-black text-ink">${lineUnitPrice(line) * line.quantity}</p>
              </div>
              <input value={line.note} onChange={(event) => updateLine(index, { note: event.target.value })} placeholder="品項備註" className="mt-3 w-full rounded-lg border border-orange-100 px-3 py-3" />
            </div>
          ))}
        </div>
      )}
      <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="訂單備註" className="mt-4 min-h-20 w-full rounded-lg border border-orange-100 px-3 py-4 text-lg" />
      <div className="mt-4 flex items-center justify-between text-2xl font-black"><span>總計</span><span>${total}</span></div>
      <button onClick={submitOrder} disabled={!canSubmit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-tomato px-4 py-5 text-xl font-black text-white disabled:bg-stone-300">
        <Send className="size-6" />送出訂單
      </button>
    </div>
  );
}
