import Link from "next/link";
import { ArrowRight, ChefHat, LayoutDashboard, QrCode, ShieldCheck, Store } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { demoStoreId } from "@/lib/mock-data";

const entries = [
  {
    href: "/register",
    title: "新店家註冊",
    description: "建立帳號後進入 onboarding，建立店家、菜單與 QR Code。",
    icon: Store
  },
  {
    href: `/order/${demoStoreId}`,
    title: "顧客 QR 點餐",
    description: "手機掃碼後點餐，送單即時同步到後台與 KDS。",
    icon: QrCode
  },
  {
    href: "/merchant",
    title: "店家 POS 後台",
    description: "登入後依角色管理店家、菜單、訂單與店休模式。",
    icon: LayoutDashboard
  },
  {
    href: `/kitchen/${demoStoreId}`,
    title: "廚房 KDS",
    description: "即時新訂單、計時器、超時警示與大字模式。",
    icon: ChefHat
  },
  {
    href: "/admin",
    title: "SaaS 管理員",
    description: "建立店家、匯入 Demo 資料與管理多店家。",
    icon: ShieldCheck
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-mist">
      <TopNav />
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-12">
        <div className="flex min-h-[430px] flex-col justify-center">
          <p className="mb-4 inline-flex w-fit rounded-full bg-leaf/10 px-4 py-2 text-sm font-black text-leaf">
            Firebase SaaS Onboarding Ready
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-ink sm:text-5xl">
            從註冊到開店的早餐店 QR 點餐 SaaS MVP
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-steel">
            新店家可以註冊帳號、建立店家、上傳 Logo/Banner、自動生成預設菜單與 QR Code，並開始測試顧客點餐、後台管理與廚房 KDS。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 font-black text-white shadow-soft transition hover:bg-leaf/90">
              開始註冊店家
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-black text-ink transition hover:border-leaf hover:text-leaf">
              店家登入
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
