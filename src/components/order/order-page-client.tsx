"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronLeft, Coffee, Minus, Plus, Search, Send, ShoppingCart, Sparkles } from "lucide-react";
import { useDemoStore } from "@/lib/demo-store";
import type { OrderItem, OrderMode, OrderStatus, Product } from "@/lib/types";

type CartLine = {
  product: Product;
  quantity: number;
  options: Record<string, string>;
  note: string;
};

type Combo = {
  id: string;
  name: string;
  description: string;
  priceAdd: number;
  drink: string;
};

const quickCategories = ["漢堡", "蛋餅", "飲料"];
const quickNotes = ["不要醬", "切邊", "加辣"];
const combos: Combo[] = [
  { id: "combo-a", name: "A 餐", description: "主餐 + 中杯紅茶", priceAdd: 25, drink: "中杯紅茶" },
  { id: "combo-b", name: "B 餐", description: "主餐 + 中杯奶茶", priceAdd: 35, drink: "中杯奶茶" }
];
const statusSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: "new", label: "已送出" },
  { status: "preparing", label: "製作中" },
  { status: "completed", label: "可取餐" }
];

function optionDefaults(product: Product) {
  return Object.fromEntries(product.options.map((option) => [option.name, option.values[0] ?? ""]));
}

function optionPrice(value: string) {
  return Number(value.match(/\+(\d+)/)?.[1] ?? 0);
}

function lineUnitPrice(line: CartLine) {
  return line.product.price + Object.values(line.options).reduce((sum, value) => sum + optionPrice(value), 0);
}

function statusRank(status: OrderStatus) {
  if (status === "completed") return 2;
  if (status === "preparing") return 1;
  return 0;
}

function isDrink(product: Product) {
  return /飲|茶|奶|咖啡|豆漿/.test(product.name);
}

