"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ArrowLeft, ShieldCheck, Users } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { firestore } from "@/lib/firebase";
import type { User, UserRole } from "@/lib/types";

const roleOptions: UserRole[] = ["user", "merchant", "kitchen", "admin"];

function editableRole(role: UserRole) {
  return roleOptions.includes(role) ? role : "merchant";
}

export function AdminUsers() {
  return (
    <LoginGate allowedRoles={["admin"]} title="管理員登入">
      {() => <AdminUsersContent />}
    </LoginGate>
  );
}

function AdminUsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

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

  async function changeRole(userId: string, role: UserRole) {
    if (!firestore) return;
    setSavingId(userId);
    setError("");
    try {
      await updateDoc(doc(firestore, "users", userId), { role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新角色失敗");
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
                <p className="text-sm font-black text-leaf">User Role Management</p>
                <h1 className="text-3xl font-black text-ink">使用者角色管理</h1>
              </div>
            </div>
            <Link href="/admin" className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
              <ArrowLeft className="size-4" />
              回管理後台
            </Link>
          </div>
        </header>

        <section className="mt-5 rounded-lg bg-white shadow-sm">
          <div className="border-b border-stone-200 p-5">
            <div className="flex items-center gap-2 text-sm font-black text-steel">
              <ShieldCheck className="size-4 text-leaf" />
              Role changes are saved to Firestore in realtime.
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
                    <th className="px-5 py-4">目前角色</th>
                    <th className="px-5 py-4">修改角色</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map((user) => (
                    <tr key={user.id} className="text-sm font-bold text-ink">
                      <td className="px-5 py-4">{user.name || user.id}</td>
                      <td className="px-5 py-4">{user.email}</td>
                      <td className="px-5 py-4 font-mono text-xs text-steel">{user.storeId || "-"}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-leaf/10 px-3 py-1 text-xs font-black text-leaf">{user.role}</span>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={editableRole(user.role)}
                          disabled={savingId === user.id}
                          onChange={(event) => changeRole(user.id, event.target.value as UserRole)}
                          className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-black text-steel outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20 disabled:opacity-60"
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
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
