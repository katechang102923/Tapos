"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Minus, Plus, Send, ShoppingCart, Store } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import type { OrderItem, OrderMode, Product } from "@/lib/types";

type CartLine = {
  product: Product;
  quantity: number;
  note: string;
  options: Record<string, string>;
};

function optionDefaults(product: Product) {
  return Object.fromEntries(product.options.map((option) => [option.name, option.values[0] ?? ""]));
}

export default function MerchantPosPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="POS 點餐登入">
      {({ profile }) => <MerchantPosContent storeId={profile?.storeId ?? ""} />}
    </LoginGate>
  );
}

function MerchantPosContent({ storeId }: { storeId: string }) {
  const { db, createOrder } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId);
  const categories = useMemo(
    () => db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort),
    [db.categories, storeId]
  );
  const products = useMemo(
    () => db.products.filter((item) => item.storeId === storeId && item.isAvailable && !item.isSoldOut).sort((a, b) => a.sort - b.sort),
    [db.products, storeId]
  );

  const [mode, setMode] = useState<OrderMode>("takeout");
  const [tableNo, setTableNo] = useState("1");
  const [customerNote, setCustomerNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderSuccess, setOrderSuccess] = useState<string>("");
  const [lastOrder, setLastOrder] = useState<{ orderNumber: string; pickupNumber: string; status: string } | null>(null);

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">請先完成店家設定</h1>
          <p className="mt-3 text-steel">POS 點餐需要先綁定店家。請至店家後台建立店家資料。</p>
        </div>
      </main>
    );
  }

  if (!store) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f4f2] font-black text-steel">載入店家資料...</div>;
  }

  const total = cart.reduce(
    (sum, line) =>
      sum + line.quantity * (line.product.price + Object.values(line.options).reduce((count, value) => count + Number(value.match(/\+(\d+)/)?.[1] ?? 0), 0)),
    0
  );

  function addToCart(product: Product) {
    setCart((current) => [
      ...current,
      {
        product,
        quantity: 1,
        note: "",
        options: optionDefaults(product)
      }
    ]);
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeLine(index: number) {
    setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function submitOrder() {
    if (cart.length === 0) return;
    const order = createOrder({
      storeId,
      mode,
      tableNo: mode === "takeout" ? "外帶" : tableNo,
      customerNote,
      total,
      source: "pos",
      status: "accepted",
      items: cart.map<OrderItem>((line) => ({
        id: "",
        orderId: "",
        storeId,
        productId: line.product.id,
        productName: line.product.name,
        quantity: line.quantity,
        unitPrice: line.product.price + Object.values(line.options).reduce((count, value) => count + Number(value.match(/\+(\d+)/)?.[1] ?? 0), 0),
        selectedOptions: line.options,
        note: line.note
      }))
    });

    setLastOrder({ orderNumber: order.orderNumber, pickupNumber: order.pickupNumber, status: order.status });
    setCart([]);
    setCustomerNote("");
    setOrderSuccess(`POS 訂單已建立，訂單號 ${order.orderNumber}`);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 rounded-lg bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-steel">POS 前台點餐</p>
            <h1 className="mt-2 text-3xl font-black text-ink">櫃台快速建立訂單</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-steel">店員可直接替客人點餐，支援內用桌號、外帶與備註，訂單會寫入同一批訂單資料。</p>
          </div>
          <Link href="/merchant" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
            <ArrowLeft className="size-4" /> 回店家後台
          </Link>
        </div>

        {orderSuccess && (
          <div className="mb-5 rounded-lg border border-leaf/30 bg-leaf/10 p-5 text-leaf">
            <p className="font-black">{orderSuccess}</p>
            {lastOrder && <p className="mt-2 text-sm">取餐號：{lastOrder.pickupNumber}，狀態：{lastOrder.status}</p>}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.95fr]">
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap gap-2">
              <button onClick={() => setMode("takeout")} className={`rounded-lg px-4 py-3 font-black ${mode === "takeout" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>外帶</button>
              <button onClick={() => setMode("dine-in")} className={`rounded-lg px-4 py-3 font-black ${mode === "dine-in" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>內用</button>
            </div>
            {mode === "dine-in" && (
              <div className="mb-5 rounded-lg border border-orange-100 bg-orange-50 p-4">
                <label className="block text-sm font-black text-steel">桌號</label>
                <input value={tableNo} onChange={(event) => setTableNo(event.target.value)} placeholder="桌號" className="mt-2 w-full rounded-lg border border-orange-200 bg-white px-4 py-3 text-lg font-bold" />
              </div>
            )}
            <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="訂單備註" className="mb-5 min-h-[120px] w-full rounded-lg border border-orange-200 bg-white px-4 py-4 text-lg font-bold" />

            <div className="mb-5 rounded-lg bg-[#f8faf5] p-4">
              <p className="font-black text-ink">店家：{store.name}</p>
              <p className="mt-2 text-sm text-steel">{store.notice || "請選擇商品並送出訂單。"}</p>
            </div>

            <div className="grid gap-4">
              {products.map((product) => (
                <div key={product.id} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex items-start gap-4">
                    <img src={product.imageUrl} alt={product.name} className="h-24 w-24 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-black text-ink">{product.name}</p>
                      <p className="mt-2 text-sm text-steel line-clamp-2">{product.description}</p>
                      <p className="mt-3 text-2xl font-black text-tomato">${product.price}</p>
                    </div>
                  </div>
                  <button onClick={() => addToCart(product)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
                    <ShoppingCart className="size-5" /> 加入購物車
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black text-ink">購物車</h2>
              {cart.length === 0 ? (
                <p className="mt-4 rounded-lg bg-orange-50 p-4 text-center text-sm font-black text-steel">尚未選擇商品</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {cart.map((line, index) => (
                    <div key={`${line.product.id}-${index}`} className="rounded-lg border border-orange-100 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-black text-ink">{line.product.name}</p>
                          <p className="mt-1 text-sm text-steel">${line.product.price} x {line.quantity}</p>
                        </div>
                        <button onClick={() => removeLine(index)} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">刪除</button>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"> <Minus className="size-4" /></button>
                        <span className="text-xl font-black">{line.quantity}</span>
                        <button onClick={() => updateLine(index, { quantity: line.quantity + 1 })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"> <Plus className="size-4" /></button>
                      </div>
                      <textarea value={line.note} onChange={(event) => updateLine(index, { note: event.target.value })} placeholder="品項備註" className="mt-4 w-full rounded-lg border border-orange-100 px-3 py-3 text-sm" />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 rounded-lg bg-orange-50 p-4 text-xl font-black text-ink">總計：${total}</div>
              <button onClick={submitOrder} disabled={cart.length === 0} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white disabled:opacity-60">
                <Send className="size-5" /> 送出訂單
              </button>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <p className="font-black text-ink">操作說明</p>
              <ul className="mt-3 space-y-2 text-sm text-steel">
                <li>內用時請填寫桌號。</li>
                <li>外帶訂單將自動標記為「外帶」。</li>
                <li>送出後訂單會直接變成已接單狀態。</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
