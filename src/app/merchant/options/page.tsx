"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Plus } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductEditorDialog } from "@/components/merchant/product-editor-dialog";
import { useDemoStore } from "@/lib/demo-store";
import { productFinalPrice } from "@/lib/pricing";
import { defaultStoreId } from "@/lib/store-access";
import type { Product, ProductOptionChoice, ProductOptionGroup } from "@/lib/types";

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
  const { db, deleteProduct, upsertProduct } = useDemoStore({ storeId, skipOrderList: true });
  const [editingProduct, setEditingProduct] = useState<Product>(blankProduct);
  const [productEditorOpen, setProductEditorOpen] = useState(false);

  const store = db.stores.find((item) => item.id === storeId);
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
