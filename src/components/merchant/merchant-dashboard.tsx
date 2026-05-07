"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ChefHat, Coffee, Eye, EyeOff, Flame, ImagePlus, LayoutDashboard, Menu as MenuIcon, Plus, Power, PowerOff, ReceiptText, RefreshCcw, Sandwich, Sparkles, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { StatusPill } from "@/components/status-pill";
import { useDemoStore } from "@/lib/demo-store";
import type { Category, Product, Store, UserRole } from "@/lib/types";

const blankProduct: Product = {
  id: "new-product",
  storeId: "",
  categoryId: "cat-burger",
  name: "",
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
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

function isBreakfastTime() {
  const hour = new Date().getHours();
  return hour >= 5 && hour < 11;
}

function isDrinkName(name: string) {
  return /飲|茶|奶|咖啡|豆漿|紅茶|綠茶/.test(name);
}

export function MerchantDashboard() {
  return (
    <LoginGate allowedRoles={["owner", "staff", "admin"]} title="早餐店後台登入">
      {({ profile, signOutUser }) => <MerchantDashboardContent role={profile?.role ?? "staff"} storeId={profile?.storeId ?? ""} onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function MerchantDashboardContent({ storeId, role, onSignOut }: { storeId: string; role: UserRole; onSignOut: () => Promise<void> }) {
  const { db, todayOrders, createMockOrder, deleteProduct, resetDemo, seedDemoData, updateOrderStatus, upsertCategory, upsertProduct, upsertStore } = useDemoStore({ storeId });
  const [editingProduct, setEditingProduct] = useState<Product>(blankProduct);
  const [categoryName, setCategoryName] = useState("");
  const [notice, setNotice] = useState("");

  const store = db.stores.find((item) => item.id === storeId);
  const categories = db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const products = db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const activeOrders = todayOrders.filter((order) => order.status !== "cancelled");
  const canManageStore = role === "owner" || role === "admin";
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

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-leaf">首次登入</p>
          <h1 className="mt-2 text-3xl font-black text-ink">先建立早餐店</h1>
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
      sort: Number(editingProduct.sort) || products.length + 1,
      categoryId: editingProduct.categoryId || categories[0]?.id || "cat-burger"
    });
    setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 2 });
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

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-orange-100 bg-[#171717] p-4 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-tomato"><ReceiptText className="size-5" /></div>
          <div>
            <p className="font-black">{store?.name ?? "早餐店"}</p>
            <p className="text-xs font-bold text-white/55">Breakfast POS</p>
          </div>
        </div>
        <nav className="mt-6 grid gap-2">
          <SidebarItem icon={LayoutDashboard} label="尖峰總覽" active />
          <SidebarItem icon={MenuIcon} label="早餐菜單" />
          <SidebarItem icon={ReceiptText} label="今日訂單" />
          <SidebarItem icon={BarChart3} label="熱門排行" />
          <Link href={`/kitchen/${storeId}`} className="mt-4 inline-flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ChefHat className="size-5" />廚房 KDS</Link>
          {canManageStore && <Link href="/merchant/settings" className="inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black text-white/70 hover:bg-white/10">店家設定</Link>}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-steel">早餐時段：{isBreakfastTime() ? "自動開啟" : "非早餐時段"}</p>
            <h1 className="text-3xl font-black text-ink">早餐尖峰控制台</h1>
            {(store?.temporaryNotice || store?.notice) && <p className="mt-2 font-bold text-tomato">公告：{store.temporaryNotice || store.notice}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageStore && <button onClick={() => updateStore({ isOpen: !store?.isOpen })} className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-leaf" : "bg-tomato"}`}>{store?.isOpen ? <Power className="size-5" /> : <PowerOff className="size-5" />}{store?.isOpen ? "營業中" : "休息中"}</button>}
            {canManageStore && <button onClick={() => updateStore({ peakMode: !store?.peakMode })} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-black text-ink"><Flame className="size-5" />{store?.peakMode ? "尖峰模式中" : "早餐尖峰模式"}</button>}
            <button onClick={() => createMockOrder(storeId)} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><Sparkles className="size-5" />模擬掃碼點餐</button>
            <button onClick={seedDemoData} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">匯入早餐菜單</button>
            <button onClick={resetDemo} className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel"><RefreshCcw className="size-5" />重設</button>
            <button onClick={onSignOut} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">登出</button>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-5">
          <Metric label="今日營收" value={`$${revenue}`} accent="text-tomato" />
          <Metric label="今日訂單" value={todayOrders.length.toString()} />
          <Metric label="待製作" value={todayOrders.filter((order) => order.status === "new").length.toString()} accent="text-amber-600" />
          <Metric label="熱食品項" value={products.filter((product) => !isDrinkName(product.name)).length.toString()} />
          <Metric label="飲料品項" value={products.filter((product) => isDrinkName(product.name)).length.toString()} accent="text-leaf" />
        </section>

        {canManageStore && (
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
            {canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">快速停售</h2>
                  <button onClick={() => setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 1 })} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><Plus className="size-4" />新增</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 rounded-lg bg-[#fffaf0] p-3">
                      <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{product.name}</p>
                        <p className="font-bold text-tomato">${product.price}</p>
                      </div>
                      <button onClick={() => upsertProduct({ ...product, isSoldOut: !product.isSoldOut })} className={`rounded-lg px-3 py-3 font-black ${product.isSoldOut ? "bg-amber-100 text-amber-700" : "bg-leaf/10 text-leaf"}`}>{product.isSoldOut ? "恢復" : "停售"}</button>
                      <button onClick={() => upsertProduct({ ...product, isAvailable: !product.isAvailable })} className="grid size-11 place-items-center rounded-lg bg-white">{product.isAvailable ? <Eye className="size-5 text-leaf" /> : <EyeOff className="size-5 text-stone-400" />}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">今日訂單</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {todayOrders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((order) => (
                  <article key={order.id} className="rounded-lg border border-orange-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-3xl font-black">#{order.pickupNumber} / {order.tableNo}</p>
                        <p className="text-sm font-bold text-steel">{new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm font-bold text-steel">{order.items.map((item) => <p key={item.id}>{item.quantity} x {item.productName}</p>)}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => updateOrderStatus(order.id, "preparing")} className="rounded-lg bg-amber-100 px-3 py-2 font-black text-amber-700">製作中</button>
                      <button onClick={() => updateOrderStatus(order.id, "completed")} className="rounded-lg bg-leaf px-3 py-2 font-black text-white">完成</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            {canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">商品編輯</h2>
                <div className="mt-4 grid gap-3">
                  <input value={editingProduct.name} onChange={(event) => setEditingProduct({ ...editingProduct, name: event.target.value })} placeholder="商品名稱" className="rounded-lg border border-orange-100 px-4 py-3 font-bold" />
                  <textarea value={editingProduct.description} onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })} placeholder="商品描述" className="min-h-20 rounded-lg border border-orange-100 px-4 py-3" />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={editingProduct.price} onChange={(event) => setEditingProduct({ ...editingProduct, price: Number(event.target.value) })} className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
                    <input type="number" value={editingProduct.sort} onChange={(event) => setEditingProduct({ ...editingProduct, sort: Number(event.target.value) })} className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
                    <select value={editingProduct.categoryId} onChange={(event) => setEditingProduct({ ...editingProduct, categoryId: event.target.value })} className="rounded-lg border border-orange-100 px-3 py-3 font-bold">
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </div>
                  <input value={editingProduct.imageUrl} onChange={(event) => setEditingProduct({ ...editingProduct, imageUrl: event.target.value })} placeholder="圖片 URL" className="rounded-lg border border-orange-100 px-4 py-3" />
                  <div className="grid grid-cols-4 gap-2">{imagePresets.map((url) => <button key={url} onClick={() => setEditingProduct({ ...editingProduct, imageUrl: url })} className="overflow-hidden rounded-lg border-2 border-orange-100"><img src={url} alt="圖片範本" className="h-16 w-full object-cover" /></button>)}</div>
                  <button onClick={saveProduct} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white"><ImagePlus className="size-5" />儲存商品</button>
                </div>
              </div>
            )}

            {canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">分類管理</h2>
                <div className="mt-4 flex gap-2">
                  <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新增分類" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
                  <button onClick={addCategory} className="rounded-lg bg-ink px-4 py-3 font-black text-white">新增</button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <button key={category.id} onClick={() => upsertCategory({ ...category, isActive: !category.isActive })} className={`rounded-lg px-4 py-3 font-black ${category.isActive ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-400"}`}>{category.name}</button>)}</div>
              </div>
            )}

            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">今日熱門商品</h2>
              <div className="mt-4 space-y-3">
                {ranking.length === 0 ? <p className="rounded-lg bg-orange-50 p-4 text-sm font-bold text-steel">尚無銷售資料</p> : ranking.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg bg-[#fffaf0] px-4 py-3">
                    <div><p className="font-black">#{index + 1} {item.name}</p><p className="text-sm font-bold text-steel">售出 {item.quantity} 份</p></div>
                    <p className="font-black text-tomato">${item.total}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function SidebarItem({ icon: Icon, label, active = false }: { icon: React.ElementType; label: string; active?: boolean }) {
  return <div className={`inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"}`}><Icon className="size-5" />{label}</div>;
}

function Metric({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><p className="text-sm font-black text-steel">{label}</p><p className={`mt-2 text-4xl font-black ${accent}`}>{value}</p></div>;
}
