"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Cpu, Plus, Printer, ReceiptText, Save, Tags, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { accessibleStoreIds, defaultStoreId, storeRoleFor } from "@/lib/store-access";
import type { Device, DeviceConnectionType, DeviceType, PrinterStation, User } from "@/lib/types";

const deviceTypes: Array<{ value: DeviceType; label: string; description: string }> = [
  { value: "kitchen", label: "出單機", description: "廚房機、櫃台機、吧台機與 ESC/POS 熱感列印" },
  { value: "label", label: "標籤機", description: "杯貼、外帶貼紙、取餐號標籤" },
  { value: "invoice", label: "電子發票機", description: "預留電子發票字軌、機台與 API 串接" },
  { value: "display", label: "客顯設備", description: "預留客戶顯示器連線設定" },
  { value: "scanner", label: "掃碼槍", description: "預留條碼/QR 掃描設備" }
];

const connectionTypes: Array<{ value: DeviceConnectionType; label: string }> = [
  { value: "bluetooth", label: "藍牙" },
  { value: "usb", label: "USB / 有線" },
  { value: "lan", label: "網路 LAN/IP" }
];

const stationOptions: Array<{ value: PrinterStation; label: string }> = [
  { value: "kitchen", label: "廚房機" },
  { value: "counter", label: "櫃台機" },
  { value: "bar", label: "吧台機" }
];

function blankDevice(storeId: string): Device {
  const now = new Date().toISOString();
  return {
    id: "",
    storeId,
    type: "kitchen",
    name: "",
    brand: "",
    model: "",
    connectionType: "lan",
    ipAddress: "",
    port: "9100",
    macAddress: "",
    usbVendorId: "",
    usbProductId: "",
    bluetoothName: "",
    paperWidth: "80mm",
    station: "kitchen",
    categoryIds: [],
    labelMode: "cup",
    labelSize: "40x30mm",
    autoPrint: false,
    invoiceMachineNo: "",
    invoiceTrack: "",
    apiKey: "",
    enabled: true,
    connectionStatus: "not_tested",
    createdAt: now,
    updatedAt: now
  };
}

export default function MerchantDevicesPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin", "owner", "manager", "staff", "viewer"]} title="設備與列印設定登入">
      {({ profile }) => <MerchantDevicesContent profile={profile} />}
    </LoginGate>
  );
}

