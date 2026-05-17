"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LoginGate } from "@/components/auth/login-gate";
import { businessScheduleSummary, defaultBusinessSchedule, normalizeBusinessSchedule, weekdayKeys, weekdayLabels } from "@/lib/business-hours";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId, isPlatformAdmin } from "@/lib/store-access";
import { storeRoleFor } from "@/lib/store-access";
import type { BusinessSchedule, User, WeekdayKey } from "@/lib/types";

const taiwanDistricts: Record<string, string[]> = {
  "高雄市": ["新興區", "前金區", "苓雅區", "鹽埕區", "鼓山區", "旗津區", "前鎮區", "三民區", "楠梓區", "小港區", "左營區", "仁武區", "大社區", "岡山區", "路竹區", "阿蓮區", "田寮區", "燕巢區", "橋頭區", "梓官區", "彌陀區", "永安區", "湖內區", "鳳山區", "大寮區", "林園區", "鳥松區", "大樹區", "旗山區", "美濃區", "內門區", "杉林區", "甲仙區", "六龜區", "茂林區", "桃源區", "那瑪夏區"],
  "台南市": ["中西區", "東區", "南區", "北區", "安平區", "安南區", "永康區", "歸仁區", "新化區", "左鎮區", "玉井區", "楠西區", "南化區", "仁德區", "關廟區", "龍崎區", "官田區", "麻豆區", "佳里區", "西港區", "七股區", "將軍區", "學甲區", "北門區", "新營區", "後壁區", "白河區", "東山區", "六甲區", "下營區", "柳營區", "鹽水區", "善化區", "大內區", "山上區", "新市區", "安定區"],
  "屏東縣": ["屏東市", "潮州鎮", "東港鎮", "恆春鎮", "萬丹鄉", "長治鄉", "麟洛鄉", "九如鄉", "里港鄉", "鹽埔鄉", "高樹鄉", "萬巒鄉", "內埔鄉", "竹田鄉", "新埤鄉", "枋寮鄉", "新園鄉", "崁頂鄉", "林邊鄉", "南州鄉", "佳冬鄉", "琉球鄉", "車城鄉", "滿州鄉", "枋山鄉", "三地門鄉", "霧台鄉", "瑪家鄉", "泰武鄉", "來義鄉", "春日鄉", "獅子鄉", "牡丹鄉"]
};

type StoreForm = {
  name: string;
  logoUrl: string;
  bannerUrl: string;
  phone: string;
  address: string;
  addressCity: string;
  addressDistrict: string;
  addressDetail: string;
  closedDates: string[];
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
  checkoutMode: "prepaid" | "postpaid";
  reportEmailEnabled: boolean;
  reportEmailRecipients: string;
  reportEmailTime: string;
};

export function StoreSettings() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager"]} title="店家設定">
      {({ profile }) => <StoreSettingsContent storeId={defaultStoreId(profile)} profile={profile} />}
    </LoginGate>
  );
}

