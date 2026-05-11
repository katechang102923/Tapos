"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, ChefHat, Gift, Monitor, Search, ShieldCheck, Store, ToggleLeft, ToggleRight, Users } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { PERMISSION_LABELS, ROLE_LABELS, defaultPermissionsForRole, roleBadgeClass, roleLabel } from "@/lib/permissions";
import type { Store as StoreType, StoreMemberRole, User, UserPermissions } from "@/lib/types";

export default function PlatformPage() {
  return (
    <LoginGate allowedRoles={["admin"]} title="平台管理中心登入">
      {({ signOutUser }) => <PlatformContent onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function PlatformContent({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const { db, bindStoreUser, unbindStoreUser, upsertStore, updateUserStorePermissions } = useDemoStore({ admin: true });
  const [search, setSearch] = useState("");
  const [bindingEmail, setBindingEmail] = useState<Record<string, string>>({});
  const [bindingRole, setBindingRole] = useState<Record<string, StoreMemberRole>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [permEditorOpen, setPermEditorOpen] = useState<Record<string, boolean>>({});
  const [permEdits, setPermEdits] = useState<Record<string, Partial<UserPermissions>>>({});

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.stores.filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [db.stores, search]);

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

  function permKey(storeId: string, userId: string) {
    return `${storeId}-${userId}`;
  }

  function openPermEditor(storeId: string, user: User) {
    const key = permKey(storeId, user.id);
    const storeRole = user.storeRoles?.[storeId] ?? user.memberships?.[storeId] ?? "staff";
    const roleDefaults = defaultPermissionsForRole(storeRole as StoreMemberRole);
    const custom = user.storePermissions?.[storeId] ?? {};
    setPermEdits((prev) => ({ ...prev, [key]: { ...roleDefaults, ...custom } }));
    setPermEditorOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function savePermissions(storeId: string, user: User) {
    const key = permKey(storeId, user.id);
    const edits = permEdits[key];
    if (!edits) return;
    setSaving(`perm-${key}`);
    try {
      await updateUserStorePermissions(user.email, storeId, edits);
      setMessage(`已更新 ${user.email} 的自訂權限`);
      setPermEditorOpen((prev) => ({ ...prev, [key]: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving("");
    }
  }

  async function resetPermissions(storeId: string, user: User) {
    const storeRole = user.storeRoles?.[storeId] ?? user.memberships?.[storeId] ?? "staff";
    const key = permKey(storeId, user.id);
    setSaving(`perm-${key}`);
    try {
      await updateUserStorePermissions(user.email, storeId, {});
      setPermEdits((prev) => ({ ...prev, [key]: defaultPermissionsForRole(storeRole as StoreMemberRole) }));
      setMessage(`已重設 ${user.email} 為角色預設權限`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "重設失敗");
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
              <h1 className="text-3xl font-black">平台管理中心</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ArrowLeft className="size-4" />首頁</Link>
            <button onClick={onSignOut} className="rounded-lg bg-white/10 px-4 py-3 font-black text-white">登出</button>
          </div>
        </header>

        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-[#1a1a1a] p-5"><p className="text-sm font-black text-white/50">店家總數</p><p className="mt-2 text-4xl font-black text-white">{db.stores.length}</p></div>
          <div className="rounded-lg bg-[#1a1a1a] p-5"><p className="text-sm font-black text-white/50">帳號總數</p><p className="mt-2 text-4xl font-black text-white">{db.users.length}</p></div>
          <div className="rounded-lg bg-[#1a1a1a] p-5"><p className="text-sm font-black text-white/50">訂單總數</p><p className="mt-2 text-4xl font-black text-white">{db.orders.length}</p></div>
        </div>

        {message && <div className="mb-4 rounded-lg border border-leaf/30 bg-leaf/10 p-4 font-black text-leaf">{message}</div>}
        {error && <div className="mb-4 rounded-lg border border-tomato/30 bg-tomato/10 p-4 font-black text-tomato">{error}</div>}

        <div className="mb-5 flex items-center gap-3 rounded-lg bg-[#1a1a1a] px-4 py-3">
          <Search className="size-5 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋店家名稱或 ID..." className="flex-1 bg-transparent font-bold text-white placeholder:text-white/30 focus:outline-none" />
        </div>

        <div className="space-y-5">
          {filteredStores.length === 0 ? (
            <div className="rounded-lg bg-[#1a1a1a] p-12 text-center">
              <Store className="mx-auto size-12 text-white/20" />
              <p className="mt-4 font-black text-white/40">找不到符合的店家</p>
            </div>
          ) : filteredStores.map((store) => {
            const users = storeUsers(store.id);
            const userCount = linkedUserCount.get(store.id) ?? 0;
            return (
              <div key={store.id} className="rounded-lg bg-[#1a1a1a] p-5">
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
                      <div className="mt-2 flex items-center gap-3 text-sm font-bold text-white/50">
                        <span className="flex items-center gap-1.5"><Users className="size-4" />{userCount} 個帳號</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${store.isOpen ? "bg-leaf/20 text-leaf" : "bg-tomato/20 text-tomato"}`}>{store.isOpen ? "營業中" : "休息中"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/merchant/menu?storeId=${store.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-black text-white">菜單</Link>
                    <Link href={`/merchant/promotions?storeId=${store.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-black text-white"><Gift className="size-4" />促銷</Link>
                    <Link href={`/kitchen/${store.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-black text-white"><ChefHat className="size-4" />KDS</Link>
                  </div>
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

                {/* Bound users */}
                {users.length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="mb-2 text-xs font-black text-white/40">已綁定帳號</p>
                    <div className="space-y-2">
                      {users.map((user) => {
                        const userStoreRole = (user.storeRoles?.[store.id] ?? user.memberships?.[store.id] ?? null) as StoreMemberRole | null;
                        const key = permKey(store.id, user.id);
                        const editorOpen = permEditorOpen[key] ?? false;
                        const edits = permEdits[key] ?? {};
                        const isSavingPerm = saving === `perm-${key}`;
                        return (
                          <div key={user.id} className="rounded-lg bg-white/5">
                            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                              <span className="text-sm font-bold text-white">{user.email}</span>
                              {userStoreRole && (
                                <span className={`rounded px-2 py-0.5 text-xs font-black ${roleBadgeClass(userStoreRole)}`}>{roleLabel(userStoreRole)}</span>
                              )}
                              {user.storePermissions?.[store.id] && Object.keys(user.storePermissions[store.id]!).length > 0 && (
                                <span className="rounded bg-purple-900/50 px-2 py-0.5 text-xs font-black text-purple-300">自訂權限</span>
                              )}
                              <button onClick={() => openPermEditor(store.id, user)} className="rounded bg-white/10 px-2 py-0.5 text-xs font-black text-white/70 hover:bg-white/20">
                                {editorOpen ? "收起" : "編輯權限"}
                              </button>
                              <button onClick={() => handleUnbind(user.id, store.id, user.email)} className="text-xs font-black text-tomato hover:underline">解除</button>
                            </div>
                            {editorOpen && (
                              <div className="border-t border-white/10 px-3 py-3">
                                <p className="mb-2 text-xs font-black text-white/40">自訂權限（勾選覆蓋角色預設）</p>
                                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                  {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((permKey_) => (
                                    <label key={permKey_} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10">
                                      <input
                                        type="checkbox"
                                        checked={edits[permKey_] ?? false}
                                        onChange={(e) => setPermEdits((prev) => ({ ...prev, [key]: { ...prev[key], [permKey_]: e.target.checked } }))}
                                        className="size-4 accent-leaf"
                                      />
                                      {PERMISSION_LABELS[permKey_]}
                                    </label>
                                  ))}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <button onClick={() => savePermissions(store.id, user)} disabled={isSavingPerm} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                                    {isSavingPerm ? "儲存中..." : "儲存自訂權限"}
                                  </button>
                                  <button onClick={() => resetPermissions(store.id, user)} disabled={isSavingPerm} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white/70 disabled:opacity-60">
                                    重設為角色預設
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bind form */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <input
                    value={bindingEmail[store.id] ?? ""}
                    onChange={(e) => setBindingEmail((prev) => ({ ...prev, [store.id]: e.target.value }))}
                    placeholder="綁定帳號 email..."
                    className="flex-1 min-w-48 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white placeholder:text-white/30 focus:outline-none"
                  />
                  <select
                    value={bindingRole[store.id] ?? "staff"}
                    onChange={(e) => setBindingRole((prev) => ({ ...prev, [store.id]: e.target.value as StoreMemberRole }))}
                    className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white"
                  >
                    {roleMemberRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} ({r})</option>)}
                  </select>
                  <button
                    onClick={() => handleBind(store.id)}
                    disabled={saving === `bind-${store.id}`}
                    className="rounded-lg bg-leaf px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                  >
                    {saving === `bind-${store.id}` ? "綁定中..." : "綁定"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
