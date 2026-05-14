"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChefHat,
  Contact,
  Cpu,
  Gift,
  LayoutDashboard,
  Menu as MenuIcon,
  Plus,
  QrCode,
  ReceiptText,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { resolvePermissions, roleBadgeClass, roleLabel } from "@/lib/permissions";
import { accessibleStoreIds, defaultStoreId, isPlatformAdmin, storeRoleFor } from "@/lib/store-access";
import { checkStoreAccess, checkUserAccess } from "@/lib/subscription";
import type { Category, Store, User } from "@/lib/types";

type MerchantView = "dashboard" | "menu";

export function MerchantDashboard({ view = "dashboard" }: { view?: MerchantView }) {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff", "viewer"]} title="店家後台管理">
      {({ profile, signOutUser }) => {
        if (!profile) return null;

        if (profile.status === "pending" || profile.status === "rejected") {
          return (
            <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
                <QrCode className="size-10 text-leaf" />
                <h1 className="mt-4 text-3xl font-black text-ink">{profile.status === "rejected" ? "帳號審核未通過" : "帳號等待審核"}</h1>
                <p className="mt-2 text-sm font-semibold text-steel">請等待平台管理員審核帳號後再進入店家後台。</p>
                <button onClick={signOutUser} className="mt-5 rounded-lg bg-ink px-4 py-3 font-black text-white">登出</button>
              </div>
            </main>
          );
        }

        if (!isPlatformAdmin(profile) && accessibleStoreIds(profile).length === 0) {
          return (
            <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
              <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft">
                <p className="text-sm font-black text-leaf">尚未綁定店家</p>
                <h1 className="mt-2 text-3xl font-black text-ink">請先完成店家授權</h1>
                <p className="mt-3 leading-7 text-steel">此帳號目前沒有任何店家授權，請聯絡平台管理員綁定店家。</p>
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
  const isAdmin = isPlatformAdmin(profile);
  const authorizedStoreIds = useMemo(() => accessibleStoreIds(profile), [profile]);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId(profile));
  const bootstrapStoreId = isAdmin ? selectedStoreId : (authorizedStoreIds.includes(selectedStoreId) ? selectedStoreId : authorizedStoreIds[0] ?? "");
  const { db, upsertCategory, upsertStore } = useDemoStore({ storeId: bootstrapStoreId, admin: isAdmin, skipOrderList: true });
  const storeIds = useMemo(
    () => isAdmin
      ? db.stores.filter((store) => !store.isDeleted && store.id !== "demo-store").map((store) => store.id)
      : authorizedStoreIds,
    [authorizedStoreIds, db.stores, isAdmin]
  );
  const activeStoreId = storeIds.includes(selectedStoreId) ? selectedStoreId : storeIds[0] ?? "";
  const [categoryName, setCategoryName] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!storeIds.length) return;
    if (!selectedStoreId || !storeIds.includes(selectedStoreId)) {
      const nextStoreId = storeIds[0];
      setSelectedStoreId(nextStoreId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("activeStoreId", nextStoreId);
        window.localStorage.setItem("selectedStoreId", nextStoreId);
      }
    }
  }, [selectedStoreId, storeIds]);

  const store = db.stores.find((item) => item.id === activeStoreId);
  const categories = db.categories.filter((item) => item.storeId === activeStoreId).sort((a, b) => a.sort - b.sort);
  const storeRole = storeRoleFor(profile, activeStoreId);
  const permissions = resolvePermissions(profile, activeStoreId);
  const canManageStore = isAdmin || permissions.canManageMenu;
  const storeAccessCheck = !isAdmin ? checkStoreAccess(store) : { ok: true, reason: "" };
  const userAccessCheck = !isAdmin ? checkUserAccess(profile, activeStoreId) : { ok: true, reason: "" };

  if (db.stores.length > 0 && !userAccessCheck.ok) {
    return <BlockedPage title="帳號權限異常" reason={userAccessCheck.reason} onSignOut={onSignOut} />;
  }

  if (db.stores.length > 0 && !storeAccessCheck.ok) {
    return <BlockedPage title="店家狀態異常" reason={storeAccessCheck.reason} onSignOut={onSignOut} />;
  }

  function updateStore(patch: Partial<Store>) {
    if (!store) return;
    upsertStore({ ...store, ...patch });
  }

  function saveNotice() {
    updateStore({ temporaryNotice: notice });
  }

  function addCategory() {
    if (!categoryName.trim() || !activeStoreId) return;
    upsertCategory({ id: "", storeId: activeStoreId, name: categoryName.trim(), sort: categories.length + 1, isActive: true });
    setCategoryName("");
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-orange-100 bg-[#171717] p-4 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-tomato">
            <ReceiptText className="size-5" />
          </div>
          <div>
            {storeRole && <span className={`mb-1 inline-block rounded px-2 py-0.5 text-xs font-black ${roleBadgeClass(storeRole)}`}>{roleLabel(storeRole)}</span>}
            <p className="font-black">{store?.name ?? "店家設定"}</p>
            <p className="text-xs font-bold text-white/55">設定中心</p>
          </div>
        </div>

        <nav className="mt-6 grid gap-2">
          <SidebarItem href="/merchant/dashboard" icon={LayoutDashboard} label="後台設定" active={view === "dashboard"} />
          <SidebarItem href="/merchant/menu" icon={MenuIcon} label="菜單管理" active={view === "menu"} />
          <SidebarItem href="/merchant/options" icon={SlidersHorizontal} label="商品選項管理" />
          <SidebarItem href="/merchant/qr" icon={QrCode} label="線上點餐 QR Code" />
          <SidebarItem href="/merchant/devices" icon={Cpu} label="設備與列印設定" />
          {store?.features?.promotionEnabled && permissions.canManagePromotions && <SidebarItem href="/merchant/promotions" icon={Gift} label="促銷活動" />}
          {canManageStore && <SidebarItem href="/merchant/settings" icon={Settings} label="店家設定" />}
          {permissions.canManageUsers && <SidebarItem href="/merchant/members" icon={Users} label="員工管理" />}
          {store?.features?.memberEnabled && permissions.canManageMembers && <SidebarItem href="/merchant/customers" icon={Contact} label="會員管理" />}
          {store?.features?.memberEnabled && permissions.canManageMembers && <SidebarItem href="/merchant/member-rules" icon={Contact} label="會員點數規則" />}
          <Link href="/merchant/pos" className="inline-flex items-center gap-3 rounded-lg bg-leaf px-4 py-3 font-black text-white">
            <ShoppingCart className="size-5" />
            前往 POS 前台
          </Link>
          {store?.features?.kdsEnabled && (
            <Link href={`/kitchen/${activeStoreId}`} className="inline-flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20">
              <ChefHat className="size-5" />
              廚房 KDS
            </Link>
          )}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-steel">{view === "dashboard" ? "店家資料與功能設定" : "菜單分類管理"}</p>
            <h1 className="text-3xl font-black text-ink">{view === "dashboard" ? "店家後台設定" : "菜單管理"}</h1>
            {isAdmin && storeIds.length > 1 && (
              <label className="mt-3 block text-sm font-bold text-steel">
                切換店家
                <select
                  value={activeStoreId}
                  onChange={(event) => setSelectedStoreId(event.target.value)}
                  className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink"
                >
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
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel hover:text-ink">
              <ArrowLeft className="size-5" />
              回首頁
            </Link>
          </div>
        </header>

        {view === "dashboard" && (
          <DashboardOverview store={store} canManageStore={canManageStore} updateStore={updateStore} notice={notice} setNotice={setNotice} saveNotice={saveNotice} />
        )}
        {view === "menu" && (
          <MenuManagement
            categories={categories}
            canManageStore={canManageStore}
            categoryName={categoryName}
            setCategoryName={setCategoryName}
            addCategory={addCategory}
            upsertCategory={upsertCategory}
          />
        )}
      </section>
    </main>
  );
}

function BlockedPage({ title, reason, onSignOut }: { title: string; reason: string; onSignOut: () => Promise<void> }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
        <p className="text-sm font-black text-tomato">{title}</p>
        <h1 className="mt-2 text-2xl font-black text-ink">{reason}</h1>
        <button onClick={onSignOut} className="mt-5 rounded-lg bg-ink px-4 py-3 font-black text-white">登出</button>
      </div>
    </main>
  );
}

function StoreStatusButtons({ store, updateStore }: { store?: Store; updateStore: (patch: Partial<Store>) => void }) {
  return (
    <>
      <button onClick={() => updateStore({ isOpen: true, orderStatus: "open" })} className={`rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-leaf" : "bg-stone-400"}`}>
        營業中
      </button>
      <button onClick={() => updateStore({ isOpen: false, orderStatus: "closed" })} className={`rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-stone-400" : "bg-tomato"}`}>
        休息中
      </button>
    </>
  );
}

function SidebarItem({ href, icon: Icon, label, active = false }: { href: string; icon: React.ElementType; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"}`}>
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

function ToggleButton({ active, label, onClick, disabled = false }: { active: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-4 py-4 text-left font-black ${active ? "bg-leaf/10 text-leaf" : "bg-tomato/10 text-tomato"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span className="block text-xs">{active ? "開放" : "關閉"}</span>
      {label}
    </button>
  );
}

function DashboardOverview({
  store,
  canManageStore,
  updateStore,
  notice,
  setNotice,
  saveNotice,
}: {
  store?: Store;
  canManageStore: boolean;
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
              <h2 className="text-2xl font-black">店家後台設定中心</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-steel">管理店家資訊、菜單、QR Code、設備與營業狀態。</p>
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
          <SettingsCard href="/merchant/qr" title="線上點餐 QR Code" description="管理外帶點餐連結、內用桌號 QR Code、預覽與下載。" />
          <SettingsCard href="/merchant/devices" title="設備與列印設定" description="管理出單機、標籤機、列印站點與列印模板。" />
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">營業狀態設定</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              disabled={!canManageStore}
              onClick={() => updateStore({ isOpen: true, orderStatus: "open" })}
              className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-leaf text-white" : "bg-stone-100 text-steel"} ${!canManageStore ? "cursor-not-allowed opacity-60" : ""}`}
            >
              營業中
            </button>
            <button
              disabled={!canManageStore}
              onClick={() => updateStore({ isOpen: false, orderStatus: "closed" })}
              className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-stone-100 text-steel" : "bg-tomato text-white"} ${!canManageStore ? "cursor-not-allowed opacity-60" : ""}`}
            >
              休息中
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ToggleButton disabled={!canManageStore} label="開放外帶 QR 接單" active={store?.takeoutOrderingEnabled ?? store?.takeoutEnabled ?? true} onClick={() => updateStore({ takeoutOrderingEnabled: !(store?.takeoutOrderingEnabled ?? store?.takeoutEnabled ?? true) })} />
            <ToggleButton disabled={!canManageStore} label="開放內用 QR 接單" active={store?.dineInOrderingEnabled ?? store?.dineInEnabled ?? true} onClick={() => updateStore({ dineInOrderingEnabled: !(store?.dineInOrderingEnabled ?? store?.dineInEnabled ?? true) })} />
            <ToggleButton disabled={!canManageStore} label="開放 POS 現場單" active={store?.posOrderingEnabled ?? true} onClick={() => updateStore({ posOrderingEnabled: !(store?.posOrderingEnabled ?? true) })} />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="臨時公告，例如：現場繁忙需等候 15 分鐘" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" disabled={!canManageStore} />
            <button onClick={saveNotice} disabled={!canManageStore} className="rounded-lg bg-ink px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
              發布公告
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">設定導覽</h2>
          <div className="mt-4 grid gap-2 text-sm font-bold text-steel">
            <p className="rounded-lg bg-orange-50 px-3 py-2">菜單管理</p>
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

function MenuManagement({
  categories,
  canManageStore,
  categoryName,
  setCategoryName,
  addCategory,
  upsertCategory,
}: {
  categories: Category[];
  canManageStore: boolean;
  categoryName: string;
  setCategoryName: (value: string) => void;
  addCategory: () => void;
  upsertCategory: (category: Category) => void;
}) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black">菜單分類</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-steel">管理分類、商品排序與上下架。商品與多層選項請到商品管理頁操作。</p>
        <div className="mt-5 grid gap-3">
          {categories.length === 0 && <p className="rounded-lg bg-orange-50 p-4 text-sm font-bold text-steel">尚未建立分類。</p>}
          {categories.map((category) => (
            <div key={category.id} className="flex flex-col gap-3 rounded-lg border border-orange-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">{category.name}</p>
                <p className="text-xs font-bold text-steel">排序 {category.sort}</p>
              </div>
              <button
                disabled={!canManageStore}
                onClick={() => upsertCategory({ ...category, isActive: !category.isActive })}
                className={`rounded-lg px-4 py-2 font-black ${category.isActive ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-steel"} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {category.isActive ? "上架中" : "已停用"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <aside className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black">新增分類</h2>
        <div className="mt-4 grid gap-3">
          <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="例如：主餐、飲料、點心" className="rounded-lg border border-orange-100 px-4 py-3 font-bold" disabled={!canManageStore} />
          <button onClick={addCategory} disabled={!canManageStore} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
            <Plus className="size-5" />
            新增分類
          </button>
        </div>
      </aside>
    </div>
  );
}

function SettingsCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-lg border border-orange-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <p className="text-xl font-black text-ink">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-steel">{description}</p>
    </Link>
  );
}
