"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { ArrowLeft, Search, ShieldCheck, Users } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { firestore } from "@/lib/firebase";
import type { User, UserRole } from "@/lib/types";

const roleOptions: UserRole[] = ["user", "merchant", "kitchen", "admin", "owner", "manager", "staff", "viewer"];

function editableRole(role: UserRole) {
  return roleOptions.includes(role) ? role : "user";
}

export function AdminUsers() {
  return (
    <LoginGate allowedRoles={["admin"]} title="平台管理中心登入">
      {() => <AdminUsersContent />}
    </LoginGate>
  );
}

function AdminUsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupUser, setLookupUser] = useState<User | null>(null);
  const [lookupRole, setLookupRole] = useState<UserRole>("user");
  const [lookupStoreId, setLookupStoreId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");

  useEffect(() => {
    if (!firestore) {
      setLoading(false);
      setError("Firebase 尚未設定");
      return;
    }

    return onSnapshot(
      collection(firestore, "users"),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as User));
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );
  }, []);

  async function approveUser(user: User) {
    if (!firestore) return;
    setSavingId(user.id);
    setError("");
    try {
      await updateDoc(doc(firestore, "users", user.id), {
        approved: true,
        status: "active",
        pending: false,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "核准帳號失敗");
    } finally {
      setSavingId("");
    }
  }

  async function rejectUser(user: User) {
    if (!firestore) return;
    setSavingId(user.id);
    setError("");
    try {
      await updateDoc(doc(firestore, "users", user.id), {
        approved: false,
        status: "rejected",
        pending: false,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "拒絕帳號失敗");
    } finally {
      setSavingId("");
    }
  }

  async function changeRole(userId: string, role: UserRole) {
    if (!firestore) return;
    setSavingId(userId);
    setError("");
    try {
      await updateDoc(doc(firestore, "users", userId), { role, updatedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新角色失敗");
    } finally {
      setSavingId("");
    }
  }

  async function findUser() {
    if (!firestore) return;
    const value = lookupValue.trim();
    if (!value) {
      setError("請輸入 email 或 uid");
      return;
    }

    setError("");
    setLookupMessage("");
    setLookupUser(null);
    setLookupLoading(true);

    try {
      const snapshot = value.includes("@")
        ? await getDocs(query(collection(firestore, "users"), where("email", "==", value.toLowerCase()), limit(1)))
        : await getDoc(doc(firestore, "users", value));

      const foundUser = "docs" in snapshot
        ? snapshot.docs[0]
          ? ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User)
          : null
        : snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as User)
          : null;

      if (!foundUser) {
        setError("查無使用者");
        return;
      }

      setLookupUser(foundUser);
      setLookupRole(editableRole(foundUser.role));
      setLookupStoreId(foundUser.storeId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "查詢使用者失敗");
    } finally {
      setLookupLoading(false);
    }
  }

  async function saveLookupUser() {
    if (!firestore || !lookupUser) return;
    setSavingId(lookupUser.id);
    setError("");
    setLookupMessage("");

    try {
      await updateDoc(doc(firestore, "users", lookupUser.id), {
        role: lookupRole,
        storeId: lookupStoreId.trim() || null,
        updatedAt: new Date().toISOString()
      });
      setLookupUser({ ...lookupUser, role: lookupRole, storeId: lookupStoreId.trim() || null });
      setLookupMessage("已更新使用者");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新使用者失敗");
    } finally {
      setSavingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <header className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-lg bg-ink text-white">
                <Users className="size-6" />
              </div>
              <div>
                <p className="text-sm font-black text-leaf">使用者權限管理</p>
                <h1 className="text-3xl font-black text-ink">平台使用者管理</h1>
              </div>
            </div>
            <Link href="/admin" className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
              <ArrowLeft className="size-4" />
              回平台管理中心
            </Link>
          </div>
        </header>

        <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black text-steel">
            <Search className="size-4 text-leaf" />
            查詢並發放權限
          </div>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row">
            <input
              value={lookupValue}
              onChange={(event) => setLookupValue(event.target.value)}
              placeholder="輸入 email 或 uid"
              className="min-w-0 flex-1 rounded-lg border border-stone-300 px-4 py-3 font-bold text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/20"
            />
            <button
              onClick={findUser}
              disabled={lookupLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white disabled:opacity-60"
            >
              <Search className="size-4" />
              {lookupLoading ? "查詢中..." : "查詢"}
            </button>
          </div>

          {lookupUser && (
            <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-3 text-sm font-bold text-steel md:grid-cols-2 xl:grid-cols-5">
                <Info label="Email" value={lookupUser.email || "-"} mono={false} />
                <Info label="Name" value={lookupUser.name || "-"} mono={false} />
                <Info label="UID" value={lookupUser.id} />
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-stone-400">Role</span>
                  <select
                    value={lookupRole}
                    onChange={(event) => setLookupRole(event.target.value as UserRole)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-black text-steel outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
                  >
                    {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-stone-400">Store ID</span>
                  <input
                    value={lookupStoreId}
                    onChange={(event) => setLookupStoreId(event.target.value)}
                    placeholder="storeId，可留空"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-bold text-steel outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={saveLookupUser} disabled={savingId === lookupUser.id} className="rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:opacity-60">
                  {savingId === lookupUser.id ? "儲存中..." : "儲存"}
                </button>
                {lookupMessage && <p className="font-bold text-leaf">{lookupMessage}</p>}
              </div>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-lg bg-white shadow-sm">
          <div className="border-b border-stone-200 p-5">
            <div className="flex items-center gap-2 text-sm font-black text-steel">
              <ShieldCheck className="size-4 text-leaf" />
              權限變更會即時寫入 Firestore。
            </div>
            {error && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-bold text-tomato">{error}</p>}
          </div>

          {loading ? (
            <div className="p-6 font-black text-steel">載入使用者...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-stone-50 text-sm font-black text-steel">
                  <tr>
                    <th className="px-5 py-4">姓名</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Store ID</th>
                    <th className="px-5 py-4">狀態</th>
                    <th className="px-5 py-4">角色</th>
                    <th className="px-5 py-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map((user) => (
                    <tr key={user.id} className="text-sm font-bold text-ink">
                      <td className="px-5 py-4">{user.name || user.id}</td>
                      <td className="px-5 py-4">{user.email}</td>
                      <td className="px-5 py-4 font-mono text-xs text-steel">{user.storeId || "-"}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${
                          user.status === "active" ? "bg-leaf/10 text-leaf" :
                          user.status === "rejected" ? "bg-tomato/10 text-tomato" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {user.status ?? "pending"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-leaf/10 px-3 py-1 text-xs font-black text-leaf">{user.role}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={editableRole(user.role)}
                            onChange={(event) => changeRole(user.id, event.target.value as UserRole)}
                            disabled={savingId === user.id}
                            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-bold text-steel outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
                          >
                            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <button onClick={() => approveUser(user)} disabled={savingId === user.id || user.role === "admin"} className="rounded-lg bg-leaf px-3 py-1 text-xs font-black text-white disabled:opacity-50">核准</button>
                          <button onClick={() => rejectUser(user)} disabled={savingId === user.id || user.role === "admin"} className="rounded-lg bg-tomato px-3 py-1 text-xs font-black text-white disabled:opacity-50">拒絕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-stone-400">{label}</p>
      <p className={`mt-1 break-all text-ink ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
