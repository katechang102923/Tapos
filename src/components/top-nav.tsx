import Link from "next/link";
import { QrCode } from "lucide-react";

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-mist/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-ink text-white">
            <QrCode className="size-5" />
          </div>
          <div>
            <p className="text-base font-black text-ink">餐飲 QR 點餐系統</p>
            <p className="text-sm font-semibold text-steel">QR 點餐・POS・KDS・會員</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
