import Link from "next/link";
import { ChefHat, LayoutDashboard, LogIn, QrCode, ShieldCheck, Store } from "lucide-react";
import { demoStoreId } from "@/lib/mock-data";

const links = [
  { href: "/register", label: "註冊開店", icon: Store },
  { href: "/login", label: "登入", icon: LogIn },
  { href: `/order/${demoStoreId}`, label: "顧客點餐", icon: QrCode },
  { href: "/merchant", label: "店家後台", icon: LayoutDashboard },
  { href: `/kitchen/${demoStoreId}`, label: "廚房 KDS", icon: ChefHat },
  { href: "/admin", label: "管理員", icon: ShieldCheck }
];

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-mist/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-ink text-white">
            <QrCode className="size-5" />
          </div>
          <div>
            <p className="text-base font-black text-ink">QR 點餐 SaaS MVP</p>
            <p className="text-sm font-semibold text-steel">註冊、建店、菜單、QR Code、KDS</p>
          </div>
        </Link>
        <nav className="flex gap-2 overflow-x-auto">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-steel shadow-sm transition hover:border-leaf hover:text-leaf">
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
