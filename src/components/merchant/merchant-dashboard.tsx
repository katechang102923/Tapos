"use client";

import { useState } from "react";
import Link from "next/link";
import { ChefHat, Cpu, Gift, LayoutDashboard, Menu as MenuIcon, Plus, Power, QrCode, ReceiptText, Settings, ShoppingCart, SlidersHorizontal, Users } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { resolvePermissions, roleLabel, roleBadgeClass } from "@/lib/permissions";
import { accessibleStoreIds, defaultStoreId, storeRoleFor } from "@/lib/store-access";
import { checkStoreAccess, checkUserAccess } from "@/lib/subscription";
import type { Category, Store, User } from "@/lib/types";

type MerchantView = "dashboard" | "menu";

export function MerchantDashboard({ view = "dashboard" }: { view?: MerchantView }) {
  return (
    <LoginGate allowedRoles={["merchant", "admin", "owner", "manager", "staff", "viewer"]} title="店家後台管理">
      {({ profile, signOutUser }) => {
        if (!profile) return null;
        if (profile.status === "pending" || profile.status === "rejected") {
          return (
            <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
                <QrCode className="size-10 text-leaf" />
                <h1 className="mt-4 text-3xl font-black text-ink">{profile.status === "rejected" ? "帳號未通過審核" : "帳號等待審核"}</h1>
                <p className="mt-2 text-sm font-semibold text-steel">請等待平台管理員核准後再進入店家後台。</p>
                <button onClick={signOutUser} className="mt-5 rounded-lg bg-ink px-4 py-3 font-black text-white">登出</button>
              </div>
            </main>
          );
        }
        if (accessibleStoreIds(profile).length === 0) {
          return (
            <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
              <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft">
                <p className="text-sm font-black text-leaf">尚未綁定店家</p>
                <h1 className="mt-2 text-3xl font-black text-ink">請先完成店家設定</h1>
                <p className="mt-3 leading-7 text-steel">此帳號目前沒有可管理的店家，請由平台管理員綁定店家權限。</p>
                <button onClick={signOutUser} className="mt-5 rounded-lg bg-ink px-5 py-3 font-black text-white">登出</button>
              </div>
            </main>
          );
        }
        return <MerchantDashboardContent profile={profile} view={view} onSignOut={signOutUser} />;
      }}
    </LoginGate>
  );
}

