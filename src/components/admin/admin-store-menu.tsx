"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Plus } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductEditorDialog } from "@/components/merchant/product-editor-dialog";
import { useDemoStore } from "@/lib/demo-store";
import { productFinalPrice } from "@/lib/pricing";
import type { Product, ProductOptionChoice, ProductOptionGroup } from "@/lib/types";

const blankProduct = (storeId: string, categoryId: string, sort: number): Product => ({
  id: "new-product",
  storeId,
  categoryId,
  name: "",
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  originalPrice: 70,
  price: 60,
  discountType: "none",
  discountValue: 0,
  isAvailable: true,
  isSoldOut: false,
  sort,
  options: [],
  optionGroups: []
});

const imagePresets = [
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80"
];

export function AdminStoreMenu({ storeId }: { storeId: string }) {
  return (
    <LoginGate allowedRoles={["admin"]} title="平台管理中心登入">
      {() => <AdminStoreMenuContent storeId={storeId} />}
    </LoginGate>
  );
}

function AdminStoreMenuContent({ storeId }: { storeId: string }) {
  const { db, deleteProduct, upsertProduct } = useDemoStore({ admin: true });
  const store = db.stores.find((s) => s.id === storeId);
  const categories = useMemo(() => db.categories.filter((c) => c.storeId === storeId).sort((a, b) => a.sort - b.sort), [db.categories, storeId]);
  const products = useMemo(() => db.products.filter((p) => p.storeId === storeId).sort((a, b) => a.sort - b.sort), [db.products, storeId]);

  const firstCategoryId = categories[0]?.id ?? "";
  const [editingProduct, setEditingProduct] = useState<Product>(() => blankProduct(storeId, firstCategoryId, 1));
  const [productEditorOpen, setProductEditorOpen] = useState(false);

  function startNewProduct() {
    setEditingProduct(blankProduct(storeId, firstCategoryId, products.length + 1));
    setProductEditorOpen(true);
  }

  function saveProduct() {
    if (!editingProduct.name.trim()) return;
    upsertProduct({
      ...editingProduct,
      id: editingProduct.id === "new-product" ? "" : editingProduct.id,
      storeId,
      price: Number(editingProduct.price),
      originalPrice: Number(editingProduct.originalPrice ?? editingProduct.price),
      discountType: editingProduct.discountType ?? "none",
      discountValue: Number(editingProduct.discountValue ?? 0),
      sort: Number(editingProduct.sort) || products.length + 1,
      categoryId: editingProduct.categoryId || firstCategoryId
    });
    setEditingProduct(blankProduct(storeId, firstCategoryId, products.length + 2));
    setProductEditorOpen(false);
  }

  function removeEditingProduct() {
    if (!editingProduct.id || editingProduct.id === "new-product") return;
    if (!window.confirm(`確定要刪除「${editingProduct.name}」嗎？`)) return;
    deleteProduct(editingProduct.id);
    startNewProduct();
  }

  // ── option group helpers (mirrors merchant/options logic) ─────────────────

  function makeOptionGroup(name = "新選項群組"): ProductOptionGroup {
    return { id: `grp-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name, required: false, minSelect: 0, maxSelect: 1, options: [] };
  }

  function makeOption(): ProductOptionChoice {
    return { id: `opt-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: "新選項", priceDelta: 0, isAvailable: true, children: [] };
  }

  function mapGroups(groups: ProductOptionGroup[], mapper: (g: ProductOptionGroup) => ProductOptionGroup | null): ProductOptionGroup[] {
    return groups.flatMap((g) => {
      const mapped = mapper(g);
      if (!mapped) return [];
      return [{ ...mapped, options: mapped.options.map((o) => ({ ...o, children: o.children ? mapGroups(o.children, mapper) : o.children })) }];
    });
  }

  function setOptionGroups(updater: (groups: ProductOptionGroup[]) => ProductOptionGroup[]) {
    setEditingProduct((cur) => ({ ...cur, optionGroups: updater(cur.optionGroups ?? []) }));
  }

  function addOptionGroup() {
    setEditingProduct((cur) => ({ ...cur, optionGroups: [...(cur.optionGroups ?? []), makeOptionGroup()] }));
  }

  function updateOptionGroup(groupId: string, patch: Partial<ProductOptionGroup>) {
    setOptionGroups((groups) => mapGroups(groups, (g) => g.id === groupId ? { ...g, ...patch } : g));
  }

  function removeOptionGroup(groupId: string) {
    setOptionGroups((groups) => mapGroups(groups, (g) => g.id === groupId ? null : g));
  }

  function addGroupOption(groupId: string) {
    setOptionGroups((groups) => mapGroups(groups, (g) => g.id === groupId ? { ...g, options: [...g.options, makeOption()] } : g));
  }

  function updateGroupOption(groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) {
    setOptionGroups((groups) => mapGroups(groups, (g) => {
      if (g.id !== groupId) return g;
      return { ...g, options: g.options.map((o) => o.id === optionId ? { ...o, ...patch } : o) };
    }));
  }

  function removeGroupOption(groupId: string, optionId: string) {
    setOptionGroups((groups) => mapGroups(groups, (g) => {
      if (g.id !== groupId) return g;
      return { ...g, options: g.options.filter((o) => o.id !== optionId) };
    }));
  }

  function addChildGroup(groupId: string, optionId: string) {
    setOptionGroups((groups) => mapGroups(groups, (g) => {
      if (g.id !== groupId) return g;
      return { ...g, options: g.options.map((o) => o.id === optionId ? { ...o, children: [...(o.children ?? []), makeOptionGroup("子選項群組")] } : o) };
    }));
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 sm:p-6">
      <header className="mb-5 rounded-lg bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">平台管理中心</p>
            <h1 className="mt-1 text-3xl font-black text-ink">菜單管理：{store?.name ?? storeId}</h1>
            <p className="mt-1 text-sm font-bold text-steel">可管理商品、分類、選項群組、調味、加料、套餐細項。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={startNewProduct} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
              <Plus className="size-4" />新增商品
            </button>
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-3 font-black text-steel">
              <ArrowLeft className="size-4" />回多店家管理
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        {products.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-8 text-center font-bold text-steel">目前沒有商品，點「新增商品」開始建立。</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => { setEditingProduct({ ...product, optionGroups: product.optionGroups ?? [] }); setProductEditorOpen(true); }}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${editingProduct.id === product.id ? "border-leaf bg-leaf/10 ring-2 ring-leaf" : "border-stone-200 bg-stone-50 hover:bg-stone-100"}`}
              >
                <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-ink">{product.name}</p>
                  <p className="font-bold text-tomato">${productFinalPrice(product)}</p>
                  <p className="text-xs font-bold text-steel">{product.optionGroups?.length ?? 0} 個選項群組</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false }); }}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-amber-100 text-amber-700"}`}
                >
                  {product.isAvailable ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

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
          updateGroupOption={updateGroupOption}
          updateOptionGroup={updateOptionGroup}
        />
      )}
    </main>
  );
}
