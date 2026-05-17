"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gift, Search, UserPlus, X } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId } from "@/lib/store-access";
import type { Customer, User } from "@/lib/types";

export default function MerchantCustomersPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff"]} title="會員管理">
      {({ profile }) => <MerchantCustomersContent storeId={defaultStoreId(profile)} profile={profile} />}
    </LoginGate>
  );
}

function MerchantCustomersContent({ storeId, profile }: { storeId: string; profile: User | null }) {
  const { db, ready, createCustomer, adjustCustomerPoints, adjustStoredValue } = useDemoStore({ storeId, loadCustomers: true, skipOrderList: true });
  const store = db.stores.find((s) => s.id === storeId);
  const memberEnabled = store?.features?.memberEnabled ?? false;
  const storedValueEnabled = store?.features?.memberStoredValueEnabled ?? false;
  const customers = (db.customers ?? [])
    .filter((c) => c.storeId === storeId)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", birthday: "", note: "" });
  const [message, setMessage] = useState("");
  const [adjustOpen, setAdjustOpen] = useState<"points" | "value" | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const filtered = customers.filter((c) =>
    !query.trim() ||
    c.name.includes(query) ||
    c.phone.includes(query) ||
    (c.memberNo ?? "").includes(query)
  );

  function showMsg(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleCreate() {
    if (!newForm.name.trim() || !newForm.phone.trim()) return;
    const name = newForm.name.trim();
    const phone = newForm.phone.trim();

    // Exact duplicate: same name + same phone
    const exactDupe = customers.find((c) => c.phone === phone && c.name === name);
    if (exactDupe) {
      showMsg("此會員已存在（姓名與電話相同）");
      return;
    }

    // Phone-only duplicate: same phone, different name — ask for confirmation
    const phoneDupe = customers.find((c) => c.phone === phone);
    if (phoneDupe) {
      if (!window.confirm(`電話 ${phone} 已有會員「${phoneDupe.name}」，確定要再新增一位嗎？`)) return;
    }

    const member = await createCustomer({ storeId, ...newForm, createdBy: profile?.email ?? "" });
    setNewForm({ name: "", phone: "", birthday: "", note: "" });
    setFormOpen(false);
    setSelected(member);
    showMsg("會員已建立");
  }

  async function handleAdjustPoints() {
    if (!selected) return;
    const pts = Number(adjustAmount);
    if (!Number.isFinite(pts) || pts === 0) return;
    await adjustCustomerPoints({ customerId: selected.id, storeId, type: pts > 0 ? "earn" : "adjust", points: Math.abs(pts), note: adjustNote || "後台調整", createdBy: profile?.email ?? "" });
    setSelected((prev) => prev ? { ...prev, points: (prev.points ?? 0) + pts } : prev);
    setAdjustAmount("");
    setAdjustNote("");
    setAdjustOpen(null);
    showMsg(`點數已調整 ${pts > 0 ? "+" : ""}${pts}`);
  }

  async function handleAdjustValue() {
    if (!selected) return;
    const val = Number(adjustAmount);
    if (!Number.isFinite(val) || val === 0) return;
    await adjustStoredValue({ customerId: selected.id, storeId, type: val > 0 ? "topup" : "payment", amount: val, note: adjustNote || "後台調整", createdBy: profile?.email ?? "" });
    setSelected((prev) => prev ? { ...prev, storedValueBalance: (prev.storedValueBalance ?? 0) + val } : prev);
    setAdjustAmount("");
    setAdjustNote("");
    setAdjustOpen(null);
    showMsg(`儲值已調整 ${val > 0 ? "+" : ""}$${val}`);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台</p>
            <h1 className="text-3xl font-black text-ink">{store?.name} · 會員管理</h1>
            <p className="mt-1 text-sm font-bold text-steel">查詢、新增會員，管理點數與儲值餘額。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            回上一層
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-4">
        {!memberEnabled && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-black text-amber-800">會員功能尚未開啟</p>
            <p className="mt-1 text-sm font-bold text-steel">
              請至 <Link href="/merchant/settings" className="text-leaf underline">店家設定</Link> 開啟會員功能後，才能累積點數與管理儲值。
            </p>
          </div>
        )}

        {message && <div className="mb-4 rounded-lg bg-leaf/10 p-4 font-black text-leaf">{message}</div>}

        {/* 搜尋列 + 新增按鈕 */}
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-orange-100 bg-white px-3 py-3">
            <Search className="size-5 shrink-0 text-steel" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋姓名、手機、會員編號" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
          </label>
          <button onClick={() => { setFormOpen(true); setSelected(null); }} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white">
            <UserPlus className="size-5" />
            新增會員
          </button>
        </div>

        {/* 新增會員表單 */}
        {formOpen && (
          <div className="mb-4 rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">新增會員</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-lg bg-stone-100 p-2 text-steel"><X className="size-4" /></button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "姓名 *", key: "name", placeholder: "王小明" },
                { label: "手機 *", key: "phone", placeholder: "0912345678" },
                { label: "生日", key: "birthday", placeholder: "YYYY-MM-DD" },
                { label: "備註", key: "note", placeholder: "備忘事項" },
              ].map(({ label, key, placeholder }) => (
                <label key={key} className="grid gap-1 text-sm font-black text-steel">
                  {label}
                  <input
                    value={newForm[key as keyof typeof newForm]}
                    onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    type={key === "birthday" ? "date" : "text"}
                    className="rounded-lg border border-orange-100 px-3 py-3 font-bold"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setFormOpen(false)} className="rounded-lg border border-orange-100 px-4 py-3 font-black text-steel">取消</button>
              <button onClick={handleCreate} disabled={!newForm.name.trim() || !newForm.phone.trim()} className="rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:opacity-50">建立會員</button>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* 會員列表 */}
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="border-b border-orange-100 px-4 py-3">
              <p className="font-black text-ink">{ready ? `共 ${filtered.length} 位會員` : "載入中..."}</p>
            </div>
            {!ready ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-orange-50" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-sm font-bold text-steel">
                {customers.length === 0 ? "尚無會員資料，點擊「新增會員」開始建立" : "尚無符合條件的會員"}
              </p>
            ) : (
              <div className="divide-y divide-orange-50">
                {filtered.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => { setSelected(customer.id === selected?.id ? null : customer); setAdjustOpen(null); setFormOpen(false); }}
                    className={`w-full p-4 text-left transition ${selected?.id === customer.id ? "bg-leaf/5 ring-inset ring-1 ring-leaf" : "hover:bg-orange-50"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-ink">{customer.name}</p>
                        <p className="text-sm font-bold text-steel">{customer.phone}{customer.memberNo ? ` · ${customer.memberNo}` : ""}</p>
                      </div>
                      <div className="text-right">
                        {memberEnabled && <p className="text-sm font-black text-amber-600"><Gift className="mb-0.5 inline size-3" /> {customer.points ?? 0} 點</p>}
                        {storedValueEnabled && <p className="text-sm font-black text-blue-600">儲值 ${customer.storedValueBalance ?? 0}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 選中會員詳情 */}
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-2xl font-black text-ink">{selected.name}</p>
                    <p className="mt-1 text-sm font-bold text-steel">{selected.phone}</p>
                    {selected.memberNo && <p className="text-sm font-bold text-steel">會員編號：{selected.memberNo}</p>}
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded-lg bg-stone-100 p-2 text-steel"><X className="size-4" /></button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {memberEnabled && (
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <p className="text-sm font-black text-amber-700">點數</p>
                      <p className="text-2xl font-black text-amber-600">{selected.points ?? 0}</p>
                    </div>
                  )}
                  {storedValueEnabled && (
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                      <p className="text-sm font-black text-blue-700">儲值餘額</p>
                      <p className="text-2xl font-black text-blue-600">${selected.storedValueBalance ?? 0}</p>
                    </div>
                  )}
                  <div className="rounded-lg bg-stone-50 p-3 text-center">
                    <p className="text-sm font-black text-steel">累計消費</p>
                    <p className="text-2xl font-black">${selected.totalSpent ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-3 text-center">
                    <p className="text-sm font-black text-steel">消費次數</p>
                    <p className="text-2xl font-black">{selected.totalOrders ?? 0} 次</p>
                  </div>
                </div>

                {(selected.birthday || selected.note) && (
                  <div className="mt-4 space-y-1 border-t border-orange-100 pt-4 text-sm font-bold text-steel">
                    {selected.birthday && <p>生日：{selected.birthday}</p>}
                    {selected.note && <p>備註：{selected.note}</p>}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {memberEnabled && (
                    <button onClick={() => setAdjustOpen(adjustOpen === "points" ? null : "points")} className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-black text-steel">調整點數</button>
                  )}
                  {storedValueEnabled && (
                    <button onClick={() => setAdjustOpen(adjustOpen === "value" ? null : "value")} className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-black text-steel">調整儲值</button>
                  )}
                </div>

                {adjustOpen && (
                  <div className="mt-3 rounded-lg bg-orange-50 p-4">
                    <p className="text-sm font-black text-ink">{adjustOpen === "points" ? "調整點數（正數加點，負數扣點）" : "調整儲值（正數加值，負數扣值）"}</p>
                    <div className="mt-2 grid gap-2">
                      <input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} type="number" placeholder={adjustOpen === "points" ? "+50 或 -10" : "+200 或 -100"} className="rounded-lg border border-orange-100 px-3 py-2 font-bold" />
                      <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="備註（選填）" className="rounded-lg border border-orange-100 px-3 py-2 font-bold" />
                      <div className="flex gap-2">
                        <button onClick={() => { setAdjustOpen(null); setAdjustAmount(""); setAdjustNote(""); }} className="flex-1 rounded-lg border border-orange-200 px-3 py-2 text-sm font-black text-steel">取消</button>
                        <button onClick={adjustOpen === "points" ? handleAdjustPoints : handleAdjustValue} className="flex-1 rounded-lg bg-leaf px-3 py-2 text-sm font-black text-white">確認</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
