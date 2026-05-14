"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Contact, Plus, Search, X } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { resolvePermissions } from "@/lib/permissions";
import { accessibleStoreIds, defaultStoreId } from "@/lib/store-access";
import type { Customer, PointLog, StoredValueLog, User } from "@/lib/types";

export default function MerchantCustomersPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin", "owner", "manager", "staff", "viewer"]} title="會員管理">
      {({ profile }) => <CustomersShell profile={profile} />}
    </LoginGate>
  );
}

function CustomersShell({ profile }: { profile: User | null }) {
  const storeIds = accessibleStoreIds(profile);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId(profile));
  const activeStoreId = storeIds.includes(selectedStoreId) ? selectedStoreId : storeIds[0] ?? "";
  useEffect(() => {
    if (storeIds.length > 0 && selectedStoreId !== activeStoreId) setSelectedStoreId(activeStoreId);
  }, [activeStoreId, selectedStoreId, storeIds]);
  const { db, createCustomer, updateCustomer, adjustCustomerPoints, adjustStoredValue } = useDemoStore({ storeId: activeStoreId, loadCustomers: true });

  const store = db.stores.find((s) => s.id === activeStoreId);
  const permissions = resolvePermissions(profile, activeStoreId);
  const isAdmin = profile?.role === "admin";

  // Always call hooks before any early returns
  const customers = useMemo(() => (db.customers ?? []).filter((c) => c.storeId === activeStoreId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [db.customers, activeStoreId]);
  const pointLogs = useMemo(() => (db.pointLogs ?? []).filter((l) => l.storeId === activeStoreId), [db.pointLogs, activeStoreId]);
  const storedValueLogs = useMemo(() => (db.storedValueLogs ?? []).filter((l) => l.storeId === activeStoreId), [db.storedValueLogs, activeStoreId]);
  const memberStoredValueEnabled = store?.features?.memberStoredValueEnabled ?? false;

  if (!store?.features?.memberEnabled && !isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <Contact className="size-10 text-steel" />
          <h1 className="mt-4 text-2xl font-black text-ink">會員功能尚未開通</h1>
          <p className="mt-2 text-sm font-bold text-steel">此店家尚未啟用會員功能，請聯絡平台管理員開通。</p>
        </div>
      </main>
    );
  }

  if (!permissions.canManageMembers && !isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">權限不足</h1>
          <p className="mt-2 text-sm font-bold text-steel">此帳號沒有會員管理權限。</p>
        </div>
      </main>
    );
  }

  return (
    <CustomersContent
      storeId={activeStoreId}
      storeIds={storeIds}
      db={db}
      profile={profile}
      permissions={permissions}
      isAdmin={isAdmin}
      customers={customers}
      pointLogs={pointLogs}
      storedValueLogs={storedValueLogs}
      memberStoredValueEnabled={memberStoredValueEnabled}
      createCustomer={createCustomer}
      updateCustomer={updateCustomer}
      adjustCustomerPoints={adjustCustomerPoints}
      adjustStoredValue={adjustStoredValue}
      onStoreChange={setSelectedStoreId}
    />
  );
}

type ContentProps = {
  storeId: string;
  storeIds: string[];
  db: ReturnType<typeof useDemoStore>["db"];
  profile: User | null;
  permissions: ReturnType<typeof resolvePermissions>;
  isAdmin: boolean;
  customers: Customer[];
  pointLogs: PointLog[];
  storedValueLogs: StoredValueLog[];
  memberStoredValueEnabled: boolean;
  createCustomer: ReturnType<typeof useDemoStore>["createCustomer"];
  updateCustomer: ReturnType<typeof useDemoStore>["updateCustomer"];
  adjustCustomerPoints: ReturnType<typeof useDemoStore>["adjustCustomerPoints"];
  adjustStoredValue: ReturnType<typeof useDemoStore>["adjustStoredValue"];
  onStoreChange: (id: string) => void;
};

