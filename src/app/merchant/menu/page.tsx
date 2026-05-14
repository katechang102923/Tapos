"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, GripVertical, Layers3, Plus } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { buildMenuTemplateProducts, menuTemplateLabel, type MenuTemplateType } from "@/lib/menu-import-templates";
import { discountLabel, productFinalPrice } from "@/lib/pricing";
import { canSwitchStore, defaultStoreId, isPlatformAdmin } from "@/lib/store-access";
import type { Category, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export default function MerchantMenuPage() {
  return (
    <LoginGate allowedRoles={["merchant", "admin", "systemAdmin", "softwareAdmin", "owner", "manager"]} title="菜單管理">
      {({ profile }) => <MerchantMenuShell profile={profile} />}
    </LoginGate>
  );
}

function MerchantMenuShell({ profile }: { profile: User | null }) {
  const searchParams = useSearchParams();
  const requestedStoreId = searchParams.get("storeId") ?? "";
  const platformAdmin = isPlatformAdmin(profile);
  const { db } = useDemoStore({ admin: platformAdmin, skipOrderList: true });
  const switchableStoreIds = useMemo(
    () => platformAdmin ? db.stores.filter((store) => !store.isDeleted).map((store) => store.id) : [],
    [db.stores, platformAdmin]
  );
  const [selectedStoreId, setSelectedStoreId] = useState(requestedStoreId || defaultStoreId(profile));
  useEffect(() => {
    if (!platformAdmin || switchableStoreIds.length === 0) return;
    if (!selectedStoreId || !switchableStoreIds.includes(selectedStoreId)) {
      setSelectedStoreId(switchableStoreIds[0]);
    }
  }, [platformAdmin, selectedStoreId, switchableStoreIds]);
  const fallbackStoreId = platformAdmin ? switchableStoreIds[0] ?? selectedStoreId : defaultStoreId(profile);
  const storeId = platformAdmin
    ? (selectedStoreId && switchableStoreIds.includes(selectedStoreId) ? selectedStoreId : fallbackStoreId)
    : defaultStoreId(profile);
  return <MerchantMenuContent canSwitch={canSwitchStore(profile)} storeId={storeId} storeIds={switchableStoreIds} stores={db.stores} onStoreChange={setSelectedStoreId} />;
}

function MerchantMenuContent({ storeId, canSwitch = false, storeIds = [], stores = [], onStoreChange }: { storeId: string; canSwitch?: boolean; storeIds?: string[]; stores?: Array<{ id: string; name: string }>; onStoreChange?: (storeId: string) => void }) {
  const { db, upsertCategory, upsertProduct } = useDemoStore({ storeId, skipOrderList: true });
  const [categoryName, setCategoryName] = useState("");
  const [templateType, setTemplateType] = useState<MenuTemplateType>("breakfast");
  const [templateMessage, setTemplateMessage] = useState("");
  const [templateError, setTemplateError] = useState("");
  const store = db.stores.find((item) => item.id === storeId);
  const categories = db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const products = db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);

  function addCategory() {
    if (!categoryName.trim()) return;
    upsertCategory({ id: "", storeId, name: categoryName.trim(), sort: categories.length + 1, isActive: true });
    setCategoryName("");
  }

  function moveCategory(category: Category, direction: -1 | 1) {
    upsertCategory({ ...category, sort: Math.max(1, category.sort + direction) });
  }

  async function importTemplate() {
    setTemplateMessage("");
    setTemplateError("");
    if (!storeId) return;
    if (!window.confirm(`匯入${menuTemplateLabel(templateType)}範本會新增一批商品，不會刪除原本商品。是否繼續？`)) return;
    try {
      const templateProducts = buildMenuTemplateProducts(storeId, templateType, products.length + 1);
      const categoryByName = new Map(categories.map((category) => [category.name, category]));
      const categoryIds = new Map<string, string>();
      let nextCategorySort = categories.length + 1;
      for (const product of templateProducts) {
        const name = product.categoryName || "未分類";
        const existing = categoryByName.get(name);
        const categoryId = existing?.id || `cat-${storeId}-${templateType}-${name}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
        categoryIds.set(name, categoryId);
        if (!existing) {
          await upsertCategory({ id: categoryId, storeId, name, sort: nextCategorySort, isActive: true });
          nextCategorySort += 1;
        }
      }
      await Promise.all(templateProducts.map((product) => upsertProduct({
        ...product,
        storeId,
        categoryId: categoryIds.get(product.categoryName || "未分類") || categories[0]?.id || "",
        sort: product.sort || products.length + 1,
        sortOrder: product.sortOrder ?? product.sort ?? 0,
        isAvailable: true,
        isSoldOut: false
      })));
      setTemplateMessage(`已匯入 ${templateProducts.length} 筆商品`);
    } catch (error) {
      console.error("importMenuTemplate failed", error);
      setTemplateError(error instanceof Error ? error.message : "匯入菜單範本失敗");
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台設定</p>
            <h1 className="text-3xl font-black text-ink">{store?.name ?? "店家"} · 菜單管理概覽</h1>
            <p className="mt-1 text-sm font-bold text-steel">管理分類、商品排序、上下架與菜單預覽。套餐、加購與商品選項請到商品選項管理。</p>
            {canSwitch && storeIds.length > 0 && (
              <label className="mt-3 block text-sm font-black text-steel">
                切換店家
                <select value={storeId} onChange={(event) => onStoreChange?.(event.target.value)} className="mt-1 rounded-lg border border-orange-100 px-3 py-2 font-bold text-ink">
                  {storeIds.map((id) => <option key={id} value={id}>{stores.find((item) => item.id === id)?.name ?? id}</option>)}
                </select>
              </label>
            )}
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            返回設定中心
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-ink">分類管理</h2>
            <div className="mt-4 flex gap-2">
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新增分類名稱" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
              <button onClick={addCategory} className="rounded-lg bg-ink px-4 py-3 font-black text-white"><Plus className="size-5" /></button>
            </div>
            <div className="mt-4 grid gap-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-3">
                  <GripVertical className="size-4 text-steel" />
                  <button onClick={() => upsertCategory({ ...category, isActive: !category.isActive })} className={`flex-1 text-left font-black ${category.isActive ? "text-ink" : "text-stone-400"}`}>{category.name}</button>
                  <button onClick={() => moveCategory(category, -1)} className="rounded-md bg-white px-2 py-1 text-xs font-black">上移</button>
                  <button onClick={() => moveCategory(category, 1)} className="rounded-md bg-white px-2 py-1 text-xs font-black">下移</button>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-ink">匯入菜單範本</h2>
            <p className="mt-1 text-sm font-bold text-steel">範本只會新增分類與商品，不會刪除原本菜單。</p>
            <div className="mt-4 grid gap-2">
              <select value={templateType} onChange={(event) => setTemplateType(event.target.value as MenuTemplateType)} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink">
                <option value="breakfast">早餐店</option>
                <option value="drink">飲料店</option>
                <option value="noodle">鍋燒麵店</option>
              </select>
              <button onClick={importTemplate} className="rounded-lg bg-leaf px-4 py-3 font-black text-white">匯入菜單範本</button>
              {templateMessage && <p className="rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">{templateMessage}</p>}
              {templateError && <p className="rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{templateError}</p>}
            </div>
          </div>
          <Link href="/merchant/options" className="flex items-center justify-between rounded-lg bg-ink p-5 font-black text-white shadow-sm">
            前往商品選項管理
            <Layers3 className="size-6" />
          </Link>
        </aside>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-orange-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-ink">商品列表與菜單預覽</h2>
              <p className="mt-1 text-sm font-bold text-steel">快速切換上下架、檢查折扣後售價與分類。</p>
            </div>
            <Link href="/merchant/options" className="rounded-lg bg-leaf px-4 py-3 font-black text-white">新增 / 編輯商品</Link>
          </div>
          <div className="mt-4 grid gap-3">
            {products.length === 0 ? (
              <p className="rounded-lg bg-orange-50 p-6 text-center font-black text-steel">尚無商品，請先新增商品。</p>
            ) : products.map((product) => {
              const category = categories.find((item) => item.id === product.categoryId);
              const discounted = productFinalPrice(product) !== product.price;
              return (
                <article key={product.id} className="grid gap-3 rounded-lg border border-orange-100 bg-[#fffaf0] p-3 sm:grid-cols-[80px_1fr_auto] sm:items-center">
                  <img src={product.imageUrl} alt={product.name} className="size-20 rounded-lg object-cover" />
                  <div>
                    <p className="text-lg font-black text-ink">{product.name}</p>
                    <p className="mt-1 text-sm font-bold text-steel">{category?.name ?? "未分類"} · 排序 {product.sort}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-black text-tomato">${productFinalPrice(product)}</span>
                      {discounted && <span className="text-sm font-bold text-stone-400 line-through">${product.price}</span>}
                      {discountLabel(product.discountType, product.discountValue) && <span className="rounded-full bg-tomato/10 px-2 py-1 text-xs font-black text-tomato">{discountLabel(product.discountType, product.discountValue)}</span>}
                    </div>
                  </div>
                  <button onClick={() => upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false })} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-stone-200 text-stone-500"}`}>
                    {product.isAvailable ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    {product.isAvailable ? "上架中" : "停售中"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