function MerchantDevicesContent({ profile }: { profile: User | null }) {
  const storeIds = accessibleStoreIds(profile);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId(profile));
  const activeStoreId = storeIds.includes(selectedStoreId) ? selectedStoreId : storeIds[0] ?? "";
  const { db, deleteDevice, upsertDevice } = useDemoStore({ storeId: activeStoreId, skipOrderList: true });
  const [editingDevice, setEditingDevice] = useState<Device>(() => blankDevice(activeStoreId));
  const [message, setMessage] = useState("");
  const store = db.stores.find((item) => item.id === activeStoreId);
  const categories = db.categories.filter((item) => item.storeId === activeStoreId).sort((a, b) => a.sort - b.sort);
  const devices = useMemo(() => (db.devices ?? []).filter((device) => device.storeId === activeStoreId), [db.devices, activeStoreId]);
  const storeRole = storeRoleFor(profile, activeStoreId);
  const canManage = profile?.role === "admin" || storeRole === "owner" || storeRole === "manager";

  function startCreate() {
    setEditingDevice(blankDevice(activeStoreId));
    setMessage("");
  }

  function patchDevice(patch: Partial<Device>) {
    setEditingDevice((current) => ({ ...current, ...patch, storeId: activeStoreId }));
  }

  function saveDevice() {
    if (!canManage || !editingDevice.name.trim() || !activeStoreId) return;
    upsertDevice({
      ...editingDevice,
      storeId: activeStoreId,
      name: editingDevice.name.trim(),
      brand: editingDevice.brand.trim(),
      model: editingDevice.model.trim(),
      port: editingDevice.port ? String(editingDevice.port) : "",
      updatedAt: new Date().toISOString()
    });
    setMessage("設備設定已儲存");
    setEditingDevice(blankDevice(activeStoreId));
  }

  function toggleDevice(device: Device) {
    if (!canManage) return;
    upsertDevice({ ...device, enabled: !device.enabled, updatedAt: new Date().toISOString() });
  }

  function removeDevice(device: Device) {
    if (!canManage) return;
    if (!window.confirm(`確定要刪除「${device.name}」嗎？`)) return;
    deleteDevice(device.id);
    setMessage("設備已刪除");
  }

  function testPrint(device: Device) {
    const content = [
      "----------------",
      store?.name || "測試店家",
      "測試列印成功",
      new Date().toLocaleString("zh-TW", { hour12: false }),
      "----------------"
    ].join("\n");
    console.info("printTestTicket", { device, content });
    setMessage(`已產生「${device.name}」測試單。正式串接時會送到 ${device.connectionType.toUpperCase()} 列印服務。`);
  }

  if (!activeStoreId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">尚未綁定店家</h1>
          <p className="mt-3 text-steel">請先由平台管理員將此帳號綁定到店家，再設定設備。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-leaf">設備與列印設定</p>
            <h1 className="text-3xl font-black">出單機、標籤機與電子發票機管理</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold text-steel">先建立設備資料、列印規則與測試單接口，未來可接 Web Bluetooth、WebUSB、LAN ESC/POS 與發票 API。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {storeIds.length > 1 && (
              <select value={activeStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} className="rounded-lg border border-orange-100 bg-white px-4 py-3 font-black">
                {storeIds.map((id) => {
                  const optionStore = db.stores.find((item) => item.id === id);
                  return <option key={id} value={id}>{optionStore?.name ?? id}</option>;
                })}
              </select>
            )}
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
              <ArrowLeft className="size-4" />
              回店家後台
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          {message && <div className="rounded-lg bg-leaf/10 p-4 font-black text-leaf">{message}</div>}
          {!canManage && <div className="rounded-lg bg-amber-100 p-4 font-black text-amber-800">此帳號可查看設備設定，但只有 admin、owner、manager 可以新增或修改設備。</div>}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {deviceTypes.map((item) => (
              <div key={item.value} className="rounded-lg bg-white p-4 shadow-sm">
                <p className="font-black text-ink">{item.label}</p>
                <p className="mt-2 text-xs font-bold leading-5 text-steel">{item.description}</p>
              </div>
            ))}
          </section>

          <section className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">設備列表</h2>
                <p className="mt-1 text-sm font-bold text-steel">{store?.name ?? activeStoreId} 目前共有 {devices.length} 台設備</p>
              </div>
              <button onClick={startCreate} disabled={!canManage} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:opacity-50">
                <Plus className="size-4" />
                新增設備
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {devices.length === 0 ? (
                <p className="rounded-lg bg-orange-50 p-6 text-center font-black text-steel">尚未建立設備設定</p>
              ) : devices.map((device) => (
                <article key={device.id} className="rounded-lg border border-orange-100 bg-[#fffaf0] p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-3">
                      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-white text-leaf">
                        {deviceIcon(device.type)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black">{device.name}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${device.enabled ? "bg-leaf/10 text-leaf" : "bg-stone-200 text-stone-500"}`}>
                            {device.enabled ? "啟用中" : "已停用"}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-steel">{deviceTypeLabel(device.type)}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-steel">{device.brand || "未填品牌"} / {device.model || "未填型號"} / {connectionLabel(device.connectionType)}</p>
                        <p className="mt-1 font-mono text-xs text-steel">
                          {device.connectionType === "lan" && `${device.ipAddress || "未填 IP"}:${device.port || "9100"}`}
                          {device.connectionType === "usb" && `VID ${device.usbVendorId || "-"} / PID ${device.usbProductId || "-"}`}
                          {device.connectionType === "bluetooth" && `${device.bluetoothName || "未填藍牙名稱"} / ${device.macAddress || "未填 MAC"}`}
                        </p>
                        {device.type === "kitchen" && <p className="mt-2 text-sm font-bold text-steel">列印位置：{stationLabel(device.station)}，分類：{categoryNames(device.categoryIds, categories)}</p>}
                        {device.type === "label" && <p className="mt-2 text-sm font-bold text-steel">標籤：{labelModeLabel(device.labelMode)} / {device.labelSize || "未設定"} / {device.autoPrint ? "自動列印" : "手動列印"}</p>}
                        {device.type === "invoice" && <p className="mt-2 text-sm font-bold text-steel">發票機台：{device.invoiceMachineNo || "未設定"} / 字軌：{device.invoiceTrack || "未設定"}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => testPrint(device)} className="rounded-lg bg-ink px-3 py-2 text-sm font-black text-white">列印測試單</button>
                      <button onClick={() => setEditingDevice(device)} disabled={!canManage} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-black text-steel disabled:opacity-50">編輯</button>
                      <button onClick={() => toggleDevice(device)} disabled={!canManage} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-black text-steel disabled:opacity-50">{device.enabled ? "停用" : "啟用"}</button>
                      <button onClick={() => removeDevice(device)} disabled={!canManage} className="inline-flex items-center gap-1 rounded-lg bg-tomato px-3 py-2 text-sm font-black text-white disabled:opacity-50"><Trash2 className="size-4" />刪除</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">{editingDevice.id ? "編輯設備" : "新增設備"}</h2>
          <div className="mt-4 grid gap-3">
            <Field label="設備名稱" value={editingDevice.name} onChange={(value) => patchDevice({ name: value })} />
            <label className="grid gap-1 text-sm font-black text-steel">
              設備類型
              <select value={editingDevice.type} onChange={(event) => patchDevice({ type: event.target.value as DeviceType })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                {deviceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="品牌" value={editingDevice.brand} onChange={(value) => patchDevice({ brand: value })} />
              <Field label="型號" value={editingDevice.model} onChange={(value) => patchDevice({ model: value })} />
            </div>
            <label className="grid gap-1 text-sm font-black text-steel">
              連線方式
              <select value={editingDevice.connectionType} onChange={(event) => patchDevice({ connectionType: event.target.value as DeviceConnectionType })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                {connectionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            {editingDevice.connectionType === "lan" && (
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field label="IP Address" value={editingDevice.ipAddress ?? ""} onChange={(value) => patchDevice({ ipAddress: value })} />
                <Field label="Port" value={editingDevice.port ?? ""} onChange={(value) => patchDevice({ port: value })} />
              </div>
            )}
            {editingDevice.connectionType === "usb" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="USB Vendor ID" value={editingDevice.usbVendorId ?? ""} onChange={(value) => patchDevice({ usbVendorId: value })} />
                <Field label="USB Product ID" value={editingDevice.usbProductId ?? ""} onChange={(value) => patchDevice({ usbProductId: value })} />
              </div>
            )}
            {editingDevice.connectionType === "bluetooth" && (
              <div className="grid gap-3">
                <Field label="藍牙名稱" value={editingDevice.bluetoothName ?? ""} onChange={(value) => patchDevice({ bluetoothName: value })} />
                <Field label="MAC Address" value={editingDevice.macAddress ?? ""} onChange={(value) => patchDevice({ macAddress: value })} />
              </div>
            )}

            {(editingDevice.type === "kitchen" || editingDevice.type === "invoice") && (
              <label className="grid gap-1 text-sm font-black text-steel">
                紙寬
                <select value={editingDevice.paperWidth ?? "80mm"} onChange={(event) => patchDevice({ paperWidth: event.target.value as "58mm" | "80mm" })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                  <option value="58mm">58mm</option>
                  <option value="80mm">80mm</option>
                </select>
              </label>
            )}

            {editingDevice.type === "kitchen" && (
              <div className="rounded-lg bg-orange-50 p-4">
                <p className="font-black">出單機設定</p>
                <label className="mt-3 grid gap-1 text-sm font-black text-steel">
                  出單位置
                  <select value={editingDevice.station ?? "kitchen"} onChange={(event) => patchDevice({ station: event.target.value as PrinterStation })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                    {stationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <div className="mt-3 grid gap-2">
                  <p className="text-sm font-black text-steel">指定列印分類</p>
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2 text-sm font-bold text-steel">
                      <input
                        type="checkbox"
                        checked={(editingDevice.categoryIds ?? []).includes(category.id)}
                        onChange={(event) => {
                          const current = editingDevice.categoryIds ?? [];
                          patchDevice({ categoryIds: event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id) });
                        }}
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {editingDevice.type === "label" && (
              <div className="rounded-lg bg-orange-50 p-4">
                <p className="font-black">標籤機設定</p>
                <label className="mt-3 grid gap-1 text-sm font-black text-steel">
                  標籤用途
                  <select value={editingDevice.labelMode ?? "cup"} onChange={(event) => patchDevice({ labelMode: event.target.value as Device["labelMode"] })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                    <option value="cup">杯貼</option>
                    <option value="takeout">外帶貼紙</option>
                    <option value="pickup">取餐號標籤</option>
                  </select>
                </label>
                <Field label="標籤尺寸" value={editingDevice.labelSize ?? ""} onChange={(value) => patchDevice({ labelSize: value })} />
                <label className="mt-3 flex items-center gap-2 font-black text-steel">
                  <input type="checkbox" checked={Boolean(editingDevice.autoPrint)} onChange={(event) => patchDevice({ autoPrint: event.target.checked })} />
                  送單後自動列印
                </label>
              </div>
            )}

            {editingDevice.type === "invoice" && (
              <div className="rounded-lg bg-orange-50 p-4">
                <p className="font-black">電子發票機設定</p>
                <Field label="機台號碼" value={editingDevice.invoiceMachineNo ?? ""} onChange={(value) => patchDevice({ invoiceMachineNo: value })} />
                <Field label="發票字軌" value={editingDevice.invoiceTrack ?? ""} onChange={(value) => patchDevice({ invoiceTrack: value })} />
                <Field label="API Key（隱藏保存）" type="password" value={editingDevice.apiKey ?? ""} onChange={(value) => patchDevice({ apiKey: value })} />
                <button type="button" onClick={() => setMessage("電子發票機測試連線接口已建立，尚未串接財政部正式 API。")} className="mt-3 rounded-lg bg-ink px-4 py-3 font-black text-white">測試連線</button>
              </div>
            )}

            <label className="flex items-center gap-2 rounded-lg bg-stone-100 px-4 py-3 font-black text-steel">
              <input type="checkbox" checked={editingDevice.enabled} onChange={(event) => patchDevice({ enabled: event.target.checked })} />
              啟用此設備
            </label>

            <div className="rounded-lg border border-dashed border-orange-200 p-4 text-xs font-bold leading-6 text-steel">
              已預留 Web Bluetooth API、WebUSB API、LAN/IP Socket Bridge、ESC/POS 指令與熱感列印模板串接點。
            </div>

            <button onClick={saveDevice} disabled={!canManage || !editingDevice.name.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white disabled:opacity-50">
              <Save className="size-5" />
              儲存設備設定
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-black text-steel">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
    </label>
  );
}

function deviceIcon(type: DeviceType) {
  if (type === "label") return <Tags className="size-5" />;
  if (type === "invoice") return <ReceiptText className="size-5" />;
  if (type === "display") return <Cpu className="size-5" />;
  if (type === "scanner") return <CheckCircle2 className="size-5" />;
  return <Printer className="size-5" />;
}

function deviceTypeLabel(type: DeviceType) {
  return deviceTypes.find((item) => item.value === type)?.label ?? type;
}

function connectionLabel(type: DeviceConnectionType) {
  if (type === "bluetooth") return "藍牙";
  if (type === "usb") return "USB / 有線";
  return "網路 LAN/IP";
}

function stationLabel(value?: PrinterStation) {
  return stationOptions.find((item) => item.value === value)?.label ?? "未設定";
}

function labelModeLabel(value?: Device["labelMode"]) {
  if (value === "takeout") return "外帶貼紙";
  if (value === "pickup") return "取餐號標籤";
  return "杯貼";
}

function categoryNames(categoryIds: string[] | undefined, categories: Array<{ id: string; name: string }>) {
  if (!categoryIds?.length) return "全部分類";
  return categoryIds.map((id) => categories.find((category) => category.id === id)?.name ?? id).join("、");
}
