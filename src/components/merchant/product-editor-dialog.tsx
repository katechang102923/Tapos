"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Link2, Plus } from "lucide-react";
import type { Category, Product, ProductOptionChoice, ProductOptionGroup, SharedOptionGroup } from "@/lib/types";
import { discountLabel, productFinalPrice } from "@/lib/pricing";

export function ProductEditorDialog({
  addChildGroup,
  addGroupOption,
  addOptionGroup,
  categories,
  editingProduct,
  imagePresets,
  removeEditingProduct,
  removeGroupOption,
  removeOptionGroup,
  saveProduct,
  setEditingProduct,
  setProductEditorOpen,
  sharedGroups = [],
  updateGroupOption,
  updateOptionGroup
}: {
  addChildGroup: (groupId: string, optionId: string) => void;
  addGroupOption: (groupId: string) => void;
  addOptionGroup: () => void;
  categories: Category[];
  editingProduct: Product;
  imagePresets: string[];
  removeEditingProduct: () => void;
  removeGroupOption: (groupId: string, optionId: string) => void;
  removeOptionGroup: (groupId: string) => void;
  saveProduct: () => void;
  setEditingProduct: React.Dispatch<React.SetStateAction<Product>>;
  setProductEditorOpen: (open: boolean) => void;
  sharedGroups?: SharedOptionGroup[];
  updateGroupOption: (groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) => void;
  updateOptionGroup: (groupId: string, patch: Partial<ProductOptionGroup>) => void;
}) {
  const optionGroups = editingProduct.optionGroups ?? [];
  const isNewProduct = editingProduct.id === "new-product";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-3 sm:p-5">
      <section className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-[#fff7e8] shadow-2xl sm:min-h-[calc(100vh-40px)]">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-orange-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-leaf">商品編輯</p>
            <h2 className="text-2xl font-black text-ink sm:text-3xl">{isNewProduct ? "新增商品" : editingProduct.name || "編輯商品"}</h2>
            <p className="mt-1 text-sm font-bold text-steel">設定基本資料、價格、上架狀態與多層套餐選項。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setProductEditorOpen(false)} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">關閉</button>
            {!isNewProduct && <button onClick={removeEditingProduct} className="rounded-lg bg-tomato px-4 py-3 font-black text-white">刪除商品</button>}
            <button onClick={saveProduct} className="rounded-lg bg-ink px-5 py-3 font-black text-white">儲存商品</button>
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
                <LabeledInput label="成本 / 原價" type="number" value={String(editingProduct.originalPrice ?? editingProduct.price ?? 0)} onChange={(value) => setEditingProduct((current) => ({ ...current, originalPrice: Number(value) }))} />
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
                <LabeledInput label={(editingProduct.discountType ?? "none") === "percent" ? "折數（例：9 折請填 90，85 折請填 85）" : (editingProduct.discountType ?? "none") === "amount" ? "折扣金額" : (editingProduct.discountType ?? "none") === "specialPrice" ? "特價價" : "折扣值"} type="number" value={String(editingProduct.discountValue ?? 0)} onChange={(value) => setEditingProduct((current) => ({ ...current, discountValue: Number(value) }))} />
                <div className="rounded-lg bg-orange-50 px-3 py-3 text-sm font-black text-steel">
                  折扣後單價：<span className="text-tomato">${productFinalPrice(editingProduct)}</span>
                  {discountLabel(editingProduct.discountType, editingProduct.discountValue) && <span className="ml-2 text-tomato">{discountLabel(editingProduct.discountType, editingProduct.discountValue)}</span>}
                </div>
                <label className="grid gap-1 text-sm font-black text-steel">
                  分類
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
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <img src={editingProduct.imageUrl} alt={editingProduct.name || "商品圖片預覽"} className="size-24 rounded-lg object-cover ring-1 ring-orange-100" />
                <div>
                  <h3 className="text-xl font-black">圖片預覽</h3>
                  <p className="mt-1 text-sm font-bold text-steel">可以貼上圖片 URL，或選擇下方常用圖片。</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {imagePresets.map((url) => (
                  <button key={url} onClick={() => setEditingProduct((current) => ({ ...current, imageUrl: url }))} className="overflow-hidden rounded-lg ring-2 ring-transparent transition hover:ring-leaf">
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
                <p className="mt-1 text-sm font-bold text-steel">可設定調味、升級套餐、套餐飲料、點心與加料。選項底下可繼續新增子群組或連結共用群組。</p>
              </div>
              <button onClick={addOptionGroup} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white">
                <Plus className="size-4" />
                新增選項群組
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {optionGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 p-6 text-center">
                  <p className="font-black text-ink">尚未建立選項群組</p>
                  <p className="mt-1 text-sm font-bold text-steel">例如：調味、升級套餐、套餐飲料、加料。</p>
                  <button onClick={addOptionGroup} className="mt-4 rounded-lg bg-ink px-5 py-3 font-black text-white">新增第一個群組</button>
                </div>
              ) : optionGroups.map((group) => (
                <OptionGroupEditor
                  key={group.id}
                  group={group}
                  depth={0}
                  isShared={false}
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
  const linkedGroupCount = group.options.reduce((sum, opt) => sum + (opt.childGroupIds?.length ?? 0), 0);

  return (
    <div className={`rounded-lg border ${depth === 0 ? "border-orange-200 bg-orange-50" : "border-orange-100 bg-white"}`}>
      {/* Collapsible header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {expanded ? <ChevronDown className="size-4 shrink-0 text-steel" /> : <ChevronRight className="size-4 shrink-0 text-steel" />}
          <span className="font-black text-ink">{(group.groupName ?? group.name) || "（未命名群組）"}</span>
          <span className="text-xs font-bold text-steel">
            {group.required ? "必選" : "選填"} · {group.maxSelect <= 1 ? "單選" : `最多 ${group.maxSelect}`} · {group.options.length} 項
          </span>
          {isShared && (
            <span className="rounded bg-leaf/15 px-1.5 py-0.5 text-xs font-black text-leaf">共用群組</span>
          )}
          {!isShared && depth === 0 && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-black text-steel">商品群組</span>
          )}
          {linkedGroupCount > 0 && (
            <span className="flex items-center gap-0.5 rounded bg-leaf/10 px-1.5 py-0.5 text-xs font-bold text-leaf">
              <Link2 className="size-3" />{linkedGroupCount} 共用
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => removeOptionGroup(group.id)}
          className="shrink-0 rounded px-2 py-1 text-xs font-black text-tomato hover:bg-red-50"
        >
          刪除群組
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-orange-100 p-3">
          {/* Group settings */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <LabeledInput label="選項群組名稱" value={group.groupName ?? group.name} onChange={(value) => updateOptionGroup(group.id, { name: value, groupName: value })} />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-3 py-2.5 text-sm font-black text-steel">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(event) => updateOptionGroup(group.id, { required: event.target.checked, minSelect: event.target.checked ? Math.max(1, group.minSelect) : 0 })}
              />
              必選
            </label>
            <LabeledInput label="最少可選" type="number" value={String(group.minSelect)} onChange={(value) => updateOptionGroup(group.id, { minSelect: Math.max(0, Number(value)) })} />
            <LabeledInput label="最多可選" type="number" value={String(group.maxSelect)} onChange={(value) => updateOptionGroup(group.id, { maxSelect: Math.max(1, Number(value)) })} />
          </div>

          {/* Option rows */}
          <div className="grid gap-2">
            {group.options.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                groupId={group.id}
                depth={depth}
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

          <button
            type="button"
            onClick={() => addGroupOption(group.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-orange-200 bg-white py-2 text-sm font-black text-steel hover:border-leaf hover:text-leaf"
          >
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
      {/* Compact controls row */}
      <div className="flex flex-wrap items-center gap-1.5 p-2">
        <input
          type="text"
          value={option.optionName ?? option.name}
          onChange={(event) => updateGroupOption(groupId, option.id, { name: event.target.value, optionName: event.target.value })}
          placeholder="選項名稱"
          className="min-w-[100px] flex-1 rounded border border-orange-100 px-2 py-1.5 text-sm font-bold text-ink"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs font-black text-steel">+$</span>
          <input
            type="number"
            value={option.priceDelta}
            onChange={(event) => updateGroupOption(groupId, option.id, { priceDelta: Number(event.target.value) })}
            className="w-16 rounded border border-orange-100 px-2 py-1.5 text-sm font-bold text-ink"
          />
        </div>
        <label className="flex items-center gap-1 text-xs font-black text-steel">
          <input
            type="checkbox"
            checked={option.isAvailable}
            onChange={(event) => updateGroupOption(groupId, option.id, { isAvailable: event.target.checked })}
            className="size-3.5"
          />
          可用
        </label>

        {/* Quick preview of linked shared groups */}
        {linkedNames.length > 0 && (
          <div className="flex items-center gap-1">
            <Link2 className="size-3 text-leaf" />
            {linkedNames.map((name) => (
              <span key={name} className="rounded bg-leaf/10 px-1 py-0.5 text-xs font-bold text-leaf">{name}</span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {childGroups.length > 0 && (
            <button
              type="button"
              onClick={() => setChildrenExpanded((prev) => !prev)}
              className="flex items-center gap-0.5 rounded px-2 py-1 text-xs font-black text-steel hover:bg-orange-50"
            >
              {childGroups.length} 子群組
              {childrenExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          )}
          {depth < 3 && (
            <button
              type="button"
              onClick={() => { addChildGroup(groupId, option.id); setChildrenExpanded(true); }}
              className="rounded px-2 py-1 text-xs font-black text-steel hover:bg-orange-50"
              title="新增商品專屬子群組"
            >
              +子群組
            </button>
          )}
          <button
            type="button"
            onClick={() => removeGroupOption(groupId, option.id)}
            className="rounded px-2 py-1 text-xs font-black text-tomato hover:bg-red-50"
          >
            刪
          </button>
        </div>
      </div>

      {/* Shared group linking — dedicated row with clear label */}
      {sharedGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-orange-50 px-2 py-1.5">
          <span className="shrink-0 text-xs font-black text-steel">連結共用群組：</span>
          {sharedGroups.map((sg) => {
            const linked = linkedIds.includes(sg.id);
            return (
              <button
                key={sg.id}
                type="button"
                onClick={() => updateGroupOption(groupId, option.id, {
                  childGroupIds: linked ? linkedIds.filter((id) => id !== sg.id) : [...linkedIds, sg.id]
                })}
                className={`rounded px-2 py-0.5 text-xs font-black transition ${linked ? "bg-leaf text-white" : "bg-orange-50 text-steel hover:bg-orange-100"}`}
              >
                {linked ? "✓ " : "+ "}{sg.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Inline child groups (product-specific) */}
      {childrenExpanded && childGroups.length > 0 && (
        <div className="space-y-2 border-t border-orange-100 py-2 pl-4 pr-2">
          {childGroups.map((child) => (
            <OptionGroupEditor
              key={child.id}
              group={child}
              depth={depth + 1}
              isShared={false}
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
