"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId } from "@/lib/store-access";
import type { CashFlowAmountMode, CashFlowType, User } from "@/lib/types";

export default function MerchantCashflowPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff"]} title="現金流管理">
      {({ profile }) => <MerchantCashflowContent storeId={defaultStoreId(profile)} profile={profile} />}
    </LoginGate>
  );
}

function MerchantCashflowContent({ storeId, profile }: { storeId: string; profile: User | null }) {
  const { db, todayCashFlows, createCashFlow, upsertCashFlowItem } = useDemoStore({ storeId, todayOrdersOnly: true });
  const store = db.stores.find((s) => s.id === storeId);
  const cashFlowItems = (db.cashFlowItems ?? [])
    .filter((item) => item.storeId === storeId && item.enabled)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  const income = todayCashFlows.filter((cf) => cf.type === "income").reduce((sum, cf) => sum + cf.amount, 0);
  const expense = todayCashFlows.filter((cf) => cf.type === "expense").reduce((sum, cf) => sum + cf.amount, 0);
  const net = income - expense;

  const [itemId, setItemId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemType, setItemType] = useState<CashFlowType>("expense");
  const [itemAmountMode, setItemAmountMode] = useState<CashFlowAmountMode>("open");
  const [itemFixed, setItemFixed] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);

  const selectedItem = cashFlowItems.find((cf) => cf.id === itemId) ?? null;

  function chooseItem(id: string) {
    const item = cashFlowItems.find((cf) => cf.id === id);
    setItemId(id);
    setAmount(item?.amountMode === "fixed" ? String(item.fixedAmount ?? "") : "");
    setNote("");
    setError("");
  }

  async function submit() {
    setError("");
    setMessage("");
    if (!selectedItem) { setError("請選擇項目"); return; }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError("請輸入正確金額"); return; }
    try {
      await createCashFlow({
        storeId,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        type: selectedItem.type,
        amount: value,
        category: selectedItem.name,
        note,
        createdBy: profile?.email ?? profile?.id ?? ""
      });
      setItemId("");
      setAmount("");
      setNote("");
      setMessage("已記錄");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "記錄失敗");
    }
  }

  async function addItem() {
    if (!itemName.trim()) return;
    const fixed = Number(itemFixed);
    await upsertCashFlowItem({
      storeId,
      name: itemName.trim(),
      type: itemType,
      amountMode: itemAmountMode,
      fixedAmount: itemAmountMode === "fixed" && Number.isFinite(fixed) && fixed > 0 ? fixed : undefined,
      enabled: true
    });
    setItemName("");
    setItemFixed("");
    setShowItemForm(false);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台</p>
            <h1 className="text-3xl font-black text-ink">{store?.name} · 現金流</h1>
            <p className="mt-1 text-sm font-bold text-steel">記錄今日進貨、找零、備用金等收支。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            回上一層
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {/* 今日摘要 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1 text-leaf"><Plus className="size-4" /><p className="text-sm font-black">今日收入</p></div>
            <p className="mt-2 text-3xl font-black text-leaf">${income}</p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1 text-tomato"><Minus className="size-4" /><p className="text-sm font-black">今日支出</p></div>
            <p className="mt-2 text-3xl font-black text-tomato">${expense}</p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <p className="text-sm font-black text-steel">淨額</p>
            <p className={`mt-2 text-3xl font-black ${net >= 0 ? "text-leaf" : "text-tomato"}`}>${net}</p>
          </div>
        </div>

        {/* 新增記錄 */}
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-ink">新增現金流記錄</h2>
          {message && <p className="mt-3 rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">{message}</p>}
          {error && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{error}</p>}
          {cashFlowItems.length === 0 ? (
            <p className="mt-4 rounded-lg bg-orange-50 p-4 text-sm font-bold text-steel">尚無項目設定，請先在下方「管理項目」建立收支項目。</p>
          ) : (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-black text-steel">
                項目
                <select value={itemId} onChange={(e) => chooseItem(e.target.value)} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink">
                  <option value="">請選擇項目</option>
                  {cashFlowItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}（{item.type === "income" ? "收入" : "支出"}）
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black text-steel">
                金額
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min="1"
                  placeholder="0"
                  readOnly={selectedItem?.amountMode === "fixed"}
                  className="rounded-lg border border-orange-100 px-3 py-3 font-bold read-only:bg-orange-50"
                />
              </label>
              <label className="grid gap-1 text-sm font-black text-steel">
                備註（選填）
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="進貨廠商、備註說明..." className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
              </label>
              <button onClick={submit} disabled={!itemId} className="rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:opacity-50">
                新增記錄
              </button>
            </div>
          )}
        </div>

        {/* 今日記錄清單 */}
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-ink">今日記錄</h2>
          {todayCashFlows.length === 0 ? (
            <p className="mt-4 py-4 text-center text-sm font-bold text-steel">尚無記錄</p>
          ) : (
            <div className="mt-4 space-y-2">
              {[...todayCashFlows]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((cf) => (
                  <div key={cf.id} className="flex items-center justify-between rounded-lg bg-orange-50 px-4 py-3">
                    <div>
                      <p className="font-black text-ink">{cf.itemName ?? cf.category}</p>
                      {cf.note && <p className="text-xs font-bold text-steel">{cf.note}</p>}
                      <p className="text-xs font-bold text-steel">
                        {new Date(cf.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                        {cf.createdBy ? ` · ${cf.createdBy}` : ""}
                      </p>
                    </div>
                    <p className={`text-lg font-black ${cf.type === "income" ? "text-leaf" : "text-tomato"}`}>
                      {cf.type === "income" ? "+" : "−"}${cf.amount}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* 管理項目 */}
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-ink">管理項目</h2>
              <p className="mt-1 text-sm font-bold text-steel">設定常用收支項目，讓日常記錄更快速。</p>
            </div>
            <button onClick={() => setShowItemForm(!showItemForm)} className="rounded-lg bg-ink px-4 py-2 text-sm font-black text-white">
              {showItemForm ? "取消" : "+ 新增項目"}
            </button>
          </div>

          {showItemForm && (
            <div className="mt-4 grid gap-3 rounded-lg border border-orange-100 p-4">
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="項目名稱（如：進貨、備用金補充）" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
              <div className="flex gap-2">
                <button onClick={() => setItemType("expense")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${itemType === "expense" ? "bg-tomato text-white" : "bg-stone-100 text-steel"}`}>支出</button>
                <button onClick={() => setItemType("income")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${itemType === "income" ? "bg-leaf text-white" : "bg-stone-100 text-steel"}`}>收入</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setItemAmountMode("open")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${itemAmountMode === "open" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>自由輸入</button>
                <button onClick={() => setItemAmountMode("fixed")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${itemAmountMode === "fixed" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>固定金額</button>
              </div>
              {itemAmountMode === "fixed" && (
                <input value={itemFixed} onChange={(e) => setItemFixed(e.target.value)} type="number" placeholder="固定金額" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
              )}
              <button onClick={addItem} disabled={!itemName.trim()} className="rounded-lg bg-ink px-4 py-3 font-black text-white disabled:opacity-50">儲存項目</button>
            </div>
          )}

          {cashFlowItems.length > 0 && (
            <div className="mt-4 grid gap-2">
              {cashFlowItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2">
                  <p className="font-black text-ink">{item.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-black ${item.type === "income" ? "bg-leaf/10 text-leaf" : "bg-tomato/10 text-tomato"}`}>
                    {item.type === "income" ? "收入" : "支出"}{item.amountMode === "fixed" ? ` · $${item.fixedAmount}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
