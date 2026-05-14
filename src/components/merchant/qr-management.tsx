"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Download, ExternalLink, Plus, QrCode, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { getAppUrl } from "@/lib/app-url";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId, storeRoleFor } from "@/lib/store-access";
import type { Table, User } from "@/lib/types";

type QrManagementContentProps = {
  profile: User | null;
};

export function QrManagement() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager"]} title="線上點餐 QR Code">
      {({ profile }) => <QrManagementContent profile={profile} />}
    </LoginGate>
  );
}

function QrManagementContent({ profile }: QrManagementContentProps) {
  const storeId = defaultStoreId(profile);
  const role = storeRoleFor(profile, storeId);
  const canManage = profile?.role === "systemAdmin" || role === "owner" || role === "manager";
  const { db, deleteTable, upsertTable } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId);
  const tables = useMemo(
    () => (db.tables ?? []).filter((table) => table.storeId === storeId).sort((a, b) => a.sort - b.sort),
    [db.tables, storeId]
  );
  const [tableName, setTableName] = useState("");
  const [batchArea, setBatchArea] = useState("");
  const [batchStart, setBatchStart] = useState("1");
  const [batchEnd, setBatchEnd] = useState("10");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const takeoutUrl = orderUrl(storeId, undefined, "takeout");

  function copy(value: string) {
    navigator.clipboard?.writeText(value);
    setActionMessage("已複製點餐連結");
  }

  async function createTableRecord(name: string, sort: number) {
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error("請輸入桌號名稱");
    const now = new Date().toISOString();
    const url = orderUrl(storeId, normalizedName, "dineIn");
    return upsertTable({
      id: "",
      storeId,
      tableName: normalizedName,
      name: normalizedName,
      tableNo: normalizedName,
      area: parseArea(normalizedName),
      number: parseNumber(normalizedName),
      enabled: true,
      isActive: true,
      qrUrl: url,
      sort,
      createdAt: now,
      updatedAt: now
    });
  }

  async function addTable() {
    if (!canManage) {
      setActionError("你的角色沒有新增桌號權限");
      return;
    }
    setActionError("");
    setActionMessage("");
    setIsSaving(true);
    try {
      await createTableRecord(tableName, tables.length + 1);
      setTableName("");
      setActionMessage("桌號已新增");
    } catch (error) {
      console.error("createTable failed", error);
      setActionError(error instanceof Error ? error.message : "新增桌號失敗");
    } finally {
      setIsSaving(false);
    }
  }

  async function batchCreate() {
    if (!canManage) {
      setActionError("你的角色沒有批次建立桌號權限");
      return;
    }
    setActionError("");
    setActionMessage("");
    const start = Number(batchStart);
    const end = Number(batchEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      setActionError("請確認起始號碼與結束號碼");
      return;
    }
    setIsSaving(true);
    try {
      const area = batchArea.trim();
      const requests = [];
      for (let number = start; number <= end; number += 1) {
        requests.push(createTableRecord(`${area}${number}`, tables.length + requests.length + 1));
      }
      await Promise.all(requests);
      setActionMessage(`已建立 ${requests.length} 個桌號`);
    } catch (error) {
      console.error("batchCreateTables failed", error);
      setActionError(error instanceof Error ? error.message : "批次產生桌號失敗");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTable(table: Table, patch: Partial<Table>) {
    if (!canManage) {
      setActionError("你的角色沒有修改桌號權限");
      return;
    }
    setActionError("");
    const nextName = (patch.tableName ?? table.tableName).trim();
    try {
      await upsertTable({
        ...table,
        ...patch,
        tableName: nextName,
        name: nextName,
        tableNo: nextName,
        area: parseArea(nextName),
        number: parseNumber(nextName),
        qrUrl: orderUrl(storeId, nextName, "dineIn"),
        updatedAt: new Date().toISOString()
      });
      setActionMessage("桌號已更新");
    } catch (error) {
      console.error("createTable failed", error);
      setActionError(error instanceof Error ? error.message : "更新桌號失敗");
    }
  }

  async function removeTable(tableId: string) {
    if (!canManage) {
      setActionError("你的角色沒有刪除桌號權限");
      return;
    }
    if (!window.confirm("確定要刪除這個桌號 QR Code 嗎？")) return;
    setActionError("");
    try {
      await deleteTable(tableId);
      setActionMessage("桌號已刪除");
    } catch (error) {
      console.error("createTable failed", error);
      setActionError(error instanceof Error ? error.message : "刪除桌號失敗");
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-leaf">店家後台設定</p>
            <h1 className="text-3xl font-black text-ink">{store?.name ?? "店家"} 線上點餐 QR Code</h1>
            <p className="mt-1 text-sm font-bold text-steel">管理外帶點餐連結、內用桌號 QR Code、QR Code 預覽與下載。</p>
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
              <h2 className="text-2xl font-black">外帶點餐 QR</h2>
              <p className="text-sm font-bold text-white/60">給顧客掃描後直接進入外帶點餐頁。</p>
            </div>
          </div>
          <img src={qrImage(takeoutUrl)} alt="外帶點餐 QR Code" className="mt-5 w-full rounded-lg bg-white p-4" />
          <p className="mt-4 break-all rounded-lg bg-white/10 p-3 text-sm font-bold">{takeoutUrl}</p>
          <div className="mt-4 grid gap-2">
            <button onClick={() => copy(takeoutUrl)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink">
              <Copy className="size-5" />
              複製外帶連結
            </button>
            <a href={takeoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
              <ExternalLink className="size-5" />
              預覽外帶頁
            </a>
            <a href={qrImage(takeoutUrl)} download={`takeout-${storeId}.png`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
              <Download className="size-5" />
              下載 QR PNG
            </a>
          </div>
        </aside>

        <section className="space-y-5">
          {!canManage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 font-bold text-amber-800">
              目前角色只能查看 QR Code，新增、編輯與刪除桌號需要 owner 或 manager 權限。
            </div>
          )}
          {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-700">{actionError}</div>}
          {actionMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{actionMessage}</div>}

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">新增桌號</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
              <label className="grid gap-2 text-sm font-black text-steel">
                桌號名稱
                <input
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  placeholder="例如 A1、包廂1、吧台1、VIP1"
                  className="rounded-lg border border-orange-100 px-4 py-3 text-base font-bold text-ink"
                />
              </label>
              <button disabled={!canManage || isSaving} onClick={addTable} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50 lg:self-end">
                <Plus className="size-5" />
                新增桌號
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-ink">批次產生桌號</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_140px_auto]">
              <label className="grid gap-2 text-sm font-black text-steel">
                區域代碼，例如 A、B、包廂、吧台
                <input value={batchArea} onChange={(event) => setBatchArea(event.target.value)} placeholder="例如 A" className="rounded-lg border border-orange-100 px-4 py-3 text-base font-bold text-ink" />
              </label>
              <label className="grid gap-2 text-sm font-black text-steel">
                起始號碼，例如 1
                <input value={batchStart} onChange={(event) => setBatchStart(event.target.value)} type="number" placeholder="例如 1" className="rounded-lg border border-orange-100 px-4 py-3 text-base font-bold text-ink" />
              </label>
              <label className="grid gap-2 text-sm font-black text-steel">
                結束號碼，例如 10
                <input value={batchEnd} onChange={(event) => setBatchEnd(event.target.value)} type="number" placeholder="例如 10" className="rounded-lg border border-orange-100 px-4 py-3 text-base font-bold text-ink" />
              </label>
              <button disabled={!canManage || isSaving} onClick={batchCreate} className="rounded-lg bg-ink px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50 md:self-end">
                批次產生
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tables.length === 0 ? (
              <p className="rounded-lg bg-white p-6 text-center font-black text-steel shadow-sm sm:col-span-2 xl:col-span-3">尚未建立桌號</p>
            ) : (
              tables.map((table) => {
                const enabled = table.enabled ?? table.isActive ?? true;
                const tableUrl = table.qrUrl || orderUrl(storeId, table.tableName, "dineIn");
                return (
                  <article key={table.id} className="rounded-lg border border-orange-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <label className="min-w-0 flex-1 text-xs font-black text-steel">
                        桌號名稱
                        <input
                          value={table.tableName}
                          disabled={!canManage}
                          onChange={(event) => updateTable(table, { tableName: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-orange-100 px-3 py-2 text-xl font-black text-ink disabled:bg-stone-50"
                        />
                      </label>
                      <button
                        disabled={!canManage}
                        onClick={() => updateTable(table, { enabled: !enabled, isActive: !enabled })}
                        className={`rounded-lg px-3 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-500"}`}
                      >
                        {enabled ? "啟用中" : "已停用"}
                      </button>
                    </div>
                    <img src={qrImage(tableUrl)} alt={`${table.tableName} QR Code`} className="mt-3 w-full rounded-lg bg-[#fffaf0] p-4" />
                    <p className="mt-3 break-all rounded-lg bg-orange-50 p-3 text-xs font-bold text-steel">{tableUrl}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => copy(tableUrl)} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-black text-ink ring-1 ring-orange-100">
                        <Copy className="size-4" />
                        複製連結
                      </button>
                      <a href={tableUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-steel">
                        <ExternalLink className="size-4" />
                        預覽
                      </a>
                      <a href={qrImage(tableUrl)} download={`table-${storeId}-${table.tableName}.png`} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white">
                        <Download className="size-4" />
                        下載
                      </a>
                      <button disabled={!canManage} onClick={() => removeTable(table.id)} className="inline-flex items-center gap-1 rounded-lg bg-tomato px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                        <Trash2 className="size-4" />
                        刪除
                      </button>
                    </div>
                  </article>
                );
              })
            )}
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
