"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  QrCode,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store as StoreIcon,
  Users,
} from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { resolvePermissions, roleBadgeClass, roleLabel } from "@/lib/permissions";
import { accessibleStoreIds, defaultStoreId, isPlatformAdmin, storeRoleFor } from "@/lib/store-access";
import { checkStoreAccess, checkUserAccess } from "@/lib/subscription";
import type { Store, User } from "@/lib/types";

type MerchantView = "dashboard" | "menu";

const mainNav = [
  { href: "/merchant/pos", label: "點餐營運", description: "接單、現場單、今日銷售", icon: ShoppingCart },
  { href: "/merchant/menu", label: "菜單管理", description: "分類、商品、套餐與共用群組庫", icon: MenuIcon },
  { href: "/merchant/pos?panel=reports", label: "訂單與報表", description: "訂單紀錄、日報、現金流", icon: BarChart3 },
  { href: "/merchant/customers", label: "會員與促銷", description: "會員、點數、活動券", icon: Users },
  { href: "/merchant/settings", label: "店家設定", description: "QR、營業、設備、權限", icon: Settings },
];

export function MerchantDashboard({ view = "dashboard" }: { view?: MerchantView }) {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff", "viewer"]} title="店家後台">
      {({ profile, signOutUser }) => {
        if (!profile) return null;

        if (profile.status === "pending" || profile.status === "rejected") {
          return (
            <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
                <QrCode className="size-10 text-leaf" />
                <h1 className="mt-4 text-3xl font-black text-slate-900">{profile.status === "rejected" ? "帳號未通過審核" : "帳號等待審核"}</h1>
                <p className="mt-2 text-sm font-semibold text-slate-500">請等待平台管理員核准後再進入店家後台。</p>
                <button onClick={signOutUser} className="mt-5 rounded-xl bg-slate-900 px-4 py-3 font-black text-white">登出</button>
              </div>
            </main>
          );
        }

        if (!isPlatformAdmin(profile) && accessibleStoreIds(profile).length === 0) {
          return (
            <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-black text-leaf">尚未綁定店家</p>
                <h1 className="mt-2 text-3xl font-black text-slate-900">請聯絡平台管理員授權店家</h1>
                <p className="mt-3 leading-7 text-slate-500">此帳號目前沒有任何可操作的店家，授權後重新登入即可使用。</p>
                <button onClick={signOutUser} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-black text-white">登出</button>
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
  const { db, upsertStore } = useDemoStore({ storeId: bootstrapStoreId, admin: isAdmin, skipOrderList: true });
  const storeIds = useMemo(
    () => isAdmin
      ? db.stores.filter((store) => !store.isDeleted && store.id !== "demo-store").map((store) => store.id)
      : authorizedStoreIds,
    [authorizedStoreIds, db.stores, isAdmin]
  );
  const activeStoreId = storeIds.includes(selectedStoreId) ? selectedStoreId : storeIds[0] ?? "";
  const store = db.stores.find((item) => item.id === activeStoreId);
  const storeRole = storeRoleFor(profile, activeStoreId);
  const permissions = resolvePermissions(profile, activeStoreId);
  const canManageStore = isAdmin || permissions.canManageMenu;
  const storeAccessCheck = !isAdmin ? checkStoreAccess(store) : { ok: true, reason: "" };
  const userAccessCheck = !isAdmin ? checkUserAccess(profile, activeStoreId) : { ok: true, reason: "" };

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

  if (db.stores.length > 0 && !userAccessCheck.ok) {
    return <BlockedPage title="帳號授權已到期" reason={userAccessCheck.reason} onSignOut={onSignOut} />;
  }

  if (db.stores.length > 0 && !storeAccessCheck.ok) {
    return <BlockedPage title="店家服務暫停" reason={storeAccessCheck.reason} onSignOut={onSignOut} />;
  }

  function updateStore(patch: Partial<Store>) {
    if (!store) return;
    upsertStore({ ...store, ...patch });
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-slate-200 bg-slate-900 p-4 text-white lg:sticky lg:top-0 lg:min-h-screen lg:border-b-0">
        <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3">
          <div className="grid size-11 place-items-center rounded-xl bg-leaf">
            <ReceiptText className="size-5" />
          </div>
          <div className="min-w-0">
            {storeRole && <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-black ${roleBadgeClass(storeRole)}`}>{roleLabel(storeRole)}</span>}
            <p className="truncate font-black">{store?.name ?? "未命名店家"}</p>
            <p className="text-xs font-bold text-white/50">餐飲 QR 點餐系統</p>
          </div>
        </div>

        <nav className="mt-5 grid gap-1.5">
          {mainNav.map((item) => (
            <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActiveNav(item.href, view)} />
          ))}
        </nav>

        <div className="mt-5 grid gap-2 rounded-2xl bg-white/8 p-3">
          {isAdmin && storeIds.length > 1 ? (
            <label className="grid gap-1 text-xs font-black text-white/60">
              代管店家
              <select
                value={activeStoreId}
                onChange={(event) => setSelectedStoreId(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                {storeIds.map((id) => {
                  const optionStore = db.stores.find((item) => item.id === id);
                  return <option key={id} value={id}>{optionStore?.name ?? "未命名店家"}</option>;
                })}
              </select>
            </label>
          ) : (
            <p className="text-xs font-bold text-white/55">目前店家：{store?.name ?? "未命名店家"}</p>
          )}
          <button onClick={onSignOut} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white transition hover:bg-white/15">
            <LogOut className="size-4" />
            登出
          </button>
        </div>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-100/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-leaf">店家設定中心</p>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">管理店家資料、菜單、QR Code 與營業設定</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/merchant/pos" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <ShoppingCart className="size-4" />
                  前往 POS 工作台
                </Link>
                {canManageStore && <StoreStatusButtons store={store} updateStore={updateStore} />}
              </div>
            </div>
          </header>

          <DashboardOverview store={store} canManageStore={canManageStore} updateStore={updateStore} />
        </div>
      </section>
    </main>
  );
}

function isActiveNav(href: string, view: MerchantView) {
  if (href === "/merchant/menu") return view === "menu";
  if (href === "/merchant/settings") return view === "dashboard";
  return false;
}

function BlockedPage({ title, reason, onSignOut }: { title: string; reason: string; onSignOut: () => Promise<void> }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-tomato">{title}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">{reason}</h1>
        <button onClick={onSignOut} className="mt-5 rounded-xl bg-slate-900 px-4 py-3 font-black text-white">登出</button>
      </div>
    </main>
  );
}

function StoreStatusButtons({ store, updateStore }: { store?: Store; updateStore: (patch: Partial<Store>) => void }) {
  const isOpen = store?.isOpen && store.orderStatus !== "closed";
  return (
    <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
      <button onClick={() => updateStore({ isOpen: true, orderStatus: "open" })} className={`rounded-lg px-3 py-2 text-sm font-black transition ${isOpen ? "bg-leaf text-white" : "text-slate-500 hover:bg-slate-100"}`}>
        營業中
      </button>
      <button onClick={() => updateStore({ isOpen: false, orderStatus: "closed" })} className={`rounded-lg px-3 py-2 text-sm font-black transition ${!isOpen ? "bg-tomato text-white" : "text-slate-500 hover:bg-slate-100"}`}>
        休息中
      </button>
    </div>
  );
}

function SidebarItem({ href, icon: Icon, label, active = false }: { href: string; icon: React.ElementType; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-white/72 hover:bg-white/10 hover:text-white"}`}>
      <Icon className="size-5" />
      <span className="flex-1">{label}</span>
      <ChevronRight className={`size-4 transition ${active ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
    </Link>
  );
}

function ToggleButton({ active, label, onClick, disabled = false }: { active: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl px-4 py-4 text-left text-sm font-black shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${active ? "bg-emerald-50 text-leaf ring-1 ring-emerald-100" : "bg-rose-50 text-tomato ring-1 ring-rose-100"}`}
    >
      <span className="mb-1 block text-xs opacity-70">{active ? "已開放" : "已關閉"}</span>
      {label}
    </button>
  );
}

function DashboardOverview({
  store,
  canManageStore,
  updateStore,
}: {
  store?: Store;
  canManageStore: boolean;
  updateStore: (patch: Partial<Store>) => void;
}) {
  const [notice, setNotice] = useState(store?.temporaryNotice ?? "");

  useEffect(() => {
    setNotice(store?.temporaryNotice ?? "");
  }, [store?.temporaryNotice]);

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={StoreIcon} title="店家狀態" value={store?.isOpen ? "營業中" : "休息中"} tone={store?.isOpen ? "green" : "red"} />
          <MetricCard icon={QrCode} title="外帶 QR" value={(store?.takeoutOrderingEnabled ?? store?.takeoutEnabled ?? true) ? "開放" : "關閉"} />
          <MetricCard icon={ReceiptText} title="內用 QR" value={(store?.dineInOrderingEnabled ?? store?.dineInEnabled ?? true) ? "開放" : "關閉"} />
          <MetricCard icon={ShoppingCart} title="POS 現場單" value={(store?.posOrderingEnabled ?? true) ? "開放" : "關閉"} />
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">店家後台流程</h2>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-500">店家日常操作集中在點餐營運；設定、菜單、QR、會員則放在後台設定中心。</p>
            </div>
            <Link href="/merchant/pos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:shadow-md">
              <ShoppingCart className="size-4" />
              開啟 POS 工作台
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {mainNav.map((item) => (
              <SettingsCard key={item.href} href={item.href} title={item.label} description={item.description} icon={item.icon} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black text-slate-950">接單開關</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">可分開控制 QR 外帶、QR 內用與 POS 現場單，不互相影響。</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ToggleButton disabled={!canManageStore} label="開放外帶 QR 接單" active={store?.takeoutOrderingEnabled ?? store?.takeoutEnabled ?? true} onClick={() => updateStore({ takeoutOrderingEnabled: !(store?.takeoutOrderingEnabled ?? store?.takeoutEnabled ?? true) })} />
            <ToggleButton disabled={!canManageStore} label="開放內用 QR 接單" active={store?.dineInOrderingEnabled ?? store?.dineInEnabled ?? true} onClick={() => updateStore({ dineInOrderingEnabled: !(store?.dineInOrderingEnabled ?? store?.dineInEnabled ?? true) })} />
            <ToggleButton disabled={!canManageStore} label="開放 POS 現場單" active={store?.posOrderingEnabled ?? true} onClick={() => updateStore({ posOrderingEnabled: !(store?.posOrderingEnabled ?? true) })} />
          </div>
        </section>
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">臨時公告</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">顯示在顧客 QR 點餐頁店名下方。</p>
          <textarea
            value={notice}
            onChange={(event) => setNotice(event.target.value)}
            placeholder="例如：現場爆單，餐點需等候約 20 分鐘。"
            disabled={!canManageStore}
            className="mt-4 min-h-28 w-full rounded-2xl border-0 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-leaf disabled:opacity-60"
          />
          <button onClick={() => updateStore({ temporaryNotice: notice })} disabled={!canManageStore} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
            儲存公告
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">後台設定建議</h2>
          <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600">
            <p className="rounded-xl bg-slate-100 px-3 py-2">先建立分類與商品</p>
            <p className="rounded-xl bg-slate-100 px-3 py-2">在商品內套用甜度、冰塊、加料等共用群組</p>
            <p className="rounded-xl bg-slate-100 px-3 py-2">產生外帶與桌號 QR Code</p>
            <p className="rounded-xl bg-slate-100 px-3 py-2">設定印單機與 KDS</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, tone = "slate" }: { icon: React.ElementType; title: string; value: string; tone?: "slate" | "green" | "red" }) {
  const toneClass = tone === "green" ? "bg-emerald-50 text-leaf" : tone === "red" ? "bg-rose-50 text-tomato" : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`grid size-10 place-items-center rounded-xl ${toneClass}`}>
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SettingsCard({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: React.ElementType }) {
  return (
    <Link href={href} className="group rounded-2xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-white text-slate-700 shadow-sm transition group-hover:bg-leaf group-hover:text-white">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}