function CustomersContent({ storeId, storeIds, db, profile, permissions, isAdmin, customers, pointLogs, storedValueLogs, memberStoredValueEnabled, createCustomer, updateCustomer, adjustCustomerPoints, adjustStoredValue, onStoreChange }: ContentProps) {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", email: "", birthday: "" });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", birthday: "" });
  const [pointAdjAmount, setPointAdjAmount] = useState("");
  const [pointAdjNote, setPointAdjNote] = useState("");
  const [pointAdjMsg, setPointAdjMsg] = useState("");
  const [svAdjAmount, setSvAdjAmount] = useState("");
  const [svAdjNote, setSvAdjNote] = useState("");
  const [svAdjType, setSvAdjType] = useState<"topup" | "adjust">("topup");
  const [svAdjMsg, setSvAdjMsg] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.memberNo.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const selectedPointLogs = useMemo(() => pointLogs.filter((l) => l.customerId === selectedCustomer?.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20), [pointLogs, selectedCustomer]);
  const selectedSvLogs = useMemo(() => storedValueLogs.filter((l) => l.customerId === selectedCustomer?.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20), [storedValueLogs, selectedCustomer]);
  const selectedOrders = useMemo(() => db.orders.filter((o) => o.customer?.customerId === selectedCustomer?.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10), [db.orders, selectedCustomer]);

  async function handleAddCustomer() {
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      setAddError("姓名與手機為必填");
      return;
    }
    setAddLoading(true);
    setAddError("");
    try {
      await createCustomer({ storeId, name: addForm.name.trim(), phone: addForm.phone.trim(), email: addForm.email.trim() || undefined, birthday: addForm.birthday || undefined, createdBy: profile?.email ?? "" });
      setAddForm({ name: "", phone: "", email: "", birthday: "" });
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleUpdateCustomer() {
    if (!selectedCustomer) return;
    await updateCustomer(selectedCustomer.id, { name: editForm.name.trim(), phone: editForm.phone.trim(), email: editForm.email.trim() || undefined, birthday: editForm.birthday || undefined });
    setEditMode(false);
  }

  async function handleAdjustPoints() {
    if (!selectedCustomer) return;
    const amount = parseInt(pointAdjAmount, 10);
    if (!Number.isFinite(amount) || amount === 0) return;
    await adjustCustomerPoints({ customerId: selectedCustomer.id, storeId, type: "adjust", points: amount, note: pointAdjNote, createdBy: profile?.email ?? "" });
    setPointAdjAmount("");
    setPointAdjNote("");
    setPointAdjMsg(`點數已調整 ${amount > 0 ? "+" : ""}${amount}`);
    setTimeout(() => setPointAdjMsg(""), 3000);
  }

  async function handleAdjustStoredValue() {
    if (!selectedCustomer) return;
    const amount = parseFloat(svAdjAmount);
    if (!Number.isFinite(amount) || amount === 0) return;
    const signedAmount = svAdjType === "topup" ? Math.abs(amount) : amount;
    await adjustStoredValue({ customerId: selectedCustomer.id, storeId, type: svAdjType, amount: signedAmount, note: svAdjNote, createdBy: profile?.email ?? "" });
    setSvAdjAmount("");
    setSvAdjNote("");
    setSvAdjMsg(`儲值已調整 ${signedAmount > 0 ? "+" : ""}${signedAmount}`);
    setTimeout(() => setSvAdjMsg(""), 3000);
  }

  function startEdit(customer: Customer) {
    setEditForm({ name: customer.name, phone: customer.phone, email: customer.email ?? "", birthday: customer.birthday ?? "" });
    setEditMode(true);
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setEditMode(false);
    setPointAdjAmount("");
    setPointAdjNote("");
    setPointAdjMsg("");
    setSvAdjAmount("");
    setSvAdjNote("");
    setSvAdjMsg("");
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-col gap-3 rounded-lg bg-[#171717] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white/55">會員管理</p>
            <h1 className="mt-1 text-3xl font-black">會員列表</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {storeIds.length > 1 && (
              <select value={storeId} onChange={(e) => onStoreChange(e.target.value)} className="rounded-lg border border-white/20 bg-white px-4 py-3 font-black text-ink">
                {storeIds.map((id) => <option key={id} value={id}>{db.stores.find((s) => s.id === id)?.name ?? id}</option>)}
              </select>
            )}
            <button onClick={() => setShowAddForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white"><Plus className="size-5" />新增會員</button>
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20"><ArrowLeft className="size-4" />返回後台</Link>
          </div>
        </header>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-5 rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">新增會員</h2>
              <button onClick={() => setShowAddForm(false)}><X className="size-5 text-steel" /></button>
            </div>
            {addError && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{addError}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-black text-steel">姓名 *<input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink" placeholder="王小明" /></label>
              <label className="grid gap-1 text-sm font-black text-steel">手機 *<input value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink" placeholder="0912-345-678" /></label>
              <label className="grid gap-1 text-sm font-black text-steel">Email<input value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink" placeholder="（選填）" /></label>
              <label className="grid gap-1 text-sm font-black text-steel">生日<input type="date" value={addForm.birthday} onChange={(e) => setAddForm((f) => ({ ...f, birthday: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink" /></label>
            </div>
            <button onClick={handleAddCustomer} disabled={addLoading} className="mt-4 rounded-lg bg-leaf px-5 py-3 font-black text-white disabled:opacity-60">{addLoading ? "新增中..." : "確認新增"}</button>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          {/* Customer list */}
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 rounded-lg border border-orange-100 px-3 py-2">
              <Search className="size-4 text-steel" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋姓名 / 手機 / 會員編號" className="flex-1 text-sm font-bold text-ink outline-none" />
            </div>
            <p className="mt-3 text-xs font-black text-steel">共 {filtered.length} 位會員</p>
            <div className="mt-3 space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="rounded-lg bg-stone-50 p-4 text-center text-sm font-black text-steel">尚無會員資料</p>
              ) : filtered.map((customer) => (
                <button key={customer.id} onClick={() => selectCustomer(customer)} className={`w-full rounded-lg p-3 text-left transition ${selectedCustomer?.id === customer.id ? "bg-blue-50 border border-blue-200" : "bg-stone-50 hover:bg-orange-50"}`}>
                  <p className="font-black text-ink">{customer.name}</p>
                  <p className="text-sm font-bold text-steel">{customer.memberNo} ｜ {customer.phone}</p>
                  <div className="mt-1 flex gap-3 text-xs font-bold text-steel">
                    <span>點數 {customer.points}</span>
                    {memberStoredValueEnabled && <span>儲值 ${customer.storedValueBalance}</span>}
                    <span>消費 {customer.totalOrders} 次</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Customer detail */}
          {selectedCustomer ? (
            <section className="space-y-5">
              {/* Basic info */}
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black">{selectedCustomer.name}</h2>
                    <p className="mt-1 text-sm font-bold text-steel">{selectedCustomer.memberNo} ｜ {selectedCustomer.phone}</p>
                    {selectedCustomer.email && <p className="text-sm font-bold text-steel">{selectedCustomer.email}</p>}
                    {selectedCustomer.birthday && <p className="text-sm font-bold text-steel">生日：{selectedCustomer.birthday}</p>}
                    <p className="mt-1 text-sm font-bold text-steel">加入：{new Date(selectedCustomer.createdAt).toLocaleDateString("zh-TW")}</p>
                  </div>
                  <button onClick={() => startEdit(selectedCustomer)} className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-black text-steel">編輯資料</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBox label="點數" value={selectedCustomer.points.toString()} color="text-blue-600" />
                  {memberStoredValueEnabled && <StatBox label="儲值餘額" value={`$${selectedCustomer.storedValueBalance}`} color="text-leaf" />}
                  <StatBox label="累計消費" value={`$${selectedCustomer.totalSpent}`} />
                  <StatBox label="消費次數" value={selectedCustomer.totalOrders.toString()} />
                </div>
                {editMode && (
                  <div className="mt-4 grid gap-3 rounded-lg bg-stone-50 p-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-black text-steel">姓名<input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold" /></label>
                    <label className="grid gap-1 text-sm font-black text-steel">手機<input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold" /></label>
                    <label className="grid gap-1 text-sm font-black text-steel">Email<input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold" /></label>
                    <label className="grid gap-1 text-sm font-black text-steel">生日<input type="date" value={editForm.birthday} onChange={(e) => setEditForm((f) => ({ ...f, birthday: e.target.value }))} className="rounded-lg border border-orange-100 px-3 py-2 font-bold" /></label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button onClick={handleUpdateCustomer} className="rounded-lg bg-leaf px-4 py-2 font-black text-white">儲存</button>
                      <button onClick={() => setEditMode(false)} className="rounded-lg bg-stone-200 px-4 py-2 font-black text-steel">取消</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Points management */}
              {permissions.canAdjustMemberPoints && (
                <div className="rounded-lg bg-white p-5 shadow-sm">
                  <h3 className="text-xl font-black">點數調整</h3>
                  {pointAdjMsg && <p className="mt-2 text-sm font-black text-leaf">{pointAdjMsg}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input type="number" value={pointAdjAmount} onChange={(e) => setPointAdjAmount(e.target.value)} placeholder="點數（負數為扣除）" className="rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold w-48" />
                    <input value={pointAdjNote} onChange={(e) => setPointAdjNote(e.target.value)} placeholder="備註（選填）" className="rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold flex-1 min-w-32" />
                    <button onClick={handleAdjustPoints} disabled={!pointAdjAmount} className="rounded-lg bg-blue-600 px-4 py-2 font-black text-white disabled:opacity-50">調整點數</button>
                  </div>
                  {selectedPointLogs.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs font-black text-steel">近期點數記錄</p>
                      {selectedPointLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
                          <div><p className="font-black">{pointLogTypeLabel(log.type)}{log.note ? ` — ${log.note}` : ""}</p><p className="text-xs text-steel">{new Date(log.createdAt).toLocaleString("zh-TW")}</p></div>
                          <span className={`font-black ${log.points >= 0 ? "text-leaf" : "text-tomato"}`}>{log.points >= 0 ? "+" : ""}{log.points}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stored value management */}
              {memberStoredValueEnabled && permissions.canUseStoredValue && (
                <div className="rounded-lg bg-white p-5 shadow-sm">
                  <h3 className="text-xl font-black">儲值管理</h3>
                  {svAdjMsg && <p className="mt-2 text-sm font-black text-leaf">{svAdjMsg}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select value={svAdjType} onChange={(e) => setSvAdjType(e.target.value as "topup" | "adjust")} className="rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold">
                      <option value="topup">儲值加值</option>
                      <option value="adjust">手動調整</option>
                    </select>
                    <input type="number" value={svAdjAmount} onChange={(e) => setSvAdjAmount(e.target.value)} placeholder={svAdjType === "topup" ? "加值金額" : "金額（負為扣除）"} className="rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold w-40" />
                    <input value={svAdjNote} onChange={(e) => setSvAdjNote(e.target.value)} placeholder="備註（選填）" className="rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold flex-1 min-w-32" />
                    <button onClick={handleAdjustStoredValue} disabled={!svAdjAmount} className="rounded-lg bg-leaf px-4 py-2 font-black text-white disabled:opacity-50">確認</button>
                  </div>
                  {selectedSvLogs.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs font-black text-steel">近期儲值記錄</p>
                      {selectedSvLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
                          <div><p className="font-black">{svLogTypeLabel(log.type)}{log.note ? ` — ${log.note}` : ""}</p><p className="text-xs text-steel">{new Date(log.createdAt).toLocaleString("zh-TW")} ｜ 餘額 ${log.afterBalance}</p></div>
                          <span className={`font-black ${log.amount >= 0 ? "text-leaf" : "text-tomato"}`}>{log.amount >= 0 ? "+" : ""}${log.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recent orders */}
              {selectedOrders.length > 0 && (
                <div className="rounded-lg bg-white p-5 shadow-sm">
                  <h3 className="text-xl font-black">近期消費記錄</h3>
                  <div className="mt-3 space-y-2">
                    {selectedOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-3">
                        <div>
                          <p className="font-black">#{order.orderNumber} — {order.mode === "takeout" ? "外帶" : `內用 ${order.tableNo}`}</p>
                          <p className="text-sm font-bold text-steel">{new Date(order.createdAt).toLocaleString("zh-TW")}</p>
                          {order.pointsEarned && <p className="text-xs font-bold text-blue-600">+{order.pointsEarned} 點</p>}
                        </div>
                        <p className="font-black text-tomato">${order.total}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <div className="flex items-center justify-center rounded-lg bg-white p-12 shadow-sm">
              <p className="text-xl font-black text-steel">選擇左側會員以查看詳情</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatBox({ label, value, color = "text-ink" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3 text-center">
      <p className="text-xs font-black text-steel">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function pointLogTypeLabel(type: PointLog["type"]): string {
  const labels: Partial<Record<PointLog["type"], string>> = { earn: "消費獲點", redeem: "點數兌換", adjust: "手動調整", rollback: "點數回滾", points_add: "點數增加", points_use: "點數使用" };
  return labels[type] ?? type;
}

function svLogTypeLabel(type: StoredValueLog["type"]): string {
  const labels: Partial<Record<StoredValueLog["type"], string>> = { topup: "儲值加值", payment: "儲值付款", spend: "儲值消費", adjust: "手動調整", refund: "退款" };
  return labels[type] ?? type;
}
