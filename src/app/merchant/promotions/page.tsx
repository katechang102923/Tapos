"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Gift, Percent, Plus, Tag, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { resolvePermissions } from "@/lib/permissions";
import { accessibleStoreIds, defaultStoreId } from "@/lib/store-access";
import type { Promotion, PromotionType, User } from "@/lib/types";

type PromotionForm = {
  name: string;
  type: PromotionType;
  startDate: string;
  endDate: string;
  discountPercent: string;
  discountAmount: string;
  buyQty: string;
  freeQty: string;
  stackable: boolean;
  autoApply: boolean;
  priority: string;
  targetCategories: string[];
  targetProducts: string[];
};

const typeLabels: Record<PromotionType, string> = {
  percent_discount: "百分比折扣",
  amount_discount: "固定金額折扣",
  buy_one_get_one: "買一送一（自動折最低價）",
  buy_x_get_y: "買 X 送 Y（自動折最低價）",
  second_half_price: "第二件半價",
};

const typeIcons: Record<PromotionType, React.ElementType> = {
  percent_discount: Percent,
  amount_discount: Tag,
  buy_one_get_one: Gift,
  buy_x_get_y: Gift,
  second_half_price: Tag,
};

function emptyForm(): PromotionForm {
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return {
    name: "",
    type: "percent_discount",
    startDate: today,
    endDate: nextMonth,
    discountPercent: "10",
    discountAmount: "50",
    buyQty: "2",
    freeQty: "1",
    stackable: false,
    autoApply: true,
    priority: "10",
    targetCategories: [],
    targetProducts: [],
  };
}

export default function MerchantPromotionsPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin", "owner", "manager"]} title="促銷活動管理">
      {({ profile }) => <PromotionsShell profile={profile} />}
    </LoginGate>
  );
}

function PromotionsShell({ profile }: { profile: User | null }) {
  const storeIds = accessibleStoreIds(profile);
  const [activeStoreId, setActiveStoreId] = useState(defaultStoreId(profile));
  const selectedStoreId = storeIds.includes(activeStoreId) ? activeStoreId : storeIds[0] ?? "";
  const isAdmin = profile?.role === "admin";
  const permissions = resolvePermissions(profile, selectedStoreId);
  const canManage = permissions.canManagePromotions;

  if (!canManage) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">無法使用促銷活動管理</h1>
          <p className="mt-3 text-steel">此功能僅限 owner 或 manager 以上角色。</p>
          <Link href="/merchant/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><ArrowLeft className="size-4" />返回設定中心</Link>
        </div>
      </main>
    );
  }

  return <PromotionsContent storeId={selectedStoreId} storeIds={storeIds} activeStoreId={activeStoreId} onStoreChange={setActiveStoreId} isPlatformAdmin={isAdmin} />;
}

