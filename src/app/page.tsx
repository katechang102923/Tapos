import Link from "next/link";
import { ArrowRight, ChefHat, LayoutDashboard, ShieldCheck, ShoppingCart, Store } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { demoStoreId } from "@/lib/mock-data";

const entries = [
  {
    href: "/register",
    title: "新店家註冊",
    description: "建立店家帳號、店鋪資料、Logo/Banner 與預設菜單。",
    icon: Store
  },
  {
    href: "/merchant/pos",
    title: "POS 前台點餐",
    description: "接單、建立訂單、查看今日銷售與商品排行。",
    icon: ShoppingCart
  },
  {
    href: "/merchant/dashboard",
    title: "店家後台管理",
    description: "管理店家資料、菜單、商品選項、QR Code 與桌號設定。",
    icon: LayoutDashboard
  },
  {
    href: `/kitchen/${demoStoreId}`,
    title: "廚房 KDS",
    description: "即時顯示新訂單、待製作餐點、出餐狀態與尖峰模式。",
    icon: ChefHat
  },
  {
    href: "/admin",
    title: "平台管理中心",
    description: "管理多店家資料、使用者角色與平台營運設定。",
    icon: ShieldCheck
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-mist">
      <TopNav />
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
        <div className="flex min-h-[500px] flex-col justify-center">
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
            新店家可以註冊帳號、建立店家、上傳 Logo/Banner，自動生成菜單與 QR Code，快速開始顧客點餐、店家後台管理與廚房 KDS。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 font-black text-white shadow-soft transition hover:bg-leaf/90">
              開始註冊店家
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-black text-ink transition hover:border-leaf hover:text-leaf">
              進入店家後台
            </Link>
            <Link href="/merchant/pos" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-black text-ink transition hover:border-leaf hover:text-leaf">
              POS 前台點餐
            </Link>
          </div>
        </div>
        <div className="grid gap-3">
          {entries.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link key={entry.href} href={entry.href} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-leaf hover:shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink text-white">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-black text-ink">{entry.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-steel">{entry.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
