"use client";

import { useState } from "react";
import Link from "next/link";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import type { Product } from "@/lib/types";

const blankProduct: Product = {
  id: "",
  storeId: "",
  categoryId: "",
  name: "",
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  originalPrice: 70,
  price: 60,
  isAvailable: true,
  isSoldOut: false,
  sort: 99,
  options: []
};

export function AdminStoreMenu({ storeId }: { storeId: string }) {
  return (
    <LoginGate allowedRoles={["admin"]} title="平台管理中心登入">
      {() => <AdminStoreMenuContent storeId={storeId} />}
    </LoginGate>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-black text-steel">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-stone-300 px-4 py-3 font-bold text-ink" />
    </label>
  );
}

function AdminStoreMenuContent({ storeId }: { storeId: string }) {
  const { db, deleteProduct, upsertProduct } = useDemoStore({ admin: true });
  const store = db.stores.find((item) => item.id === storeId);
  const categories = db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const products = db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const [editingProduct, setEditingProduct] = useState<Product>({ ...blankProduct, storeId });

  function saveProduct() {
    if (!editingProduct.name.trim()) return;
    upsertProduct({
      ...editingProduct,
      storeId,
      categoryId: editingProduct.categoryId || categories[0]?.id || "",
      originalPrice: Number(editingProduct.originalPrice || editingProduct.price),
      price: Number(editingProduct.price),
      sort: Number(editingProduct.sort) || products.length + 1
    });
    setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id ?? "", sort: products.length + 2 });
  }

  function removeProduct(product: Product) {
    if (!window.confirm(`確定要刪除「${product.name}」嗎？`)) return;
    deleteProduct(product.id);
    if (editingProduct.id === product.id) setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id ?? "" });
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 sm:p-6">
      <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg bg-white p-5 shadow-soft">
          <p className="text-sm font-black text-leaf">平台管理中心</p>
          <h1 className="mt-2 text-3xl font-black text-ink">管理菜單：{store?.name ?? storeId}</h1>
          <div className="mt-5 grid gap-3">
            {products.length === 0 ? <p className="rounded-lg bg-stone-50 p-4 font-bold text-steel">目前沒有商品</p> : products.map((product) => (
              <div key={product.id} className="grid gap-3 rounded-lg bg-[#fffaf0] p-3 md:grid-cols-[64px_1fr_auto] md:items-center">
                <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                <div>
                  <p className="font-black text-ink">{product.name}</p>
                  <p className="text-sm font-bold text-steel">${product.price} · {categories.find((category) => category.id === product.categoryId)?.name ?? "未分類"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false })} className={`rounded-lg px-3 py-2 font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-stone-200 text-stone-500"}`}>
                    {product.isAvailable ? "上架中" : "停售中"}
                  </button>
                  <button onClick={() => setEditingProduct(product)} className="rounded-lg border border-stone-300 px-3 py-2 font-black text-steel">編輯</button>
                  <button onClick={() => removeProduct(product)} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">刪除</button>
                </div>
              </div>
            ))}
          </div>
          <Link href="/admin" className="mt-5 inline-flex rounded-lg border border-stone-300 px-5 py-3 font-black text-steel">回多店家管理</Link>
        </div>
        <aside className="rounded-lg bg-white p-5 shadow-soft">
          <h2 className="text-2xl font-black text-ink">{editingProduct.id ? "編輯商品" : "新增商品"}</h2>
          <div className="mt-4 grid gap-3">
            <Field label="商品名稱" value={editingProduct.name} onChange={(value) => setEditingProduct({ ...editingProduct, name: value })} />
            <label className="grid gap-1 text-sm font-black text-steel">
              商品描述
              <textarea value={editingProduct.description} onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })} placeholder="商品描述" className="min-h-24 rounded-lg border border-stone-300 px-4 py-3 font-normal text-ink" />
            </label>
            <Field label="原價" type="number" value={String(editingProduct.originalPrice ?? editingProduct.price)} onChange={(value) => setEditingProduct({ ...editingProduct, originalPrice: Number(value) })} />
            <Field label="售價" type="number" value={String(editingProduct.price)} onChange={(value) => setEditingProduct({ ...editingProduct, price: Number(value) })} />
            <label className="grid gap-1 text-sm font-black text-steel">
              商品分類
              <select value={editingProduct.categoryId} onChange={(event) => setEditingProduct({ ...editingProduct, categoryId: event.target.value })} className="rounded-lg border border-stone-300 px-4 py-3 font-bold text-ink">
                <option value="">選擇分類</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <Field label="商品圖片網址" value={editingProduct.imageUrl} onChange={(value) => setEditingProduct({ ...editingProduct, imageUrl: value })} />
            <label className="flex items-center gap-3 rounded-lg bg-stone-100 px-4 py-3 font-black text-steel">
              <input type="checkbox" checked={editingProduct.isAvailable} onChange={(event) => setEditingProduct({ ...editingProduct, isAvailable: event.target.checked, isSoldOut: false })} />
              商品上架
            </label>
            <button onClick={saveProduct} className="rounded-lg bg-leaf px-4 py-3 font-black text-white">儲存商品</button>
            <button onClick={() => setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id ?? "", sort: products.length + 1 })} className="rounded-lg border border-stone-300 px-4 py-3 font-black text-steel">清空新增</button>
          </div>
        </aside>
      </section>
    </main>
  );
}
