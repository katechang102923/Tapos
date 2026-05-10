"use client";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId } from "@/lib/store-access";

export function StoreSettings() {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="店家設定">
      {({ profile }) => <StoreSettingsContent storeId={defaultStoreId(profile)} />}
    </LoginGate>
  );
}

function StoreSettingsContent({ storeId }: { storeId: string }) {
  const { db, upsertStore } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId);
  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    bannerUrl: "",
    phone: "",
    address: "",
    businessHours: "",
    description: "",
    notice: "",
    isOpen: true,
    takeoutEnabled: true,
    dineInEnabled: true,
    takeoutOrderingEnabled: true,
    dineInOrderingEnabled: true,
    posOrderingEnabled: true,
    enablePickupDisplay: true,
    reportEmailEnabled: false,
    reportEmailRecipients: "",
    reportEmailTime: "23:00"
  });

  useEffect(() => {
    if (!store) return;
    setForm({
      name: store.name ?? "",
      logoUrl: store.logoUrl ?? "",
      bannerUrl: store.bannerUrl ?? "",
      phone: store.phone ?? "",
      address: store.address ?? "",
      businessHours: store.businessHours ?? "",
      description: store.description ?? "",
      notice: store.notice ?? "",
      isOpen: store.isOpen,
      takeoutEnabled: store.takeoutEnabled ?? true,
      dineInEnabled: store.dineInEnabled ?? true,
      takeoutOrderingEnabled: store.takeoutOrderingEnabled ?? store.takeoutEnabled ?? true,
      dineInOrderingEnabled: store.dineInOrderingEnabled ?? store.dineInEnabled ?? true,
      posOrderingEnabled: store.posOrderingEnabled ?? true,
      enablePickupDisplay: store.enablePickupDisplay ?? true,
      reportEmailEnabled: store.reportEmailEnabled ?? false,
      reportEmailRecipients: store.reportEmailRecipients ?? "",
      reportEmailTime: store.reportEmailTime ?? "23:00"
    });
  }, [store]);

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">尚未建立店家</h1>
          <Link href="/onboarding" className="mt-4 inline-flex rounded-lg bg-leaf px-4 py-3 font-black text-white">前往建店</Link>
        </div>
      </main>
    );
  }

  if (!store) {
    return <main className="grid min-h-screen place-items-center bg-[#fff7e8] font-black text-steel">載入店家設定...</main>;
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (!store) return;
    upsertStore({
      ...store,
      ...form
    });
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台設定</p>
            <h1 className="text-3xl font-black text-ink">店家設定</h1>
            <p className="mt-1 text-sm font-bold text-steel">店名、營業狀態、營業時間、外帶/內用開關與基本資料設定。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            返回設定中心
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 p-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-ink">基本資料</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="店家名稱" value={form.name} onChange={(value) => update("name", value)} />
            <Field label="店家電話" value={form.phone} onChange={(value) => update("phone", value)} />
            <Field label="店家地址" value={form.address} onChange={(value) => update("address", value)} className="sm:col-span-2" />
            <Field label="營業時間" value={form.businessHours} onChange={(value) => update("businessHours", value)} />
            <Field label="Logo 圖片網址" value={form.logoUrl} onChange={(value) => update("logoUrl", value)} />
            <Field label="Banner 圖片網址" value={form.bannerUrl} onChange={(value) => update("bannerUrl", value)} className="sm:col-span-2" />
            <label className="grid gap-1 text-sm font-black text-steel sm:col-span-2">
              店家簡介
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} className="min-h-24 rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
            </label>
            <label className="grid gap-1 text-sm font-black text-steel sm:col-span-2">
              店家公告
              <textarea value={form.notice} onChange={(event) => update("notice", event.target.value)} className="min-h-20 rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
            </label>
          </div>
          <button onClick={save} className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-5 py-4 font-black text-white">
            <Save className="size-5" />
            儲存店家設定
          </button>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">營業狀態</h2>
            <div className="mt-4 grid gap-3">
              <Toggle label="營業中" checked={form.isOpen} onChange={(value) => update("isOpen", value)} />
              <Toggle label="開放外帶 QR 接單" checked={form.takeoutOrderingEnabled} onChange={(value) => update("takeoutOrderingEnabled", value)} />
              <Toggle label="開放內用 QR 接單" checked={form.dineInOrderingEnabled} onChange={(value) => update("dineInOrderingEnabled", value)} />
              <Toggle label="開放 POS 現場單" checked={form.posOrderingEnabled} onChange={(value) => update("posOrderingEnabled", value)} />
              <Toggle label="POS 現場單需出餐叫號" checked={form.enablePickupDisplay} onChange={(value) => update("enablePickupDisplay", value)} />
            </div>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">自動報表 Email</h2>
            <div className="mt-4 grid gap-3">
              <Toggle label="啟用每日自動 Email" checked={form.reportEmailEnabled} onChange={(value) => update("reportEmailEnabled", value)} />
              <label className="grid gap-1 text-sm font-black text-steel">
                收件人（逗號分隔多個 Email）
                <input value={form.reportEmailRecipients} onChange={(event) => update("reportEmailRecipients", event.target.value)} placeholder="owner@example.com, manager@example.com" className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
              </label>
              <label className="grid gap-1 text-sm font-black text-steel">
                寄送時間
                <input type="time" value={form.reportEmailTime} onChange={(event) => update("reportEmailTime", event.target.value)} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
              </label>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            {form.bannerUrl && <img src={form.bannerUrl} alt="Banner 預覽" className="aspect-[16/7] w-full object-cover" />}
            <div className="p-5">
              {form.logoUrl && <img src={form.logoUrl} alt="Logo 預覽" className="size-16 rounded-lg object-cover" />}
              <p className="mt-3 text-xl font-black text-ink">{form.name || "店家名稱"}</p>
              <p className="mt-1 text-sm font-bold text-steel">{form.businessHours || "營業時間未設定"}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`grid gap-1 text-sm font-black text-steel ${className}`}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-orange-50 px-4 py-4 font-black text-ink">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5" />
    </label>
  );
}