function MerchantDashboardContent({ profile, view, onSignOut }: { profile: User; view: MerchantView; onSignOut: () => Promise<void> }) {
  const storeIds = accessibleStoreIds(profile);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId(profile));
  const { db, upsertCategory, upsertStore } = useDemoStore({ storeId: selectedStoreId, skipOrderList: true });
  const [categoryName, setCategoryName] = useState("");
  const [notice, setNotice] = useState("");

  const store = db.stores.find((item) => item.id === selectedStoreId);
  const categories = db.categories.filter((item) => item.storeId === selectedStoreId).sort((a, b) => a.sort - b.sort);
  const storeRole = storeRoleFor(profile, selectedStoreId);
  const role = profile.role === "admin" ? "admin" : storeRole;
  const permissions = resolvePermissions(profile, selectedStoreId);
  const canManageStore = permissions.canManageMenu || profile.role === "admin";
  const storeAccessCheck = profile.role !== "admin" ? checkStoreAccess(store) : { ok: true, reason: "" };
  const userAccessCheck = profile.role !== "admin" ? checkUserAccess(profile, selectedStoreId) : { ok: true, reason: "" };

  // Access gates (skip while store data is loading)
  if (db.stores.length > 0 && !userAccessCheck.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-tomato">帳號存取受限</p>
          <h1 className="mt-2 text-2xl font-black text-ink">{userAccessCheck.reason}</h1>
          <button onClick={onSignOut} className="mt-5 rounded-lg bg-ink px-4 py-3 font-black text-white">登出</button>
        </div>
      </main>
    );
  }
  if (db.stores.length > 0 && !storeAccessCheck.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-tomato">店家方案受限</p>
          <h1 className="mt-2 text-2xl font-black text-ink">{storeAccessCheck.reason}</h1>
          <button onClick={onSignOut} className="mt-5 rounded-lg bg-ink px-4 py-3 font-black text-white">登出</button>
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
    upsertCategory({ id: "", storeId: selectedStoreId, name: categoryName.trim(), sort: categories.length + 1, isActive: true });
    setCategoryName("");
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-orange-100 bg-[#171717] p-4 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-tomato"><ReceiptText className="size-5" /></div>
          <div>
            {storeRole && <span className={`mb-1 inline-block rounded px-2 py-0.5 text-xs font-black ${roleBadgeClass(storeRole)}`}>{roleLabel(storeRole)}</span>}
            <p className="font-black">{store?.name ?? "店家後台"}</p>
            <p className="text-xs font-bold text-white/55">資料設定中心</p>
          </div>
        </div>
        <nav className="mt-6 grid gap-2">
          <SidebarItem href="/merchant/dashboard" icon={LayoutDashboard} label="設定中心" active={view === "dashboard"} />
          <SidebarItem href="/merchant/menu" icon={MenuIcon} label="菜單管理" active={view === "menu"} />
          <SidebarItem href="/merchant/options" icon={SlidersHorizontal} label="商品選項管理" />
          <SidebarItem href="/merchant/qr" icon={QrCode} label="線上點餐 QR Code" />
          <SidebarItem href="/merchant/devices" icon={Cpu} label="設備與列印設定" />
          {store?.features?.promotionEnabled && permissions.canManagePromotions && <SidebarItem href="/merchant/promotions" icon={Gift} label="促銷活動" />}
          {canManageStore && <SidebarItem href="/merchant/settings" icon={Settings} label="店家設定" />}
          {permissions.canManageUsers && <SidebarItem href="/merchant/members" icon={Users} label="帳號管理" />}
          <Link href="/merchant/pos" className="inline-flex items-center gap-3 rounded-lg bg-leaf px-4 py-3 font-black text-white"><ShoppingCart className="size-5" />前往 POS 前台</Link>
          {store?.features?.kdsEnabled && permissions.canUseKDS && (
            <Link href={`/kitchen/${selectedStoreId}`} className="inline-flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20"><ChefHat className="size-5" />廚房 KDS</Link>
          )}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-steel">{view === "dashboard" ? "店家後台設定" : "菜單分類管理"}</p>
            <h1 className="text-3xl font-black text-ink">{view === "dashboard" ? "設定中心" : "菜單管理"}</h1>
            {storeIds.length > 1 && (
              <label className="mt-3 block text-sm font-bold text-steel">
                選擇店家
                <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm">
                  {storeIds.map((id) => {
                    const optionStore = db.stores.find((item) => item.id === id);
                    return <option key={id} value={id}>{optionStore?.name ?? id}</option>;
                  })}
                </select>
              </label>
            )}
            {(store?.temporaryNotice || store?.notice) && <p className="mt-2 font-bold text-tomato">公告：{store.temporaryNotice || store.notice}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageStore && <StoreStatusButtons store={store} updateStore={updateStore} />}
            <button onClick={onSignOut} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">登出</button>
          </div>
        </header>

        {view === "dashboard" && canManageStore && <DashboardOverview store={store} updateStore={updateStore} notice={notice} setNotice={setNotice} saveNotice={saveNotice} />}
        {view === "menu" && canManageStore && <MenuManagement categories={categories} categoryName={categoryName} setCategoryName={setCategoryName} addCategory={addCategory} upsertCategory={upsertCategory} />}
      </section>
    </main>
  );
}

function StoreStatusButtons({ store, updateStore }: { store?: Store; updateStore: (patch: Partial<Store>) => void }) {
  return (
    <>
      <button onClick={() => updateStore({ isOpen: true, orderStatus: "open" })} className={`rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-leaf" : "bg-stone-400"}`}>營業中</button>
      <button onClick={() => updateStore({ isOpen: false, orderStatus: "closed" })} className={`rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-stone-400" : "bg-tomato"}`}>休息中</button>
    </>
  );
}

