"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, WalletCards } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { accessibleStoreIds, defaultStoreId, isPlatformAdmin } from "@/lib/store-access";
import type { CashFlowAmountMode, CashFlowType, User } from "@/lib/types";

export default function MerchantCashflowPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff", "viewer"]} title="現金流">
      {({ profile }) => <CashflowShell profile={profile} />}
    </LoginGate>
  );
}

function CashflowShell({ profile }: { profile: User | null }) {
  const isAdmin = isPlatformAdmin(profile);
  const { db: adminDb } = useDemoStore({ admin: isAdmin, skipOrderList: true });
  const storeIds = isAdmin ? adminDb.stores.filter((store) => !store.isDeleted).map((store) => store.id) : accessibleStoreIds(profile);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId(profile) || storeIds[0] || "");
  const storeId = storeIds.includes(selectedStoreId) ? selectedStoreId : storeIds[0] || "";
  const { db, createCashFlow, todayCashFlows, upsertCashFlowItem } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((item) => item.id === storeId) ?? adminDb.stores.find((item) => item.id === storeId);
  const cashItems = useMemo(() => (db.cashFlowItems ?? []).filter((item) => item.storeId === storeId && item.enabled), [db.cashFlowItems, storeId]);
  const [cashForm, setCashForm] = useState({ itemId: "", amount: "", note: "" });
  const [itemForm, setItemForm] = useState<{ name: string; type: CashFlowType; amountMode: CashFlowAmountMode; fixedAmount: string }>({ name: "", type: "expense", amountMode: "open", fixedAmount: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const income = todayCashFlows.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = todayCashFlows.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const selectedItem = cashItems.find((item) => item.id === cashForm.itemId);

  async function submitCashFlow() {
    setError("");
    setMessage("");
    if (!selectedItem) {
      setError("請先選擇現金流項目");
      return;
    }
    const amount = Number(cashForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("請輸入正確金額");
      return;
    }
    try {
      await createCashFlow({ storeId, itemId: selectedItem.id, itemName: selectedItem.name, type: selectedItem.type, amount, category: selectedItem.name, note: cashForm.note, createdBy: profile?.email ?? "" });
      setCashForm({ itemId: "", amount: "", note: "" });
      setMessage("現金流已新增");
    } catch (err) {
      console.error("createCashFlow failed", err);
      setError(err instanceof Error ? err.message : "新增現金流失敗");
    }
  }

  async function addItem() {
    setError("");
    if (!itemForm.name.trim()) {
      setError("請輸入項目名稱");
      return;
    }
    try {
      const fixedAmount = Number(itemForm.fixedAmount);
      await upsertCashFlowItem({ storeId, name: itemForm.name.trim(), type: itemForm.type, amountMode: itemForm.amountMode, fixedAmount: itemForm.amountMode === "fixed" && Number.isFinite(fixedAmount) ? fixedAmount : undefined, enabled: true });
      setItemForm({ name: "", type: "expense", amountMode: "open", fixedAmount: "" });
      setMessage("現金流項目已建立");
    } catch (err) {
      console.error("createCashFlowItem failed", err);
      setError(err instanceof Error ? err.message : "新增項目失敗");
    }
  }

  if (!storeId) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4"><div className="rounded-lg bg-white p-6 font-black text-ink shadow-soft">尚未取得可管理的店家。</div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-3 rounded-lg bg-[#172033] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white/60">POS 前台</p>
            <h1 className="mt-1 text-3xl font-black">{store?.name || "未命名店家"} 現金流</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && storeIds.length > 1 && (
              <select value={storeId} onChange={(event) => setSelectedStoreId(event.target.value)} className="rounded-lg border border-white/20 bg-white px-4 py-3 font-black text-ink">
                {storeIds.map((id) => <option key={id} value={id}>{adminDb.stores.find((storeItem) => storeItem.id === id)?.name ?? id}</option>)}
              </select>
            )}
            <Link href="/merchant/pos" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20"><ArrowLeft className="size-4" />返回 POS</Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <Metric label="現金收入" value={`$${income}`} />
          <Metric label="現金支出" value={`$${expense}`} />
          <Metric label="現金流淨額" value={`$${income - expense}`} />
        </section>

        {(message || error) && <p className={`mt-5 rounded-lg p-4 font-black ${error ? "bg-tomato/10 text-tomato" : "bg-leaf/10 text-leaf"}`}>{error || message}</p>}

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-black"><WalletCards className="size-5" />新增現金流</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-black text-steel">項目<select value={cashForm.itemId} onChange={(event) => {
                const item = cashItems.find((candidate) => candidate.id === event.target.value);
                setCashForm({ itemId: event.target.value, amount: item?.amountMode === "fixed" ? String(item.fixedAmount ?? "") : "", note: "" });
              }} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink"><option value="">選擇項目</option>{cashItems.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.type === "income" ? "收入" : "支出"}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-black text-steel">金額<input type="number" value={cashForm.amount} onChange={(event) => setCashForm((current) => ({ ...current, amount: event.target.value }))} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" /></label>
              <label className="grid gap-1 text-sm font-black text-steel sm:col-span-2">備註<input value={cashForm.note} onChange={(event) => setCashForm((current) => ({ ...current, note: event.target.value }))} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" /></label>
            </div>
            <button onClick={submitCashFlow} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 font-black text-white"><Plus className="size-4" />新增紀錄</button>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">現金流項目管理</h2>
            <div className="mt-4 grid gap-3">
              <input value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如 採買、備用金、退款" className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" />
              <div className="grid grid-cols-2 gap-2">
                <select value={itemForm.type} onChange={(event) => setItemForm((current) => ({ ...current, type: event.target.value as CashFlowType }))} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink"><option value="income">收入</option><option value="expense">支出</option></select>
                <select value={itemForm.amountMode} onChange={(event) => setItemForm((current) => ({ ...current, amountMode: event.target.value as CashFlowAmountMode }))} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink"><option value="open">自由輸入</option><option value="fixed">固定金額</option></select>
              </div>
              {itemForm.amountMode === "fixed" && <input type="number" value={itemForm.fixedAmount} onChange={(event) => setItemForm((current) => ({ ...current, fixedAmount: event.target.value }))} placeholder="固定金額" className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" />}
              <button onClick={addItem} className="rounded-lg bg-leaf px-4 py-3 font-black text-white">新增項目</button>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">今日現金流</h2>
          <div className="mt-4 space-y-2">
            {todayCashFlows.length === 0 ? <p className="rounded-lg bg-stone-50 p-4 text-sm font-bold text-steel">今日尚無現金流紀錄</p> : todayCashFlows.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-3">
                <div><p className="font-black">{item.itemName || item.category || "未分類"}{item.note ? ` - ${item.note}` : ""}</p><p className="text-xs font-bold text-steel">{new Date(item.createdAt).toLocaleString("zh-TW")}</p></div>
                <span className={`font-black ${item.type === "income" ? "text-leaf" : "text-tomato"}`}>{item.type === "income" ? "+" : "-"}${item.amount}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><p className="text-sm font-black text-steel">{label}</p><p className="mt-3 text-3xl font-black">{value}</p></div>;
}
