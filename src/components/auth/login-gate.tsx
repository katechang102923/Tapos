"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Lock, LogOut } from "lucide-react";
import { firebaseEnabled } from "@/lib/firebase";
import { useAuthState } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export function LoginGate({
  children,
  allowedRoles,
  title = "店家登入"
}: {
  children: (context: ReturnType<typeof useAuthState>) => ReactNode;
  allowedRoles: UserRole[];
  title?: string;
}) {
  const authState = useAuthState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  if (!firebaseEnabled) {
    return (
      <div className="min-h-screen bg-[#f4f4f2] p-6">
        <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-tomato">Firebase 尚未啟用</p>
          <h1 className="mt-2 text-3xl font-black text-ink">請先建立 `.env.local`</h1>
          <p className="mt-3 leading-7 text-steel">後台、設定與 onboarding 需要 Firebase Auth。請依 README 填入 Firebase web app 設定後重啟 `npm run dev`。</p>
        </div>
      </div>
    );
  }

  if (authState.loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f4f2] font-black text-steel">載入登入狀態...</div>;
  }

  if (!authState.firebaseUser) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              setLocalError("");
              await authState.signIn(email, password);
            } catch (error) {
              setLocalError(error instanceof Error ? error.message : "登入失敗");
            }
          }}
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft"
        >
          <div className="grid size-12 place-items-center rounded-lg bg-ink text-white">
            <Lock className="size-6" />
          </div>
          <h1 className="mt-4 text-3xl font-black text-ink">{title}</h1>
          <p className="mt-2 text-sm font-semibold text-steel">請使用 Firebase Auth Email/password 登入。</p>
          <div className="mt-5 grid gap-3">
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="rounded-lg border border-stone-300 px-4 py-3" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" className="rounded-lg border border-stone-300 px-4 py-3" />
            {(localError || authState.error) && <p className="rounded-lg bg-tomato/10 p-3 text-sm font-bold text-tomato">{localError || authState.error}</p>}
            <button className="rounded-lg bg-ink px-4 py-3 font-black text-white">登入</button>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-steel">
            <Link href="/register">註冊新店家</Link>
            <Link href="/forgot-password">忘記密碼</Link>
          </div>
        </form>
      </main>
    );
  }

  if (authState.firebaseUser && !authState.profile && !authState.error) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f4f2] font-black text-steel">載入使用者權限...</div>;
  }

  const fixedAdminEmail = authState.firebaseUser?.email?.toLowerCase() === "ciut0000@gmail.com";

  if (authState.profile && !fixedAdminEmail && authState.profile.role !== "admin" && (authState.profile.status !== "active" || !authState.profile.approved)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-amber-600">帳號等待審核</p>
          <h1 className="mt-2 text-2xl font-black text-ink">你的帳號尚未啟用</h1>
          <p className="mt-3 leading-7 text-steel">請等待平台管理員核准帳號。核准後即可依照店家綁定權限進入後台。</p>
          <button onClick={authState.signOutUser} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
            <LogOut className="size-4" />
            登出
          </button>
        </div>
      </main>
    );
  }

  const effectiveAllowedRoles = allowedRoles.includes("merchant")
    ? [...allowedRoles, "owner", "manager", "staff", "viewer"]
    : allowedRoles;

  if (!authState.profile || !effectiveAllowedRoles.includes(authState.profile.role)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-tomato">權限不足</p>
          <h1 className="mt-2 text-2xl font-black text-ink">此帳號沒有進入此頁面的角色權限</h1>
          {authState.error && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-bold text-tomato">{authState.error}</p>}
          <button onClick={authState.signOutUser} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
            <LogOut className="size-4" />
            登出
          </button>
        </div>
      </main>
    );
  }

  return <>{children(authState)}</>;
}
