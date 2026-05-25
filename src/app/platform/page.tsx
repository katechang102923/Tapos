"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, ArrowLeft, Bell, Building2, CalendarClock, Contact, Eye, EyeOff, Gift, Infinity, Menu as MenuIcon, Monitor, Plus, RotateCcw, Search, ShieldCheck, Store, Trash2, ToggleLeft, ToggleRight, Users, Wallet } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { normalizeStoreMemberRole } from "@/lib/roles";
import { SUBSCRIPTION_STATUS_COLORS, SUBSCRIPTION_STATUS_LABELS, addDays, daysUntil, effectiveSubscriptionStatus, formatDate } from "@/lib/subscription";
import type { BusinessType, PlatformNotification, Store as StoreType, StoreMemberRole, SubscriptionStatus } from "@/lib/types";

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  breakfast:  "早餐店",
  drink:      "飲料店",
  snack:      "小吃店",
  restaurant: "餐廳",
  other:      "其他",
};

const STORE_ROLE_LABELS: Record<StoreMemberRole, string> = {
  owner: "老闆",
  manager: "店長",
  staff: "員工",
  viewer: "檢視者"
};

export default function PlatformPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin"]} title="平台管理中心登入">
      {({ signOutUser }) => <PlatformContent onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function PlatformContent({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const {
    db, bindStoreUser, unbindStoreUser, upsertStore, updateStoreSubscription,
    markNotificationRead, markRecordsForArchive, softDeleteStore, restoreStore, upsertMemberRules
  } = useDemoStore({ admin: true });

  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [notifSearch, setNotifSearch] = useState("");
  const [bindingEmail, setBindingEmail] = useState<Record<string, string>>({});
  const [bindingRole, setBindingRole] = useState<Record<string, StoreMemberRole>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [subEditorOpen, setSubEditorOpen] = useState<Record<string, boolean>>({});
  const [subForm, setSubForm] = useState<Record<string, { status: SubscriptionStatus; endsAt: string; trialEndsAt: string }>>({});
  const [archiving, setArchiving] = useState<Record<string, boolean>>({});
  const [customRetentionOpen, setCustomRetentionOpen] = useState<Record<string, boolean>>({});
  const [customRetentionDate, setCustomRetentionDate] = useState<Record<string, string>>({});
  /** Store pending deletion confirmation; null = modal closed */
  const [deleteConfirm, setDeleteConfirm] = useState<StoreType | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [storeCreatorOpen, setStoreCreatorOpen] = useState(false);
  const [newStoreForm, setNewStoreForm] = useState({
    name: "",
    businessType: "breakfast" as BusinessType,
    isOpen: true,
    subscriptionEndsAt: "",
    dataRetentionMonths: "6"
  });

  const activeStores = useMemo(() => db.stores.filter((s) => !s.isDeleted), [db.stores]);
  const deletedStores = useMemo(() => db.stores.filter((s) => s.isDeleted), [db.stores]);

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = showDeleted ? db.stores : activeStores;
    return pool.filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [db.stores, activeStores, search, showDeleted]);

  const linkedUserCount = useMemo(() => {
    const map = new Map<string, number>();
    db.users.forEach((user) => {
      const ids = user.storeIds?.length ? user.storeIds : user.storeId ? [user.storeId] : [];
      ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [db.users]);

  function storeUsers(storeId: string) {
    return db.users.filter((u) => u.storeIds?.includes(storeId) || u.storeId === storeId);
  }

  const notifications = useMemo<PlatformNotification[]>(() => {
    const q = notifSearch.trim().toLowerCase();
    return (db.platformNotifications ?? [])
      .filter((notif) => notif.type === "new_registration")
      .filter((n) => !q || n.email.toLowerCase().includes(q) || n.storeName.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.platformNotifications, notifSearch]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !(n.isRead ?? n.read)).length,
    [notifications]
  );

  async function handleMarkRead(notifId: string) {
    try {
      await markNotificationRead(notifId);
    } catch {
      setError("標記已讀失敗");
    }
  }

  async function createPlatformStore() {
    const name = newStoreForm.name.trim();
    if (!name) {
      setError("請輸入店家名稱");
      return;
    }
    const now = new Date().toISOString();
    const storeId = `store-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    const retention = newStoreForm.dataRetentionMonths === "never" ? null : Number(newStoreForm.dataRetentionMonths);
    const storeType = newStoreForm.businessType === "drink" ? "drink" : newStoreForm.businessType === "snack" ? "snack" : "breakfast";
    setSaving("create-store");
    setError("");
    setMessage("");
    try {
      await upsertStore({
        id: storeId,
        name,
        logoUrl: "",
        bannerUrl: "",
        ownerId: "",
        storeType,
        businessType: newStoreForm.businessType,
        isOpen: newStoreForm.isOpen,
        orderStatus: newStoreForm.isOpen ? "open" : "closed",
        takeoutEnabled: true,
        dineInEnabled: true,
        takeoutOrderingEnabled: true,
        dineInOrderingEnabled: true,
        posOrderingEnabled: true,
        dataRetentionMode: newStoreForm.dataRetentionMonths === "never" ? "neverExpire" : "months",
        dataRetentionMonths: retention,
        dataRetentionUntil: null,
        subscriptionStatus: "active",
        subscriptionEndsAt: newStoreForm.subscriptionEndsAt || undefined,
        features: {
          kdsEnabled: true,
          dailyReportEnabled: true,
          cashFlowEnabled: true,
          memberEnabled: true,
          memberStoredValueEnabled: true,
          promotionEnabled: true
        },
        createdAt: now
      });
      await upsertMemberRules(storeId, {
        enablePoints: true,
        earnAmount: 100,
        earnPoints: 1,
        pointValue: 1,
        enableCouponExchange: true,
        birthdayRewardEnabled: false,
        birthdayRewardPoints: 0,
        updatedAt: now
      });
      setMessage(`已建立店家：${name}`);
      setStoreCreatorOpen(false);
      setNewStoreForm({ name: "", businessType: "breakfast", isOpen: true, subscriptionEndsAt: "", dataRetentionMonths: "6" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立店家失敗");
    } finally {
      setSaving("");
    }
  }

  async function toggleFeature(store: StoreType, feature: keyof NonNullable<StoreType["features"]>) {
    await upsertStore({ ...store, features: { ...store.features, [feature]: !store.features?.[feature] } });
  }

  async function handleBind(storeId: string) {
    const email = bindingEmail[storeId]?.trim();
    if (!email) return;
    setSaving(`bind-${storeId}`);
    setError("");
    setMessage("");
    try {
      await bindStoreUser(email, storeId, bindingRole[storeId] ?? "staff");
      setBindingEmail((prev) => ({ ...prev, [storeId]: "" }));
      setMessage(`已綁定 ${email}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "綁定失敗");
    } finally {
      setSaving("");
    }
  }

  async function handleUnbind(userId: string, storeId: string, email: string) {
    if (!confirm(`確定解除 ${email} 對此店家的綁定？`)) return;
    try {
      await unbindStoreUser(userId, storeId);
      setMessage(`已解除 ${email} 的綁定`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解除失敗");
    }
  }

  function openSubEditor(store: StoreType) {
    const effectiveStatus = effectiveSubscriptionStatus(store);
    setSubForm((prev) => ({
      ...prev,
      [store.id]: {
        status: store.subscriptionStatus ?? effectiveStatus,
        endsAt: store.subscriptionEndsAt?.slice(0, 10) ?? "",
        trialEndsAt: store.trialEndsAt?.slice(0, 10) ?? "",
      }
    }));
    setSubEditorOpen((prev) => ({ ...prev, [store.id]: !prev[store.id] }));
  }

  async function extendSubscription(store: StoreType, days: number) {
    const base = store.subscriptionEndsAt && (daysUntil(store.subscriptionEndsAt) ?? -1) >= 0
      ? store.subscriptionEndsAt
      : undefined;
    const newEndsAt = addDays(base, days);
    setSaving(`sub-${store.id}`);
    setError("");
    try {
      await updateStoreSubscription(store.id, { subscriptionStatus: "active", subscriptionEndsAt: newEndsAt });
      setMessage(`${store.name} 已延長至 ${newEndsAt}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "延長失敗");
    } finally {
      setSaving("");
    }
  }

  async function saveSubscription(store: StoreType) {
    const form = subForm[store.id];
    if (!form) return;
    setSaving(`sub-${store.id}`);
    setError("");
    try {
      await updateStoreSubscription(store.id, {
        subscriptionStatus: form.status,
        subscriptionEndsAt: form.endsAt || undefined,
        trialEndsAt: form.trialEndsAt || undefined,
      });
      setMessage(`${store.name} 訂閱資訊已更新`);
      setSubEditorOpen((prev) => ({ ...prev, [store.id]: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving("");
    }
  }

  async function suspendStore(store: StoreType) {
    if (!confirm(`確定暫停 ${store.name} 的服務？`)) return;
    setSaving(`sub-${store.id}`);
    setError("");
    try {
      await updateStoreSubscription(store.id, { subscriptionStatus: "suspended" });
      setMessage(`${store.name} 已暫停`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "暫停失敗");
    } finally {
      setSaving("");
    }
  }

  async function resumeStore(store: StoreType) {
    setSaving(`sub-${store.id}`);
    setError("");
    try {
      await updateStoreSubscription(store.id, { subscriptionStatus: "active" });
      setMessage(`${store.name} 已恢復`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "恢復失敗");
    } finally {
      setSaving("");
    }
  }

  async function handleSetRetentionMonths(store: StoreType, months: number) {
    try {
      await upsertStore({ ...store, dataRetentionMode: "months", dataRetentionMonths: months, dataRetentionUntil: null });
      setMessage(`${store.name} 資料保留期限已設為 ${months} 個月`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定失敗");
    }
  }

  async function handleSetRetentionCustomDate(store: StoreType) {
    const date = customRetentionDate[store.id]?.trim();
    if (!date) return;
    try {
      await upsertStore({ ...store, dataRetentionMode: "customDate", dataRetentionMonths: null, dataRetentionUntil: date });
      setCustomRetentionOpen((prev) => ({ ...prev, [store.id]: false }));
      setMessage(`${store.name} 資料保留至 ${date}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定失敗");
    }
  }

  async function handleSetRetentionNever(store: StoreType) {
    try {
      await upsertStore({ ...store, dataRetentionMode: "neverExpire", dataRetentionMonths: null, dataRetentionUntil: null });
      setMessage(`${store.name} 已設為無使用期限`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定失敗");
    }
  }

  function retentionLabel(store: StoreType): string {
    if (store.dataRetentionMode === "neverExpire") return "無使用期限";
    if (store.dataRetentionMode === "customDate" && store.dataRetentionUntil) return `保留至 ${formatDate(store.dataRetentionUntil)}`;
    return `保留 ${store.dataRetentionMonths ?? 6} 個月`;
  }

  async function handleMarkArchive(store: StoreType) {
    if (store.dataRetentionMode === "neverExpire") {
      setMessage(`${store.name} 已設為無使用期限，無需封存舊資料`);
      return;
    }
    const months = store.dataRetentionMonths ?? 6;
    if (!confirm(`確定標記 ${store.name} 超過 ${months} 個月的資料為封存？此操作不可逆（軟封存，不刪除資料）。`)) return;
    setArchiving((prev) => ({ ...prev, [store.id]: true }));
    setError("");
    try {
      await markRecordsForArchive(store.id, months);
      setMessage(`${store.name} 已完成資料封存標記`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "封存失敗");
    } finally {
      setArchiving((prev) => ({ ...prev, [store.id]: false }));
    }
  }

  // ─── Soft delete / restore ────────────────────────────────────────────────

  function openDeleteConfirm(store: StoreType) {
    setDeleteConfirm(store);
    setDeleteConfirmChecked(false);
  }

  async function confirmSoftDelete() {
    if (!deleteConfirm || !deleteConfirmChecked) return;
    setSaving(`del-${deleteConfirm.id}`);
    setError("");
    try {
      await softDeleteStore(deleteConfirm.id);
      setMessage(`「${deleteConfirm.name}」已刪除。店家後台、POS、QR、KDS 已停止服務。`);
      setDeleteConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗");
    } finally {
      setSaving("");
    }
  }

  async function handleRestoreStore(store: StoreType) {
    if (!confirm(`確定恢復「${store.name}」？恢復後店家將重新開放服務。`)) return;
    setSaving(`restore-${store.id}`);
    setError("");
    try {
      await restoreStore(store.id);
      setMessage(`「${store.name}」已恢復，服務重新開放。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "恢復失敗");
    } finally {
      setSaving("");
    }
  }

  const roleMemberRoles: StoreMemberRole[] = ["owner", "manager", "staff", "viewer"];

  return (
    <main className="min-h-screen bg-[#0f0f0f] p-4 text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-lg bg-[#1a1a1a] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-lg bg-tomato"><ShieldCheck className="size-8" /></div>
            <div>
              <p className="text-sm font-black text-white/50">Platform Admin</p>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black">平台管理中心</h1>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-tomato px-2.5 py-1 text-sm font-black text-white">
                    <Bell className="size-3.5" />新註冊 {unreadCount} 筆
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ArrowLeft className="size-4" />首頁</Link>
            <button onClick={() => setStoreCreatorOpen((prev) => !prev)} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white"><Plus className="size-4" />新增店家</button>
            <button onClick={onSignOut} className="rounded-lg bg-white/10 px-4 py-3 font-black text-white">登出</button>
          </div>
        </header>

        {storeCreatorOpen && (
          <section className="mb-6 rounded-lg bg-[#1a1a1a] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-leaf">新增店家</p>
                <h2 className="text-2xl font-black text-white">建立新的店家資料</h2>
              </div>
              <button onClick={() => setStoreCreatorOpen(false)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-black text-white">關閉</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-black text-white/70">
                店家名稱 *
                <input value={newStoreForm.name} onChange={(event) => setNewStoreForm((prev) => ({ ...prev, name: event.target.value }))} className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none" />
              </label>
              <label className="grid gap-1 text-sm font-black text-white/70">
                店家類型
                <select value={newStoreForm.businessType} onChange={(event) => setNewStoreForm((prev) => ({ ...prev, businessType: event.target.value as BusinessType }))} className="rounded-lg border border-white/10 bg-[#111] px-4 py-3 font-bold text-white outline-none">
                  <option value="breakfast">早餐店</option>
                  <option value="drink">飲料店</option>
                  <option value="snack">鍋燒麵店</option>
                  <option value="other">其他</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black text-white/70">
                狀態
                <select value={newStoreForm.isOpen ? "open" : "closed"} onChange={(event) => setNewStoreForm((prev) => ({ ...prev, isOpen: event.target.value === "open" }))} className="rounded-lg border border-white/10 bg-[#111] px-4 py-3 font-bold text-white outline-none">
                  <option value="open">營業中</option>
                  <option value="closed">休息中</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black text-white/70">
                訂閱到期日
                <input type="date" value={newStoreForm.subscriptionEndsAt} onChange={(event) => setNewStoreForm((prev) => ({ ...prev, subscriptionEndsAt: event.target.value }))} className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none" />
              </label>
              <label className="grid gap-1 text-sm font-black text-white/70">
                資料保留策略
                <select value={newStoreForm.dataRetentionMonths} onChange={(event) => setNewStoreForm((prev) => ({ ...prev, dataRetentionMonths: event.target.value }))} className="rounded-lg border border-white/10 bg-[#111] px-4 py-3 font-bold text-white outline-none">
                  <option value="3">3 個月</option>
                  <option value="6">6 個月</option>
                  <option value="12">12 個月</option>
                  <option value="24">24 個月</option>
                  <option value="never">無期限</option>
                </select>
              </label>
              <div className="flex items-end">
                <button onClick={createPlatformStore} disabled={saving === "create-store"} className="w-full rounded-lg bg-leaf px-5 py-3 font-black text-white disabled:opacity-50">
                  {saving === "create-store" ? "建立中..." : "建立店家"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Stat cards */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-[#1a1a1a] p-5">
            <p className="text-sm font-black text-white/50">店家總數</p>
            <p className="mt-2 text-4xl font-black text-white">{activeStores.length}</p>
            {deletedStores.length > 0 && (
              <p className="mt-1 text-xs font-bold text-white/30">已刪除 {deletedStores.length} 家（隱藏中）</p>
            )}
          </div>
          <div className="rounded-lg bg-[#1a1a1a] p-5">
            <p className="text-sm font-black text-white/50">帳號總數</p>
            <p className="mt-2 text-4xl font-black text-white">{db.users.length}</p>
          </div>
        </div>

        {message && <div className="mb-4 rounded-lg border border-leaf/30 bg-leaf/10 p-4 font-black text-leaf">{message}</div>}
        {error && <div className="mb-4 rounded-lg border border-tomato/30 bg-tomato/10 p-4 font-black text-tomato">{error}</div>}

        {/* New registration notifications */}
        <section className="mb-6 rounded-lg bg-[#1a1a1a] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Bell className="size-5 text-white/60" />
              <p className="font-black text-white">新註冊店家通知</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-tomato px-2 py-0.5 text-xs font-black text-white">{unreadCount} 未讀</span>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
              <Search className="size-4 text-white/40" />
              <input
                value={notifSearch}
                onChange={(e) => setNotifSearch(e.target.value)}
                placeholder="搜尋信箱或店名..."
                className="w-44 bg-transparent text-sm font-bold text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-sm font-bold text-white/30">
              {notifSearch ? "找不到符合的通知" : "尚無新的註冊申請"}
            </p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => {
                const isRead = notif.isRead ?? notif.read;
                return (
                  <div key={notif.id} className={`rounded-lg p-4 ${isRead ? "bg-white/5" : "border border-amber-500/30 bg-amber-500/10"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!isRead && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-white">未讀</span>}
                          <span className="font-black text-white">{notif.storeName}</span>
                          {notif.businessType && (
                            <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">
                              {BUSINESS_TYPE_LABELS[notif.businessType] ?? notif.businessType}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white/60">{notif.email}</p>
                        <p className="text-xs font-bold text-white/30">{new Date(notif.createdAt).toLocaleString("zh-TW")}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isRead && (
                          <button onClick={() => handleMarkRead(notif.id)} className="rounded bg-white/10 px-3 py-1.5 text-xs font-black text-white/70 hover:bg-white/20">
                            標記已讀
                          </button>
                        )}
                        {notif.storeId && (
                          <Link href={`/merchant/menu?storeId=${notif.storeId}`} className="rounded bg-leaf/20 px-3 py-1.5 text-xs font-black text-leaf hover:bg-leaf/30">
                            前往店家管理
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Search + show-deleted toggle */}
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-[#1a1a1a] px-4 py-3">
          <Search className="size-5 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋店家名稱或 ID..." className="flex-1 bg-transparent font-bold text-white placeholder:text-white/30 focus:outline-none" />
          <button
            onClick={() => setShowDeleted((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition ${showDeleted ? "bg-tomato/20 text-tomato" : "bg-white/10 text-white/50 hover:bg-white/20"}`}
          >
            {showDeleted ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {showDeleted ? `顯示已刪除（${deletedStores.length}）` : "顯示已刪除店家"}
          </button>
        </div>

        {/* Store cards */}
        <div className="space-y-5">
          {filteredStores.length === 0 ? (
            <div className="rounded-lg bg-[#1a1a1a] p-12 text-center">
              <Store className="mx-auto size-12 text-white/20" />
              <p className="mt-4 font-black text-white/40">找不到符合的店家</p>
            </div>
          ) : filteredStores.map((store) => {
            const isDeleted = store.isDeleted === true;
            const users = storeUsers(store.id);
            const userCount = linkedUserCount.get(store.id) ?? 0;
            const subStatus = effectiveSubscriptionStatus(store);
            const remainDays = daysUntil(store.subscriptionEndsAt);
            const subOpen = subEditorOpen[store.id] ?? false;
            const subF = subForm[store.id];
            const isSavingSub = saving === `sub-${store.id}`;
            const isDeleting = saving === `del-${store.id}`;
            const isRestoring = saving === `restore-${store.id}`;

            return (
              <div key={store.id} className={`rounded-lg p-5 ${isDeleted ? "border border-tomato/20 bg-[#1a1a1a] opacity-70" : "bg-[#1a1a1a]"}`}>
                {/* Deleted banner */}
                {isDeleted && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tomato/30 bg-tomato/10 px-4 py-3">
                    <div>
                      <span className="text-sm font-black text-tomato">已刪除店家</span>
                      {store.deletedAt && (
                        <span className="ml-3 text-xs font-bold text-tomato/60">
                          刪除時間：{new Date(store.deletedAt).toLocaleString("zh-TW")}
                        </span>
                      )}
                      {store.deletedBy && (
                        <span className="ml-3 text-xs font-bold text-tomato/40">by {store.deletedBy}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRestoreStore(store)}
                      disabled={isRestoring}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-leaf/20 px-3 py-2 text-sm font-black text-leaf hover:bg-leaf/30 disabled:opacity-40"
                    >
                      <RotateCcw className="size-4" />
                      {isRestoring ? "恢復中…" : "恢復店家"}
                    </button>
                  </div>
                )}

                {/* Store header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt={store.name} className="size-14 rounded-lg object-cover" />
                    ) : (
                      <div className="grid size-14 place-items-center rounded-lg bg-white/10"><Building2 className="size-7 text-white/40" /></div>
                    )}
                    <div>
                      <p className="text-xl font-black">{store.name}</p>
                      <p className="mt-0.5 text-xs font-bold text-white/40">{store.id}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-white/50">
                        <span className="flex items-center gap-1.5"><Users className="size-4" />{userCount} 個帳號</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${store.isOpen ? "bg-leaf/20 text-leaf" : "bg-tomato/20 text-tomato"}`}>{store.isOpen ? "營業中" : "休息中"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${SUBSCRIPTION_STATUS_COLORS[subStatus]}`}>{SUBSCRIPTION_STATUS_LABELS[subStatus]}</span>
                        {store.subscriptionEndsAt && (
                          <span className="flex items-center gap-1 text-xs font-black text-white/40">
                            <CalendarClock className="size-3" />
                            到期：{formatDate(store.subscriptionEndsAt)}
                            {remainDays !== null && remainDays >= 0 && ` （剩 ${remainDays} 天）`}
                            {remainDays !== null && remainDays < 0 && " （已到期）"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white/30">{retentionLabel(store)}</span>
                    {!isDeleted && (
                      <Link
                        href={`/merchant/menu?storeId=${store.id}&adminMode=1`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-leaf/20 px-3 py-2 text-xs font-black text-leaf hover:bg-leaf/30"
                      >
                        <MenuIcon className="size-3.5" />
                        代管菜單
                      </Link>
                    )}
                    {!isDeleted && (
                      <button
                        onClick={() => openDeleteConfirm(store)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-tomato/20 px-3 py-2 text-xs font-black text-tomato hover:bg-tomato/30 disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" />
                        刪除店家
                      </button>
                    )}
                  </div>
                </div>

                {/* Skip management sections for deleted stores */}
                {!isDeleted && (
                  <>
                    {/* Subscription management */}
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="mr-1 text-xs font-black text-white/40">訂閱方案</p>
                        <button onClick={() => extendSubscription(store, 7)} disabled={isSavingSub} className="rounded bg-white/10 px-2 py-1 text-xs font-black text-white/70 hover:bg-white/20 disabled:opacity-40">+7 天</button>
                        <button onClick={() => extendSubscription(store, 30)} disabled={isSavingSub} className="rounded bg-white/10 px-2 py-1 text-xs font-black text-white/70 hover:bg-white/20 disabled:opacity-40">+30 天</button>
                        <button onClick={() => extendSubscription(store, 90)} disabled={isSavingSub} className="rounded bg-white/10 px-2 py-1 text-xs font-black text-white/70 hover:bg-white/20 disabled:opacity-40">+90 天</button>
                        {subStatus !== "suspended" ? (
                          <button onClick={() => suspendStore(store)} disabled={isSavingSub} className="rounded bg-tomato/20 px-2 py-1 text-xs font-black text-tomato hover:bg-tomato/30 disabled:opacity-40">暫停店家</button>
                        ) : (
                          <button onClick={() => resumeStore(store)} disabled={isSavingSub} className="rounded bg-leaf/20 px-2 py-1 text-xs font-black text-leaf hover:bg-leaf/30 disabled:opacity-40">恢復店家</button>
                        )}
                        <button onClick={() => openSubEditor(store)} className="rounded bg-white/10 px-2 py-1 text-xs font-black text-white/70 hover:bg-white/20">
                          {subOpen ? "收起" : "自訂日期"}
                        </button>
                      </div>
                      {subOpen && subF !== undefined && (
                        <div className="mt-3 space-y-3 rounded-lg bg-white/5 p-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className="grid gap-1 text-xs font-black text-white/40">
                              方案狀態
                              <select
                                value={subF.status}
                                onChange={(e) => setSubForm((prev) => ({ ...prev, [store.id]: { ...prev[store.id], status: e.target.value as SubscriptionStatus } }))}
                                className="rounded bg-white/10 px-2 py-1.5 text-sm font-bold text-white"
                              >
                                {(Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[]).map((s) => (
                                  <option key={s} value={s}>{SUBSCRIPTION_STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                            </label>
                            <label className="grid gap-1 text-xs font-black text-white/40">
                              訂閱到期日
                              <input type="date" value={subF.endsAt} onChange={(e) => setSubForm((prev) => ({ ...prev, [store.id]: { ...prev[store.id], endsAt: e.target.value } }))} className="rounded bg-white/10 px-2 py-1.5 text-sm font-bold text-white [color-scheme:dark]" />
                            </label>
                            <label className="grid gap-1 text-xs font-black text-white/40">
                              試用到期日
                              <input type="date" value={subF.trialEndsAt} onChange={(e) => setSubForm((prev) => ({ ...prev, [store.id]: { ...prev[store.id], trialEndsAt: e.target.value } }))} className="rounded bg-white/10 px-2 py-1.5 text-sm font-bold text-white [color-scheme:dark]" />
                            </label>
                          </div>
                          <button onClick={() => saveSubscription(store)} disabled={isSavingSub} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                            {isSavingSub ? "儲存中..." : "儲存訂閱設定"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Feature toggles */}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <p className="w-full text-xs font-black text-white/40">功能開關</p>
                      {(
                        [
                          { key: "kdsEnabled" as const, label: "廚房 KDS", icon: Monitor },
                          { key: "promotionEnabled" as const, label: "促銷活動", icon: Gift },
                          { key: "dailyReportEnabled" as const, label: "日報表", icon: Store },
                          { key: "cashFlowEnabled" as const, label: "現金流", icon: Store },
                          { key: "memberEnabled" as const, label: "會員功能", icon: Contact },
                          { key: "memberStoredValueEnabled" as const, label: "儲值功能", icon: Wallet },
                        ] as const
                      ).map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => toggleFeature(store, key)}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black ${store.features?.[key] ? "bg-leaf/20 text-leaf" : "bg-white/10 text-white/50"}`}
                        >
                          {store.features?.[key] ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Data retention */}
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="w-full text-xs font-black text-white/40">
                          資料保留策略
                          <span className="ml-2 text-amber-400">目前：{retentionLabel(store)}</span>
                        </p>
                        {[3, 6, 12, 24].map((months) => {
                          const active = store.dataRetentionMode !== "customDate" && store.dataRetentionMode !== "neverExpire" && (store.dataRetentionMonths ?? 6) === months;
                          return (
                            <button key={months} onClick={() => handleSetRetentionMonths(store, months)} className={`rounded px-2 py-1 text-xs font-black ${active ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white/50 hover:bg-white/20"}`}>
                              {months} 個月
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setCustomRetentionOpen((prev) => ({ ...prev, [store.id]: !prev[store.id] }))}
                          className={`rounded px-2 py-1 text-xs font-black ${store.dataRetentionMode === "customDate" ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white/50 hover:bg-white/20"}`}
                        >
                          自訂日期
                        </button>
                        <button
                          onClick={() => handleSetRetentionNever(store)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-black ${store.dataRetentionMode === "neverExpire" ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white/50 hover:bg-white/20"}`}
                        >
                          <Infinity className="size-3" />無使用期限
                        </button>
                        <button
                          onClick={() => handleMarkArchive(store)}
                          disabled={archiving[store.id] || store.dataRetentionMode === "neverExpire"}
                          className="inline-flex items-center gap-1.5 rounded bg-tomato/20 px-3 py-1.5 text-xs font-black text-tomato hover:bg-tomato/30 disabled:opacity-40"
                        >
                          <ArchiveRestore className="size-3.5" />
                          {archiving[store.id] ? "封存中…" : "立即封存舊資料"}
                        </button>
                      </div>
                      {customRetentionOpen[store.id] && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                          <span className="text-xs font-black text-white/40">保留至</span>
                          <input
                            type="date"
                            value={customRetentionDate[store.id] ?? store.dataRetentionUntil?.slice(0, 10) ?? ""}
                            onChange={(e) => setCustomRetentionDate((prev) => ({ ...prev, [store.id]: e.target.value }))}
                            className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-white [color-scheme:dark]"
                          />
                          <button onClick={() => handleSetRetentionCustomDate(store)} disabled={!customRetentionDate[store.id]} className="rounded bg-leaf px-3 py-1 text-xs font-black text-white disabled:opacity-40">確認</button>
                          <button onClick={() => setCustomRetentionOpen((prev) => ({ ...prev, [store.id]: false }))} className="rounded bg-white/10 px-2 py-1 text-xs font-black text-white/50">取消</button>
                        </div>
                      )}
                    </div>

                    {/* Bound users */}
                    {users.length > 0 && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="mb-2 text-xs font-black text-white/40">已綁定帳號（詳細權限請由店家後台 → 帳號管理設定）</p>
                        <div className="flex flex-wrap gap-2">
                          {users.map((user) => {
                            const userStoreRole = normalizeStoreMemberRole(user.storeRoles?.[store.id] ?? user.memberships?.[store.id]);
                            return (
                              <div key={user.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
                                <span className="text-sm font-bold text-white">{user.email}</span>
                                {userStoreRole && (
                                  <span className="rounded border border-[#2f7a54] bg-[#123a2a] px-2 py-0.5 text-xs font-black text-[#b9f6d3] shadow-sm">{STORE_ROLE_LABELS[userStoreRole]}</span>
                                )}
                                <button onClick={() => handleUnbind(user.id, store.id, user.email)} className="text-xs font-black text-tomato hover:underline">解除</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bind form */}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <p className="w-full text-xs font-black text-white/40">綁定帳號</p>
                      <input
                        value={bindingEmail[store.id] ?? ""}
                        onChange={(e) => setBindingEmail((prev) => ({ ...prev, [store.id]: e.target.value }))}
                        placeholder="輸入帳號 email..."
                        className="min-w-48 flex-1 rounded-lg border border-white/25 bg-[#111] px-3 py-2 text-sm font-bold text-white shadow-sm placeholder:text-white/45 focus:border-leaf focus:bg-[#161616] focus:outline-none"
                      />
                      <select
                        value={bindingRole[store.id] ?? "staff"}
                        onChange={(e) => setBindingRole((prev) => ({ ...prev, [store.id]: e.target.value as StoreMemberRole }))}
                        className="rounded-lg border border-white/25 bg-[#111] px-3 py-2 text-sm font-bold text-white shadow-sm focus:border-leaf focus:bg-[#161616] focus:outline-none"
                      >
                        {roleMemberRoles.map((r) => <option key={r} value={r} className="bg-[#111] text-white">{STORE_ROLE_LABELS[r]}</option>)}
                      </select>
                      <button
                        onClick={() => handleBind(store.id)}
                        disabled={saving === `bind-${store.id}`}
                        className="rounded-lg border border-leaf bg-leaf px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-leaf/90 disabled:opacity-60"
                      >
                        {saving === `bind-${store.id}` ? "綁定中..." : "綁定"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#1a1a1a] p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-lg bg-tomato/20">
                <Trash2 className="size-6 text-tomato" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">確認刪除店家</h2>
                <p className="text-sm font-bold text-white/50">此操作可由管理員恢復</p>
              </div>
            </div>

            <div className="mb-5 rounded-lg border border-tomato/30 bg-tomato/10 p-4">
              <p className="text-lg font-black text-white">{deleteConfirm.name}</p>
              <p className="mt-0.5 text-xs font-bold text-white/40">{deleteConfirm.id}</p>
            </div>

            <div className="mb-5 space-y-2 text-sm font-bold text-white/60">
              <p>刪除後將立即：</p>
              <ul className="ml-4 list-disc space-y-1 text-white/50">
                <li>店家後台無法登入</li>
                <li>POS 系統停止服務</li>
                <li>QR 點餐頁顯示「休息中」</li>
                <li>KDS 廚房顯示停止服務</li>
              </ul>
              <p className="mt-3 text-white/40">資料保留，可由平台管理員隨時恢復。</p>
            </div>

            <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <input
                type="checkbox"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                className="mt-0.5 size-4 accent-tomato"
              />
              <span className="text-sm font-bold text-white/70">
                我確認要刪除「{deleteConfirm.name}」，並了解店家服務將立即中斷
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-lg bg-white/10 px-4 py-3 font-black text-white/70 hover:bg-white/20"
              >
                取消
              </button>
              <button
                onClick={confirmSoftDelete}
                disabled={!deleteConfirmChecked || saving === `del-${deleteConfirm.id}`}
                className="flex-1 rounded-lg bg-tomato px-4 py-3 font-black text-white disabled:opacity-40"
              >
                {saving === `del-${deleteConfirm.id}` ? "刪除中…" : "確認刪除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
