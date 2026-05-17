"use client";

import { useRef, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, Link2, Plus, Search, Upload, X } from "lucide-react";
import type { Category, Product, ProductOptionChoice, ProductOptionGroup, ProductScheduledChange, SharedOptionGroup } from "@/lib/types";
import { discountLabel, productFinalPrice } from "@/lib/pricing";

type ProductEditorDialogProps = {
  addChildGroup: (groupId: string, optionId: string) => void;
  addGroupOption: (groupId: string) => void;
  addOptionGroup: () => void;
  applySharedGroups?: (groupIds: string[]) => void;
  categories: Category[];
  editingProduct: Product;
  imagePresets: string[];
  removeEditingProduct: () => void;
  removeGroupOption: (groupId: string, optionId: string) => void;
  removeOptionGroup: (groupId: string) => void;
  moveOptionGroup?: (groupId: string, direction: -1 | 1) => void;
  saveProduct: () => void;
  setEditingProduct: Dispatch<SetStateAction<Product>>;
  setProductEditorOpen: (open: boolean) => void;
  sharedGroups?: SharedOptionGroup[];
  updateGroupOption: (groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) => void;
  updateOptionGroup: (groupId: string, patch: Partial<ProductOptionGroup>) => void;
  saveState?: "idle" | "unsaved" | "saving" | "saved" | "error";
  saveMessage?: string;
};

