"use client";

import Link from "next/link";
import { useState } from "react";
import { QrCode, Save } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { getAppUrl } from "@/lib/app-url";

export function StoreSettings() {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="店家設定登入">
      {({ profile }) => <StoreSettingsContent storeId={profile?.storeId ?? ""} />}
    </LoginGate>
  );
}

function StoreSettingsContent({ storeId }: { storeId: string }) {
  const { db, upsertStore } = useDemoStore({ storeId });
  const store = db.stores.find((item) => item.id === storeId);
  const [name, setName] = useState(store?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(store?.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(store?.bannerUrl ?? "");
  const [isOpen, setIsOpen] = useState(store?.isOpen ?? true);
  const [notice, setNotice] = useState(store?.notice ?? "");

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">尚未建立店家</h1>
          <Link href="/onboarding" className="mt-4 inline-flex rounded-lg bg-leaf px-4 py-3 font-black text-white">前往建店</Link>
        </div>
      </main>
    );
  }

  if (!store) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f4f2] font-black text-steel">載入店家設定...</main>;
  }

  const orderUrl = `${getAppUrl()}/order/${storeId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(orderUrl)}`;

  function readFile(file: File, setter: (value: string) => void) {
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  }

  function save() {
    if (!store) return;
    upsertStore({
      id: store.id,
      ownerId: store.ownerId,
      storeType: store.storeType,
      createdAt: store.createdAt,
      name,
      logoUrl,
      bannerUrl,
      isOpen,
      notice
    });
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-leaf">Store Settings</p>
          <h1 className="mt-2 text-3xl font-black text-ink">店家設定</h1>
          <div className="mt-6 grid gap-4">
            <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border border-stone-300 px-4 py-3 text-lg font-bold" />
            <textarea value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="店家公告" className="min-h-20 rounded-lg border border-stone-300 px-4 py-3" />
            <Upload label="Logo" value={logoUrl} setValue={setLogoUrl} onFile={(file) => readFile(file, setLogoUrl)} />
            <Upload label="Banner" value={bannerUrl} setValue={setBannerUrl} onFile={(file) => readFile(file, setBannerUrl)} />
            <label className="flex items-center gap-3 rounded-lg bg-stone-100 px-4 py-3 font-black text-steel">
              <input type="checkbox" checked={isOpen} onChange={(event) => setIsOpen(event.target.checked)} />
              營業中
            </label>
            <button onClick={save} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white">
              <Save className="size-5" />
              儲存設定
            </button>
          </div>
        </section>

        <aside className="rounded-lg bg-ink p-5 text-white shadow-soft">
          <div className="flex items-center gap-3">
            <QrCode className="size-8" />
            <div>
              <p className="text-xl font-black">店家 QR Code</p>
              <p className="text-sm font-bold text-white/60">{getAppUrl()}/order/{storeId}</p>
            </div>
          </div>
          <img src={qrUrl} alt="Store QR Code" className="mt-5 w-full rounded-lg bg-white p-4" />
          <p className="mt-4 break-all rounded-lg bg-white/10 p-3 text-sm font-bold">{orderUrl}</p>
          <a href={qrUrl} download={`qr-${storeId}.png`} className="mt-4 inline-flex w-full justify-center rounded-lg bg-white px-4 py-3 font-black text-ink">
            下載 PNG
          </a>
          <Link href="/merchant" className="mt-3 inline-flex w-full justify-center rounded-lg bg-white/10 px-4 py-3 font-black text-white">
            回後台
          </Link>
        </aside>
      </div>
    </main>
  );
}

function Upload({ label, value, setValue, onFile }: { label: string; value: string; setValue: (value: string) => void; onFile: (file: File) => void }) {
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <p className="font-black text-steel">{label}</p>
      {value && <img src={value} alt={`${label} preview`} className="mt-3 aspect-[4/2] w-full rounded-lg object-cover" />}
      <input value={value} onChange={(event) => setValue(event.target.value)} className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} className="mt-3 w-full text-sm" />
    </div>
  );
}
