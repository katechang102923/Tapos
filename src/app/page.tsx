"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, QrCode, ShieldCheck, ShoppingCart, Store } from "lucide-react";
import { useAuthState } from "@/lib/auth";
import { isPlatformAdmin, isPlatformAdminEmail } from "@/lib/store-access";

export default function HomePage() {
  const { firebaseUser, profile, loading } = useAuthState();
  const isLoggedIn = !loading && Boolean(firebaseUser);
  const isAdmin = isLoggedIn && (isPlatformAdmin(profile) || isPlatformAdminEmail(firebaseUser?.email));

  return (
    <main className="min-h-screen bg-mist">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-mist/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-ink text-white">
              <QrCode className="size-5" />
            </div>
            <div>
              <p className="text-base font-black text-ink">餐飲 QR 點餐系統</p>
              <p className="hidden text-sm font-semibold text-steel sm:block">QR 點餐・POS・KDS・會員</p>
            </div>
          </Link>
          <nav className="flex gap-2">
            {!loading && !isLoggedIn && (
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-steel shadow-sm hover:border-leaf hover:text-leaf">
                <Store className="size-4" />
                註冊開店
              </Link>
            )}
            {!loading && isLoggedIn && (
              <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-steel shadow-sm hover:border-leaf hover:text-leaf">
                <LayoutDashboard className="size-4" />
                店家後台
              </Link>
            )}
            {isAdmin && (
              <Link href="/platform" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-steel shadow-sm hover:border-leaf hover:text-leaf">
                <ShieldCheck className="size-4" />
                平台管理
              </Link>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        {/* Hero */}
        <div className="flex flex-col justify-center">
          <p className="mb-4 inline-flex w-fit rounded-full bg-leaf/10 px-4 py-2 text-sm font-black text-leaf">
            多店家 QR 點餐平台
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-ink sm:text-5xl">
            適用各類餐飲店的 QR 點餐系統
          </h1>
          <p className="mt-5 max-w-2xl text-xl font-bold leading-8 text-ink">
            餐飲店、飲料店、小吃店、餐廳皆可快速建立線上點餐系統。
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-steel">
            自動生成 QR Code，即時廚房 KDS，POS 前台點餐，會員點數管理，完整日結備份。
          </p>
          {!loading && !isLoggedIn && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 font-black text-white shadow-soft transition hover:bg-leaf/90">
                開始註冊店家
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-black text-ink transition hover:border-leaf hover:text-leaf">
                店家登入
              </Link>
            </div>
          )}
          {!loading && isLoggedIn && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 font-black text-white shadow-soft transition hover:bg-leaf/90">
                <LayoutDashboard className="size-4" />
                進入店家後台
              </Link>
              <Link href="/merchant/pos" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-black text-ink transition hover:border-leaf hover:text-leaf">
                <ShoppingCart className="size-4" />
                POS 前台點餐
              </Link>
            </div>
          )}
        </div>

        {/* Entry cards */}
        <div className="grid content-start gap-3">
          {!loading && !isLoggedIn && (
            <>
              <EntryCard
                href="/register"
                icon={Store}
                title="新店家註冊"
                description="建立店家帳號、店鋪資料、Logo/Banner 與預設菜單。"
              />
              <EntryCard
                href="/merchant/dashboard"
                icon={LayoutDashboard}
                title="店家登入"
                description="已有帳號？登入後可進入店家後台、管理菜單與查看日報。"
              />
            </>
          )}
          {!loading && isLoggedIn && (
            <>
              <EntryCard
                href="/merchant/dashboard"
                icon={LayoutDashboard}
                title="店家後台管理"
                description="管理店家資料、菜單、商品選項、QR Code 與帳號設定。"
              />
              <EntryCard
                href="/merchant/pos"
                icon={ShoppingCart}
                title="POS 前台點餐"
                description="接單、建立訂單、查看今日銷售與現金流管理。"
              />
              {isAdmin && (
                <EntryCard
                  href="/platform"
                  icon={ShieldCheck}
                  title="平台管理中心"
                  description="管理所有店家、帳號綁定、訂閱方案與功能開關。"
                  tone="admin"
                />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function EntryCard({ href, icon: Icon, title, description, tone = "default" }: { href: string; icon: React.ElementType; title: string; description: string; tone?: "default" | "admin" }) {
  const iconBg = tone === "admin" ? "bg-tomato" : "bg-ink";
  return (
    <Link href={href} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-leaf hover:shadow-soft">
      <div className="flex items-start gap-4">
        <div className={`grid size-11 shrink-0 place-items-center rounded-lg text-white ${iconBg}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="font-black text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-steel">{description}</p>
        </div>
      </div>
    </Link>
  );
}