function StoreSettingsContent({ storeId, profile }: { storeId: string; profile: User | null }) {
  const { db, upsertStore } = useDemoStore({ storeId, skipOrderList: true });
  const canManageCheckoutMode = isPlatformAdmin(profile) || ["owner", "manager"].includes(storeRoleFor(profile, storeId) ?? "");
  const store = db.stores.find((item) => item.id === storeId);
  const [message, setMessage] = useState("");
  const [closedDateInput, setClosedDateInput] = useState("");
  const [form, setForm] = useState<StoreForm>(() => ({
    name: "",
    logoUrl: "",
    bannerUrl: "",
    phone: "",
    address: "",
    addressCity: "",
    addressDistrict: "",
    addressDetail: "",
    closedDates: [],
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
    checkoutMode: "prepaid",
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
      addressCity: store.addressCity ?? "",
      addressDistrict: store.addressDistrict ?? "",
      addressDetail: store.addressDetail ?? (store.addressCity || store.addressDistrict ? "" : store.address ?? ""),
      closedDates: [...(store.closedDates ?? [])].sort(),
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
      checkoutMode: store.checkoutMode ?? "prepaid",
      reportEmailEnabled: store.reportEmailEnabled ?? false,
      reportEmailRecipients: store.reportEmailRecipients ?? "",
      reportEmailTime: store.reportEmailTime ?? "23:00"
    });
  }, [store]);

  const districtOptions = useMemo(() => taiwanDistricts[form.addressCity] ?? [], [form.addressCity]);
  const scheduleSummary = businessScheduleSummary(form.businessSchedule);

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

  function updateAddressCity(city: string) {
    setForm((current) => ({
      ...current,
      addressCity: city,
      addressDistrict: taiwanDistricts[city]?.includes(current.addressDistrict) ? current.addressDistrict : ""
    }));
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

  function addClosedDate() {
    if (!closedDateInput) return;
    setForm((current) => ({
      ...current,
      closedDates: Array.from(new Set([...current.closedDates, closedDateInput])).sort()
    }));
    setClosedDateInput("");
  }

  function removeClosedDate(date: string) {
    setForm((current) => ({
      ...current,
      closedDates: current.closedDates.filter((item) => item !== date)
    }));
  }

  async function save() {
    if (!store) return;
    const fullAddress = [form.addressCity, form.addressDistrict, form.addressDetail].filter(Boolean).join("");
    const nextBusinessHours = businessScheduleSummary(form.businessSchedule);
    await upsertStore({
      ...store,
      ...form,
      address: fullAddress,
      businessHours: nextBusinessHours,
      closedDates: Array.from(new Set(form.closedDates)).sort(),
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
            <h1 className="text-3xl font-black text-ink">店家資料與營業設定</h1>
            <p className="mt-1 text-sm font-bold text-steel">管理店家基本資料、圖片、營業時間、公休日與接單開關。</p>
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
              <label className="grid gap-1 text-sm font-black text-steel">
                縣市
                <select value={form.addressCity} onChange={(event) => updateAddressCity(event.target.value)} className="rounded-lg border border-orange-100 bg-white px-4 py-3 font-bold text-ink">
                  <option value="">請選擇縣市</option>
                  {Object.keys(taiwanDistricts).map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black text-steel">
                區域
                <select value={form.addressDistrict} onChange={(event) => update("addressDistrict", event.target.value)} disabled={!form.addressCity} className="rounded-lg border border-orange-100 bg-white px-4 py-3 font-bold text-ink disabled:bg-stone-100">
                  <option value="">請選擇區域</option>
                  {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
              </label>
              <Field label="詳細地址" value={form.addressDetail} onChange={(value) => update("addressDetail", value)} className="sm:col-span-2" placeholder="例如 中山一路 100 號 1 樓" />
              <Field
                label="Logo 圖片網址"
                value={form.logoUrl}
                onChange={(value) => update("logoUrl", value)}
                placeholder="請貼上 Logo 圖片網址，建議 400x400px，檔案小於 300KB"
                help="目前先支援圖片網址，之後可擴充上傳圖片並自動壓縮。"
              />
              <Field
                label="Banner 圖片網址"
                value={form.bannerUrl}
                onChange={(value) => update("bannerUrl", value)}
                className="sm:col-span-2"
                placeholder="請貼上首頁橫幅圖片網址，建議 1200x400px，檔案小於 800KB"
                help="目前先支援圖片網址，之後可擴充上傳圖片並自動壓縮。"
              />
              <Textarea label="店家簡介" value={form.description} onChange={(value) => update("description", value)} />
              <Textarea label="臨時公告" value={form.notice} onChange={(value) => update("notice", value)} />
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="size-5 text-leaf" />
              <h2 className="text-2xl font-black text-ink">正式營業時間</h2>
            </div>
            <p className="mt-2 text-sm font-bold text-steel">可設定每週營業日與時間，支援 18:00–02:00 這類跨日營業。</p>
            <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-ink">目前摘要：{scheduleSummary}</p>
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

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-ink">本月公休日</h2>
            <p className="mt-2 text-sm font-bold text-steel">公休日會自動停止 QR 與 POS 接單，顧客會看到「今日公休，暫停接單」。</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input type="date" value={closedDateInput} onChange={(event) => setClosedDateInput(event.target.value)} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
              <button type="button" onClick={addClosedDate} className="rounded-lg bg-ink px-4 py-3 font-black text-white">新增公休日</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {form.closedDates.length === 0 ? (
                <p className="text-sm font-bold text-steel">尚未設定本月公休日</p>
              ) : form.closedDates.map((date) => (
                <span key={date} className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-2 text-sm font-black text-ink">
                  {formatClosedDate(date)}
                  <button type="button" onClick={() => removeClosedDate(date)} className="text-tomato"><X className="size-4" /></button>
                </span>
              ))}
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
            <h2 className="text-2xl font-black text-ink">接單狀態</h2>
            <div className="mt-4 grid gap-3">
              <Toggle label="店家營業中" checked={form.isOpen} onChange={(value) => update("isOpen", value)} />
              <Toggle label="臨時休息" checked={form.temporaryClosed} onChange={(value) => update("temporaryClosed", value)} />
              <Toggle label="手動暫停接單" checked={form.temporaryPaused} onChange={(value) => update("temporaryPaused", value)} />
              <Toggle label="開放外帶 QR 接單" checked={form.takeoutOrderingEnabled} onChange={(value) => update("takeoutOrderingEnabled", value)} />
              <Toggle label="開放內用 QR 接單" checked={form.dineInOrderingEnabled} onChange={(value) => update("dineInOrderingEnabled", value)} />
              <Toggle label="開放 POS 現場單" checked={form.posOrderingEnabled} onChange={(value) => update("posOrderingEnabled", value)} />
              <Toggle label="POS 可在非營業時間建立現場單" checked={form.allowPosOutsideBusinessHours} onChange={(value) => update("allowPosOutsideBusinessHours", value)} />
              <Toggle label="啟用取餐號顯示" checked={form.enablePickupDisplay} onChange={(value) => update("enablePickupDisplay", value)} />
            </div>
          </div>

          {/* 結帳模式 */}
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-ink">結帳模式</h2>
            <p className="mt-1 text-sm font-bold text-steel">決定 POS 送出訂單時的結帳流程。</p>
            {!canManageCheckoutMode && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                僅老闆、店長或系統管理員可修改結帳模式
              </p>
            )}
            <div className="mt-3 grid gap-2">
              {([
                { value: "prepaid", label: "先結帳", desc: "按下送出時立即完成付款，再建立訂單進廚房。" },
                { value: "postpaid", label: "後結帳", desc: "先建立訂單進廚房，用餐/取餐後再統一結帳。" },
              ] as const).map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    form.checkoutMode === value
                      ? "border-leaf bg-leaf/5"
                      : "border-orange-100 bg-orange-50"
                  } ${!canManageCheckoutMode ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="checkoutMode"
                    value={value}
                    checked={form.checkoutMode === value}
                    disabled={!canManageCheckoutMode}
                    onChange={() => update("checkoutMode", value)}
                    className="mt-0.5 size-4 shrink-0 accent-leaf"
                  />
                  <div>
                    <p className="font-black text-ink">{label}</p>
                    <p className="text-xs font-bold text-steel">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">日報 Email</h2>
            <div className="mt-4 grid gap-3">
              <Toggle label="啟用每日報表 Email" checked={form.reportEmailEnabled} onChange={(value) => update("reportEmailEnabled", value)} />
              <Field label="收件 Email，可用逗號分隔" value={form.reportEmailRecipients} onChange={(value) => update("reportEmailRecipients", value)} />
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
              <p className="mt-1 text-sm font-bold text-steel">{scheduleSummary}</p>
              <p className="mt-1 text-sm font-bold text-steel">{[form.addressCity, form.addressDistrict, form.addressDetail].filter(Boolean).join("") || "地址未設定"}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function formatClosedDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function Field({ label, value, onChange, className = "", placeholder = "", help = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string; placeholder?: string; help?: string }) {
  return (
    <label className={`grid gap-1 text-sm font-black text-steel ${className}`}>
      {label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink placeholder:text-stone-400" />
      {help && <span className="text-xs font-bold text-stone-500">{help}</span>}
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
