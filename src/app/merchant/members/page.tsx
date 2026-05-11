"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Users } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { PERMISSION_LABELS, ROLE_LABELS, defaultPermissionsForRole, roleBadgeClass, roleLabel, resolvePermissions } from "@/lib/permissions";
import { accessibleStoreIds, defaultStoreId } from "@/lib/store-access";
import { ACCESS_STATUS_LABELS, daysUntil, formatDate } from "@/lib/subscription";
import type { AccessStatus, StoreMemberRole, User, UserPermissions } from "@/lib/types";

export default function MerchantMembersPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin", "owner", "manager"]} title="帳號與權限管理">
      {({ profile }) => <MembersShell profile={profile} />}
    </LoginGate>
  );
}

function MembersShell({ profile }: { profile: User | null }) {
  const storeIds = accessibleStoreIds(profile);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId(profile));
  const storeId = storeIds.includes(selectedStoreId) ? selectedStoreId : storeIds[0] ?? "";

  const isAdmin = profile?.role === "admin";
  const permissions = resolvePermissions(profile, storeId);

  if (!isAdmin && !permissions.canManageUsers) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-tomato">無法存取</p>
          <h1 className="mt-2 text-2xl font-black text-ink">僅限老闆角色可管理帳號</h1>
          <Link href="/merchant/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
            <ArrowLeft className="size-4" />返回設定中心
          </Link>
        </div>
      </main>
    );
  }

  return (
    <MembersContent
      profile={profile}
      storeId={storeId}
      storeIds={storeIds}
      selectedStoreId={selectedStoreId}
      onStoreChange={setSelectedStoreId}
    />
  );
}

