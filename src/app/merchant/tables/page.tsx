"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { getAppUrl } from "@/lib/app-url";
import { defaultStoreId } from "@/lib/store-access";

export default function MerchantTablesPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="桌號設定登入">
      {({ profile }) => <MerchantTablesContent storeId={defaultStoreId(profile)} />}
    </LoginGate>
  );
}

function MerchantTablesContent({ storeId }: { storeId: string }) {
  const { db } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId);
  const orderUrl = `${getAppUrl()}/order/${storeId}`;
  const tableNumbers = Array.from({ length: 12 }, (_, index) => String(index + 1));

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">先建立店家</h1>
          <Link href="/onboarding" className="mt-4 inline-flex rounded-lg bg-leaf px-4 py-3 font-black text-white">開始建店</Link>
        </div>
      </main>
    );
  }

  function copyTableUrl(tableNo: string) {
    const tableUrl = `${orderUrl}/${encodeURIComponent(tableNo)}`;
    navigator.clipboard?.writeText(tableUrl);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台</p>
            <h1 className="text-3xl font-black text-ink">{store?.name} · 桌號與 QR Code 管理</h1>
            <p className="mt-1 text-sm font-bold text-steel">為每一張餐桌產生獨立的 QR Code，顧客掃碼進入內用點餐頁面。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink border border-orange-100">
            <ArrowLeft className="size-5" />
            回上一層
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-4">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">QR 桌號設定</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-steel">下方為 1 到 12 桌的點餐連結與 QR Code。每張桌子的顧客會進入同一張桌的內用點餐頁面。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tableNumbers.map((tableNo) => {
              const tableUrl = `${orderUrl}/${encodeURIComponent(tableNo)}`;
              const tableQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(tableUrl)}`;
              return (
                <div key={tableNo} className="rounded-lg border border-orange-100 bg-[#fffaf0] p-4">
                  <p className="text-xl font-black">桌號 {tableNo}</p>
                  <p className="mt-2 break-all text-xs font-bold text-steel">{tableUrl}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={tableQrUrl} download={`table-${storeId}-${tableNo}.png`} className="inline-flex items-center justify-center gap-1 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white">
                      <Download className="size-4" />
                      下載
                    </a>
                    <button onClick={() => copyTableUrl(tableNo)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-black text-ink border border-orange-100">
                      <Copy className="size-4" />
                      複製
                    </button>
                    <a href={tableUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-steel">
                      <ExternalLink className="size-4" />
                      預覽
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-leaf text-white">
              <QrCode className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black">全店通用點餐 QR Code</h2>
              <p className="text-sm font-bold text-steel">所有顧客掃碼進入同一個點餐頁（外帶模式）</p>
            </div>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[300px_1fr]">
            <div>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(orderUrl)}`} alt="顧客點餐 QR Code" className="w-full rounded-lg bg-white p-4 border border-orange-100" />
            </div>
            <div>
              <p className="break-all rounded-lg bg-orange-50 p-3 text-sm font-bold text-steel border border-orange-100">{orderUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => navigator.clipboard?.writeText(orderUrl)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
                  <Copy className="size-5" />
                  複製點餐連結
                </button>
                <a href={orderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink border border-orange-100">
                  <ExternalLink className="size-5" />
                  預覽點餐頁
                </a>
                <a href={`https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(orderUrl)}`} download={`qr-${storeId}.png`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink border border-orange-100">
                  <Download className="size-5" />
                  下載 QR Code 圖片
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