export function ProductEditorDialog({
  addChildGroup,
  addGroupOption,
  addOptionGroup,
  applySharedGroups = () => undefined,
  categories,
  editingProduct,
  imagePresets,
  removeEditingProduct,
  removeGroupOption,
  removeOptionGroup,
  moveOptionGroup = () => undefined,
  saveProduct,
  setEditingProduct,
  setProductEditorOpen,
  sharedGroups = [],
  updateGroupOption,
  updateOptionGroup,
  saveState,
  saveMessage
}: ProductEditorDialogProps) {
  const form = useMemo(() => normalizeProductForm(editingProduct), [editingProduct]);
  const optionGroups = form.optionGroups ?? [];
  const isNewProduct = editingProduct.id === "new-product";
  const [sharedPickerOpen, setSharedPickerOpen] = useState(false);
  const [sharedSearch, setSharedSearch] = useState("");
  const [selectedSharedIds, setSelectedSharedIds] = useState<string[]>([]);
  const scheduledChanges = editingProduct.scheduledChanges ?? [];

  const sharedRefs = optionGroups.filter((group) => isSharedGroupRef(group));
  const appliedSharedIds = useMemo(() => new Set(sharedRefs.map((group) => sharedRefId(group))), [sharedRefs]);
  const filteredSharedGroups = sharedGroups.filter((group) => {
    const keyword = sharedSearch.trim().toLowerCase();
    if (!keyword) return true;
    return group.name.toLowerCase().includes(keyword) || (group.groupName ?? "").toLowerCase().includes(keyword);
  });
  const imageInputRef = useRef<HTMLInputElement>(null);

  function handleLocalImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) setEditingProduct((current) => ({ ...current, imageUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected if needed
    event.target.value = "";
  }

  function addScheduledChange() {
    const now = new Date().toISOString();
    const next: ProductScheduledChange = {
      id: newClientId("scheduled"),
      effectiveAt: datetimeLocalToTaipeiIso(defaultNextMonthDatetimeLocal()),
      price: Number(editingProduct.price ?? 0),
      cost: Number(editingProduct.cost ?? editingProduct.originalPrice ?? 0),
      isActive: editingProduct.isAvailable ?? true,
      note: "",
      createdAt: now
    };
    setEditingProduct((current) => ({
      ...current,
      scheduledChanges: [...(current.scheduledChanges ?? []), next]
    }));
  }

  function updateScheduledChange(changeId: string, patch: Partial<ProductScheduledChange>) {
    setEditingProduct((current) => ({
      ...current,
      scheduledChanges: (current.scheduledChanges ?? []).map((change) => change.id === changeId ? { ...change, ...patch } : change)
    }));
  }

  function removeScheduledChange(changeId: string) {
    setEditingProduct((current) => ({
      ...current,
      scheduledChanges: (current.scheduledChanges ?? []).filter((change) => change.id !== changeId)
    }));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-3 sm:p-5">
      <section className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-[#fff7e8] shadow-2xl sm:min-h-[calc(100vh-40px)]">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-orange-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-leaf">商品編輯</p>
            <h2 className="text-2xl font-black text-ink sm:text-3xl">{isNewProduct ? "新增商品" : editingProduct.name || "編輯商品"}</h2>
            <p className="mt-1 text-sm font-bold text-steel">設定商品基本資料、價格、折扣與多層選項，讓前台點餐和 KDS 都能同步使用。</p>
            {saveMessage ? (
              <p className={`mt-2 text-sm font-black ${saveState === "error" ? "text-tomato" : saveState === "saving" ? "text-ink" : "text-leaf"}`}>{saveMessage}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setProductEditorOpen(false)} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">關閉</button>
            {!isNewProduct && <button type="button" onClick={removeEditingProduct} className="rounded-lg bg-tomato px-4 py-3 font-black text-white">刪除商品</button>}
            <button type="button" onClick={saveProduct} className="rounded-lg bg-ink px-5 py-3 font-black text-white">儲存商品</button>
          </div>
        </header>

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.35fr)]">
          <section className="space-y-4">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h3 className="text-xl font-black">商品基本資料</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <LabeledInput label="商品名稱" value={editingProduct.name} onChange={(value) => setEditingProduct((current) => ({ ...current, name: value }))} />
                </div>
                <label className="grid gap-1 text-sm font-black text-steel sm:col-span-2">
                  商品描述
                  <textarea value={editingProduct.description} onChange={(event) => setEditingProduct((current) => ({ ...current, description: event.target.value }))} className="min-h-28 rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" />
                </label>
                <LabeledInput label="售價" type="number" value={String(editingProduct.price ?? 0)} onChange={(value) => setEditingProduct((current) => ({ ...current, price: Number(value) }))} />
                <LabeledInput label="原價 / 成本參考" type="number" value={String(editingProduct.originalPrice ?? editingProduct.price ?? 0)} onChange={(value) => setEditingProduct((current) => ({ ...current, originalPrice: Number(value) }))} />
                <LabeledInput label="排序" type="number" value={String(editingProduct.sort ?? 0)} onChange={(value) => setEditingProduct((current) => ({ ...current, sort: Number(value) }))} />
                <label className="grid gap-1 text-sm font-black text-steel">
                  商品折扣
                  <select value={editingProduct.discountType ?? "none"} onChange={(event) => setEditingProduct((current) => ({ ...current, discountType: event.target.value as Product["discountType"], discountValue: event.target.value === "none" ? 0 : current.discountValue ?? 0 }))} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink">
                    <option value="none">無折扣</option>
                    <option value="percent">幾折</option>
                    <option value="amount">折扣金額</option>
                    <option value="specialPrice">特價價</option>
                  </select>
                </label>
                <LabeledInput label={(editingProduct.discountType ?? "none") === "percent" ? "折扣百分比，例如 90 = 9 折" : (editingProduct.discountType ?? "none") === "amount" ? "折扣金額" : (editingProduct.discountType ?? "none") === "specialPrice" ? "特價價" : "折扣值"} type="number" value={String(editingProduct.discountValue ?? 0)} onChange={(value) => setEditingProduct((current) => ({ ...current, discountValue: Number(value) }))} />
                <div className="rounded-lg bg-orange-50 px-3 py-3 text-sm font-black text-steel">
                  折扣後價格：<span className="text-tomato">${productFinalPrice(editingProduct)}</span>
                  {discountLabel(editingProduct.discountType, editingProduct.discountValue) && <span className="ml-2 text-tomato">{discountLabel(editingProduct.discountType, editingProduct.discountValue)}</span>}
                </div>
                <LabeledInput label="成本價" type="number" value={String(editingProduct.cost ?? 0)} onChange={(value) => setEditingProduct((current) => ({ ...current, cost: Number(value) }))} />
                <label className="grid gap-1 text-sm font-black text-steel">
                  商品分類
                  <select value={editingProduct.categoryId} onChange={(event) => setEditingProduct((current) => ({ ...current, categoryId: event.target.value }))} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink">
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center justify-between rounded-lg border border-orange-100 px-3 py-3 text-sm font-black text-steel sm:col-span-2">
                  商品上架狀態
                  <input type="checkbox" checked={editingProduct.isAvailable && !editingProduct.isSoldOut} onChange={(event) => setEditingProduct((current) => ({ ...current, isAvailable: event.target.checked, isSoldOut: !event.target.checked }))} className="size-5" />
                </label>
                <div className="sm:col-span-2">
                  <LabeledInput label="商品圖片網址" value={editingProduct.imageUrl} onChange={(value) => setEditingProduct((current) => ({ ...current, imageUrl: value }))} />
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleLocalImageUpload} />
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-black text-steel transition hover:bg-orange-50">
                    <Upload className="size-4" />
                    上傳本地圖片
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-ink">預約修改</h3>
                  <p className="mt-1 text-sm font-bold text-steel">可先設定未來生效的售價、成本與上下架狀態。POS 與 QR 會依時間自動套用已生效的最新一筆。</p>
                </div>
                <button type="button" onClick={addScheduledChange} className="rounded-lg bg-ink px-4 py-3 font-black text-white">新增預約修改</button>
              </div>
              <div className="mt-4 grid gap-3">
                {scheduledChanges.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 p-4 text-sm font-bold text-steel">尚未設定預約修改</div>
                ) : scheduledChanges
                  .slice()
                  .sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt))
                  .map((change) => {
                    const effective = Date.parse(change.effectiveAt) <= Date.now();
                    return (
                      <div key={change.id} className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${effective ? "bg-leaf text-white" : "bg-white text-steel"}`}>{effective ? "已生效" : "尚未生效"}</span>
                          <button type="button" onClick={() => removeScheduledChange(change.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-tomato">刪除</button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1 text-sm font-black text-steel">
                            生效日期/時間
                            <input
                              type="datetime-local"
                              value={isoToDatetimeLocal(change.effectiveAt)}
                              onChange={(event) => updateScheduledChange(change.id, { effectiveAt: datetimeLocalToTaipeiIso(event.target.value) })}
                              className="rounded-lg border border-orange-100 bg-white px-3 py-3 font-bold text-ink"
                            />
                          </label>
                          <label className="grid gap-1 text-sm font-black text-steel">
                            新售價
                            <input
                              type="number"
                              value={change.price ?? ""}
                              onChange={(event) => updateScheduledChange(change.id, { price: numberOrUndefined(event.target.value) })}
                              className="rounded-lg border border-orange-100 bg-white px-3 py-3 font-bold text-ink"
                            />
                          </label>
                          <label className="grid gap-1 text-sm font-black text-steel">
                            新成本價
                            <input
                              type="number"
                              value={change.cost ?? ""}
                              onChange={(event) => updateScheduledChange(change.id, { cost: numberOrUndefined(event.target.value) })}
                              className="rounded-lg border border-orange-100 bg-white px-3 py-3 font-bold text-ink"
                            />
                          </label>
                          <label className="flex items-center justify-between rounded-lg border border-orange-100 bg-white px-3 py-3 text-sm font-black text-steel">
                            生效後上架
                            <input type="checkbox" checked={change.isActive ?? true} onChange={(event) => updateScheduledChange(change.id, { isActive: event.target.checked })} className="size-5" />
                          </label>
                          <label className="grid gap-1 text-sm font-black text-steel sm:col-span-2">
                            備註
                            <input
                              value={change.note ?? ""}
                              onChange={(event) => updateScheduledChange(change.id, { note: event.target.value })}
                              placeholder="例如 6/1 起漲價"
                              className="rounded-lg border border-orange-100 bg-white px-3 py-3 font-bold text-ink"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <img src={editingProduct.imageUrl} alt={editingProduct.name || "商品圖片預覽"} className="size-24 rounded-lg object-cover ring-1 ring-orange-100" />
                <div>
                  <h3 className="text-xl font-black">圖片預覽</h3>
                  <p className="mt-1 text-sm font-bold text-steel">可貼上圖片 URL，或直接選用下方範例圖片。</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {imagePresets.map((url) => (
                  <button key={url} type="button" onClick={() => setEditingProduct((current) => ({ ...current, imageUrl: url }))} className="overflow-hidden rounded-lg ring-2 ring-transparent transition hover:ring-leaf">
                    <img src={url} alt="圖片範本" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-orange-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black">多層菜單選項設定</h3>
                <p className="mt-1 text-sm font-bold text-steel">設定調味、加料、套餐與調味選項。調味選項適合甜度、冰塊、加料等跨商品重複使用的選項。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addOptionGroup} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white">
                  <Plus className="size-4" />
                  新增選項群組
                </button>
                <button type="button" onClick={() => { setSelectedSharedIds([]); setSharedPickerOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-leaf bg-white px-4 py-3 font-black text-leaf">
                  <Link2 className="size-4" />
                  套用調味選項
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {sharedRefs.length > 0 && (
                <div className="rounded-lg border border-leaf/20 bg-leaf/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-ink">已套用群組</p>
                      <p className="text-xs font-bold text-steel">商品只保存調味選項 ID，群組內容會跟著調味選項設定同步。</p>
                    </div>
                    <button type="button" onClick={() => setSharedPickerOpen(true)} className="rounded-lg bg-white px-3 py-2 text-sm font-black text-leaf ring-1 ring-leaf/30">+ 套用調味選項</button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {sharedRefs.map((group) => {
                      const shared = sharedGroups.find((item) => item.id === sharedRefId(group));
                      const index = optionGroups.findIndex((item) => item.id === group.id);
                      return (
                        <AppliedSharedGroupCard
                          key={group.id}
                          groupRef={group}
                          sharedGroup={shared}
                          canMoveUp={index > 0}
                          canMoveDown={index >= 0 && index < optionGroups.length - 1}
                          onMove={(direction) => moveOptionGroup(group.id, direction)}
                          onRemove={() => removeOptionGroup(group.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {optionGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 p-6 text-center">
                  <p className="font-black text-ink">尚未設定選項群組</p>
                  <p className="mt-1 text-sm font-bold text-steel">可以新增商品專屬群組，或直接套用甜度、冰塊、加料等調味選項。</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={addOptionGroup} className="rounded-lg bg-ink px-5 py-3 font-black text-white">新增商品專屬群組</button>
                    <button type="button" onClick={() => setSharedPickerOpen(true)} className="rounded-lg border border-leaf bg-white px-5 py-3 font-black text-leaf">套用調味選項</button>
                  </div>
                </div>
              ) : optionGroups.map((group) => (
                <OptionGroupEditor
                  key={group.id}
                  group={group}
                  depth={0}
                  isShared={isSharedGroupRef(group)}
                  sharedGroups={sharedGroups}
                  addChildGroup={addChildGroup}
                  addGroupOption={addGroupOption}
                  removeGroupOption={removeGroupOption}
                  removeOptionGroup={removeOptionGroup}
                  updateGroupOption={updateGroupOption}
                  updateOptionGroup={updateOptionGroup}
                />
              ))}
            </div>
          </section>
        </div>
      </section>

      {sharedPickerOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4">
          <div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-ink">套用調味選項</h3>
                <p className="mt-1 text-sm font-bold text-steel">勾選後直接加入商品，商品只會保存調味選項 ID。</p>
              </div>
              <button type="button" onClick={() => setSharedPickerOpen(false)} className="rounded-lg p-2 text-steel hover:bg-orange-50">
                <X className="size-5" />
              </button>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2">
              <Search className="size-4 text-steel" />
              <input value={sharedSearch} onChange={(event) => setSharedSearch(event.target.value)} placeholder="搜尋甜度、冰塊、加料、套餐..." className="min-w-0 flex-1 bg-transparent py-1 font-bold text-ink outline-none" />
            </label>
            <div className="mt-4 grid gap-2">
              {filteredSharedGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-orange-200 p-5 text-center text-sm font-bold text-steel">目前沒有可套用的調味選項，請先到「調味選項庫」建立。</div>
              ) : filteredSharedGroups.map((group) => {
                const alreadyApplied = appliedSharedIds.has(group.id);
                const selected = selectedSharedIds.includes(group.id);
                return (
                  <button key={group.id} type="button" disabled={alreadyApplied} onClick={() => setSelectedSharedIds((current) => selected ? current.filter((id) => id !== group.id) : [...current, group.id])} className={`rounded-lg border p-3 text-left transition ${alreadyApplied ? "border-stone-200 bg-stone-100 text-stone-400" : selected ? "border-leaf bg-leaf/10 text-ink" : "border-orange-100 bg-white hover:border-leaf"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{group.name}</p>
                        <p className="mt-1 text-xs font-bold text-steel">{group.required ? "必選" : "非必選"} / 最少 {group.minSelect} / 最多 {group.maxSelect} / {group.options.length} 個選項</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${alreadyApplied ? "bg-stone-200 text-stone-500" : selected ? "bg-leaf text-white" : "bg-orange-50 text-steel"}`}>{alreadyApplied ? "已套用" : selected ? "已勾選" : "可套用"}</span>
                    </div>
                    {group.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {group.options.slice(0, 8).map((option) => (
                          <span key={option.id} className="rounded bg-orange-50 px-2 py-1 text-xs font-bold text-steel">{option.name}{option.priceDelta ? ` +${option.priceDelta}` : ""}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSharedPickerOpen(false)} className="rounded-lg border border-orange-200 px-4 py-3 font-black text-steel">取消</button>
              <button type="button" onClick={() => { applySharedGroups(selectedSharedIds); setSharedPickerOpen(false); setSelectedSharedIds([]); }} disabled={selectedSharedIds.length === 0} className="rounded-lg bg-leaf px-5 py-3 font-black text-white disabled:bg-stone-300">
                套用 {selectedSharedIds.length} 個群組
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isSharedGroupRef(group: ProductOptionGroup) {
  return group.sourceType === "shared" || Boolean(group.groupId || group.sharedGroupId);
}

function sharedRefId(group: ProductOptionGroup) {
  return group.groupId ?? group.sharedGroupId ?? group.id.replace(/^shared-/, "");
}

function normalizeProductForm(product: Product): Product {
  return {
    ...product,
    optionGroups: normalizeOptionGroups(product.optionGroups)
  };
}

function normalizeOptionGroups(value: Product["optionGroups"] | Record<string, ProductOptionGroup> | null | undefined): ProductOptionGroup[] {
  if (!value) return [];
  const groups = Array.isArray(value) ? value : Object.values(value);
  return groups.map((group, index) => normalizeOptionGroup(group, index));
}

function normalizeOptionGroup(group: ProductOptionGroup, index: number): ProductOptionGroup {
  const name = group.groupName ?? group.name ?? "未命名群組";
  return {
    ...group,
    id: group.id || `group-${index}`,
    name,
    groupName: name,
    required: group.required ?? false,
    minSelect: group.minSelect ?? 0,
    maxSelect: group.maxSelect ?? 1,
    type: group.type ?? ((group.maxSelect ?? 1) > 1 ? "multiple" : "single"),
    children: normalizeOptionGroups(group.children),
    options: (group.options ?? []).map((option, optionIndex) => ({
      ...option,
      id: option.id || `option-${index}-${optionIndex}`,
      name: option.optionName ?? option.name ?? "未命名選項",
      optionName: option.optionName ?? option.name ?? "未命名選項",
      priceDelta: Number(option.priceDelta ?? 0),
      sortOrder: option.sortOrder ?? optionIndex,
      isAvailable: option.isAvailable ?? true,
      children: normalizeOptionGroups(option.children),
      childGroupIds: option.childGroupIds ?? [],
      nextGroupIds: option.nextGroupIds ?? []
    }))
  };
}

function AppliedSharedGroupCard({ groupRef, sharedGroup, canMoveUp, canMoveDown, onMove, onRemove }: {
  groupRef: ProductOptionGroup;
  sharedGroup?: SharedOptionGroup;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const groupName = sharedGroup?.name ?? groupRef.name ?? "調味選項";
  const options = sharedGroup?.options ?? [];

  return (
    <div className="rounded-lg border border-leaf/20 bg-white">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button type="button" onClick={() => setExpanded((prev) => !prev)} className="flex flex-1 items-center gap-2 text-left">
          {expanded ? <ChevronDown className="size-4 text-steel" /> : <ChevronRight className="size-4 text-steel" />}
          <span className="rounded-lg bg-leaf px-3 py-1 text-sm font-black text-white">{groupName}</span>
          <span className="text-xs font-bold text-steel">{options.length} 個選項</span>
          <span className="rounded bg-leaf/10 px-2 py-0.5 text-xs font-black text-leaf">調味選項</span>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!canMoveUp} onClick={() => onMove(-1)} className="rounded border border-orange-100 px-2 py-1 text-xs font-black text-steel disabled:opacity-40">上移</button>
          <button type="button" disabled={!canMoveDown} onClick={() => onMove(1)} className="rounded border border-orange-100 px-2 py-1 text-xs font-black text-steel disabled:opacity-40">下移</button>
          <button type="button" onClick={onRemove} className="rounded bg-red-50 px-2 py-1 text-xs font-black text-tomato">移除</button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-orange-100 p-3">
          {!sharedGroup ? (
            <p className="text-sm font-bold text-tomato">找不到此調味選項，請移除後重新套用。</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => (
                <span key={option.id} className="rounded bg-orange-50 px-2 py-1 text-xs font-bold text-ink">{option.name}{option.priceDelta ? ` +${option.priceDelta}` : ""}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OptionGroupEditor({
  group,
  depth,
  isShared,
  sharedGroups,
  addChildGroup,
  addGroupOption,
  removeGroupOption,
  removeOptionGroup,
  updateGroupOption,
  updateOptionGroup
}: {
  group: ProductOptionGroup;
  depth: number;
  isShared: boolean;
  sharedGroups: SharedOptionGroup[];
  addChildGroup: (groupId: string, optionId: string) => void;
  addGroupOption: (groupId: string) => void;
  removeGroupOption: (groupId: string, optionId: string) => void;
  removeOptionGroup: (groupId: string) => void;
  updateGroupOption: (groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) => void;
  updateOptionGroup: (groupId: string, patch: Partial<ProductOptionGroup>) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const linkedGroupCount = (group.options ?? []).reduce((sum, opt) => sum + (opt.childGroupIds?.length ?? 0), 0);

  return (
    <div className={`rounded-lg border ${depth === 0 ? "border-orange-200 bg-orange-50" : "border-orange-100 bg-white"}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setExpanded((prev) => !prev)} className="flex flex-1 items-center gap-2 text-left">
          {expanded ? <ChevronDown className="size-4 shrink-0 text-steel" /> : <ChevronRight className="size-4 shrink-0 text-steel" />}
          <span className="font-black text-ink">{(group.groupName ?? group.name) || "未命名群組"}</span>
          <span className="text-xs font-bold text-steel">{group.required ? "必選" : "選填"} / {group.maxSelect <= 1 ? "單選" : `最多 ${group.maxSelect} 項`} / {(group.options ?? []).length} 個選項</span>
          {isShared && <span className="rounded bg-leaf/15 px-1.5 py-0.5 text-xs font-black text-leaf">調味選項</span>}
          {!isShared && depth === 0 && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-black text-steel">商品群組</span>}
          {linkedGroupCount > 0 && <span className="flex items-center gap-0.5 rounded bg-leaf/10 px-1.5 py-0.5 text-xs font-bold text-leaf"><Link2 className="size-3" />{linkedGroupCount} 調味選項</span>}
        </button>
        <button type="button" onClick={() => removeOptionGroup(group.id)} className="shrink-0 rounded px-2 py-1 text-xs font-black text-tomato hover:bg-red-50">刪除群組</button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-orange-100 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <LabeledInput label="群組名稱" value={group.groupName ?? group.name} onChange={(value) => updateOptionGroup(group.id, { name: value, groupName: value })} />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-3 py-2.5 text-sm font-black text-steel">
              <input type="checkbox" checked={group.required} onChange={(event) => updateOptionGroup(group.id, { required: event.target.checked, minSelect: event.target.checked ? Math.max(1, group.minSelect) : 0 })} />
              必選
            </label>
            <label className="grid gap-1 text-sm font-black text-steel">
              選擇方式
              <select value={group.type ?? (group.maxSelect > 1 ? "multiple" : "single")} onChange={(event) => updateOptionGroup(group.id, { type: event.target.value as ProductOptionGroup["type"], maxSelect: event.target.value === "single" ? 1 : Math.max(2, group.maxSelect) })} className="rounded-lg border border-orange-100 bg-white px-3 py-3 font-bold text-ink">
                <option value="single">單選</option>
                <option value="multiple">複選</option>
              </select>
            </label>
            <LabeledInput label="最少選擇" type="number" value={String(group.minSelect)} onChange={(value) => updateOptionGroup(group.id, { minSelect: Math.max(0, Number(value)) })} />
            <LabeledInput label="最多選擇" type="number" value={String(group.maxSelect)} onChange={(value) => updateOptionGroup(group.id, { maxSelect: Math.max(1, Number(value)) })} />
          </div>

          <div className="grid gap-2">
            {(group.options ?? []).map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                groupId={group.id}
                depth={depth}
                isShared={isShared}
                sharedGroups={sharedGroups}
                addChildGroup={addChildGroup}
                addGroupOption={addGroupOption}
                removeGroupOption={removeGroupOption}
                removeOptionGroup={removeOptionGroup}
                updateGroupOption={updateGroupOption}
                updateOptionGroup={updateOptionGroup}
              />
            ))}
          </div>

          <button type="button" onClick={() => addGroupOption(group.id)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-orange-200 bg-white py-2 text-sm font-black text-steel hover:border-leaf hover:text-leaf">
            <Plus className="size-3.5" />
            新增選項
          </button>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  option,
  groupId,
  depth,
  isShared,
  sharedGroups,
  addChildGroup,
  addGroupOption,
  removeGroupOption,
  removeOptionGroup,
  updateGroupOption,
  updateOptionGroup
}: {
  option: ProductOptionChoice;
  groupId: string;
  depth: number;
  isShared: boolean;
  sharedGroups: SharedOptionGroup[];
  addChildGroup: (groupId: string, optionId: string) => void;
  addGroupOption: (groupId: string) => void;
  removeGroupOption: (groupId: string, optionId: string) => void;
  removeOptionGroup: (groupId: string) => void;
  updateGroupOption: (groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) => void;
  updateOptionGroup: (groupId: string, patch: Partial<ProductOptionGroup>) => void;
}) {
  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const linkedIds = option.childGroupIds ?? [];
  const childGroups = option.children ?? [];
  const linkedNames = sharedGroups.filter((sg) => linkedIds.includes(sg.id)).map((sg) => sg.name);

  return (
    <div className="rounded-lg border border-orange-100 bg-white">
      <div className="flex flex-wrap items-center gap-1.5 p-2">
        <input type="text" value={option.optionName ?? option.name} onChange={(event) => updateGroupOption(groupId, option.id, { name: event.target.value, optionName: event.target.value })} placeholder="選項名稱" className="min-w-[100px] flex-1 rounded border border-orange-100 px-2 py-1.5 text-sm font-bold text-ink" />
        <div className="flex items-center gap-1">
          <span className="text-xs font-black text-steel">+$</span>
          <input type="number" value={option.priceDelta} onChange={(event) => updateGroupOption(groupId, option.id, { priceDelta: Number(event.target.value) })} className="w-16 rounded border border-orange-100 px-2 py-1.5 text-sm font-bold text-ink" />
        </div>
        <label className="flex items-center gap-1 text-xs font-black text-steel">
          <input type="checkbox" checked={option.isAvailable} onChange={(event) => updateGroupOption(groupId, option.id, { isAvailable: event.target.checked })} className="size-3.5" />
          可用
        </label>

        {linkedNames.length > 0 && (
          <div className="flex items-center gap-1">
            <Link2 className="size-3 text-leaf" />
            {linkedNames.map((name) => <span key={name} className="rounded bg-leaf/10 px-1 py-0.5 text-xs font-bold text-leaf">{name}</span>)}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {childGroups.length > 0 && (
            <button type="button" onClick={() => setChildrenExpanded((prev) => !prev)} className="flex items-center gap-0.5 rounded px-2 py-1 text-xs font-black text-steel hover:bg-orange-50">
              {childGroups.length} 子群組
              {childrenExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          )}
          {!isShared && depth < 3 && (
            <button type="button" onClick={() => { addChildGroup(groupId, option.id); setChildrenExpanded(true); }} className="rounded px-2 py-1 text-xs font-black text-steel hover:bg-orange-50" title="新增此選項的下一層子群組">+子群組</button>
          )}
          {depth >= 3 && !isShared && <span className="rounded bg-orange-50 px-2 py-1 text-xs font-black text-amber-700">最多 4 層</span>}
          <button type="button" onClick={() => removeGroupOption(groupId, option.id)} className="rounded px-2 py-1 text-xs font-black text-tomato hover:bg-red-50">刪除</button>
        </div>
      </div>

      {sharedGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-orange-50 px-2 py-1.5">
          <span className="shrink-0 text-xs font-black text-steel">下一層調味選項：</span>
          {sharedGroups.map((sg) => {
            const linked = linkedIds.includes(sg.id);
            return (
              <button key={sg.id} type="button" onClick={() => updateGroupOption(groupId, option.id, { childGroupIds: linked ? linkedIds.filter((id) => id !== sg.id) : [...linkedIds, sg.id] })} className={`rounded px-2 py-0.5 text-xs font-black transition ${linked ? "bg-leaf text-white" : "bg-orange-50 text-steel hover:bg-orange-100"}`} title={linked ? "點擊移除此條件調味選項" : "點擊加入此條件調味選項"}>
                {linked ? "移除 " : "+ "}{sg.name}
              </button>
            );
          })}
        </div>
      )}

      {childrenExpanded && childGroups.length > 0 && (
        <div className="space-y-2 border-t border-orange-100 py-2 pl-4 pr-2">
          {childGroups.map((child) => (
            <OptionGroupEditor key={child.id} group={child} depth={depth + 1} isShared={false} sharedGroups={sharedGroups} addChildGroup={addChildGroup} addGroupOption={addGroupOption} removeGroupOption={removeGroupOption} removeOptionGroup={removeOptionGroup} updateGroupOption={updateGroupOption} updateOptionGroup={updateOptionGroup} />
          ))}
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-black text-steel">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" />
    </label>
  );
}

function newClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultNextMonthDatetimeLocal() {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return toDatetimeLocal(next);
}

function toDatetimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function isoToDatetimeLocal(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value.slice(0, 16);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDatetimeLocal(parsed);
}

function datetimeLocalToTaipeiIso(value: string) {
  if (!value) return "";
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}+08:00`;
}

function numberOrUndefined(value: string) {
  if (value.trim() === "") return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}
