"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Cpu, Plus, Printer, Save, Tags, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { accessibleStoreIds, defaultStoreId, storeRoleFor } from "@/lib/store-access";
import type {
  Device,
  DeviceConnectionType,
  DeviceType,
  PrintOrderType,
  PrintTemplate,
  PrintTemplateField,
  PrintTemplateSize,
  PrinterStation,
  Product,
  User
} from "@/lib/types";

const deviceTypes: Array<{ value: DeviceType; label: string; description: string }> = [
  { value: "kitchen", label: "出單機", description: "廚房機、櫃台機、吧台機與 ESC/POS 熱感列印" },
  { value: "label", label: "標籤機", description: "杯貼、外帶貼紙、取餐號標籤，可依站點與分類分流" },
  { value: "display", label: "客顯設備", description: "預留客戶顯示器連線設定" },
  { value: "scanner", label: "掃碼槍", description: "預留條碼 / QR 掃描設備" }
];

const connectionTypes: Array<{ value: DeviceConnectionType; label: string }> = [
  { value: "bluetooth", label: "藍牙" },
  { value: "usb", label: "USB / 有線" },
  { value: "lan", label: "網路 LAN/IP" }
];

const stationOptions: Array<{ value: PrinterStation; label: string }> = [
  { value: "bar", label: "吧台" },
  { value: "kitchen", label: "廚房" },
  { value: "counter", label: "櫃台" },
  { value: "custom", label: "自訂站點" }
];

const orderTypeOptions: Array<{ value: PrintOrderType; label: string }> = [
  { value: "dineIn", label: "內用" },
  { value: "takeout", label: "外帶" },
  { value: "qr", label: "QR 進單" },
  { value: "pos", label: "現場單" }
];

const sizeOptions: Array<{ value: PrintTemplateSize; label: string }> = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
  { value: "xlarge", label: "特大" }
];

const templateLabels: Record<keyof PrintTemplate, string> = {
  orderNumber: "取餐號",
  tableNumber: "桌號",
  orderType: "內用 / 外帶 / 來源",
  productName: "商品名稱",
  quantity: "數量",
  modifiers: "加料 / 加購 / 調味",
  note: "備註",
  price: "價格",
  total: "總金額",
  storeName: "店名",
  createdAt: "時間"
};

const boldFields: Array<keyof PrintTemplate> = ["productName", "quantity"];

