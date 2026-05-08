"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, ChefHat, Copy, Download, ExternalLink, Eye, EyeOff, Flame, ImagePlus, LayoutDashboard, Menu as MenuIcon, Plus, Power, PowerOff, QrCode, ReceiptText, RefreshCcw, Settings, ShoppingCart, Sparkles } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { StatusPill } from "@/components/status-pill";
import { useDemoStore } from "@/lib/demo-store";
import { getAppUrl } from "@/lib/app-url";
import type { Category, Product, Store, UserRole } from "@/lib/types";

const blankProduct: Product = {
  id: "new-product",
  storeId: "",
  categoryId: "cat-burger",
  name: "",
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  originalPrice: 70,
  price: 60,
  isAvailable: true,
  isSoldOut: false,
  sort: 99,
  options: [
    { name: "加料", values: ["不加", "加蛋 +15", "加起司 +10"] },
    { name: "醬料", values: ["正常", "少醬", "不加醬"] }
  ]
};

const imagePresets = [
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80"
];

function isDrinkName(name: string) {
  return /飲|茶|奶|咖啡|豆漿|紅茶|綠茶/.test(name);
}

type MerchantView = "dashboard" | "menu" | "orders" | "rankings";

export function MerchantDashboard({ view = "dashboard" }: { view?: MerchantView }) {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="店家後台登入">
      {({ profile, signOutUser }) => <MerchantDashboardContent role={profile?.role ?? "user"} storeId={profile?.storeId ?? ""} view={view} onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function MerchantDashboardContent({ storeId, role, view, onSignOut }: { storeId: string; role: UserRole; view: MerchantView; onSignOut: () => Promise<void> }) {
  const { db, todayOrders, createMockOrder, deleteProduct, rejectOrder, resetDemo, seedDemoData, updateOrderStatus, upsertCategory, upsertProduct, upsertStore } = useDemoStore({ storeId });
  const [editingProduct, setEditingProduct] = useState<Product>(blankProduct);
  const [categoryName, setCategoryName] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const previousPendingCount = useRef(0);

  const store = db.stores.find((item) => item.id === storeId);
  const categories = db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const products = db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const activeOrders = todayOrders.filter((order) => order.status !== "cancelled");
  const pendingOrders = todayOrders.filter((order) => order.status === "pending");
  const canManageStore = role === "merchant" || role === "admin";
  const orderUrl = `${getAppUrl()}/order/${storeId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(orderUrl)}`;
  const revenue = useMemo(() => activeOrders.reduce((sum, order) => sum + order.total, 0), [activeOrders]);
  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>();
    activeOrders.forEach((order) => {
      order.items.forEach((item) => {
        const current = map.get(item.productId) ?? { name: item.productName, quantity: 0, total: 0 };
        current.quantity += item.quantity;
        current.total += item.unitPrice * item.quantity;
        map.set(item.productId, current);
      });
    });
    return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  }, [activeOrders]);

  useEffect(() => {
    if (pendingOrders.length > previousPendingCount.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.value = 0.05;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.18);
        }
      } catch {
        // Audio can be blocked until the user interacts with the page.
      }
    }
    previousPendingCount.current = pendingOrders.length;
  }, [pendingOrders.length]);

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-leaf">首次登入</p>
          <h1 className="mt-2 text-3xl font-black text-ink">先建立店家</h1>
          <Link href="/onboarding" className="mt-5 inline-flex rounded-lg bg-leaf px-5 py-3 font-black text-white">開始建店</Link>
        </div>
      </main>
    );
  }

  function saveProduct() {
    if (!editingProduct.name.trim()) return;
    upsertProduct({
      ...editingProduct,
      id: editingProduct.id === "new-product" ? "" : editingProduct.id,
      storeId,
      price: Number(editingProduct.price),
      originalPrice: Number(editingProduct.originalPrice || editingProduct.price),
      sort: Number(editingProduct.sort) || products.length + 1,
      categoryId: editingProduct.categoryId || categories[0]?.id || "cat-burger"
    });
    setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 2 });
  }

  function startNewProduct() {
    setEditingProduct({ ...blankProduct, id: "new-product", storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 1 });
  }

  function removeEditingProduct() {
    if (!editingProduct.id || editingProduct.id === "new-product") return;
    if (!window.confirm(`確定要刪除「${editingProduct.name}」嗎？`)) return;
    deleteProduct(editingProduct.id);
    startNewProduct();
  }

  function addCategory() {
    if (!categoryName.trim()) return;
    upsertCategory({ id: "", storeId, name: categoryName.trim(), sort: categories.length + 1, isActive: true });
    setCategoryName("");
  }

  function updateStore(patch: Partial<Store>) {
    if (!store) return;
    upsertStore({ ...store, ...patch });
  }

  function saveNotice() {
    updateStore({ temporaryNotice: notice });
  }

  function copyOrderUrl() {
    navigator.clipboard?.writeText(orderUrl);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-orange-100 bg-[#171717] p-4 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-tomato"><ReceiptText className="size-5" /></div>
          <div>
            <p className="font-black">{store?.name ?? "餐飲店"}</p>
            <p className="text-xs font-bold text-white/55">店家管理後台</p>
          </div>
        </div>
        <nav className="mt-6 grid gap-2">
          <SidebarItem href="/merchant" icon={LayoutDashboard} label="總覽" active={view === "dashboard"} />
          <SidebarItem href="/merchant/menu" icon={MenuIcon} label="菜單管理" active={view === "menu"} />
          <SidebarItem href="/merchant/pos" icon={ShoppingCart} label="POS 點餐" />
          <SidebarItem href="/merchant/orders" icon={ReceiptText} label="訂單管理" active={view === "orders"} />
          <SidebarItem href="/merchant/rankings" icon={BarChart3} label="銷售排行" active={view === "rankings"} />
          <Link href="/merchant/qrcode" className="inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black text-white/70 hover:bg-white/10"><QrCode className="size-5" />QR Code 管理</Link>
          <Link href="/kds" className="inline-flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ChefHat className="size-5" />廚房 KDS</Link>
          {canManageStore && <Link href="/merchant/settings" className="inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black text-white/70 hover:bg-white/10"><Settings className="size-5" />店家設定</Link>}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-steel">店家後台：商品、訂單、QR Code 與 KDS 管理</p>
            <h1 className="text-3xl font-black text-ink">營業控制台</h1>
            {(store?.temporaryNotice || store?.notice) && <p className="mt-2 font-bold text-tomato">公告：{store.temporaryNotice || store.notice}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageStore && <button onClick={() => updateStore({ isOpen: !store?.isOpen })} className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-leaf" : "bg-tomato"}`}>{store?.isOpen ? <Power className="size-5" /> : <PowerOff className="size-5" />}{store?.isOpen ? "營業中" : "休息中"}</button>}
            {canManageStore && <button onClick={() => updateStore({ peakMode: !store?.peakMode })} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-black text-ink"><Flame className="size-5" />{store?.peakMode ? "尖峰模式中" : "尖峰模式"}</button>}
            <Link href={`/order/${storeId}`} target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><ExternalLink className="size-5" />預覽顧客點餐頁</Link>
            <button onClick={() => createMockOrder(storeId)} className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel"><Sparkles className="size-5" />產生測試訂單</button>
            <button onClick={seedDemoData} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">匯入預設菜單</button>
            <button onClick={resetDemo} className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel"><RefreshCcw className="size-5" />重設</button>
            <button onClick={onSignOut} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">登出</button>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-5">
          <Metric label="今日營收" value={`$${revenue}`} accent="text-tomato" />
          <Metric label="今日訂單" value={todayOrders.length.toString()} />
          <Metric label="待接單" value={pendingOrders.length.toString()} accent="text-amber-600" />
          <Metric label="商品管理" value={products.length.toString()} />
          <Metric label="飲料品項" value={products.filter((product) => isDrinkName(product.name)).length.toString()} accent="text-leaf" />
        </section>

        {view === "dashboard" && canManageStore && (
          <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">臨時公告</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="例如：奶茶售完、餐點需等 15 分鐘" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              <button onClick={saveNotice} className="rounded-lg bg-ink px-5 py-3 font-black text-white">發布公告</button>
            </div>
          </section>
        )}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {(view === "dashboard" || view === "menu") && canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">商品管理</h2>
                  <button onClick={startNewProduct} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><Plus className="size-4" />新增</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {products.map((product) => (
                    <div key={product.id} onClick={() => setEditingProduct(product)} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition ${editingProduct.id === product.id ? "bg-leaf/10 ring-2 ring-leaf" : "bg-[#fffaf0] hover:bg-orange-50"}`}>
                      <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{product.name}</p>
                        <p className="font-bold text-tomato">${product.price}</p>
                      </div>
                      <button onClick={(event) => { event.stopPropagation(); upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false }); }} className={`rounded-lg px-3 py-3 font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-amber-100 text-amber-700"}`}>{product.isAvailable ? "上架中" : "停售中"}</button>
                      <button onClick={(event) => { event.stopPropagation(); setEditingProduct(product); }} className="grid size-11 place-items-center rounded-lg bg-white">{product.isAvailable ? <Eye className="size-5 text-leaf" /> : <EyeOff className="size-5 text-stone-400" />}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(view === "dashboard" || view === "orders") && <div className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">今日訂單</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {todayOrders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((order) => (
                  <article key={order.id} className={`rounded-lg border p-4 ${order.status === "pending" ? "animate-order-pop border-tomato bg-tomato/5" : "border-orange-100"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-3xl font-black">#{order.orderNumber} / {order.tableNo}</p>
                        <p className="text-sm font-bold text-steel">{new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm font-bold text-steel">{order.items.map((item) => <p key={item.id}>{item.quantity} x {item.productName}</p>)}</div>
                    <p className="mt-3 text-lg font-black text-tomato">總金額 ${order.totalAmount ?? order.total}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.status === "pending" && (
                        <>
                          <button onClick={() => updateOrderStatus(order.id, "accepted")} className="rounded-lg bg-leaf px-3 py-2 font-black text-white">接單</button>
                          <select value={rejectReasons[order.id] ?? "售完"} onChange={(event) => setRejectReasons((current) => ({ ...current, [order.id]: event.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-black text-steel">
                            {["售完", "太忙", "已打烊"].map((reason) => <option key={reason}>{reason}</option>)}
                          </select>
                          <button onClick={() => rejectOrder(order.id, rejectReasons[order.id] ?? "售完")} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">取消訂單</button>
                        </>
                      )}
                      {order.status === "accepted" && <button onClick={() => updateOrderStatus(order.id, "cooking")} className="rounded-lg bg-amber-100 px-3 py-2 font-black text-amber-700">開始製作</button>}
                      {order.status === "cooking" && <button onClick={() => updateOrderStatus(order.id, "ready")} className="rounded-lg bg-violet-100 px-3 py-2 font-black text-violet-700">完成出餐</button>}
                      {order.status === "ready" && <button onClick={() => updateOrderStatus(order.id, "completed")} className="rounded-lg bg-leaf px-3 py-2 font-black text-white">已取餐</button>}
                      {!["completed", "cancelled"].includes(order.status) && order.status !== "pending" && <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">取消訂單</button>}
                    </div>
                  </article>
                ))}
              </div>
            </div>}
          </div>

          <aside className="space-y-5">
            {view === "dashboard" && canManageStore && (
              <div className="rounded-lg bg-ink p-5 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-lg bg-white text-ink">
                    <QrCode className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">QR Code 管理</h2>
                    <p className="text-sm font-bold text-white/60">顧客掃碼後進入點餐頁</p>
                  </div>
                </div>
                <img src={qrUrl} alt="顧客點餐 QR Code" className="mt-5 w-full rounded-lg bg-white p-4" />
                <p className="mt-4 break-all rounded-lg bg-white/10 p-3 text-sm font-bold">{orderUrl}</p>
                <div className="mt-4 grid gap-2">
                  <button onClick={copyOrderUrl} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink">
                    <Copy className="size-5" />
                    複製點餐連結
                  </button>
                  <a href={`/order/${storeId}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
                    <ExternalLink className="size-5" />
                    預覽點餐頁
                  </a>
                  <a href={qrUrl} download={`qr-${storeId}.png`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
                    <Download className="size-5" />
                    下載 QR Code 圖片
                  </a>
                </div>
              </div>
            )}

            {(view === "dashboard" || view === "menu") && canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">商品編輯</h2>
                <div className="mt-4 grid gap-3">
                  <input value={editingProduct.name} onChange={(event) => setEditingProduct({ ...editingProduct, name: event.target.value })} placeholder="商品名稱" className="rounded-lg border border-orange-100 px-4 py-3 font-bold" />
                  <textarea value={editingProduct.description} onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })} placeholder="商品描述" className="min-h-20 rounded-lg border border-orange-100 px-4 py-3" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={editingProduct.originalPrice ?? editingProduct.price} onChange={(event) => setEditingProduct({ ...editingProduct, originalPrice: Number(event.target.value) })} placeholder="原價" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
                    <input type="number" value={editingProduct.price} onChange={(event) => setEditingProduct({ ...editingProduct, price: Number(event.target.value) })} placeholder="售價" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
                    <input type="number" value={editingProduct.sort} onChange={(event) => setEditingProduct({ ...editingProduct, sort: Number(event.target.value) })} placeholder="排序" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
                    <select value={editingProduct.categoryId} onChange={(event) => setEditingProduct({ ...editingProduct, categoryId: event.target.value })} className="rounded-lg border border-orange-100 px-3 py-3 font-bold">
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-3 rounded-lg bg-orange-50 px-4 py-3 font-black text-steel">
                    <input type="checkbox" checked={editingProduct.isAvailable} onChange={(event) => setEditingProduct({ ...editingProduct, isAvailable: event.target.checked, isSoldOut: false })} />
                    {editingProduct.isAvailable ? "商品上架中" : "商品停售中"}
                  </label>
                  <input value={editingProduct.imageUrl} onChange={(event) => setEditingProduct({ ...editingProduct, imageUrl: event.target.value })} placeholder="圖片 URL" className="rounded-lg border border-orange-100 px-4 py-3" />
                  {editingProduct.imageUrl && <img src={editingProduct.imageUrl} alt={editingProduct.name || "商品圖片預覽"} className="aspect-[4/3] w-full rounded-lg object-cover" />}
                  <div className="grid grid-cols-4 gap-2">{imagePresets.map((url) => <button key={url} onClick={() => setEditingProduct({ ...editingProduct, imageUrl: url })} className="overflow-hidden rounded-lg border-2 border-orange-100"><img src={url} alt="圖片範本" className="h-16 w-full object-cover" /></button>)}</div>
                  <button onClick={saveProduct} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white"><ImagePlus className="size-5" />儲存商品</button>
                  <button onClick={removeEditingProduct} disabled={!editingProduct.id || editingProduct.id === "new-product"} className="rounded-lg bg-tomato px-4 py-4 font-black text-white disabled:bg-stone-300">刪除商品</button>
                </div>
              </div>
            )}

            {(view === "dashboard" || view === "menu") && canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">分類管理</h2>
                <div className="mt-4 flex gap-2">
                  <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新增分類" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
                  <button onClick={addCategory} className="rounded-lg bg-ink px-4 py-3 font-black text-white">新增</button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <button key={category.id} onClick={() => upsertCategory({ ...category, isActive: !category.isActive })} className={`rounded-lg px-4 py-3 font-black ${category.isActive ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-400"}`}>{category.name}</button>)}</div>
              </div>
            )}

            {(view === "dashboard" || view === "rankings") && <div className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">銷售排行</h2>
              <div className="mt-4 space-y-3">
                {ranking.length === 0 ? <p className="rounded-lg bg-orange-50 p-4 text-sm font-bold text-steel">尚無銷售資料</p> : ranking.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg bg-[#fffaf0] px-4 py-3">
                    <div><p className="font-black">#{index + 1} {item.name}</p><p className="text-sm font-bold text-steel">售出 {item.quantity} 份</p></div>
                    <p className="font-black text-tomato">${item.total}</p>
                  </div>
                ))}
              </div>
            </div>}
          </aside>
        </section>
      </section>
    </main>
  );
}

function SidebarItem({ href, icon: Icon, label, active = false }: { href: string; icon: React.ElementType; label: string; active?: boolean }) {
  return <Link href={href} className={`inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"}`}><Icon className="size-5" />{label}</Link>;
}

function Metric({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><p className="text-sm font-black text-steel">{label}</p><p className={`mt-2 text-4xl font-black ${accent}`}>{value}</p></div>;
}
