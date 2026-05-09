"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Copy, Download, ExternalLink, Plus, QrCode, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { getAppUrl } from "@/lib/app-url";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId } from "@/lib/store-access";
import type { Table } from "@/lib/types";

export function QrManagement() {
  return (
    <LoginGate allowedRoles={["merchant", "admin", "owner", "manager"]} title="線上點餐 QR Code">
      {({ profile }) => <QrManagementContent storeId={defaultStoreId(profile)} />}
    </LoginGate>
  );
}

function QrManagementContent({ storeId }: { storeId: string }) {
  const { db, deleteTable, upsertTable } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId);
  const tables = (db.tables ?? []).filter((table) => table.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const [tableName, setTableName] = useState("");
  const [batchArea, setBatchArea] = useState("");
  const [batchStart, setBatchStart] = useState("1");
  const [batchEnd, setBatchEnd] = useState("10");
  const takeoutUrl = orderUrl(storeId, undefined, "takeout");

  function copy(value: string) {
    navigator.clipboard?.writeText(value);
  }

  function addTable(name = tableName.trim()) {
    if (!name) return;
    const now = new Date().toISOString();
    const url = orderUrl(storeId, name, "dineIn");
    upsertTable({
      id: "",
      storeId,
      tableName: name,
      name,
      tableNo: name,
      area: parseArea(name),
      number: parseNumber(name),
      enabled: true,
      isActive: true,
      qrUrl: url,
      sort: tables.length + 1,
      createdAt: now,
      updatedAt: now
    });
    setTableName("");
  }

  function batchCreate() {
    const start = Number(batchStart);
    const end = Number(batchEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
    for (let number = start; number <= end; number += 1) {
      addTable(`${batchArea.trim()}${number}`);
    }
  }

  function updateTable(table: Table, patch: Partial<Table>) {
    const nextName = patch.tableName ?? table.tableName;
    upsertTable({
      ...table,
      ...patch,
      tableName: nextName,
      name: nextName,
      tableNo: nextName,
      qrUrl: orderUrl(storeId, nextName, "dineIn"),
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-leaf">店家後台設定</p>
            <h1 className="text-3xl font-black text-ink">{store?.name ?? "店家"} · 線上點餐 QR Code</h1>
            <p className="mt-1 text-sm font-bold text-steel">管理外帶點餐連結、內用桌號 QR Code、QR Code 預覽與下載。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            回店家後台
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-lg bg-ink p-5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <QrCode className="size-8" />
            <div>
              <h2 className="text-2xl font-black">外帶點餐 QR</h2>
              <p className="text-sm font-bold text-white/60">顧客掃碼後直接進入外帶點餐。</p>
            </div>
          </div>
          <img src={qrImage(takeoutUrl)} alt="外帶 QR Code" className="mt-5 w-full rounded-lg bg-white p-4" />
          <p className="mt-4 break-all rounded-lg bg-white/10 p-3 text-sm font-bold">{takeoutUrl}</p>
          <div className="mt-4 grid gap-2">
            <button onClick={() => copy(takeoutUrl)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink"><Copy className="size-5" />複製外帶連結</button>
            <a href={takeoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ExternalLink className="size-5" />預覽點餐頁</a>
            <a href={qrImage(takeoutUrl)} download={`takeout-${storeId}.png`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><Download className="size-5" />下載 QR PNG</a>
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">桌號管理</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
              <input value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="例如 A1、包廂1、吧台1、VIP1" className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink" />
              <button onClick={() => addTable()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white"><Plus className="size-5" />新增桌號</button>
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-ink">批次產生桌號</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_120px_auto]">
              <input value={batchArea} onChange={(event) => setBatchArea(event.target.value)} placeholder="區域代碼，例如 A / 包廂 / 吧台" className="rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              <input value={batchStart} onChange={(event) => setBatchStart(event.target.value)} type="number" placeholder="起始" className="rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              <input value={batchEnd} onChange={(event) => setBatchEnd(event.target.value)} type="number" placeholder="結束" className="rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              <button onClick={batchCreate} className="rounded-lg bg-ink px-4 py-3 font-black text-white">批次產生</button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tables.length === 0 ? (
              <p className="rounded-lg bg-white p-6 text-center font-black text-steel shadow-sm sm:col-span-2 xl:col-span-3">尚未建立桌號</p>
            ) : tables.map((table) => {
              const tableUrl = orderUrl(storeId, table.tableName, "dineIn");
              return (
                <article key={table.id} className="rounded-lg border border-orange-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <input value={table.tableName} onChange={(event) => updateTable(table, { tableName: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-orange-100 px-3 py-2 text-xl font-black text-ink" />
                    <button onClick={() => updateTable(table, { enabled: !table.enabled, isActive: !table.enabled })} className={`rounded-lg px-3 py-2 text-sm font-black ${table.enabled ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-500"}`}>{table.enabled ? "啟用" : "停用"}</button>
                  </div>
                  <img src={qrImage(tableUrl)} alt={`${table.tableName} QR Code`} className="mt-3 w-full rounded-lg bg-[#fffaf0] p-4" />
                  <p className="mt-3 break-all rounded-lg bg-orange-50 p-3 text-xs font-bold text-steel">{tableUrl}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => copy(tableUrl)} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-black text-ink ring-1 ring-orange-100"><Copy className="size-4" />複製</button>
                    <a href={tableUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-steel"><ExternalLink className="size-4" />預覽</a>
                    <a href={qrImage(tableUrl)} download={`table-${storeId}-${table.tableName}.png`} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white"><Download className="size-4" />下載</a>
                    <button onClick={() => deleteTable(table.id)} className="inline-flex items-center gap-1 rounded-lg bg-tomato px-3 py-2 text-sm font-black text-white"><Trash2 className="size-4" />刪除</button>
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

function orderUrl(storeId: string, tableName?: string, type: "dineIn" | "takeout" = "dineIn") {
  const base = `${getAppUrl()}/order/${storeId}`;
  const params = new URLSearchParams();
  if (tableName) params.set("table", tableName);
  params.set("type", type);
  return `${base}?${params.toString()}`;
}

function qrImage(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(value)}`;
}

function parseArea(value: string) {
  return value.match(/^\D+/)?.[0] ?? "";
}

function parseNumber(value: string) {
  const raw = value.match(/\d+$/)?.[0];
  return raw ? Number(raw) : undefined;
}
