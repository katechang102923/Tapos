"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, Minus, Plus, ReceiptText, Send, ShoppingCart, Table2, TimerReset, XCircle } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductOptionModal } from "@/components/product-option-modal";
import { StatusPill } from "@/components/status-pill";
import { useDemoStore } from "@/lib/demo-store";
import { normalizeSelectedOptions, selectionsTotal } from "@/lib/product-options";
import type { Order, OrderItem, OrderItemOption, OrderMode, OrderStatus, Product } from "@/lib/types";

type CartLine = {
  product: Product;
  quantity: number;
  note: string;
  selectedOptions: OrderItemOption[];
};

const orderTabs: Array<{ key: "open" | "pending" | "cooking" | "completed"; label: string; statuses: OrderStatus[] }> = [
  { key: "open", label: "未處理", statuses: ["pending", "accepted"] },
  { key: "pending", label: "新訂單", statuses: ["pending"] },
  { key: "cooking", label: "處理中", statuses: ["cooking", "ready"] },
  { key: "completed", label: "已完成", statuses: ["completed"] }
];

export default function MerchantPosPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="POS 前台登入">
      {({ profile }) => <MerchantPosContent storeId={profile?.storeId ?? ""} />}
    </LoginGate>
  );
}

function MerchantPosContent({ storeId }: { storeId: string }) {
  const { db, createOrder, todayOrders, updateOrderStatus } = useDemoStore({ storeId });
  const store = db.stores.find((item) => item.id === storeId);
  const categories = useMemo(
    () => db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort),
    [db.categories, storeId]
  );
  const products = useMemo(
    () => db.products.filter((item) => item.storeId === storeId && item.isAvailable && !item.isSoldOut).sort((a, b) => a.sort - b.sort),
    [db.products, storeId]
  );

  const [activeOrderTab, setActiveOrderTab] = useState<(typeof orderTabs)[number]["key"]>("open");
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [mode, setMode] = useState<OrderMode>("takeout");
  const [tableNo, setTableNo] = useState("1");
  const [customerNote, setCustomerNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [choosingProduct, setChoosingProduct] = useState<Product | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string>("");
  const [lastOrder, setLastOrder] = useState<{ orderNumber: string; pickupNumber: string; status: string } | null>(null);

  const visibleProducts = activeCategoryId === "all" ? products : products.filter((product) => product.categoryId === activeCategoryId);
  const activeOrders = todayOrders.filter((order) => order.status !== "cancelled");
  const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.totalAmount ?? order.total), 0);
  const averageOrderValue = activeOrders.length ? Math.round(totalRevenue / activeOrders.length) : 0;
  const dineInCount = todayOrders.filter((order) => order.mode === "dine-in").length;
  const takeoutCount = todayOrders.filter((order) => order.mode === "takeout").length;
  const selectedOrderTab = orderTabs.find((tab) => tab.key === activeOrderTab) ?? orderTabs[0];
  const displayedOrders = todayOrders
    .filter((order) => selectedOrderTab.statuses.includes(order.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const ranking = useMemo(() => salesRanking(activeOrders).slice(0, 10), [activeOrders]);

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">請先完成店家設定</h1>
          <p className="mt-3 text-steel">POS 前台需要先綁定店家。請至店家後台建立店家資料。</p>
        </div>
      </main>
    );
  }

  if (!store) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f4f2] font-black text-steel">載入店家資料...</div>;
  }

  const total = cart.reduce((sum, line) => sum + line.quantity * (line.product.price + selectionsTotal(line.selectedOptions)), 0);

  function confirmProductOptions(selectedOptions: OrderItemOption[]) {
    if (!choosingProduct) return;
    setCart((current) => [...current, { product: choosingProduct, quantity: 1, note: "", selectedOptions }]);
    setChoosingProduct(null);
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
        unitPrice: line.product.price + selectionsTotal(line.selectedOptions),
        selectedOptions: line.selectedOptions,
        note: line.note
      }))
    });

    setLastOrder({ orderNumber: order.orderNumber, pickupNumber: order.pickupNumber, status: order.status });
    setCart([]);
    setCustomerNote("");
    setOrderSuccess(`POS 訂單已建立，訂單號 ${order.orderNumber}`);
  }

  return (
    <main className="min-h-screen bg-[#f5f3ee] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-5 flex flex-col gap-3 rounded-lg bg-[#171717] p-5 text-white shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-black text-white/55">POS 前台營運中心</p>
            <h1 className="mt-2 text-3xl font-black">{store.name} 今日工作台</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-white/65">接單、處理訂單、查看今日銷售，並保留櫃台快速建立訂單。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink">
              <ArrowLeft className="size-4" /> 回設定後台
            </Link>
            <Link href="/kds" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
              廚房 KDS
            </Link>
          </div>
        </header>

        {orderSuccess && (
          <div className="mb-5 rounded-lg border border-leaf/30 bg-leaf/10 p-5 text-leaf">
            <p className="font-black">{orderSuccess}</p>
            {lastOrder && <p className="mt-2 text-sm">取餐號：{lastOrder.pickupNumber}，狀態：{lastOrder.status}</p>}
          </div>
        )}

        <section className="mb-5 grid gap-4 md:grid-cols-4">
          <MetricCard icon={BarChart3} label="今日總營收" value={`$${totalRevenue}`} tone="text-tomato" />
          <MetricCard icon={ReceiptText} label="今日訂單數" value={activeOrders.length.toString()} />
          <MetricCard icon={ShoppingCart} label="平均客單價" value={`$${averageOrderValue}`} />
          <MetricCard icon={Table2} label="內用 / 外帶" value={`${dineInCount} / ${takeoutCount}`} tone="text-leaf" />
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(520px,0.95fr)_minmax(560px,1.05fr)_420px]">
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">接單進單</h2>
                <p className="mt-1 text-sm font-bold text-steel">新訂單、處理中與已完成訂單集中在這裡。</p>
              </div>
              <Clock3 className="size-7 text-tomato" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {orderTabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveOrderTab(tab.key)} className={`rounded-lg px-3 py-3 font-black ${activeOrderTab === tab.key ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {displayedOrders.length === 0 ? (
                <p className="rounded-lg bg-stone-50 p-5 text-center font-black text-steel">目前沒有此狀態訂單</p>
              ) : displayedOrders.map((order) => (
                <OrderWorkCard key={order.id} order={order} updateOrderStatus={updateOrderStatus} />
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">快速建立訂單</h2>
                <p className="mt-1 text-sm font-bold text-steel">櫃台、電話或現場客人可由店員直接建單。</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode("takeout")} className={`rounded-lg px-4 py-3 font-black ${mode === "takeout" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>外帶</button>
                <button onClick={() => setMode("dine-in")} className={`rounded-lg px-4 py-3 font-black ${mode === "dine-in" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>內用</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              {mode === "dine-in" && (
                <label className="grid gap-1 text-sm font-black text-steel">
                  桌號
                  <input value={tableNo} onChange={(event) => setTableNo(event.target.value)} placeholder="桌號" className="rounded-lg border border-orange-200 bg-white px-4 py-3 text-lg font-bold" />
                </label>
              )}
              <label className={`grid gap-1 text-sm font-black text-steel ${mode === "takeout" ? "sm:col-span-2" : ""}`}>
                訂單備註
                <input value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="例如：趕時間、分開裝" className="rounded-lg border border-orange-200 bg-white px-4 py-3 text-lg font-bold" />
              </label>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setActiveCategoryId("all")} className={`shrink-0 rounded-lg px-4 py-3 font-black ${activeCategoryId === "all" ? "bg-leaf text-white" : "bg-orange-50 text-steel"}`}>全部</button>
              {categories.map((category) => (
                <button key={category.id} onClick={() => setActiveCategoryId(category.id)} className={`shrink-0 rounded-lg px-4 py-3 font-black ${activeCategoryId === category.id ? "bg-leaf text-white" : "bg-orange-50 text-steel"}`}>{category.name}</button>
              ))}
            </div>

            <div className="mt-4 grid max-h-[620px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {visibleProducts.map((product) => (
                <button key={product.id} onClick={() => setChoosingProduct(product)} className="rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-leaf hover:bg-[#fbfff4]">
                  <div className="flex items-start gap-3">
                    <img src={product.imageUrl} alt={product.name} className="size-20 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black">{product.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-steel">{product.description}</p>
                      <p className="mt-2 text-xl font-black text-tomato">${product.price}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            <CartPanel cart={cart} total={total} updateLine={updateLine} removeLine={removeLine} submitOrder={submitOrder} />
            <section className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">今日商品銷售排行</h2>
              <div className="mt-4 space-y-3">
                {ranking.length === 0 ? <p className="rounded-lg bg-stone-50 p-4 text-sm font-black text-steel">尚無銷售資料</p> : ranking.map((item, index) => (
                  <div key={item.productId} className="flex items-center justify-between rounded-lg bg-[#fffaf0] px-4 py-3">
                    <div>
                      <p className="font-black">#{index + 1} {item.productName}</p>
                      <p className="text-sm font-bold text-steel">售出 {item.quantity} 份</p>
                    </div>
                    <p className="font-black text-tomato">${item.totalAmount}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {choosingProduct && <ProductOptionModal product={choosingProduct} onClose={() => setChoosingProduct(null)} onConfirm={confirmProductOptions} />}
    </main>
  );
}

function salesRanking(orders: Order[]) {
  const map = new Map<string, { productId: string; productName: string; quantity: number; totalAmount: number }>();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const current = map.get(item.productId) ?? { productId: item.productId, productName: item.productName, quantity: 0, totalAmount: 0 };
      current.quantity += item.quantity;
      current.totalAmount += item.quantity * item.unitPrice;
      map.set(item.productId, current);
    });
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

function MetricCard({ icon: Icon, label, value, tone = "text-ink" }: { icon: React.ElementType; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-steel">{label}</p>
        <Icon className="size-5 text-steel" />
      </div>
      <p className={`mt-3 text-4xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function OrderWorkCard({ order, updateOrderStatus }: { order: Order; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  return (
    <article className={`rounded-lg border p-4 ${order.status === "pending" ? "animate-order-pop border-tomato bg-tomato/5" : "border-stone-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-black">#{order.orderNumber}</p>
          <p className="mt-1 text-sm font-bold text-steel">{order.mode === "takeout" ? "外帶" : `內用 ${order.tableNo}`} · {new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <StatusPill status={order.status} />
      </div>
      <div className="mt-3 space-y-2 text-sm font-bold text-steel">
        {order.items.map((item) => {
          const selectedOptions = normalizeSelectedOptions(item.selectedOptions);
          return (
            <div key={item.id}>
              <p>{item.quantity} x {item.productName}</p>
              {selectedOptions.length > 0 && <div className="ml-3 mt-1 space-y-1 text-xs">{selectedOptions.map((option) => <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 12}px` }}>- {option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}</p>)}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-lg font-black text-tomato">總金額 ${order.totalAmount ?? order.total}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(order.status === "pending" || order.status === "accepted") && <button onClick={() => updateOrderStatus(order.id, "cooking")} className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 font-black text-amber-700"><TimerReset className="size-4" />製作中</button>}
        {(order.status === "cooking" || order.status === "ready") && <button onClick={() => updateOrderStatus(order.id, "completed")} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-3 py-2 font-black text-white"><CheckCircle2 className="size-4" />已完成</button>}
        {!["completed", "cancelled"].includes(order.status) && <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="inline-flex items-center gap-2 rounded-lg bg-tomato px-3 py-2 font-black text-white"><XCircle className="size-4" />取消</button>}
      </div>
    </article>
  );
}

function CartPanel({
  cart,
  total,
  removeLine,
  submitOrder,
  updateLine
}: {
  cart: CartLine[];
  total: number;
  removeLine: (index: number) => void;
  submitOrder: () => void;
  updateLine: (index: number, patch: Partial<CartLine>) => void;
}) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black">快速建單購物車</h2>
      {cart.length === 0 ? (
        <p className="mt-4 rounded-lg bg-orange-50 p-4 text-center text-sm font-black text-steel">尚未選擇商品</p>
      ) : (
        <div className="mt-4 space-y-4">
          {cart.map((line, index) => (
            <div key={`${line.product.id}-${index}`} className="rounded-lg border border-orange-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-ink">{line.product.name}</p>
                  <p className="mt-1 text-sm text-steel">${line.product.price + selectionsTotal(line.selectedOptions)} x {line.quantity}</p>
                  {line.selectedOptions.length > 0 && <div className="mt-2 space-y-1 text-xs font-bold text-steel">{line.selectedOptions.map((option) => <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 14}px` }}>- {option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}</p>)}</div>}
                </div>
                <button onClick={() => removeLine(index)} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">刪除</button>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"><Minus className="size-4" /></button>
                <span className="text-xl font-black">{line.quantity}</span>
                <button onClick={() => updateLine(index, { quantity: line.quantity + 1 })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"><Plus className="size-4" /></button>
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
    </section>
  );
}