function PromotionsContent({ storeId, storeIds, activeStoreId, onStoreChange, isPlatformAdmin }: { storeId: string; storeIds: string[]; activeStoreId: string; onStoreChange: (id: string) => void; isPlatformAdmin: boolean }) {
  const { db, upsertPromotion, deletePromotion } = useDemoStore({ storeId, skipOrderList: true });
  const store = db.stores.find((s) => s.id === storeId);
  const categories = useMemo(() => db.categories.filter((c) => c.storeId === storeId).sort((a, b) => a.sort - b.sort), [db.categories, storeId]);
  const products = useMemo(() => db.products.filter((p) => p.storeId === storeId).sort((a, b) => a.sort - b.sort), [db.products, storeId]);
  const promotions = useMemo(() => (db.promotions ?? []).filter((p) => p.storeId === storeId).sort((a, b) => b.priority - a.priority), [db.promotions, storeId]);

  const promotionEnabled = isPlatformAdmin || (store?.features?.promotionEnabled ?? false);

  const [form, setForm] = useState<PromotionForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  if (!promotionEnabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft text-center">
          <Gift className="mx-auto size-12 text-stone-300" />
          <h1 className="mt-4 text-2xl font-black text-ink">促銷功能尚未開啟</h1>
          <p className="mt-3 text-steel">請聯絡平台管理員開啟促銷活動功能。</p>
          <Link href="/merchant/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><ArrowLeft className="size-4" />返回設定中心</Link>
        </div>
      </main>
    );
  }

  function startCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
    setMessage("");
  }

  function startEdit(promotion: Promotion) {
    setForm({
      name: promotion.name,
      type: promotion.type,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      discountPercent: String(promotion.discountPercent),
      discountAmount: String(promotion.discountAmount),
      buyQty: String(promotion.buyQty),
      freeQty: String(promotion.freeQty),
      stackable: promotion.stackable,
      autoApply: promotion.autoApply,
      priority: String(promotion.priority),
      targetCategories: promotion.targetCategories,
      targetProducts: promotion.targetProducts,
    });
    setEditingId(promotion.id);
    setShowForm(true);
    setMessage("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setMessage("");
  }

  async function savePromotion() {
    if (!form.name.trim()) { setMessage("請輸入活動名稱"); return; }
    setSaving(true);
    try {
      await upsertPromotion({
        ...(editingId ? { id: editingId } : {}),
        storeId,
        name: form.name.trim(),
        type: form.type,
        enabled: true,
        startDate: form.startDate,
        endDate: form.endDate,
        discountPercent: Number(form.discountPercent) || 0,
        discountAmount: Number(form.discountAmount) || 0,
        buyQty: Number(form.buyQty) || 2,
        freeQty: Number(form.freeQty) || 1,
        stackable: form.stackable,
        autoApply: form.autoApply,
        priority: Number(form.priority) || 10,
        targetCategories: form.targetCategories,
        targetProducts: form.targetProducts,
      });
      setMessage(editingId ? "活動已更新" : "活動已建立");
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(promotion: Promotion) {
    await upsertPromotion({ ...promotion, enabled: !promotion.enabled });
  }

  async function handleDelete(promotionId: string) {
    if (!confirm("確定要刪除此促銷活動？")) return;
    await deletePromotion(promotionId);
  }

  function toggleCategory(id: string) {
    setForm((f) => ({ ...f, targetCategories: f.targetCategories.includes(id) ? f.targetCategories.filter((c) => c !== id) : [...f.targetCategories, id] }));
  }

  function toggleProduct(id: string) {
    setForm((f) => ({ ...f, targetProducts: f.targetProducts.includes(id) ? f.targetProducts.filter((p) => p !== id) : [...f.targetProducts, id] }));
  }

  return (
    <main className="min-h-screen bg-[#f5f3ee] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 rounded-lg bg-[#171717] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white/55">促銷活動管理</p>
            <h1 className="mt-1 text-3xl font-black">{store?.name ?? "店家"} 促銷活動</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {storeIds.length > 1 && (
              <select value={activeStoreId} onChange={(e) => onStoreChange(e.target.value)} className="rounded-lg border border-white/20 bg-white px-4 py-3 font-black text-ink">
                {storeIds.map((id) => <option key={id} value={id}>{db.stores.find((s) => s.id === id)?.name ?? id}</option>)}
              </select>
            )}
            <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white"><Plus className="size-4" />新增活動</button>
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ArrowLeft className="size-4" />返回設定中心</Link>
          </div>
        </header>

        {message && <div className="mb-5 rounded-lg border border-leaf/30 bg-leaf/10 p-4 font-black text-leaf">{message}</div>}

        {showForm && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">{editingId ? "編輯促銷活動" : "新增促銷活動"}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-black text-steel">活動名稱</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" placeholder="例如：週末特惠 9 折" />
              </div>

              <div>
                <label className="block text-sm font-black text-steel">促銷類型</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PromotionType }))} className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold">
                  {(Object.keys(typeLabels) as PromotionType[]).map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-steel">優先級（數字越大越優先）</label>
                <input value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} type="number" min="1" className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              </div>

              <div>
                <label className="block text-sm font-black text-steel">開始日期</label>
                <input value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} type="date" className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              </div>

              <div>
                <label className="block text-sm font-black text-steel">結束日期</label>
                <input value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} type="date" className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              </div>

              {form.type === "percent_discount" && (
                <div>
                  <label className="block text-sm font-black text-steel">折扣百分比（%）</label>
                  <input value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} type="number" min="1" max="100" className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" placeholder="例如 10 = 9折" />
                </div>
              )}

              {form.type === "amount_discount" && (
                <div>
                  <label className="block text-sm font-black text-steel">折扣金額（元）</label>
                  <input value={form.discountAmount} onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))} type="number" min="1" className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" placeholder="例如 50" />
                </div>
              )}

              {form.type === "buy_x_get_y" && (
                <>
                  <div>
                    <label className="block text-sm font-black text-steel">買幾件（X）</label>
                    <input value={form.buyQty} onChange={(e) => setForm((f) => ({ ...f, buyQty: e.target.value }))} type="number" min="1" className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-steel">送幾件（Y，最便宜商品免費）</label>
                    <input value={form.freeQty} onChange={(e) => setForm((f) => ({ ...f, freeQty: e.target.value }))} type="number" min="1" className="mt-1 w-full rounded-lg border border-orange-100 px-4 py-3 font-bold" />
                  </div>
                </>
              )}

              <div className="sm:col-span-2 flex gap-6">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={form.autoApply} onChange={(e) => setForm((f) => ({ ...f, autoApply: e.target.checked }))} className="size-5" />
                  <span className="font-black text-steel">自動套用</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={form.stackable} onChange={(e) => setForm((f) => ({ ...f, stackable: e.target.checked }))} className="size-5" />
                  <span className="font-black text-steel">可與其他促銷疊加</span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <p className="text-sm font-black text-steel">套用分類（不選 = 全部分類）</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button key={c.id} type="button" onClick={() => toggleCategory(c.id)} className={`rounded-lg px-3 py-2 text-sm font-black ${form.targetCategories.includes(c.id) ? "bg-leaf text-white" : "bg-stone-100 text-steel"}`}>{c.name}</button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <p className="text-sm font-black text-steel">套用商品（不選 = 依分類或全部）</p>
                <div className="mt-2 flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {products.map((p) => (
                    <button key={p.id} type="button" onClick={() => toggleProduct(p.id)} className={`rounded-lg px-3 py-2 text-sm font-black ${form.targetProducts.includes(p.id) ? "bg-tomato text-white" : "bg-stone-100 text-steel"}`}>{p.name}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={savePromotion} disabled={saving} className="rounded-lg bg-leaf px-6 py-3 font-black text-white disabled:opacity-60">{saving ? "儲存中..." : "儲存活動"}</button>
              <button onClick={cancelForm} className="rounded-lg bg-stone-200 px-6 py-3 font-black text-steel">取消</button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {promotions.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow-sm">
              <Gift className="mx-auto size-12 text-stone-300" />
              <p className="mt-4 text-xl font-black text-steel">尚無促銷活動</p>
              <p className="mt-2 text-sm font-bold text-stone-400">點擊「新增活動」開始建立第一個促銷方案。</p>
            </div>
          ) : promotions.map((promotion) => {
            const TypeIcon = typeIcons[promotion.type];
            const isActive = promotion.enabled && promotion.startDate <= today && promotion.endDate >= today;
            const isExpired = promotion.endDate < today;
            const isUpcoming = promotion.startDate > today;
            return (
              <div key={promotion.id} className={`rounded-lg bg-white p-5 shadow-sm ${isActive ? "border-l-4 border-leaf" : "border-l-4 border-stone-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`grid size-12 shrink-0 place-items-center rounded-lg ${isActive ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-400"}`}>
                      <TypeIcon className="size-6" />
                    </div>
                    <div>
                      <p className="text-xl font-black">{promotion.name}</p>
                      <p className="mt-1 text-sm font-bold text-steel">{typeLabels[promotion.type]}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                        {promotion.type === "percent_discount" && <span className="rounded-full bg-tomato/10 px-2 py-1 text-tomato">折扣 {promotion.discountPercent}%</span>}
                        {promotion.type === "amount_discount" && <span className="rounded-full bg-tomato/10 px-2 py-1 text-tomato">折抵 ${promotion.discountAmount}</span>}
                        {promotion.type === "buy_one_get_one" && <span className="rounded-full bg-leaf/10 px-2 py-1 text-leaf">買一送一</span>}
                        {promotion.type === "buy_x_get_y" && <span className="rounded-full bg-leaf/10 px-2 py-1 text-leaf">買 {promotion.buyQty} 送 {promotion.freeQty}</span>}
                        {promotion.autoApply && <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">自動套用</span>}
                        {promotion.stackable && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">可疊加</span>}
                        <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-500">優先級 {promotion.priority}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-stone-400">
                        <Calendar className="size-3.5" />
                        {promotion.startDate} ~ {promotion.endDate}
                        {isExpired && <span className="ml-2 rounded-full bg-stone-100 px-2 py-1 text-stone-500">已結束</span>}
                        {isUpcoming && <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-amber-700">尚未開始</span>}
                        {isActive && <span className="ml-2 rounded-full bg-leaf/10 px-2 py-1 text-leaf">進行中</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => toggleEnabled(promotion)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black ${promotion.enabled ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-steel"}`}>
                      {promotion.enabled ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                      {promotion.enabled ? "啟用中" : "已停用"}
                    </button>
                    <button onClick={() => startEdit(promotion)} className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-black text-steel">編輯</button>
                    <button onClick={() => handleDelete(promotion.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-tomato/10 px-3 py-2 text-sm font-black text-tomato"><Trash2 className="size-3.5" />刪除</button>
                  </div>
                </div>
                {(promotion.targetCategories.length > 0 || promotion.targetProducts.length > 0) && (
                  <div className="mt-3 border-t border-stone-100 pt-3 text-xs font-bold text-stone-400">
                    {promotion.targetCategories.length > 0 && <p>套用分類：{promotion.targetCategories.map((id) => categories.find((c) => c.id === id)?.name ?? id).join("、")}</p>}
                    {promotion.targetProducts.length > 0 && <p className="mt-0.5">套用商品：{promotion.targetProducts.map((id) => products.find((p) => p.id === id)?.name ?? id).join("、")}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