function SidebarItem({ href, icon: Icon, label, active = false }: { href: string; icon: React.ElementType; label: string; active?: boolean }) {
  return <Link href={href} className={`inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"}`}><Icon className="size-5" />{label}</Link>;
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-4 text-left font-black ${active ? "bg-leaf/10 text-leaf" : "bg-tomato/10 text-tomato"}`}>
      <span className="block text-xs">{active ? "已開放" : "已暫停"}</span>
      {label}
    </button>
  );
}

function DashboardOverview({ store, updateStore, notice, setNotice, saveNotice }: { store?: Store; updateStore: (patch: Partial<Store>) => void; notice: string; setNotice: (value: string) => void; saveNotice: () => void }) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">店家設定中心</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-steel">管理店家資料、菜單、商品選項、QR Code、設備設定與營業狀態。</p>
            </div>
            <Link href="/merchant/pos" className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 font-black text-white">
              <ShoppingCart className="size-5" />
              前往 POS 前台
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SettingsCard href="/merchant/menu" title="菜單管理" description="管理分類、商品排序、上下架與菜單預覽。" />
          <SettingsCard href="/merchant/options" title="商品選項管理" description="管理套餐、加購、加料、調味與飲料補差價。" />
          <SettingsCard href="/merchant/qr" title="線上點餐 QR Code" description="管理外帶點餐連結、內用桌號 QR Code、QR Code 預覽與下載。" />
          <SettingsCard href="/merchant/devices" title="設備與列印設定" description="管理出單機、標籤機、列印站點與列印模板。" />
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">營業與接單設定</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button onClick={() => updateStore({ isOpen: true, orderStatus: "open" })} className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-leaf text-white" : "bg-stone-100 text-steel"}`}>營業中</button>
            <button onClick={() => updateStore({ isOpen: false, orderStatus: "closed" })} className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-stone-100 text-steel" : "bg-tomato text-white"}`}>休息中</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ToggleButton label="開放外帶 QR 接單" active={store?.takeoutOrderingEnabled ?? store?.takeoutEnabled ?? true} onClick={() => updateStore({ takeoutOrderingEnabled: !(store?.takeoutOrderingEnabled ?? store?.takeoutEnabled ?? true) })} />
            <ToggleButton label="開放內用 QR 接單" active={store?.dineInOrderingEnabled ?? store?.dineInEnabled ?? true} onClick={() => updateStore({ dineInOrderingEnabled: !(store?.dineInOrderingEnabled ?? store?.dineInEnabled ?? true) })} />
            <ToggleButton label="開放 POS 現場單" active={store?.posOrderingEnabled ?? true} onClick={() => updateStore({ posOrderingEnabled: !(store?.posOrderingEnabled ?? true) })} />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="例如：現場客滿，餐點需等候 15 分鐘" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
            <button onClick={saveNotice} className="rounded-lg bg-ink px-5 py-3 font-black text-white">發布臨時公告</button>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">設定項目</h2>
          <div className="mt-4 grid gap-2 text-sm font-bold text-steel">
            <p className="rounded-lg bg-orange-50 px-3 py-2">菜單與商品</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">商品選項</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">QR Code</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">設備與列印</p>
            <p className="rounded-lg bg-orange-50 px-3 py-2">店家設定</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MenuManagement({ categories, categoryName, setCategoryName, addCategory, upsertCategory }: { categories: Category[]; categoryName: string; setCategoryName: (value: string) => void; addCategory: () => void; upsertCategory: (category: Category) => void }) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black">菜單管理概覽</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-steel">管理分類、商品排序、商品上下架與菜單預覽；商品選項請前往商品選項管理。</p>
        <Link href="/merchant/options" className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
          <Plus className="size-5" />
          前往商品選項管理
        </Link>
      </section>

      <aside className="rounded-lg bg-white p-5 shadow-sm">
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
