"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Menu as MenuIcon, Plus, Power, PowerOff, QrCode, ReceiptText, Settings, ShoppingCart, Table2, Flame } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import type { Category, Store, UserRole } from "@/lib/types";

type MerchantView = "dashboard" | "menu";

export function MerchantDashboard({ view = "dashboard" }: { view?: MerchantView }) {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="店家後台登入">
      {({ profile, signOutUser }) => <MerchantDashboardContent role={profile?.role ?? "user"} storeId={profile?.storeId ?? ""} view={view} onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function MerchantDashboardContent({ storeId, role, view, onSignOut }: { storeId: string; role: UserRole; view: MerchantView; onSignOut: () => Promise<void> }) {
  const { db, upsertCategory, upsertStore } = useDemoStore({ storeId, skipOrderList: true });
  const [categoryName, setCategoryName] = useState("");
  const [notice, setNotice] = useState("");

  const store = db.stores.find((item) => item.id === storeId);
  const categories = db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const canManageStore = role === "merchant" || role === "admin";

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

  function updateStore(patch: Partial<Store>) {
    if (!store) return;
    upsertStore({ ...store, ...patch });
  }

  function saveNotice() {
    updateStore({ temporaryNotice: notice });
  }

  function addCategory() {
    if (!categoryName.trim()) return;
    upsertCategory({ id: "", storeId, name: categoryName.trim(), sort: categories.length + 1, isActive: true });
    setCategoryName("");
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
          <SidebarItem href="/merchant/dashboard" icon={LayoutDashboard} label="後台概覽" active={view === "dashboard"} />
          <SidebarItem href="/merchant/menu" icon={MenuIcon} label="菜單管理" active={view === "menu"} />
          <SidebarItem href="/merchant/options" icon={ShoppingCart} label="商品選項管理" active={false} />
          <SidebarItem href="/merchant/qrcode" icon={QrCode} label="QR Code 管理" active={false} />
          <SidebarItem href="/merchant/tables" icon={Table2} label="桌號設定" active={false} />
          {canManageStore && <SidebarItem href="/merchant/settings" icon={Settings} label="店家設定" active={false} />}
          <Link href="/merchant/pos" className="inline-flex items-center gap-3 rounded-lg bg-leaf px-4 py-3 font-black text-white"><ShoppingCart className="size-5" />進入 POS 工作台</Link>
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-steel">{view === "dashboard" ? "店家後台概覽" : "菜單編輯"}</p>
            <h1 className="text-3xl font-black text-ink">{view === "dashboard" ? "後台設定中心" : "菜單管理"}</h1>
            {(store?.temporaryNotice || store?.notice) && <p className="mt-2 font-bold text-tomato">公告：{store.temporaryNotice || store.notice}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageStore && <button onClick={() => updateStore({ isOpen: !store?.isOpen })} className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-leaf" : "bg-tomato"}`}>{store?.isOpen ? <Power className="size-5" /> : <PowerOff className="size-5" />}{store?.isOpen ? "營業中" : "休息中"}</button>}
            {canManageStore && <button onClick={() => updateStore({ peakMode: !store?.peakMode })} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-black text-ink"><Flame className="size-5" />{store?.peakMode ? "尖峰模式中" : "尖峰模式"}</button>}
            <button onClick={onSignOut} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">登出</button>
          </div>
        </header>

        {view === "dashboard" && canManageStore && (
          <DashboardOverview store={store} updateStore={updateStore} notice={notice} setNotice={setNotice} saveNotice={saveNotice} />
        )}

        {view === "menu" && canManageStore && (
          <MenuManagement categories={categories} categoryName={categoryName} setCategoryName={setCategoryName} addCategory={addCategory} upsertCategory={upsertCategory} />
        )}
      </section>
    </main>
  );
}

function SidebarItem({ href, icon: Icon, label, active = false }: { href: string; icon: React.ElementType; label: string; active?: boolean }) {
  return <Link href={href} className={`inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"}`}><Icon className="size-5" />{label}</Link>;
}

function DashboardOverview({
  store,
  updateStore,
  notice,
  setNotice,
  saveNotice
}: {
  store?: Store;
  updateStore: (patch: Partial<Store>) => void;
  notice: string;
  setNotice: (value: string) => void;
  saveNotice: () => void;
}) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">後台設定中心</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-steel">本頁負責店家狀態、營運公告、營業狀態設定；商品、選項、桌號、QR Code 管理請前往各子頁面；每日營運請前往 POS 工作台。</p>
            </div>
            <Link href="/merchant/pos" className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 font-black text-white">
              <ShoppingCart className="size-5" />
              進入 POS 工作台
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SettingsCard href="/merchant/menu" title="菜單資訊管理" description="分類、商品、價格、圖片、排序與商品上下架。" />
          <SettingsCard href="/merchant/options" title="商品選項管理" description="套餐、加購、加料、調味、飲料補差價與多層子選項。" />
          <SettingsCard href="/merchant/qrcode" title="QR Code 產出" description="顧客點餐連結、QR Code 預覽、複製與下載。" />
          <SettingsCard href="/merchant/tables" title="桌號 QR 管理" description="為每張餐桌產生獨立 QR Code，顧客掃碼進入內用點餐。" />
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">營業狀態設定</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button onClick={() => updateStore({ isOpen: true, temporaryNotice: "" })} className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-leaf text-white" : "bg-stone-100 text-steel"}`}>營業中</button>
            <button onClick={() => updateStore({ isOpen: true, temporaryNotice: "目前暫停接單，請稍候。" })} className="rounded-lg bg-amber-100 px-4 py-4 font-black text-amber-700">暫停接單</button>
            <button onClick={() => updateStore({ isOpen: false })} className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-stone-100 text-steel" : "bg-tomato text-white"}`}>休息中</button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="例如：奶茶售完、餐點需等 15 分鐘" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
            <button onClick={saveNotice} className="rounded-lg bg-ink px-5 py-3 font-black text-white">發布臨時公告</button>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">管理功能</h2>
          <div className="mt-4 grid gap-2 text-sm font-bold text-steel">
            <p className="rounded-lg bg-orange-50 px-3 py-2">菜單資訊管理</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">商品選項管理</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">QR Code 產出</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">桌號設定</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">店家設定</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MenuManagement({
  categories,
  categoryName,
  setCategoryName,
  addCategory,
  upsertCategory
}: {
  categories: Category[];
  categoryName: string;
  setCategoryName: (value: string) => void;
  addCategory: () => void;
  upsertCategory: (category: Category) => void;
}) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">菜單管理概覽</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-steel">分類、商品、商品上下架和排序設定；商品選項（套餐、加購、加料）的設定請前往「商品選項管理」頁面。</p>
            </div>
            <Link href="/merchant/options" className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
              <Plus className="size-5" />
              管理商品選項
            </Link>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">分類管理</h2>
          <div className="mt-4 flex gap-2">
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新增分類" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
            <button onClick={addCategory} className="rounded-lg bg-ink px-4 py-3 font-black text-white">新增</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button key={category.id} onClick={() => upsertCategory({ ...category, isActive: !category.isActive })} className={`rounded-lg px-4 py-3 font-black ${category.isActive ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-400"}`}>
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SettingsCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-lg bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <p className="text-xl font-black text-ink">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-steel">{description}</p>
      <p className="mt-4 font-black text-leaf">前往設定</p>
    </Link>
  );
}
