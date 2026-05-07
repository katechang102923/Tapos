"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useAuthState } from "@/lib/auth";
import { firebaseEnabled } from "@/lib/firebase";

export function AuthForm({ mode }: { mode: "login" | "register" | "forgot" }) {
  const router = useRouter();
  const auth = useAuthState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (mode === "register") {
        await auth.registerOwner(email, password, name.trim() || email);
        router.push("/onboarding");
        return;
      }

      if (mode === "forgot") {
        await auth.resetPassword(email);
        setMessage("重設密碼信已送出，請到信箱查看。");
        return;
      }

      await auth.signIn(email, password);
      router.push("/merchant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "register" ? "建立店家帳號" : mode === "forgot" ? "忘記密碼" : "店家登入";
  const description =
    mode === "register"
      ? "註冊後即可建立店面、產生 QR Code，開始早餐店試營運。"
      : mode === "forgot"
        ? "輸入 Email，我們會寄送重設密碼連結。"
        : "登入後管理菜單、訂單、廚房看板與店家設定。";
  const buttonLabel =
    mode === "forgot" ? "寄送重設密碼信" : mode === "register" ? "註冊並開始建店" : "登入";

  if (!firebaseEnabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-tomato">Firebase 尚未設定</p>
          <h1 className="mt-2 text-2xl font-black text-ink">請先檢查 `.env.local`</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-steel">
            需要設定 `NEXT_PUBLIC_FIREBASE_API_KEY` 與
            `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 才能使用註冊、登入與建店流程。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
        <div className="grid size-12 place-items-center rounded-lg bg-ink text-white">
          <Lock className="size-6" />
        </div>

        <h1 className="mt-4 text-3xl font-black text-ink">{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-steel">{description}</p>

        <div className="mt-5 grid gap-3">
          {mode === "register" && (
            <label className="grid gap-1 text-sm font-bold text-steel">
              姓名
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="王小明"
                autoComplete="name"
                className="rounded-lg border border-stone-300 px-4 py-3 text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/20"
              />
            </label>
          )}

          <label className="grid gap-1 text-sm font-bold text-steel">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="store@example.com"
              type="email"
              autoComplete="email"
              required
              className="rounded-lg border border-stone-300 px-4 py-3 text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/20"
            />
          </label>

          {mode !== "forgot" && (
            <label className="grid gap-1 text-sm font-bold text-steel">
              密碼
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 個字元"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={6}
                className="rounded-lg border border-stone-300 px-4 py-3 text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/20"
              />
            </label>
          )}

          {error && <p className="rounded-lg bg-tomato/10 p-3 text-sm font-bold text-tomato">{error}</p>}
          {message && <p className="rounded-lg bg-leaf/10 p-3 text-sm font-bold text-leaf">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white transition hover:bg-steel disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-5 animate-spin" />}
            {buttonLabel}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-steel">
          {mode !== "login" && (
            <Link className="hover:text-leaf" href="/login">
              已有帳號，前往登入
            </Link>
          )}
          {mode !== "register" && (
            <Link className="hover:text-leaf" href="/register">
              建立新店家帳號
            </Link>
          )}
          {mode !== "forgot" && (
            <Link className="hover:text-leaf" href="/forgot-password">
              忘記密碼
            </Link>
          )}
        </div>
      </form>
    </main>
  );
}