function MembersContent({
  profile,
  storeId,
  storeIds,
  selectedStoreId,
  onStoreChange,
}: {
  profile: User | null;
  storeId: string;
  storeIds: string[];
  selectedStoreId: string;
  onStoreChange: (id: string) => void;
}) {
  const {
    db,
    bindStoreUser,
    unbindStoreUser,
    updateUserStorePermissions,
    updateUserStoreAccess,
  } = useDemoStore({ storeId, admin: true });

  const store = db.stores.find((s) => s.id === storeId);
  const storeUsers = db.users.filter(
    (u) => u.storeIds?.includes(storeId) || u.storeId === storeId
  );

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  // Bind form
  const [bindEmail, setBindEmail] = useState("");
  const [bindRole, setBindRole] = useState<StoreMemberRole>("staff");

  // Per-user editors
  const [permOpen, setPermOpen] = useState<Record<string, boolean>>({});
  const [permEdits, setPermEdits] = useState<Record<string, Partial<UserPermissions>>>({});
  const [accessOpen, setAccessOpen] = useState<Record<string, boolean>>({});
  const [accessForm, setAccessForm] = useState<Record<string, { accessEndsAt: string; accessStatus: AccessStatus }>>({});

  const roleMemberRoles: StoreMemberRole[] = ["owner", "manager", "staff"];

  function userKey(userId: string) {
    return `${storeId}-${userId}`;
  }

  function openPermEditor(user: User) {
    const key = userKey(user.id);
    const storeRole = (user.storeRoles?.[storeId] ?? user.memberships?.[storeId] ?? "staff") as StoreMemberRole;
    const roleDefaults = defaultPermissionsForRole(storeRole);
    const custom = user.storePermissions?.[storeId] ?? {};
    setPermEdits((prev) => ({ ...prev, [key]: { ...roleDefaults, ...custom } }));
    setPermOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openAccessEditor(user: User) {
    const key = userKey(user.id);
    const access = user.storeAccess?.[storeId];
    setAccessForm((prev) => ({
      ...prev,
      [key]: {
        accessEndsAt: access?.accessEndsAt?.slice(0, 10) ?? "",
        accessStatus: access?.accessStatus ?? "active",
      },
    }));
    setAccessOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleBind() {
    const email = bindEmail.trim();
    if (!email) return;
    setSaving("bind");
    setError("");
    setMessage("");
    try {
      await bindStoreUser(email, storeId, bindRole);
      setBindEmail("");
      setMessage(`已綁定 ${email}（角色：${ROLE_LABELS[bindRole]}）`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "綁定失敗");
    } finally {
      setSaving("");
    }
  }

  async function handleUnbind(user: User) {
    if (!confirm(`確定解除 ${user.email} 的綁定？`)) return;
    try {
      await unbindStoreUser(user.id, storeId);
      setMessage(`已解除 ${user.email} 的綁定`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解除失敗");
    }
  }

  async function savePermissions(user: User) {
    const key = userKey(user.id);
    const edits = permEdits[key];
    if (!edits) return;
    setSaving(`perm-${key}`);
    try {
      await updateUserStorePermissions(user.email, storeId, edits);
      setMessage(`已更新 ${user.email} 的自訂權限`);
      setPermOpen((prev) => ({ ...prev, [key]: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving("");
    }
  }

  async function resetPermissions(user: User) {
    const key = userKey(user.id);
    const storeRole = (user.storeRoles?.[storeId] ?? user.memberships?.[storeId] ?? "staff") as StoreMemberRole;
    setSaving(`perm-${key}`);
    try {
      await updateUserStorePermissions(user.email, storeId, {});
      setPermEdits((prev) => ({ ...prev, [key]: defaultPermissionsForRole(storeRole) }));
      setMessage(`已重設 ${user.email} 為角色預設權限`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "重設失敗");
    } finally {
      setSaving("");
    }
  }

  async function saveAccess(user: User) {
    const key = userKey(user.id);
    const form = accessForm[key];
    if (!form) return;
    setSaving(`access-${key}`);
    try {
      await updateUserStoreAccess(user.email, storeId, {
        accessEndsAt: form.accessEndsAt || undefined,
        accessStatus: form.accessStatus,
      });
      setMessage(`已更新 ${user.email} 的存取設定`);
      setAccessOpen((prev) => ({ ...prev, [key]: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving("");
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <header className="mb-6 rounded-lg bg-[#171717] p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white/50">店家後台</p>
              <h1 className="mt-1 text-3xl font-black">{store?.name ?? "帳號與權限管理"}</h1>
              <p className="mt-1 text-sm font-bold text-white/60">帳號與權限管理</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {storeIds.length > 1 && (
                <select
                  value={selectedStoreId}
                  onChange={(e) => onStoreChange(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white px-4 py-2 text-sm font-bold text-ink"
                >
                  {storeIds.map((id) => {
                    const s = db.stores.find((item) => item.id === id);
                    return <option key={id} value={id}>{s?.name ?? id}</option>;
                  })}
                </select>
              )}
              <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 font-black text-white hover:bg-white/20">
                <ArrowLeft className="size-4" />返回設定中心
              </Link>
            </div>
          </div>
        </header>

        {message && <div className="mb-4 rounded-lg border border-leaf/30 bg-leaf/10 p-4 font-black text-leaf">{message}</div>}
        {error && <div className="mb-4 rounded-lg border border-tomato/30 bg-tomato/10 p-4 font-black text-tomato">{error}</div>}

        {/* Bind new member */}
        <section className="mb-5 rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-leaf" />
            <h2 className="text-xl font-black">綁定新帳號</h2>
          </div>
          <p className="mt-1 text-sm font-bold text-steel">輸入員工的登入 email，選擇角色後點擊綁定。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={bindEmail}
              onChange={(e) => setBindEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBind()}
              placeholder="員工帳號 email..."
              className="min-w-56 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <select
              value={bindRole}
              onChange={(e) => setBindRole(e.target.value as StoreMemberRole)}
              className="rounded-lg border border-orange-100 px-4 py-3 font-bold"
            >
              {roleMemberRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button
              onClick={handleBind}
              disabled={saving === "bind" || !bindEmail.trim()}
              className="rounded-lg bg-leaf px-5 py-3 font-black text-white disabled:opacity-60"
            >
              {saving === "bind" ? "綁定中..." : "綁定"}
            </button>
          </div>
        </section>

        {/* Member list */}
        <section className="space-y-4">
          <h2 className="text-xl font-black">已綁定帳號（{storeUsers.length} 人）</h2>
          {storeUsers.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow-sm">
              <Users className="mx-auto size-10 text-stone-300" />
              <p className="mt-3 font-black text-steel">尚未綁定任何帳號</p>
            </div>
          ) : storeUsers.map((user) => {
            const userStoreRole = (user.storeRoles?.[storeId] ?? user.memberships?.[storeId] ?? null) as StoreMemberRole | null;
            const key = userKey(user.id);
            const pOpen = permOpen[key] ?? false;
            const aOpen = accessOpen[key] ?? false;
            const edits = permEdits[key] ?? {};
            const accF = accessForm[key];
            const isSavingPerm = saving === `perm-${key}`;
            const isSavingAccess = saving === `access-${key}`;
            const userAccess = user.storeAccess?.[storeId];
            const accStatus = userAccess?.accessStatus ?? "active";
            const hasCustomPerms = user.storePermissions?.[storeId] && Object.keys(user.storePermissions[storeId]!).length > 0;
            const accessDays = userAccess?.accessEndsAt ? daysUntil(userAccess.accessEndsAt) : null;

            return (
              <div key={user.id} className="overflow-hidden rounded-lg bg-white shadow-sm">
                {/* User summary row */}
                <div className="flex flex-wrap items-center gap-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-ink">{user.name || user.email}</p>
                    <p className="text-sm font-bold text-steel">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {userStoreRole && (
                      <span className={`rounded px-2 py-0.5 text-xs font-black ${roleBadgeClass(userStoreRole)}`}>{roleLabel(userStoreRole)}</span>
                    )}
                    {hasCustomPerms && (
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-700">自訂權限</span>
                    )}
                    {accStatus !== "active" && (
                      <span className={`rounded px-2 py-0.5 text-xs font-black ${accStatus === "suspended" ? "bg-tomato/10 text-tomato" : "bg-stone-100 text-stone-500"}`}>
                        {ACCESS_STATUS_LABELS[accStatus]}
                      </span>
                    )}
                    {userAccess?.accessEndsAt && (
                      <span className="flex items-center gap-1 text-xs font-bold text-steel">
                        <CalendarClock className="size-3" />
                        {formatDate(userAccess.accessEndsAt)}
                        {accessDays !== null ? (accessDays >= 0 ? ` (剩${accessDays}天)` : " (已到期)") : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => openAccessEditor(user)}
                      className={`rounded px-2 py-1 text-xs font-black ${aOpen ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-steel hover:bg-stone-200"}`}
                    >
                      存取設定
                    </button>
                    <button
                      onClick={() => openPermEditor(user)}
                      className={`rounded px-2 py-1 text-xs font-black ${pOpen ? "bg-blue-100 text-blue-700" : "bg-stone-100 text-steel hover:bg-stone-200"}`}
                    >
                      自訂權限
                    </button>
                    <button
                      onClick={() => handleUnbind(user)}
                      className="rounded px-2 py-1 text-xs font-black text-tomato hover:bg-tomato/10"
                    >
                      移除
                    </button>
                  </div>
                </div>

                {/* Access editor */}
                {aOpen && (
                  <div className="border-t border-orange-100 bg-amber-50 px-4 py-4">
                    <p className="mb-3 text-sm font-black text-amber-800">存取期限設定</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-black text-steel">
                        使用到期日（留空 = 不限期）
                        <input
                          type="date"
                          value={accF?.accessEndsAt ?? ""}
                          onChange={(e) => setAccessForm((prev) => ({ ...prev, [key]: { ...prev[key], accessEndsAt: e.target.value } }))}
                          className="rounded-lg border border-orange-100 bg-white px-3 py-2 font-bold"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-steel">
                        帳號狀態
                        <select
                          value={accF?.accessStatus ?? "active"}
                          onChange={(e) => setAccessForm((prev) => ({ ...prev, [key]: { ...prev[key], accessStatus: e.target.value as AccessStatus } }))}
                          className="rounded-lg border border-orange-100 bg-white px-3 py-2 font-bold"
                        >
                          {(Object.keys(ACCESS_STATUS_LABELS) as AccessStatus[]).map((s) => (
                            <option key={s} value={s}>{ACCESS_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      onClick={() => saveAccess(user)}
                      disabled={isSavingAccess}
                      className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                    >
                      {isSavingAccess ? "儲存中..." : "儲存設定"}
                    </button>
                  </div>
                )}

                {/* Permission editor */}
                {pOpen && (
                  <div className="border-t border-orange-100 bg-blue-50 px-4 py-4">
                    <p className="mb-1 text-sm font-black text-blue-900">自訂權限</p>
                    <p className="mb-3 text-xs font-bold text-blue-700">覆蓋角色預設值。留意：「管理帳號」勾選後此員工也可進入此頁面。</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((pKey) => (
                        <label key={pKey} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100">
                          <input
                            type="checkbox"
                            checked={edits[pKey] ?? false}
                            onChange={(e) => setPermEdits((prev) => ({ ...prev, [key]: { ...prev[key], [pKey]: e.target.checked } }))}
                            className="size-4 accent-leaf"
                          />
                          {PERMISSION_LABELS[pKey]}
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => savePermissions(user)}
                        disabled={isSavingPerm}
                        className="rounded-lg bg-leaf px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                      >
                        {isSavingPerm ? "儲存中..." : "儲存自訂權限"}
                      </button>
                      <button
                        onClick={() => resetPermissions(user)}
                        disabled={isSavingPerm}
                        className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-black text-steel disabled:opacity-60"
                      >
                        重設為角色預設
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
