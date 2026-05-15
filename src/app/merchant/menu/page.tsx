"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers3,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductEditorDialog } from "@/components/merchant/product-editor-dialog";
import { useDemoStore } from "@/lib/demo-store";
import { buildMenuTemplateProducts, menuTemplateLabel, type MenuTemplateType } from "@/lib/menu-import-templates";
import { discountLabel, productFinalPrice } from "@/lib/pricing";
import { canSwitchStore, defaultStoreId, isPlatformAdmin } from "@/lib/store-access";
import type { Category, Product, ProductOptionChoice, ProductOptionGroup, SharedOptionGroup, User } from "@/lib/types";

const blankProduct: Product = {
  id: "new-product",
  storeId: "",
  categoryId: "",
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

export default function MerchantMenuPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager"]} title="菜單管理">
      {({ profile }) => <MerchantMenuShell profile={profile} />}
    </LoginGate>
  );
}

function MerchantMenuShell({ profile }: { profile: User | null }) {
  const searchParams = useSearchParams();
  const requestedStoreId = searchParams.get("storeId") ?? "";
  const adminMode = searchParams.get("adminMode") === "1";
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

  return (
    <MerchantMenuWorkspace
      adminMode={platformAdmin && adminMode}
      canSwitch={canSwitchStore(profile)}
      storeId={storeId}
      storeIds={switchableStoreIds}
      stores={db.stores}
      onStoreChange={setSelectedStoreId}
    />
  );
}

