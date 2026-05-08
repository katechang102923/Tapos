"use client";

import { Plus } from "lucide-react";
import type { Category, Product, ProductOptionChoice, ProductOptionGroup } from "@/lib/types";
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
                <p className="mt-1 text-sm font-bold text-steel">可設定調味、升級套餐、套餐飲料、點心與加料。選項底下可以繼續新增子群組。</p>
              </div>
              <button onClick={addOptionGroup} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white">
                <Plus className="size-4" />
                新增選項群組
              </button>
            </div>

            <div className="mt-4 grid gap-4">
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

function OptionGroupEditor({
  group,
  depth,
  addChildGroup,
  addGroupOption,
  removeGroupOption,
  removeOptionGroup,
  updateGroupOption,
  updateOptionGroup
}: {
  group: ProductOptionGroup;
  depth: number;
  addChildGroup: (groupId: string, optionId: string) => void;
  addGroupOption: (groupId: string) => void;
  removeGroupOption: (groupId: string, optionId: string) => void;
  removeOptionGroup: (groupId: string) => void;
  updateGroupOption: (groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) => void;
  updateOptionGroup: (groupId: string, patch: Partial<ProductOptionGroup>) => void;
}) {
  return (
    <section className={`rounded-lg p-3 ${depth === 0 ? "bg-orange-50" : "bg-white ring-1 ring-orange-100"}`}>
      <div className="grid gap-2">
        <p className="font-mono text-xs font-bold text-steel">群組 ID：{group.id}</p>
        <LabeledInput label="選項群組名稱" value={group.groupName ?? group.name} onChange={(value) => updateOptionGroup(group.id, { name: value, groupName: value })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-3 text-sm font-black text-steel">
            <input type="checkbox" checked={group.required} onChange={(event) => updateOptionGroup(group.id, { required: event.target.checked, minSelect: event.target.checked ? Math.max(1, group.minSelect) : 0 })} />
            必選
          </label>
          <LabeledInput label="最少可選" type="number" value={String(group.minSelect)} onChange={(value) => updateOptionGroup(group.id, { minSelect: Math.max(0, Number(value)) })} />
          <LabeledInput label="最多可選" type="number" value={String(group.maxSelect)} onChange={(value) => updateOptionGroup(group.id, { maxSelect: Math.max(1, Number(value)) })} />
        </div>
        <button onClick={() => addGroupOption(group.id)} className="rounded-lg border border-orange-200 bg-white px-3 py-2 font-black text-steel">新增選項</button>
      </div>
      <div className="mt-3 grid gap-2">
        {group.options.map((option) => (
          <div key={option.id} className="rounded-lg bg-white p-3 ring-1 ring-orange-100">
            <div className="grid gap-2">
              <LabeledInput label="選項名稱" value={option.optionName ?? option.name} onChange={(value) => updateGroupOption(group.id, option.id, { name: value, optionName: value })} />
              <LabeledInput label="加價金額" type="number" value={String(option.priceDelta)} onChange={(value) => updateGroupOption(group.id, option.id, { priceDelta: Number(value) })} />
              <label className="flex items-center gap-2 text-sm font-black text-steel">
                <input type="checkbox" checked={option.isAvailable} onChange={(event) => updateGroupOption(group.id, option.id, { isAvailable: event.target.checked })} />
                選項可用
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => addChildGroup(group.id, option.id)} className="rounded-lg border border-orange-200 bg-white px-3 py-2 font-black text-steel">新增子選項群組</button>
                <button onClick={() => removeGroupOption(group.id, option.id)} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">刪除選項</button>
              </div>
            </div>
            {(option.children ?? []).length > 0 && (
              <div className="mt-3 grid gap-3 border-l-4 border-leaf pl-3">
                {(option.children ?? []).map((child) => (
                  <OptionGroupEditor
                    key={child.id}
                    group={child}
                    depth={depth + 1}
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
        ))}
      </div>
      <button onClick={() => removeOptionGroup(group.id)} className="mt-3 rounded-lg bg-tomato px-3 py-2 font-black text-white">刪除群組</button>
    </section>
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
