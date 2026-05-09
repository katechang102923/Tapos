"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { getAppUrl } from "@/lib/app-url";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId } from "@/lib/store-access";

export function QrManagement() {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="QR 管理">
      {({ profile }) => <QrManagementContent storeId={defaultStoreId(profile)} />}
    </LoginGate>
  );
}

function QrManagementContent({ storeId }: { storeId: string }) {
  const { db } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId);
  const orderUrl = `${getAppUrl()}/order/${storeId}`;
  const takeoutQrUrl = qrImage(orderUrl);
  const tableNumbers = Array.from({ length: 12 }, (_, index) => String(index + 1));

  function copy(value: string) {
    navigator.clipboard?.writeText(value);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台設定</p>
            <h1 className="text-3xl font-black text-ink">{store?.name ?? "店家"} · QR 管理</h1>
            <p className="mt-1 text-sm font-bold text-steel">產生 QR Code、複製 QR 點餐連結、桌號 QR 與外帶 QR。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            返回設定中心
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-lg bg-ink p-5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <QrCode className="size-8" />
            <div>
              <h2 className="text-2xl font-black">外帶 QR</h2>
              <p className="text-sm font-bold text-white/60">顧客掃描後進入點餐頁</p>
            </div>
          </div>
          <img src={takeoutQrUrl} alt="外帶 QR Code" className="mt-5 w-full rounded-lg bg-white p-4" />
          <p className="mt-4 break-all rounded-lg bg-white/10 p-3 text-sm font-bold">{orderUrl}</p>
          <div className="mt-4 grid gap-2">
            <button onClick={() => copy(orderUrl)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink"><Copy className="size-5" />複製點餐連結</button>
            <a href={orderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ExternalLink className="size-5" />預覽點餐頁</a>
            <a href={takeoutQrUrl} download={`takeout-${storeId}.png`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><Download className="size-5" />下載 QR PNG</a>
          </div>
        </aside>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black text-ink">桌號 QR</h2>
          <p className="mt-2 text-sm font-bold text-steel">每張桌子的 QR 會帶入桌號，例如 /order/{storeId}/1。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tableNumbers.map((tableNo) => {
              const tableUrl = `${orderUrl}/${encodeURIComponent(tableNo)}`;
              const tableQrUrl = qrImage(tableUrl);
              return (
                <article key={tableNo} className="rounded-lg border border-orange-100 bg-[#fffaf0] p-4">
                  <p className="text-xl font-black text-ink">桌號 {tableNo}</p>
                  <p className="mt-2 break-all text-xs font-bold text-steel">{tableUrl}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => copy(tableUrl)} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-black text-ink"><Copy className="size-4" />複製</button>
                    <a href={tableUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-steel"><ExternalLink className="size-4" />預覽</a>
                    <a href={tableQrUrl} download={`table-${storeId}-${tableNo}.png`} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white"><Download className="size-4" />下載</a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

function qrImage(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(value)}`;
}
