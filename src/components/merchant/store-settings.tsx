"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginGate } from "@/components/auth/login-gate";
import { defaultBusinessSchedule, normalizeBusinessSchedule, weekdayKeys, weekdayLabels } from "@/lib/business-hours";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId } from "@/lib/store-access";
import type { BusinessSchedule, WeekdayKey } from "@/lib/types";

type StoreForm = {
  name: string;
  logoUrl: string;
  bannerUrl: string;
  phone: string;
  address: string;
  businessHours: string;
  businessSchedule: BusinessSchedule;
  description: string;
  notice: string;
  isOpen: boolean;
  temporaryClosed: boolean;
  temporaryPaused: boolean;
  takeoutEnabled: boolean;
  dineInEnabled: boolean;
  takeoutOrderingEnabled: boolean;
  dineInOrderingEnabled: boolean;
  posOrderingEnabled: boolean;
  allowPosOutsideBusinessHours: boolean;
  enablePickupDisplay: boolean;
  reportEmailEnabled: boolean;
  reportEmailRecipients: string;
  reportEmailTime: string;
};

export function StoreSettings() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager"]} title="店家設定">
      {({ profile }) => <StoreSettingsContent storeId={defaultStoreId(profile)} />}
    </LoginGate>
  );
}

function StoreSettingsContent({ storeId }: { storeId: string }) {
  const { db, upsertStore } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<StoreForm>(() => ({
    name: "",
    logoUrl: "",
    bannerUrl: "",
    phone: "",
    address: "",
    businessHours: "",
    businessSchedule: defaultBusinessSchedule(),
    description: "",
    notice: "",
    isOpen: true,
    temporaryClosed: false,
    temporaryPaused: false,
    takeoutEnabled: true,
    dineInEnabled: true,
    takeoutOrderingEnabled: true,
    dineInOrderingEnabled: true,
    posOrderingEnabled: true,
    allowPosOutsideBusinessHours: false,
    enablePickupDisplay: true,
    reportEmailEnabled: false,
    reportEmailRecipients: "",
    reportEmailTime: "23:00"
  }));

  useEffect(() => {
    if (!store) return;
    setForm({
      name: store.name ?? "",
      logoUrl: store.logoUrl ?? "",
      bannerUrl: store.bannerUrl ?? "",
      phone: store.phone ?? "",
      address: store.address ?? "",
      businessHours: store.businessHours ?? "",
      businessSchedule: normalizeBusinessSchedule(store.businessSchedule),
      description: store.description ?? "",
      notice: store.notice ?? "",
      isOpen: store.isOpen,
      temporaryClosed: store.temporaryClosed ?? false,
      temporaryPaused: store.temporaryPaused ?? false,
      takeoutEnabled: store.takeoutEnabled ?? true,
      dineInEnabled: store.dineInEnabled ?? true,
      takeoutOrderingEnabled: store.takeoutOrderingEnabled ?? store.takeoutEnabled ?? true,
      dineInOrderingEnabled: store.dineInOrderingEnabled ?? store.dineInEnabled ?? true,
      posOrderingEnabled: store.posOrderingEnabled ?? true,
      allowPosOutsideBusinessHours: store.allowPosOutsideBusinessHours ?? false,
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
          <h1 className="text-2xl font-black text-ink">請先完成店家設定</h1>
          <Link href="/onboarding" className="mt-4 inline-flex rounded-lg bg-leaf px-4 py-3 font-black text-white">前往建店</Link>
        </div>
      </main>
    );
  }

  if (!store) {
    return <main className="grid min-h-screen place-items-center bg-[#fff7e8] font-black text-steel">載入店家設定...</main>;
  }

  function update<K extends keyof StoreForm>(key: K, value: StoreForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSchedule(day: WeekdayKey, patch: Partial<BusinessSchedule[WeekdayKey]>) {
    setForm((current) => ({
      ...current,
      businessSchedule: {
        ...current.businessSchedule,
        [day]: { ...current.businessSchedule[day], ...patch }
      }
    }));
  }

  async function save() {
    if (!store) return;
    await upsertStore({
      ...store,
      ...form,
      orderStatus: form.isOpen ? (form.temporaryPaused ? "paused" : "open") : "closed"
    });
    setMessage("店家設定已儲存");
    window.setTimeout(() => setMessage(""), 2500);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家設定</p>
            <h1 className="text-3xl font-black text-ink">基本資料與接單設定</h1>
            <p className="mt-1 text-sm font-bold text-steel">管理店家資料、營業時間、QR 接單與 POS 現場單開關。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            返回設定中心
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 p-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-ink">店家基本資料</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="店家名稱" value={form.name} onChange={(value) => update("name", value)} />
              <Field label="店家電話" value={form.phone} onChange={(value) => update("phone", value)} />
              <Field label="店家地址" value={form.address} onChange={(value) => update("address", value)} className="sm:col-span-2" />
              <Field label="營業時間摘要文字" value={form.businessHours} onChange={(value) => update("businessHours", value)} />
              <Field label="Logo 圖片網址" value={form.logoUrl} onChange={(value) => update("logoUrl", value)} />
              <Field label="Banner 圖片網址" value={form.bannerUrl} onChange={(value) => update("bannerUrl", value)} className="sm:col-span-2" />
              <Textarea label="店家簡介" value={form.description} onChange={(value) => update("description", value)} />
              <Textarea label="臨時公告" value={form.notice} onChange={(value) => update("notice", value)} />
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="size-5 text-leaf" />
              <h2 className="text-2xl font-black text-ink">正式營業時間</h2>
            </div>
            <p className="mt-2 text-sm font-bold text-steel">可設定每週營業日與開始/結束時間，支援跨日，例如 18:00 到 02:00。</p>
            <div className="mt-4 grid gap-3">
              {weekdayKeys.map((day) => {
                const item = form.businessSchedule[day];
                return (
                  <div key={day} className="grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-[90px_1fr_1fr] sm:items-center">
                    <label className="flex items-center gap-2 font-black text-ink">
                      <input type="checkbox" checked={item.enabled} onChange={(event) => updateSchedule(day, { enabled: event.target.checked })} className="size-5" />
                      {weekdayLabels[day]}
                    </label>
                    <label className="grid gap-1 text-sm font-black text-steel">開始時間<input type="time" value={item.start} disabled={!item.enabled} onChange={(event) => updateSchedule(day, { start: event.target.value })} className="rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink disabled:bg-stone-100" /></label>
                    <label className="grid gap-1 text-sm font-black text-steel">結束時間<input type="time" value={item.end} disabled={!item.enabled} onChange={(event) => updateSchedule(day, { end: event.target.value })} className="rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink disabled:bg-stone-100" /></label>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={save} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-5 py-4 font-black text-white">
            <Save className="size-5" />
            儲存店家設定
          </button>
          {message && <span className="ml-3 font-black text-leaf">{message}</span>}
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">營業與接單開關</h2>
            <div className="mt-4 grid gap-3">
              <Toggle label="店家營業中" checked={form.isOpen} onChange={(value) => update("isOpen", value)} />
              <Toggle label="臨時休息" checked={form.temporaryClosed} onChange={(value) => update("temporaryClosed", value)} />
              <Toggle label="暫停接單" checked={form.temporaryPaused} onChange={(value) => update("temporaryPaused", value)} />
              <Toggle label="開放外帶 QR 接單" checked={form.takeoutOrderingEnabled} onChange={(value) => update("takeoutOrderingEnabled", value)} />
              <Toggle label="開放內用 QR 接單" checked={form.dineInOrderingEnabled} onChange={(value) => update("dineInOrderingEnabled", value)} />
              <Toggle label="開放 POS 現場單" checked={form.posOrderingEnabled} onChange={(value) => update("posOrderingEnabled", value)} />
              <Toggle label="POS 可在非營業時間手動建單" checked={form.allowPosOutsideBusinessHours} onChange={(value) => update("allowPosOutsideBusinessHours", value)} />
              <Toggle label="顯示取餐號" checked={form.enablePickupDisplay} onChange={(value) => update("enablePickupDisplay", value)} />
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">日報 Email</h2>
            <div className="mt-4 grid gap-3">
              <Toggle label="啟用每日報表 Email" checked={form.reportEmailEnabled} onChange={(value) => update("reportEmailEnabled", value)} />
              <Field label="收件人 Email（可多筆）" value={form.reportEmailRecipients} onChange={(value) => update("reportEmailRecipients", value)} />
              <label className="grid gap-1 text-sm font-black text-steel">
                發送時間
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

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-black text-steel sm:col-span-2">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-20 rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
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
