"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductEditorDialog } from "@/components/merchant/product-editor-dialog";
import { useDemoStore } from "@/lib/demo-store";
import { productFinalPrice } from "@/lib/pricing";
import { defaultStoreId } from "@/lib/store-access";
import type { Product, ProductOptionChoice, ProductOptionGroup, SharedOptionGroup } from "@/lib/types";

const blankProduct: Product = {
  id: "new-product",
  storeId: "",
  categoryId: "cat-burger",
  name: "",
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  originalPrice: 70,
  price: 60,
  discountType: "none",
  discountValue: 0,
  isAvailable: true,
  isSoldOut: false,
  sort: 99,
  options: [],
  optionGroups: []
};

const imagePresets = [
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80"
];

export default function MerchantOptionsPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="商品選項管理登入">
      {({ profile }) => <MerchantOptionsContent storeId={defaultStoreId(profile)} />}
    </LoginGate>
  );
}

function MerchantOptionsContent({ storeId }: { storeId: string }) {
  const { db, deleteProduct, upsertProduct, upsertSharedOptionGroup, deleteSharedOptionGroup } = useDemoStore({ storeId, skipOrderList: true });
  const [editingProduct, setEditingProduct] = useState<Product>(blankProduct);
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [editingSharedGroup, setEditingSharedGroup] = useState<SharedOptionGroup | null>(null);
  const [sharedGroupPanelOpen, setSharedGroupPanelOpen] = useState(false);

  const store = db.stores.find((item) => item.id === storeId);
  const sharedGroups = useMemo(
    () => (db.sharedOptionGroups ?? []).filter((item) => item.storeId === storeId),
    [db.sharedOptionGroups, storeId]
  );
  const categories = useMemo(
    () => db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort),
    [db.categories, storeId]
  );
  const products = useMemo(
    () => db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort),
    [db.products, storeId]
  );

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">先建立店家</h1>
          <Link href="/onboarding" className="mt-4 inline-flex rounded-lg bg-leaf px-4 py-3 font-black text-white">開始建店</Link>
        </div>
      </main>
    );
  }

  function saveProduct() {
    if (!editingProduct.name.trim()) return;
    upsertProduct({
      ...editingProduct,
      id: editingProduct.id === "new-product" ? "" : editingProduct.id,
      storeId,
      price: Number(editingProduct.price),
      originalPrice: Number(editingProduct.originalPrice || editingProduct.price),
      discountType: editingProduct.discountType ?? "none",
      discountValue: Number(editingProduct.discountValue ?? 0),
      sort: Number(editingProduct.sort) || products.length + 1,
      categoryId: editingProduct.categoryId || categories[0]?.id || "cat-burger"
    });
    setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 2 });
    setProductEditorOpen(false);
  }

  function startNewProduct() {
    setEditingProduct({ ...blankProduct, id: "new-product", storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 1 });
    setProductEditorOpen(true);
  }

  function removeEditingProduct() {
    if (!editingProduct.id || editingProduct.id === "new-product") return;
    if (!window.confirm(`確定要刪除「${editingProduct.name}」嗎？`)) return;
    deleteProduct(editingProduct.id);
    startNewProduct();
  }

  function makeOptionGroup(name = "新選項群組"): ProductOptionGroup {
    return {
      id: `group-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name,
      required: false,
      minSelect: 0,
      maxSelect: 1,
      options: []
    };
  }

  function makeOption(): ProductOptionChoice {
    return { id: `option-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: "新選項", priceDelta: 0, isAvailable: true, children: [] };
  }

  function addOptionGroup() {
    setEditingProduct({ ...editingProduct, optionGroups: [...(editingProduct.optionGroups ?? []), makeOptionGroup()] });
  }

  function mapGroups(groups: ProductOptionGroup[], mapper: (group: ProductOptionGroup) => ProductOptionGroup | null): ProductOptionGroup[] {
    return groups.flatMap((group) => {
      const mapped = mapper(group);
      if (!mapped) return [];
      return [{
        ...mapped,
        options: mapped.options.map((option) => ({
          ...option,
          children: option.children ? mapGroups(option.children, mapper) : option.children
        }))
      }];
    });
  }

  function setOptionGroups(updater: (groups: ProductOptionGroup[]) => ProductOptionGroup[]) {
    setEditingProduct((current) => ({
      ...current,
      optionGroups: updater(current.optionGroups ?? [])
    }));
  }

  function updateOptionGroup(groupId: string, patch: Partial<ProductOptionGroup>) {
    setOptionGroups((groups) => mapGroups(groups, (group) => group.id === groupId ? { ...group, ...patch } : group));
  }

  function removeOptionGroup(groupId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => group.id === groupId ? null : group));
  }

  function addGroupOption(groupId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => group.id === groupId ? { ...group, options: [...group.options, makeOption()] } : group));
  }

  function updateGroupOption(groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) {
    setOptionGroups((groups) => mapGroups(groups, (group) => {
      if (group.id !== groupId) return group;
      return { ...group, options: group.options.map((option) => option.id === optionId ? { ...option, ...patch } : option) };
    }));
  }

  function removeGroupOption(groupId: string, optionId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => {
      if (group.id !== groupId) return group;
      return { ...group, options: group.options.filter((option) => option.id !== optionId) };
    }));
  }

  function makeSharedGroup(): SharedOptionGroup {
    const now = new Date().toISOString();
    return {
      id: `sg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: "新共用群組",
      required: false,
      minSelect: 0,
      maxSelect: 1,
      options: [],
      storeId,
      createdAt: now,
      updatedAt: now
    };
  }

  function saveSharedGroup() {
    if (!editingSharedGroup) return;
    upsertSharedOptionGroup({ ...editingSharedGroup, storeId });
    setEditingSharedGroup(null);
    setSharedGroupPanelOpen(false);
  }

  function addChildGroup(groupId: string, optionId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        options: group.options.map((option) => option.id === optionId ? { ...option, children: [...(option.children ?? []), makeOptionGroup("子選項群組")] } : option)
      };
    }));
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台</p>
            <h1 className="text-3xl font-black text-ink">{store?.name} · 商品選項管理</h1>
            <p className="mt-1 text-sm font-bold text-steel">為商品新增套餐、調味、飲料選項及多層加購選項。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink border border-orange-100">
            <ArrowLeft className="size-5" />
            回上一層
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-4">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-orange-100 pb-4 mb-4">
            <div>
              <h2 className="text-2xl font-black">商品選項設定</h2>
              <p className="mt-1 text-sm font-bold text-steel">選擇要編輯選項的商品。</p>
            </div>
            <button onClick={startNewProduct} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
              <Plus className="size-4" />
              新增商品
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} onClick={() => { setEditingProduct({ ...product, optionGroups: product.optionGroups ?? [] }); setProductEditorOpen(true); }} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition border ${editingProduct.id === product.id ? "bg-leaf/10 ring-2 ring-leaf border-leaf" : "bg-[#fffaf0] hover:bg-orange-50 border-orange-100"}`}>
                <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{product.name}</p>
                  <p className="font-bold text-tomato">${productFinalPrice(product)}</p>
                  {productFinalPrice(product) !== product.price && <p className="text-xs font-bold text-stone-400 line-through">${product.price}</p>}
                  <p className="text-xs font-bold text-steel">
                    {product.optionGroups?.length ?? 0} 個選項群組
                  </p>
                </div>
                <button onClick={(event) => { event.stopPropagation(); upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false }); }} className={`rounded-lg px-3 py-3 font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-amber-100 text-amber-700"}`}>{product.isAvailable ? "上架中" : "停售中"}</button>
                <button onClick={(event) => { event.stopPropagation(); setEditingProduct({ ...product, optionGroups: product.optionGroups ?? [] }); setProductEditorOpen(true); }} className="grid size-11 place-items-center rounded-lg bg-white border border-orange-100">{product.isAvailable ? <Eye className="size-5 text-leaf" /> : <EyeOff className="size-5 text-stone-400" />}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shared Option Groups Panel */}
      <section className="mx-auto max-w-7xl p-4 pt-0">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-orange-100 pb-4 mb-4">
            <div>
              <h2 className="text-2xl font-black">共用選項群組</h2>
              <p className="mt-1 text-sm font-bold text-steel">可跨商品共用的選項群組，例如冰塊、甜度。透過「連結共用群組」掛載到選項項目上。</p>
            </div>
            <button onClick={() => { setEditingSharedGroup(makeSharedGroup()); setSharedGroupPanelOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white">
              <Plus className="size-4" />
              新增共用群組
            </button>
          </div>
          {sharedGroups.length === 0 ? (
            <p className="text-sm font-bold text-steel py-4 text-center">尚無共用群組。點擊「新增共用群組」建立可跨商品共享的選項（如冰塊、甜度）。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sharedGroups.map((sg) => (
                <div key={sg.id} className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-black">{sg.name}</p>
                      <p className="text-xs font-bold text-steel">ID: {sg.id} · {sg.options.length} 個選項 · {sg.required ? "必選" : "非必選"}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingSharedGroup({ ...sg }); setSharedGroupPanelOpen(true); }} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-black text-steel">編輯</button>
                      <button onClick={() => { if (window.confirm(`確定刪除共用群組「${sg.name}」？`)) deleteSharedOptionGroup(sg.id); }} className="rounded-lg bg-tomato px-2 py-2 font-black text-white"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sg.options.map((opt) => <span key={opt.id} className="rounded bg-white px-2 py-1 text-xs font-bold text-ink">{opt.name}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {sharedGroupPanelOpen && editingSharedGroup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-ink mb-4">{editingSharedGroup.id && sharedGroups.some((sg) => sg.id === editingSharedGroup.id) ? "編輯共用群組" : "新增共用群組"}</h2>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm font-black text-steel">
                群組名稱
                <input value={editingSharedGroup.name} onChange={(e) => setEditingSharedGroup((g) => g ? { ...g, name: e.target.value } : g)} className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-orange-100 px-3 py-3 text-sm font-black text-steel">
                  <input type="checkbox" checked={editingSharedGroup.required} onChange={(e) => setEditingSharedGroup((g) => g ? { ...g, required: e.target.checked, minSelect: e.target.checked ? Math.max(1, g.minSelect) : 0 } : g)} />
                  必選
                </label>
                <label className="grid gap-1 text-sm font-black text-steel">
                  最多可選
                  <input type="number" value={editingSharedGroup.maxSelect} onChange={(e) => setEditingSharedGroup((g) => g ? { ...g, maxSelect: Math.max(1, Number(e.target.value)) } : g)} className="rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink" />
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black text-steel">選項</p>
                  <button onClick={() => setEditingSharedGroup((g) => g ? { ...g, options: [...g.options, { id: `sgo-${Date.now()}`, name: "新選項", priceDelta: 0, isAvailable: true }] } : g)} className="rounded border border-orange-200 px-3 py-1 text-sm font-black text-steel">新增選項</button>
                </div>
                <div className="grid gap-2">
                  {editingSharedGroup.options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
                      <input value={opt.name} onChange={(e) => setEditingSharedGroup((g) => g ? { ...g, options: g.options.map((o) => o.id === opt.id ? { ...o, name: e.target.value } : o) } : g)} className="flex-1 rounded border border-orange-100 px-2 py-1 text-sm font-bold" placeholder="選項名稱" />
                      <input type="number" value={opt.priceDelta} onChange={(e) => setEditingSharedGroup((g) => g ? { ...g, options: g.options.map((o) => o.id === opt.id ? { ...o, priceDelta: Number(e.target.value) } : o) } : g)} className="w-20 rounded border border-orange-100 px-2 py-1 text-sm font-bold" placeholder="加價" />
                      <button onClick={() => setEditingSharedGroup((g) => g ? { ...g, options: g.options.filter((o) => o.id !== opt.id) } : g)} className="rounded bg-tomato px-2 py-1 text-xs font-black text-white">刪</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setEditingSharedGroup(null); setSharedGroupPanelOpen(false); }} className="rounded-lg border border-orange-200 px-4 py-3 font-black text-steel">取消</button>
              <button onClick={saveSharedGroup} disabled={!editingSharedGroup.name.trim()} className="rounded-lg bg-leaf px-5 py-3 font-black text-white disabled:bg-stone-300">儲存</button>
            </div>
          </div>
        </div>
      )}

      {productEditorOpen && (
        <ProductEditorDialog
          addChildGroup={addChildGroup}
          addGroupOption={addGroupOption}
          addOptionGroup={addOptionGroup}
          categories={categories}
          editingProduct={editingProduct}
          imagePresets={imagePresets}
          removeEditingProduct={removeEditingProduct}
          removeGroupOption={removeGroupOption}
          removeOptionGroup={removeOptionGroup}
          saveProduct={saveProduct}
          setEditingProduct={setEditingProduct}
          setProductEditorOpen={setProductEditorOpen}
          sharedGroups={sharedGroups}
          updateGroupOption={updateGroupOption}
          updateOptionGroup={updateOptionGroup}
        />
      )}
    </main>
  );
}