function defaultTemplate(): PrintTemplate {
  return {
    orderNumber: { visible: true, size: "large" },
    tableNumber: { visible: true, size: "large" },
    orderType: { visible: true, size: "medium" },
    productName: { visible: true, size: "medium", bold: true },
    quantity: { visible: true, size: "medium", bold: true },
    modifiers: { visible: true, size: "small" },
    note: { visible: true, size: "small" },
    price: { visible: true, size: "small" },
    total: { visible: true, size: "medium" },
    storeName: { visible: true, size: "medium" },
    createdAt: { visible: true, size: "small" }
  };
}

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
    printRouting: {
      stationName: "廚房",
      categoryIds: [],
      productIds: [],
      orderTypes: ["dineIn", "takeout", "qr", "pos"]
    },
    printTemplate: defaultTemplate(),
    labelMode: "cup",
    labelSize: "40x30mm",
    autoPrint: false,
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
  const products = db.products.filter((item) => item.storeId === activeStoreId).sort((a, b) => a.sort - b.sort);
  const devices = useMemo(() => (db.devices ?? []).filter((device) => device.storeId === activeStoreId), [db.devices, activeStoreId]);
  const storeRole = storeRoleFor(profile, activeStoreId);
  const canManage = profile?.role === "admin" || storeRole === "owner" || storeRole === "manager";

  function startCreate() {
    setEditingDevice(blankDevice(activeStoreId));
    setMessage("");
  }

  function normalizeDevice(device: Device): Device {
    return {
      ...blankDevice(activeStoreId),
      ...device,
      storeId: activeStoreId,
      printRouting: {
        ...blankDevice(activeStoreId).printRouting,
        ...device.printRouting,
        stationName: device.printRouting?.stationName ?? stationLabel(device.station) ?? "廚房",
        categoryIds: device.printRouting?.categoryIds ?? device.categoryIds ?? [],
        productIds: device.printRouting?.productIds ?? [],
        orderTypes: device.printRouting?.orderTypes ?? ["dineIn", "takeout", "qr", "pos"]
      },
      printTemplate: {
        ...defaultTemplate(),
        ...device.printTemplate
      }
    };
  }

  function patchDevice(patch: Partial<Device>) {
    setEditingDevice((current) => normalizeDevice({ ...current, ...patch, storeId: activeStoreId }));
  }

  function patchRouting(patch: Partial<NonNullable<Device["printRouting"]>>) {
    patchDevice({ printRouting: { ...normalizeDevice(editingDevice).printRouting!, ...patch } });
  }

  function patchTemplate(field: keyof PrintTemplate, patch: Partial<PrintTemplateField>) {
    const currentTemplate = normalizeDevice(editingDevice).printTemplate!;
    patchDevice({
      printTemplate: {
        ...currentTemplate,
        [field]: { ...currentTemplate[field], ...patch }
      }
    });
  }

  function saveDevice() {
    if (!canManage || !editingDevice.name.trim() || !activeStoreId) return;
    const normalized = normalizeDevice(editingDevice);
    upsertDevice({
      ...normalized,
      name: normalized.name.trim(),
      brand: normalized.brand.trim(),
      model: normalized.model.trim(),
      port: normalized.port ? String(normalized.port) : "",
      categoryIds: normalized.printRouting?.categoryIds ?? [],
      updatedAt: new Date().toISOString()
    });
    setMessage("設備與列印設定已儲存");
    setEditingDevice(blankDevice(activeStoreId));
  }

  function toggleDevice(device: Device) {
    if (!canManage) return;
    upsertDevice({ ...normalizeDevice(device), enabled: !device.enabled, updatedAt: new Date().toISOString() });
  }

  function removeDevice(device: Device) {
    if (!canManage) return;
    if (!window.confirm(`確定要刪除「${device.name}」嗎？`)) return;
    deleteDevice(device.id);
    setMessage("設備已刪除");
  }

  function testPrint(device: Device) {
    const normalized = normalizeDevice(device);
    const content = buildPreviewLines(normalized, store?.name || "測試店家").join("\n");
    console.info("printTestTicket", { device: normalized, content });
    setMessage(`已依「${normalized.name}」目前列印模板產生測試單，正式串接時會送到 ${normalized.connectionType.toUpperCase()} 列印服務。`);
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

  const normalizedEditing = normalizeDevice(editingDevice);

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-leaf">設備與列印設定</p>
            <h1 className="text-3xl font-black">出單機、標籤機與列印模板管理</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold text-steel">設定出單與標籤列印站點、分類/商品/訂單類型分流，以及即時預覽列印格式。</p>
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

      <section className="mx-auto grid max-w-7xl gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="space-y-5">
          {message && <div className="rounded-lg bg-leaf/10 p-4 font-black text-leaf">{message}</div>}
          {!canManage && <div className="rounded-lg bg-amber-100 p-4 font-black text-amber-800">此帳號可查看設備設定，但只有 admin、owner、manager 可以新增或修改設備。</div>}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              ) : devices.map((device) => {
                const normalized = normalizeDevice(device);
                return (
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
                          <p className="mt-1 font-mono text-xs text-steel">{connectionSummary(device)}</p>
                          {(device.type === "kitchen" || device.type === "label") && (
                            <p className="mt-2 text-sm font-bold text-steel">
                              站點：{normalized.printRouting?.stationName || stationLabel(device.station)}，分類：{categoryNames(normalized.printRouting?.categoryIds, categories)}，商品：{productNames(normalized.printRouting?.productIds, products)}
                            </p>
                          )}
                          {device.type === "label" && (
                            <p className="mt-1 text-sm font-bold text-steel">標籤：{labelModeLabel(device.labelMode)} / {device.labelSize || "未設定"} / {device.autoPrint ? "自動列印" : "手動列印"}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => testPrint(device)} className="rounded-lg bg-ink px-3 py-2 text-sm font-black text-white">列印測試單</button>
                        <button onClick={() => setEditingDevice(normalized)} disabled={!canManage} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-black text-steel disabled:opacity-50">編輯</button>
                        <button onClick={() => toggleDevice(device)} disabled={!canManage} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-black text-steel disabled:opacity-50">{device.enabled ? "停用" : "啟用"}</button>
                        <button onClick={() => removeDevice(device)} disabled={!canManage} className="inline-flex items-center gap-1 rounded-lg bg-tomato px-3 py-2 text-sm font-black text-white disabled:opacity-50"><Trash2 className="size-4" />刪除</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">{editingDevice.id ? "編輯設備" : "新增設備"}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="設備名稱" value={normalizedEditing.name} onChange={(value) => patchDevice({ name: value })} />
              <label className="grid gap-1 text-sm font-black text-steel">
                設備類型
                <select value={normalizedEditing.type} onChange={(event) => patchDevice({ type: event.target.value as DeviceType })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                  {deviceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Field label="品牌" value={normalizedEditing.brand} onChange={(value) => patchDevice({ brand: value })} />
                <Field label="型號" value={normalizedEditing.model} onChange={(value) => patchDevice({ model: value })} />
              </div>
              <label className="grid gap-1 text-sm font-black text-steel">
                連線方式
                <select value={normalizedEditing.connectionType} onChange={(event) => patchDevice({ connectionType: event.target.value as DeviceConnectionType })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                  {connectionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <ConnectionFields device={normalizedEditing} patchDevice={patchDevice} />

              {(normalizedEditing.type === "kitchen" || normalizedEditing.type === "label") && (
                <>
                  <PaperAndRouting device={normalizedEditing} categories={categories} products={products} patchDevice={patchDevice} patchRouting={patchRouting} />
                  <TemplateEditor template={normalizedEditing.printTemplate ?? defaultTemplate()} patchTemplate={patchTemplate} />
                </>
              )}

              {normalizedEditing.type === "label" && (
                <div className="rounded-lg bg-orange-50 p-4">
                  <p className="font-black">標籤機設定</p>
                  <label className="mt-3 grid gap-1 text-sm font-black text-steel">
                    標籤用途
                    <select value={normalizedEditing.labelMode ?? "cup"} onChange={(event) => patchDevice({ labelMode: event.target.value as Device["labelMode"] })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                      <option value="cup">杯貼</option>
                      <option value="takeout">外帶貼紙</option>
                      <option value="pickup">取餐號標籤</option>
                    </select>
                  </label>
                  <Field label="標籤尺寸" value={normalizedEditing.labelSize ?? ""} onChange={(value) => patchDevice({ labelSize: value })} />
                  <label className="mt-3 flex items-center gap-2 font-black text-steel">
                    <input type="checkbox" checked={Boolean(normalizedEditing.autoPrint)} onChange={(event) => patchDevice({ autoPrint: event.target.checked })} />
                    送單後自動列印
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 rounded-lg bg-stone-100 px-4 py-3 font-black text-steel">
                <input type="checkbox" checked={normalizedEditing.enabled} onChange={(event) => patchDevice({ enabled: event.target.checked })} />
                啟用此設備
              </label>
              <div className="rounded-lg border border-dashed border-orange-200 p-4 text-xs font-bold leading-6 text-steel">
                已預留 Web Bluetooth API、WebUSB API、LAN/IP Socket Bridge、ESC/POS 指令與熱感列印模板串接點。
              </div>
              <button onClick={saveDevice} disabled={!canManage || !normalizedEditing.name.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white disabled:opacity-50">
                <Save className="size-5" />
                儲存設備設定
              </button>
            </div>
          </section>

          {(normalizedEditing.type === "kitchen" || normalizedEditing.type === "label") && (
            <section className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">列印預覽</h2>
              <PrintPreview device={normalizedEditing} storeName={store?.name ?? "測試店家"} />
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function ConnectionFields({ device, patchDevice }: { device: Device; patchDevice: (patch: Partial<Device>) => void }) {
  if (device.connectionType === "lan") {
    return (
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="IP Address" value={device.ipAddress ?? ""} onChange={(value) => patchDevice({ ipAddress: value })} />
        <Field label="Port" value={device.port ?? ""} onChange={(value) => patchDevice({ port: value })} />
      </div>
    );
  }
  if (device.connectionType === "usb") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="USB Vendor ID" value={device.usbVendorId ?? ""} onChange={(value) => patchDevice({ usbVendorId: value })} />
        <Field label="USB Product ID" value={device.usbProductId ?? ""} onChange={(value) => patchDevice({ usbProductId: value })} />
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <Field label="藍牙名稱" value={device.bluetoothName ?? ""} onChange={(value) => patchDevice({ bluetoothName: value })} />
      <Field label="MAC Address" value={device.macAddress ?? ""} onChange={(value) => patchDevice({ macAddress: value })} />
    </div>
  );
}

function PaperAndRouting({
  device,
  categories,
  products,
  patchDevice,
  patchRouting
}: {
  device: Device;
  categories: Array<{ id: string; name: string }>;
  products: Product[];
  patchDevice: (patch: Partial<Device>) => void;
  patchRouting: (patch: Partial<NonNullable<Device["printRouting"]>>) => void;
}) {
  const routing = device.printRouting!;
  return (
    <div className="rounded-lg bg-orange-50 p-4">
      <p className="font-black">{device.type === "label" ? "標籤機站點分配" : "出單機站點分配"}</p>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm font-black text-steel">
          紙寬
          <select value={device.paperWidth ?? "80mm"} onChange={(event) => patchDevice({ paperWidth: event.target.value as "58mm" | "80mm" })} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
            <option value="58mm">58mm</option>
            <option value="80mm">80mm</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-black text-steel">
          列印站點
          <select
            value={device.station ?? "kitchen"}
            onChange={(event) => {
              const station = event.target.value as PrinterStation;
              patchDevice({ station });
              patchRouting({ stationName: stationLabel(station) });
            }}
            className="rounded-lg border border-orange-100 px-4 py-3 font-bold"
          >
            {stationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {device.station === "custom" && <Field label="自訂站點名稱" value={routing.stationName} onChange={(value) => patchRouting({ stationName: value })} />}

        <CheckboxGroup
          title="依商品分類列印"
          items={categories}
          selectedIds={routing.categoryIds}
          onChange={(categoryIds) => patchRouting({ categoryIds })}
        />
        <CheckboxGroup
          title="依單品商品列印"
          items={products.map((product) => ({ id: product.id, name: product.name }))}
          selectedIds={routing.productIds}
          onChange={(productIds) => patchRouting({ productIds })}
        />
        <CheckboxGroup
          title="依訂單類型列印"
          items={orderTypeOptions.map((item) => ({ id: item.value, name: item.label }))}
          selectedIds={routing.orderTypes}
          onChange={(orderTypes) => patchRouting({ orderTypes: orderTypes as PrintOrderType[] })}
        />
      </div>
    </div>
  );
}

function TemplateEditor({ template, patchTemplate }: { template: PrintTemplate; patchTemplate: (field: keyof PrintTemplate, patch: Partial<PrintTemplateField>) => void }) {
  return (
    <div className="rounded-lg bg-orange-50 p-4">
      <p className="font-black">列印模板設定</p>
      <div className="mt-3 grid gap-3">
        {(Object.keys(templateLabels) as Array<keyof PrintTemplate>).map((field) => (
          <div key={field} className="rounded-lg bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 font-black text-ink">
                <input type="checkbox" checked={template[field].visible} onChange={(event) => patchTemplate(field, { visible: event.target.checked })} />
                {templateLabels[field]}
              </label>
              <select value={template[field].size} onChange={(event) => patchTemplate(field, { size: event.target.value as PrintTemplateSize })} className="rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold">
                {sizeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            {boldFields.includes(field) && (
              <label className="mt-2 flex items-center gap-2 text-sm font-bold text-steel">
                <input type="checkbox" checked={Boolean(template[field].bold)} onChange={(event) => patchTemplate(field, { bold: event.target.checked })} />
                加粗
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintPreview({ device, storeName }: { device: Device; storeName: string }) {
  const template = device.printTemplate ?? defaultTemplate();
  return (
    <div className="mt-4 rounded-lg bg-[#1c1c1c] p-4 text-white">
      <div className="mx-auto max-w-[320px] rounded bg-[#fffdf7] p-4 font-mono text-[#111] shadow-soft">
        {buildPreviewRows(device, storeName).map((row) => {
          const field = template[row.field];
          if (!field.visible) return null;
          return (
            <p key={row.field} className={`${sizeClass(field.size)} ${field.bold ? "font-black" : "font-bold"} ${row.center ? "text-center" : ""}`}>
              {row.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function CheckboxGroup({ title, items, selectedIds, onChange }: { title: string; items: Array<{ id: string; name: string }>; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div>
      <p className="text-sm font-black text-steel">{title}</p>
      <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-lg bg-white p-3">
        {items.length === 0 ? (
          <p className="text-sm font-bold text-stone-400">尚無資料</p>
        ) : items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm font-bold text-steel">
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={(event) => onChange(event.target.checked ? [...selectedIds, item.id] : selectedIds.filter((id) => id !== item.id))}
            />
            {item.name}
          </label>
        ))}
      </div>
    </div>
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

function buildPreviewRows(device: Device, storeName: string) {
  return [
    { field: "storeName" as const, text: storeName, center: true },
    { field: "orderNumber" as const, text: "取餐號 Q023", center: true },
    { field: "tableNumber" as const, text: "桌號 5" },
    { field: "orderType" as const, text: "內用 / QR 進單" },
    { field: "createdAt" as const, text: new Date().toLocaleString("zh-TW", { hour12: false }) },
    { field: "productName" as const, text: "招牌豬肉蛋堡" },
    { field: "quantity" as const, text: "x 2" },
    { field: "modifiers" as const, text: "- 少醬 / 加蛋 +15 / A 套餐" },
    { field: "note" as const, text: "備註：切邊、加辣" },
    { field: "price" as const, text: "$75" },
    { field: "total" as const, text: "總金額 $150" }
  ];
}

function buildPreviewLines(device: Device, storeName: string) {
  const template = device.printTemplate ?? defaultTemplate();
  return buildPreviewRows(device, storeName).filter((row) => template[row.field].visible).map((row) => row.text);
}

function sizeClass(size: PrintTemplateSize) {
  if (size === "xlarge") return "text-3xl leading-10";
  if (size === "large") return "text-2xl leading-9";
  if (size === "medium") return "text-base leading-7";
  return "text-xs leading-5";
}

function deviceIcon(type: DeviceType) {
  if (type === "label") return <Tags className="size-5" />;
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

function connectionSummary(device: Device) {
  if (device.connectionType === "lan") return `${device.ipAddress || "未填 IP"}:${device.port || "9100"}`;
  if (device.connectionType === "usb") return `VID ${device.usbVendorId || "-"} / PID ${device.usbProductId || "-"}`;
  return `${device.bluetoothName || "未填藍牙名稱"} / ${device.macAddress || "未填 MAC"}`;
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

function productNames(productIds: string[] | undefined, products: Array<{ id: string; name: string }>) {
  if (!productIds?.length) return "全部商品";
  return productIds.map((id) => products.find((product) => product.id === id)?.name ?? id).join("、");
}