function MerchantMenuWorkspace({
  storeId,
  adminMode = false,
  canSwitch = false,
  storeIds = [],
  stores = [],
  onStoreChange
}: {
  storeId: string;
  adminMode?: boolean;
  canSwitch?: boolean;
  storeIds?: string[];
  stores?: Array<{ id: string; name: string }>;
  onStoreChange?: (storeId: string) => void;
}) {
  const { db, deleteCategory, deleteProduct, upsertCategory, upsertProduct } = useDemoStore({ storeId, skipOrderList: true });
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [categoryName, setCategoryName] = useState("");
  const [query, setQuery] = useState("");
  const [templateType, setTemplateType] = useState<MenuTemplateType>("breakfast");
  const [templateMessage, setTemplateMessage] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product>({ ...blankProduct, storeId });
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const store = db.stores.find((item) => item.id === storeId);
  const storeDisplayName = store?.name || stores.find((item) => item.id === storeId)?.name || "未命名店家";
  const rawCategories = db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const categories = useMemo(() => dedupeCategories(rawCategories), [rawCategories]);
  const firstCategoryId = categories[0]?.id || "";
  const products = db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const sharedGroups = useMemo(
    () => (db.sharedOptionGroups ?? []).filter((item) => item.storeId === storeId),
    [db.sharedOptionGroups, storeId]
  );
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const selectedCategoryName = selectedCategoryId === "all" ? "全部商品" : categoryById.get(selectedCategoryId)?.name ?? "未分類";
  const categoryFilteredProducts = useMemo(() => selectedCategoryId === "all"
    ? products
    : products.filter((product) => {
      const legacyCategory = (product as Product & { category?: string }).category;
      const cid = String(product.categoryId ?? "").trim();
      const cname = String(product.categoryName ?? "").trim();
      const legacy = String(legacyCategory ?? "").trim();

      return (
        cid === selectedCategoryId ||
        cname === selectedCategoryName ||
        legacy === selectedCategoryName
      );
    }), [products, selectedCategoryId, selectedCategoryName]);
  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return categoryFilteredProducts;
    return categoryFilteredProducts.filter((product) =>
      product.name.toLowerCase().includes(keyword) ||
      product.description.toLowerCase().includes(keyword)
    );
  }, [categoryFilteredProducts, query]);

  console.log(
    "[MENU PRODUCTS]",
    products.map((product) => ({
      name: product.name,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      category: (product as Product & { category?: string }).category,
      optionGroups: product.optionGroups,
    }))
  );
  console.log(
    "[FILTER]",
    selectedCategoryId,
    filteredProducts.map((product) => product.name)
  );

  useEffect(() => {
    setSelectedCategoryId("all");
    setEditingProduct({ ...blankProduct, storeId, categoryId: firstCategoryId });
  }, [firstCategoryId, storeId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("[menu] selectedCategory", selectedCategoryId, selectedCategoryName);
    console.log("[menu] products", products.map((product) => ({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      category: (product as Product & { category?: string }).category
    })));
    console.log("[menu] filteredProducts", filteredProducts.map((product) => product.name));
  }, [filteredProducts.length, products.length, selectedCategoryId, selectedCategoryName]);

  useEffect(() => {
    if (!productEditorOpen) return;
    console.log(
      "[EDITOR OPTION GROUPS]",
      editingProduct.optionGroups
    );
  }, [editingProduct.optionGroups, productEditorOpen]);

  function setEditingProductDraft(next: Product | ((current: Product) => Product)) {
    setSaveState("unsaved");
    setSaveMessage("尚未儲存");
    setEditingProduct(next);
  }

  function addCategory() {
    const name = categoryName.trim();
    if (!name) return;
    const exists = categories.some((category) => normalizeCategoryName(category.name) === normalizeCategoryName(name));
    if (exists) {
      setCategoryName("");
      return;
    }
    upsertCategory({ id: "", storeId, name, sort: categories.length + 1, isActive: true });
    setCategoryName("");
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`確定刪除分類「${category.name}」？此分類商品會移到未分類。`)) return;
    try {
      await deleteCategory(category.id, storeId);
      if (selectedCategoryId === category.id) {
        setSelectedCategoryId("all");
      }
    } catch (error) {
      console.error("[merchant/menu] deleteCategory failed", error);
      window.alert(`刪除分類失敗：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function selectCategory(categoryId: string) {
    if (process.env.NODE_ENV !== "production") {
      const nextCount = categoryId === "all"
        ? products.length
        : products.filter((product) => {
          const categoryName = categoryById.get(categoryId)?.name ?? "";
          const legacyCategory = (product as Product & { category?: string }).category;
          return String(product.categoryId ?? "").trim() === categoryId
            || String(product.categoryName ?? "").trim() === categoryName
            || String(legacyCategory ?? "").trim() === categoryName;
        }).length;
      console.log("[menu] selectedCategory", categoryId, categoryId === "all" ? "全部商品" : categoryById.get(categoryId)?.name);
      console.log("[menu] filteredProducts", products
        .filter((product) => {
          if (categoryId === "all") return true;
          const categoryName = categoryById.get(categoryId)?.name ?? "";
          const legacyCategory = (product as Product & { category?: string }).category;
          return String(product.categoryId ?? "").trim() === categoryId
            || String(product.categoryName ?? "").trim() === categoryName
            || String(legacyCategory ?? "").trim() === categoryName;
        })
        .map((product) => product.name));
      console.log("[merchant/menu] selectCategory", {
        selectedCategory: categoryId,
        selectedCategoryName: categoryId === "all" ? "全部商品" : categoryById.get(categoryId)?.name,
        filteredProductsLength: nextCount
      });
    }
    setSelectedCategoryId(categoryId);
  }

  function startNewProduct() {
    setSaveState("idle");
    setSaveMessage("");
    setEditingProduct({ ...blankProduct, id: "new-product", storeId, categoryId: selectedCategoryId === "all" ? categories[0]?.id || "" : selectedCategoryId, sort: products.length + 1 });
    setProductEditorOpen(true);
  }

  function productForEditor(product: Product): Product {
    console.log("[editor] opening product", product.name, product.optionGroups);
    return {
      ...product,
      optionGroups: product.optionGroups ?? []
    };
  }

  async function saveProduct() {
    if (!editingProduct.name.trim()) {
      setSaveState("error");
      setSaveMessage("請先輸入商品名稱");
      return;
    }
    setSaveState("saving");
    setSaveMessage("儲存中...");
    const productId = editingProduct.id === "new-product" ? "" : editingProduct.id;
    const categoryId = editingProduct.categoryId || categories[0]?.id || "";
    const payload: Product = {
      ...editingProduct,
      id: productId,
      storeId,
      price: Number(editingProduct.price),
      originalPrice: Number(editingProduct.originalPrice || editingProduct.price),
      discountType: editingProduct.discountType ?? "none",
      discountValue: Number(editingProduct.discountValue ?? 0),
      sort: Number(editingProduct.sort) || products.length + 1,
      sortOrder: Number(editingProduct.sortOrder ?? editingProduct.sort) || products.length + 1,
      categoryId,
      categoryName: categoryById.get(categoryId)?.name ?? editingProduct.categoryName ?? "",
      options: editingProduct.options ?? [],
      optionGroups: editingProduct.optionGroups ?? []
    };
    if (process.env.NODE_ENV !== "production") {
      console.log("[editor] save payload", payload);
      console.log("[merchant/menu] saveProduct payload", {
        storeId: payload.storeId,
        productId: payload.id || "(new)",
        name: payload.name,
        categoryId: payload.categoryId,
        categoryName: payload.categoryName,
        optionGroupCount: payload.optionGroups?.length ?? 0
      });
    }
    try {
      await upsertProduct(payload);
      setSaveState("saved");
      setSaveMessage("已儲存");
      setProductEditorOpen(false);
    } catch (error) {
      console.error("[merchant/menu] saveProduct failed", error);
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : String(error));
      if (typeof window !== "undefined") {
        window.alert(`儲存商品失敗：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  function removeEditingProduct() {
    if (!editingProduct.id || editingProduct.id === "new-product") return;
    if (!window.confirm(`確定刪除「${editingProduct.name}」？`)) return;
    deleteProduct(editingProduct.id);
    setProductEditorOpen(false);
  }

  function newClientId(prefix: string) {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function makeOption(name = "正常", priceDelta = 0): ProductOptionChoice {
    return {
      id: newClientId("option"),
      name,
      optionName: name,
      priceDelta,
      sortOrder: 0,
      isAvailable: true,
      children: [],
      childGroupIds: [],
      linkedGroupId: null,
      sharedGroupId: null
    };
  }

  function makeOptionGroup(name = "調味", options?: ProductOptionChoice[]): ProductOptionGroup {
    return {
      id: newClientId("group"),
      name,
      groupName: name,
      required: true,
      minSelect: 1,
      maxSelect: 1,
      type: "single",
      sourceType: "custom",
      sortOrder: editingProduct.optionGroups?.length ?? 0,
      linkedGroupId: null,
      sharedGroupId: null,
      groupId: null,
      children: [],
      options: options ?? [
        makeOption("正常"),
        makeOption("不加洋蔥"),
        makeOption("不加醬"),
        makeOption("加辣")
      ]
    };
  }

  function mapGroups(groups: ProductOptionGroup[], mapper: (group: ProductOptionGroup) => ProductOptionGroup | null): ProductOptionGroup[] {
    return groups.flatMap((group) => {
      const mapped = mapper(group);
      if (!mapped) return [];
      return [{
        ...mapped,
        options: (mapped.options ?? []).map((option) => ({
          ...option,
          children: option.children ? mapGroups(option.children, mapper) : option.children
        }))
      }];
    });
  }

  function setOptionGroups(updater: (groups: ProductOptionGroup[]) => ProductOptionGroup[]) {
    setEditingProductDraft((current) => ({ ...current, optionGroups: updater(current.optionGroups ?? []) }));
  }

  function addOptionGroup() {
    console.log("[editor] add option group clicked");
    setEditingProductDraft((current) => ({
      ...current,
      optionGroups: [
        ...(current.optionGroups ?? []),
        makeOptionGroup("調味")
      ]
    }));
  }

  function cloneOptionGroup(group: ProductOptionGroup | SharedOptionGroup, sortOrder = 0): ProductOptionGroup {
    const groupName = group.groupName ?? group.name ?? "調味群組";
    return {
      id: newClientId("group"),
      name: groupName,
      groupName,
      required: group.required ?? false,
      minSelect: group.minSelect ?? 0,
      maxSelect: group.maxSelect ?? 1,
      type: group.type ?? ((group.maxSelect ?? 1) > 1 ? "multiple" : "single"),
      sourceType: "custom",
      groupId: null,
      sharedGroupId: null,
      linkedGroupId: group.id,
      sortOrder,
      children: (group.children ?? []).map((child, index) => cloneOptionGroup(child, index)),
      options: (group.options ?? []).map((option, index) => ({
        id: newClientId("option"),
        name: option.optionName ?? option.name ?? "",
        optionName: option.optionName ?? option.name ?? "",
        priceDelta: Number(option.priceDelta ?? 0),
        sortOrder: option.sortOrder ?? index,
        isAvailable: option.isAvailable ?? true,
        linkedGroupId: option.linkedGroupId ?? null,
        sharedGroupId: option.sharedGroupId ?? null,
        childGroupIds: option.childGroupIds ?? [],
        nextGroupIds: option.nextGroupIds ?? [],
        children: (option.children ?? []).map((child, childIndex) => cloneOptionGroup(child, childIndex))
      }))
    };
  }

  function applySharedGroups(groupIds: string[]) {
    const selectedGroups = groupIds
      .map((id) => sharedGroups.find((group) => group.id === id))
      .filter((group): group is SharedOptionGroup => Boolean(group));
    console.log("[editor] apply flavor groups", selectedGroups);
    setOptionGroups((groups) => {
      const existingIds = new Set(groups.map((group) => group.linkedGroupId ?? group.groupId ?? group.sharedGroupId ?? group.id.replace(/^shared-/, "")));
      const copiedGroups: ProductOptionGroup[] = [];
      groupIds.filter((id) => !existingIds.has(id)).forEach((id, index) => {
        const shared = sharedGroups.find((group) => group.id === id);
        if (!shared) return;
        copiedGroups.push(cloneOptionGroup(shared, groups.length + index));
      });
      return [...groups, ...copiedGroups];
    });
  }

  function moveOptionGroup(groupId: string, direction: -1 | 1) {
    setOptionGroups((groups) => {
      const index = groups.findIndex((group) => group.id === groupId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= groups.length) return groups;
      const next = [...groups];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((group, sortOrder) => ({ ...group, sortOrder }));
    });
  }

  function updateOptionGroup(groupId: string, patch: Partial<ProductOptionGroup>) {
    setOptionGroups((groups) => mapGroups(groups, (group) => group.id === groupId ? { ...group, ...patch } : group));
  }

  function removeOptionGroup(groupId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => group.id === groupId ? null : group));
  }

  function addGroupOption(groupId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => group.id === groupId ? { ...group, options: [...(group.options ?? []), makeOption("新選項")] } : group));
  }

  function updateGroupOption(groupId: string, optionId: string, patch: Partial<ProductOptionChoice>) {
    setOptionGroups((groups) => mapGroups(groups, (group) => {
      if (group.id !== groupId) return group;
      return { ...group, options: (group.options ?? []).map((option) => option.id === optionId ? { ...option, ...patch } : option) };
    }));
  }

  function removeGroupOption(groupId: string, optionId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => {
      if (group.id !== groupId) return group;
      return { ...group, options: (group.options ?? []).filter((option) => option.id !== optionId) };
    }));
  }

  function addChildGroup(groupId: string, optionId: string) {
    setOptionGroups((groups) => mapGroups(groups, (group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        options: (group.options ?? []).map((option) => option.id === optionId ? { ...option, children: [...(option.children ?? []), makeOptionGroup("下一層調味", [])] } : option)
      };
    }));
  }

  async function importTemplate() {
    setTemplateMessage("");
    setTemplateError("");
    if (!storeId) return;
    if (!window.confirm(`匯入「${menuTemplateLabel(templateType)}」會新增一批商品，不會刪除原有商品。是否繼續？`)) return;
    try {
      const templateProducts = buildMenuTemplateProducts(storeId, templateType, products.length + 1);
      const categoryByName = new Map(categories.map((category) => [normalizeCategoryName(category.name), category]));
      const categoryIds = new Map<string, string>();
      let nextCategorySort = categories.length + 1;
      for (const product of templateProducts) {
        const name = (product.categoryName || "未分類").trim();
        const existing = categoryByName.get(normalizeCategoryName(name));
        const categoryId = existing?.id || `cat-${storeId}-${templateType}-${name}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
        categoryIds.set(name, categoryId);
        if (!existing) {
          await upsertCategory({ id: categoryId, storeId, name, sort: nextCategorySort, isActive: true });
          categoryByName.set(normalizeCategoryName(name), { id: categoryId, storeId, name, sort: nextCategorySort, isActive: true });
          nextCategorySort += 1;
        }
      }
      await Promise.all(templateProducts.map((product) => upsertProduct({
        ...product,
        storeId,
        categoryId: categoryIds.get((product.categoryName || "未分類").trim()) || categories[0]?.id || "",
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
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="pointer-events-none fixed bottom-3 right-3 z-[80] rounded-full bg-fuchsia-600/60 px-3 py-1 text-[11px] font-black text-white shadow-sm">
        DEBUG MENU PAGE v20260515
      </div>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-100/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-leaf">{adminMode ? "平台代管菜單" : "店家菜單管理"}</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">{storeDisplayName}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">分類、商品、套餐、加購與調味群組庫集中在同一個工作台。</p>
            {canSwitch && storeIds.length > 0 && (
              <label className="mt-3 block text-sm font-black text-slate-500">
                切換代管店家
                <select value={storeId} onChange={(event) => onStoreChange?.(event.target.value)} className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-900">
                  {storeIds.map((id) => <option key={id} value={id}>{stores.find((item) => item.id === id)?.name ?? "未命名店家"}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5">
              <ArrowLeft className="size-4" />
              返回設定中心
            </Link>
            <button onClick={startNewProduct} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Plus className="size-4" />
              新增商品
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-leaf">分類樹狀結構</p>
                <h2 className="text-xl font-black text-slate-950">菜單分類</h2>
              </div>
              <MenuIcon className="size-5 text-slate-400" />
            </div>
            <div className="mt-4 grid gap-1.5">
              <CategoryButton active={selectedCategoryId === "all"} label="全部商品" count={products.length} onClick={() => selectCategory("all")} />
              {categories.map((category) => (
                <CategoryButton
                  key={category.id}
                  active={selectedCategoryId === category.id}
                  label={category.name}
                  count={products.filter((product) => productMatchesCategory(product, category.id, categoryById)).length}
                  onClick={() => selectCategory(category.id)}
                  onDelete={() => removeCategory(category)}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新增分類" className="min-w-0 flex-1 rounded-xl border-0 bg-slate-100 px-3 py-2 text-sm font-bold outline-none ring-1 ring-transparent focus:bg-white focus:ring-leaf" />
              <button onClick={addCategory} className="grid size-10 place-items-center rounded-xl bg-slate-900 text-white transition hover:-translate-y-0.5">
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">商品列表</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">目前分類：{selectedCategoryName}，共 {filteredProducts.length} 項商品。點擊商品即可開啟右側商品編輯 Drawer。</p>
            </div>
            <label className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 md:w-72">
              <Search className="size-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋商品" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-black text-slate-900">尚無商品</p>
                <p className="mt-1 text-sm font-bold text-slate-500">新增商品或匯入菜單範本後即可開始設定。</p>
              </div>
            ) : filteredProducts.map((product) => {
              const category = categories.find((item) => item.id === product.categoryId);
              const discounted = productFinalPrice(product) !== product.price;
              return (
                <article
                  key={product.id}
                  onClick={() => {
                    setSaveState("idle");
                    setSaveMessage("");
                    setEditingProduct(productForEditor(product));
                    setProductEditorOpen(true);
                  }}
                  className="group cursor-pointer rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                >
                  <img src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full rounded-xl object-cover" />
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">{product.name}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">{category?.name ?? "未分類"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${product.isAvailable ? "bg-emerald-50 text-leaf" : "bg-slate-200 text-slate-500"}`}>
                      {product.isAvailable ? "上架" : "停售"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black text-tomato">${productFinalPrice(product)}</p>
                      {discounted && <p className="text-xs font-bold text-slate-400 line-through">${product.price}</p>}
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false });
                      }}
                      className="grid size-10 place-items-center rounded-xl bg-white text-slate-500 shadow-sm transition group-hover:text-slate-900"
                    >
                      {product.isAvailable ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                  </div>
                  {discountLabel(product.discountType, product.discountValue) && <p className="mt-2 inline-flex rounded-full bg-rose-50 px-2 py-1 text-xs font-black text-tomato">{discountLabel(product.discountType, product.discountValue)}</p>}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-leaf" />
              <h2 className="text-xl font-black text-slate-950">菜單設定</h2>
            </div>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">調味群組庫集中管理甜度、冰塊、加料、套餐選項等常用設定，商品內可直接套用。</p>
            <div className="mt-4 grid gap-2">
              <Link href="/merchant/options" className="inline-flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">
                開啟調味群組庫
                <Layers3 className="size-4" />
              </Link>
              <div className="flex flex-wrap gap-1.5">
                {sharedGroups.length === 0 ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">尚無調味群組</span>
                ) : sharedGroups.slice(0, 8).map((group) => (
                  <span key={group.id} className="rounded-full bg-leaf/10 px-3 py-1 text-xs font-black text-leaf">{group.name}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              <h2 className="text-xl font-black text-slate-950">匯入菜單範本</h2>
            </div>
            <p className="mt-2 text-sm font-bold text-slate-500">匯入範本只會新增商品，不會刪除既有菜單。</p>
            <div className="mt-4 grid gap-2">
              <select value={templateType} onChange={(event) => setTemplateType(event.target.value as MenuTemplateType)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900">
                <option value="breakfast">早餐店</option>
                <option value="drink">飲料店</option>
                <option value="noodle">鍋燒麵店</option>
              </select>
              <button onClick={importTemplate} className="rounded-xl bg-leaf px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">匯入範本</button>
              {templateMessage && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-black text-leaf">{templateMessage}</p>}
              {templateError && <p className="rounded-xl bg-rose-50 p-3 text-sm font-black text-tomato">{templateError}</p>}
            </div>
          </section>
        </aside>
      </section>

      {productEditorOpen && (
        <ProductEditorDialog
          addChildGroup={addChildGroup}
          addGroupOption={addGroupOption}
          addOptionGroup={addOptionGroup}
          applySharedGroups={applySharedGroups}
          categories={categories}
          editingProduct={editingProduct}
          imagePresets={imagePresets}
          removeEditingProduct={removeEditingProduct}
          removeGroupOption={removeGroupOption}
          removeOptionGroup={removeOptionGroup}
          moveOptionGroup={moveOptionGroup}
          saveProduct={saveProduct}
          setEditingProduct={setEditingProductDraft}
          setProductEditorOpen={setProductEditorOpen}
          sharedGroups={sharedGroups}
          updateGroupOption={updateGroupOption}
          updateOptionGroup={updateOptionGroup}
          saveState={saveState}
          saveMessage={saveMessage}
        />
      )}
    </main>
  );
}

function CategoryButton({ active, label, count, disabled, onClick, onDelete }: { active: boolean; label: string; count: number; disabled?: boolean; onClick: () => void; onDelete?: () => void }) {
  return (
    <div className={`flex items-center gap-1 rounded-xl transition ${active ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left text-sm font-black disabled:opacity-45"
      >
        <span className="truncate">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-white text-slate-500"}`}>{count}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className={`mr-1 grid size-8 place-items-center rounded-lg transition ${active ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-red-50 hover:text-tomato"}`}
          title={`刪除分類 ${label}`}
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

function normalizeCategoryName(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function dedupeCategories(categories: Category[]) {
  const byName = new Map<string, Category>();
  categories.forEach((category) => {
    const key = normalizeCategoryName(category.name);
    if (!key) return;
    const existing = byName.get(key);
    if (!existing || category.sort < existing.sort) {
      byName.set(key, category);
    }
  });
  return [...byName.values()].sort((a, b) => a.sort - b.sort);
}

function normalizeCategoryKey(value?: string) {
  return normalizeCategoryName(value);
}

function productMatchesCategory(product: Product, categoryId: string, categoryById: Map<string, Category>) {
  if (normalizeCategoryKey(product.categoryId) === normalizeCategoryKey(categoryId)) return true;
  const category = categoryById.get(categoryId);
  if (!category) return false;
  const expectedName = normalizeCategoryKey(category.name);
  const legacyCategory = (product as Product & { category?: string }).category;
  return normalizeCategoryKey(product.categoryName) === expectedName
    || normalizeCategoryKey(legacyCategory) === expectedName;
}