export function OrderPageClient({ storeId }: { storeId: string }) {
  const { db, createOrder } = useDemoStore({ storeId });
  const [mode, setMode] = useState<OrderMode>("takeout");
  const [tableNo, setTableNo] = useState("1");
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerNote, setCustomerNote] = useState("");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [bumpProductId, setBumpProductId] = useState<string | null>(null);

  const store = db.stores.find((item) => item.id === storeId);
  const lastOrder = lastOrderId ? db.orders.find((order) => order.id === lastOrderId) ?? null : null;
  const categories = db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort);
  const allProducts = db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const hotProducts = allProducts.filter((product) => product.isAvailable && !product.isSoldOut && !isDrink(product)).slice(0, 4);
  const products = allProducts.filter((item) => {
    const category = categories.find((target) => target.id === item.categoryId);
    const categoryMatch = activeCategory === "all" || item.categoryId === activeCategory || category?.name === activeCategory;
    const queryMatch = `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase());
    return categoryMatch && queryMatch;
  });
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = useMemo(() => cart.reduce((sum, item) => sum + lineUnitPrice(item) * item.quantity, 0), [cart]);

  function addToCart(product: Product, patch?: Partial<CartLine>) {
    if (!store?.isOpen || product.isSoldOut || !product.isAvailable) return;
    const line: CartLine = {
      product,
      quantity: 1,
      options: optionDefaults(product),
      note: "",
      ...patch
    };
    setCart((current) => [...current, line]);
    setBumpProductId(product.id);
    window.setTimeout(() => setBumpProductId(null), 260);
  }

  function addCombo(product: Product, combo: Combo) {
    addToCart(product, {
      options: {
        ...optionDefaults(product),
        套餐: `${combo.name} +${combo.priceAdd}`,
        飲料: combo.drink
      }
    });
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function productCartQuantity(productId: string) {
    return cart.filter((line) => line.product.id === productId).reduce((sum, line) => sum + line.quantity, 0);
  }

  function submitOrder() {
    if (cart.length === 0 || !store?.isOpen) return;
    const order = createOrder({
      storeId,
      mode,
      tableNo: mode === "takeout" ? "外帶" : tableNo,
      customerNote,
      total,
      items: cart.map<OrderItem>((line) => ({
        id: "",
        orderId: "",
        storeId,
        productId: line.product.id,
        productName: line.product.name,
        quantity: line.quantity,
        unitPrice: lineUnitPrice(line),
        selectedOptions: line.options,
        note: line.note
      }))
    });
    setLastOrderId(order.id);
    setCart([]);
    setCustomerNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!store) return <div className="p-8 text-center text-steel">找不到店家資料</div>;

  return (
    <main className="min-h-screen bg-[#fff7e8] pb-32 lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="grid size-12 place-items-center rounded-lg bg-orange-50 text-ink">
            <ChevronLeft className="size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black text-ink">{store.name}</p>
            <p className={`text-base font-black ${store.isOpen ? "text-leaf" : "text-tomato"}`}>{store.isOpen ? "營業中，掃碼直接點" : "休息中，暫停接單"}</p>
          </div>
          <div className="rounded-lg bg-tomato px-4 py-3 text-base font-black text-white">{mode === "takeout" ? "外帶" : `${tableNo} 桌`}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-4 lg:grid-cols-[1fr_410px]">
        <section className="min-w-0">
          <div className="overflow-hidden rounded-lg bg-white shadow-soft">
            <div className="relative h-44 bg-ink sm:h-56">
              <img src={store.bannerUrl || store.logoUrl} alt={store.name} className="h-full w-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-sm font-black text-white/80">早餐快速點餐</p>
                <h1 className="text-4xl font-black">{store.name}</h1>
                <p className="mt-2 text-base font-bold text-white/90">{store.temporaryNotice || store.notice || "尖峰時段餐點約需 10-15 分鐘。"}</p>
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
              <input value={tableNo} onChange={(event) => setTableNo(event.target.value)} disabled={mode === "takeout"} placeholder="桌號" className="rounded-lg border border-orange-200 bg-white px-4 py-4 text-xl font-black disabled:bg-stone-100" />
            </div>
          </div>

          {lastOrder && (
            <div className="animate-success-pop mt-4 rounded-lg border-2 border-leaf bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-base font-black text-leaf"><CheckCircle2 className="size-5" />訂單已送出</p>
                  <p className="text-5xl font-black text-ink">取餐號 {lastOrder.pickupNumber}</p>
                </div>
                <div className="grid size-16 place-items-center rounded-full bg-leaf text-white"><Check className="size-8" /></div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {statusSteps.map((step, index) => {
                  const done = statusRank(lastOrder.status) >= index;
                  return <div key={step.status} className={`rounded-lg px-3 py-4 text-center text-base font-black ${done ? "bg-leaf text-white" : "bg-stone-100 text-stone-400"}`}>{step.label}</div>;
                })}
              </div>
            </div>
          )}

          <div className="sticky top-[73px] z-30 mt-4 space-y-3 bg-[#fff7e8] py-3">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-stone-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋漢堡、蛋餅、奶茶" className="w-full rounded-lg border border-orange-100 bg-white py-5 pl-13 pr-4 text-xl font-black shadow-sm outline-none focus:border-tomato" />
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {["all", ...quickCategories, ...categories.map((item) => item.name).filter((name) => !quickCategories.includes(name))].map((name) => (
                <button key={name} onClick={() => setActiveCategory(name)} className={`shrink-0 rounded-lg px-6 py-4 text-lg font-black ${activeCategory === name ? "bg-ink text-white" : "bg-white text-steel shadow-sm"}`}>
                  {name === "all" ? "全部" : name}
                </button>
              ))}
            </div>
          </div>

          {!query && activeCategory === "all" && (
            <section className="mb-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-6 text-tomato" />
                <h2 className="text-2xl font-black text-ink">熱門套餐</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {hotProducts.map((product) => (
                  <article key={product.id} className="overflow-hidden rounded-lg bg-white shadow-sm">
                    <img src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full object-cover" />
                    <div className="p-3">
                      <p className="text-lg font-black text-ink">{product.name}</p>
                      <div className="mt-3 grid gap-2">
                        {combos.map((combo) => (
                          <button key={combo.id} onClick={() => addCombo(product, combo)} className="rounded-lg bg-tomato px-3 py-3 text-base font-black text-white">
                            {combo.name} ${product.price + combo.priceAdd}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const disabled = !store.isOpen || !product.isAvailable || product.isSoldOut;
              const quantity = productCartQuantity(product.id);
              return (
                <article key={product.id} className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${disabled ? "border-stone-200 opacity-60 grayscale" : "border-orange-100"} ${bumpProductId === product.id ? "animate-add-bump" : ""}`}>
                  <div className="relative">
                    <img src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full object-cover" />
                    {product.isSoldOut && <div className="absolute inset-0 grid place-items-center bg-black/55"><span className="rounded-lg bg-white px-5 py-3 text-xl font-black text-ink">售完</span></div>}
                    {quantity > 0 && <div className="absolute right-3 top-3 rounded-full bg-tomato px-3 py-1 text-sm font-black text-white">已選 {quantity}</div>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-black text-ink">{product.name}</h2>
                        <p className="mt-1 min-h-11 text-base leading-6 text-steel">{product.description}</p>
                      </div>
                      <p className="shrink-0 text-2xl font-black text-tomato">${product.price}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button onClick={() => addToCart(product)} disabled={disabled} className="rounded-lg bg-ink px-2 py-4 text-base font-black text-white disabled:bg-stone-300"><Plus className="mx-auto size-5" />加入</button>
                      {!isDrink(product) && <button onClick={() => addToCart(product, { options: { ...optionDefaults(product), 加料: "加蛋 +15" } })} disabled={disabled} className="rounded-lg bg-orange-100 px-2 py-4 text-base font-black text-ink disabled:bg-stone-200">加蛋</button>}
                      {!isDrink(product) && <button onClick={() => addToCart(product, { options: { ...optionDefaults(product), 加料: "加起司 +10" } })} disabled={disabled} className="rounded-lg bg-orange-100 px-2 py-4 text-base font-black text-ink disabled:bg-stone-200">起司</button>}
                    </div>
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
            <span className="flex items-center gap-2 text-xl font-black"><ShoppingCart className="size-6" />購物車 {totalQuantity} 項</span>
            <span className="text-2xl font-black">${total}</span>
          </summary>
          <div className="max-h-[66vh] overflow-y-auto pt-3">
            <CartPanel cart={cart} customerNote={customerNote} setCustomerNote={setCustomerNote} submitOrder={submitOrder} total={total} updateLine={updateLine} setCart={setCart} canSubmit={store.isOpen && cart.length > 0} />
          </div>
        </details>
      </div>
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
      <h2 className="flex items-center gap-2 text-2xl font-black text-ink"><ShoppingCart className="size-6" />訂單內容</h2>
      {cart.length === 0 ? (
        <p className="mt-4 rounded-lg bg-orange-50 p-5 text-center text-lg font-black text-steel">請先選擇餐點</p>
      ) : (
        <div className="mt-4 space-y-3">
          {cart.map((line, index) => (
            <div key={`${line.product.id}-${index}`} className="rounded-lg border border-orange-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-ink">{line.product.name}</p>
                  <p className="text-sm font-semibold text-tomato">${lineUnitPrice(line)}</p>
                </div>
                <button onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid size-10 place-items-center rounded-lg bg-orange-50"><Minus className="size-5 text-tomato" /></button>
              </div>
              <div className="mt-3 grid gap-2">
                {line.product.options.map((option) => (
                  <label key={option.name} className="text-base font-bold text-steel">
                    {option.name}
                    <select value={line.options[option.name]} onChange={(event) => updateLine(index, { options: { ...line.options, [option.name]: event.target.value } })} className="mt-1 w-full rounded-lg border border-orange-100 px-3 py-4 text-lg font-semibold">
                      {option.values.map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                ))}
                {isDrink(line.product) && (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={line.options.甜度 ?? "正常糖"} onChange={(event) => updateLine(index, { options: { ...line.options, 甜度: event.target.value } })} className="rounded-lg border border-orange-100 px-3 py-4 font-black">
                      {["正常糖", "半糖", "微糖", "無糖"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <select value={line.options.冰塊 ?? "正常冰"} onChange={(event) => updateLine(index, { options: { ...line.options, 冰塊: event.target.value } })} className="rounded-lg border border-orange-100 px-3 py-4 font-black">
                      {["正常冰", "少冰", "去冰", "溫", "熱"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {quickNotes.map((note) => (
                    <button key={note} onClick={() => updateLine(index, { note: line.note.includes(note) ? line.note : `${line.note}${line.note ? "、" : ""}${note}` })} className="rounded-lg bg-orange-50 px-3 py-3 font-black text-ink">{note}</button>
                  ))}
                </div>
                <input value={line.note} onChange={(event) => updateLine(index, { note: event.target.value })} placeholder="其他備註" className="rounded-lg border border-orange-100 px-3 py-4 text-lg" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })} className="grid size-12 place-items-center rounded-lg bg-orange-50"><Minus className="size-6" /></button>
                    <span className="w-10 text-center text-2xl font-black">{line.quantity}</span>
                    <button onClick={() => updateLine(index, { quantity: line.quantity + 1 })} className="grid size-12 place-items-center rounded-lg bg-orange-50"><Plus className="size-6" /></button>
                  </div>
                  <p className="text-xl font-black text-ink">${lineUnitPrice(line) * line.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="整張訂單備註" className="mt-4 min-h-20 w-full rounded-lg border border-orange-100 px-3 py-4 text-lg" />
      <div className="mt-4 flex items-center justify-between text-2xl font-black"><span>合計</span><span>${total}</span></div>
      <button onClick={submitOrder} disabled={!canSubmit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-tomato px-4 py-5 text-xl font-black text-white disabled:bg-stone-300">
        <Send className="size-6" />送出訂單
      </button>
    </div>
  );
}
