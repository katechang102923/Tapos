"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { OptionGroupEditor, ProductEditorDialog } from "@/components/merchant/product-editor-dialog";
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
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager"]} title="商品選項管理登入">
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
  const [activeTab, setActiveTab] = useState<"products" | "shared">("products");
  const [productSaveState, setProductSaveState] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");
  const [productSaveMessage, setProductSaveMessage] = useState<string>("");
  const [sharedSaveState, setSharedSaveState] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");
  const [sharedSaveMessage, setSharedSaveMessage] = useState<string>("");

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

  function setEditingProductDraft(next: Product | ((current: Product) => Product)) {
    setEditingProduct((current) => {
      const nextProduct = typeof next === "function" ? next(current) : next;
      setProductSaveState("unsaved");
      setProductSaveMessage("尚未儲存");
      return nextProduct;
    });
  }

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

  // ─── Product helpers ──────────────────────────────────────────────────────

  async function saveProduct() {
    if (!editingProduct.name.trim()) return;
    setProductSaveState("saving");
    setProductSaveMessage("儲存中...");
    try {
      await upsertProduct({
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
      setProductSaveState("saved");
      setProductSaveMessage("已儲存");
      setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 2 });
      setProductEditorOpen(false);
    } catch (error) {
      setProductSaveState("error");
      setProductSaveMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function startNewProduct() {
    setProductSaveState("idle");
    setProductSaveMessage("");
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
    return { id: `option-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: "新選項", priceDelta: 0, isAvailable: true, children: [], childGroupIds: [] };
  }

  function addOptionGroup() {
    setProductSaveState("unsaved");
    setProductSaveMessage("尚未儲存");
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
    setProductSaveState("unsaved");
    setProductSaveMessage("尚未儲存");
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

  // ─── Shared group helpers ─────────────────────────────────────────────────

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

  async function saveSharedGroup() {
    if (!editingSharedGroup) return;
    setSharedSaveState("saving");
    setSharedSaveMessage("儲存中...");
    try {
      await upsertSharedOptionGroup({ ...editingSharedGroup, storeId });
      setSharedSaveState("saved");
      setSharedSaveMessage("已儲存");
      setEditingSharedGroup(null);
      setSharedGroupPanelOpen(false);
    } catch (error) {
      setSharedSaveState("error");
      setSharedSaveMessage(error instanceof Error ? error.message : String(error));
    }
  }

  /** Options in a shared group, operated via setEditingSharedGroup. */
  function sgAddOption() {
    setSharedSaveState("unsaved");
    setSharedSaveMessage("尚未儲存");
    setEditingSharedGroup((g) => g ? {
      ...g,
      options: [...g.options, { id: `sgo-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: "新選項", priceDelta: 0, isAvailable: true, childGroupIds: [] }]
    } : g);
  }

  function sgUpdateOption(optId: string, patch: Partial<ProductOptionChoice>) {
    setSharedSaveState("unsaved");
    setSharedSaveMessage("尚未儲存");
    setEditingSharedGroup((g) => g ? {
      ...g,
      options: g.options.map((o) => o.id === optId ? { ...o, ...patch } : o)
    } : g);
  }

  function sgRemoveOption(optId: string) {
    setSharedSaveState("unsaved");
    setSharedSaveMessage("尚未儲存");
    setEditingSharedGroup((g) => g ? { ...g, options: g.options.filter((o) => o.id !== optId) } : g);
  }

  /** Toggle a shared-group reference (childGroupId) on an option inside the shared group being edited. */
  function sgToggleChildGroupId(optId: string, sgId: string, currentlyLinked: boolean) {
    setSharedSaveState("unsaved");
    setSharedSaveMessage("尚未儲存");
    setEditingSharedGroup((g) => g ? {
      ...g,
      options: g.options.map((o) => o.id !== optId ? o : {
        ...o,
        childGroupIds: currentlyLinked
          ? (o.childGroupIds ?? []).filter((id) => id !== sgId)
          : [...(o.childGroupIds ?? []), sgId]
      })
    } : g);
  }

  // ─── Shared group OptionGroupEditor wiring (no-op stubs for edit actions that
  //     come from OptionGroupEditor child; actual state lives in editingSharedGroup) ──

  function sgUpdateOptionGroup(groupId: string, patch: Partial<ProductOptionGroup>) {
    setEditingSharedGroup((g) => {
      if (!g) return g;
      if (g.id === groupId) return { ...g, ...patch };
      return g;
    });
  }

  function sgRemoveOptionGroup(_groupId: string) {
    // top-level shared group deletion is handled by the panel close / delete button
  }

  function sgAddGroupOption(groupId: string) {
    if (!editingSharedGroup || editingSharedGroup.id !== groupId) return;
    sgAddOption();
  }

  function sgUpdateGroupOption(groupId: string, optId: string, patch: Partial<ProductOptionChoice>) {
    if (!editingSharedGroup || editingSharedGroup.id !== groupId) return;
    sgUpdateOption(optId, patch);
  }

  function sgRemoveGroupOption(_groupId: string, optId: string) {
    sgRemoveOption(optId);
  }

  // Shared groups don't support inline child groups (use childGroupIds instead)
  function sgAddChildGroup(_groupId: string, _optId: string) {}

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台</p>
            <h1 className="text-3xl font-black text-ink">{store?.name} · 商品選項管理</h1>
            <p className="mt-1 text-sm font-bold text-steel">為商品新增套餐、調味、飲料選項及多層加購選項。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            回上一層
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="inline-flex flex-wrap gap-2 rounded-full bg-orange-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${activeTab === "products" ? "bg-leaf text-white" : "bg-white text-steel hover:bg-orange-100"}`}
          >
            商品選項設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("shared")}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${activeTab === "shared" ? "bg-leaf text-white" : "bg-white text-steel hover:bg-orange-100"}`}
          >
            共用群組管理
          </button>
        </div>
      </div>

      {activeTab === "products" && (
        <section className="mx-auto max-w-7xl p-4">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-orange-100 pb-4">
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
              <div
                key={product.id}
                onClick={() => {
                  setProductSaveState("idle");
                  setProductSaveMessage("");
                  setEditingProduct({ ...product, optionGroups: product.optionGroups ?? [] });
                  setProductEditorOpen(true);
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${editingProduct.id === product.id ? "border-leaf bg-leaf/10 ring-2 ring-leaf" : "border-orange-100 bg-[#fffaf0] hover:bg-orange-50"}`}
              >
                <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{product.name}</p>
                  <p className="font-bold text-tomato">${productFinalPrice(product)}</p>
                  {productFinalPrice(product) !== product.price && <p className="text-xs font-bold text-stone-400 line-through">${product.price}</p>}
                  <p className="text-xs font-bold text-steel">{product.optionGroups?.length ?? 0} 個選項群組</p>
                </div>
                <button
                  onClick={(event) => { event.stopPropagation(); upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false }); }}
                  className={`rounded-lg px-3 py-3 font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-amber-100 text-amber-700"}`}
                >
                  {product.isAvailable ? "上架中" : "停售中"}
                </button>
                <button
                  onClick={(event) => { event.stopPropagation(); setProductSaveState("idle"); setProductSaveMessage(""); setEditingProduct({ ...product, optionGroups: product.optionGroups ?? [] }); setProductEditorOpen(true); }}
                  className="grid size-11 place-items-center rounded-lg border border-orange-100 bg-white"
                >
                  {product.isAvailable ? <Eye className="size-5 text-leaf" /> : <EyeOff className="size-5 text-stone-400" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {activeTab === "shared" && (
        <section className="mx-auto max-w-7xl p-4 pt-0">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-orange-100 pb-4">
            <div>
              <h2 className="text-2xl font-black">共用選項群組</h2>
              <p className="mt-1 text-sm font-bold text-steel">可跨商品共用的選項群組（如冰量、糖度），透過選項旁的「連結共用群組」掛載到商品選項上。</p>
            </div>
            <button
              onClick={() => {
                setSharedSaveState("idle");
                setSharedSaveMessage("");
                setEditingSharedGroup(makeSharedGroup());
                setSharedGroupPanelOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 font-black text-white"
            >
              <Plus className="size-4" />
              新增共用群組
            </button>
          </div>

          {sharedGroups.length === 0 ? (
            <p className="py-4 text-center text-sm font-bold text-steel">尚無共用群組。點擊「新增共用群組」建立可跨商品共享的選項（如冰量、糖度）。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sharedGroups.map((sg) => {
                const totalLinked = sg.options.reduce((sum, o) => sum + (o.childGroupIds?.length ?? 0), 0);
                return (
                  <div key={sg.id} className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-black">{sg.name}</p>
                          <span className="rounded bg-leaf/15 px-1.5 py-0.5 text-xs font-black text-leaf">共用群組</span>
                          {totalLinked > 0 && (
                            <span className="flex items-center gap-0.5 rounded bg-leaf/10 px-1.5 py-0.5 text-xs font-bold text-leaf">
                              <Link2 className="size-3" />{totalLinked} 子引用
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-steel">{sg.options.length} 個選項 · {sg.required ? "必選" : "非必選"} · ID: {sg.id}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setSharedSaveState("idle"); setSharedSaveMessage(""); setEditingSharedGroup({ ...sg }); setSharedGroupPanelOpen(true); }} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-black text-steel">編輯</button>
                        <button onClick={() => { if (window.confirm(`確定刪除共用群組「${sg.name}」？`)) deleteSharedOptionGroup(sg.id); }} className="rounded-lg bg-tomato px-2 py-2 font-black text-white">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sg.options.map((opt) => {
                        const childNames = (opt.childGroupIds ?? [])
                          .map((id) => sharedGroups.find((s) => s.id === id)?.name)
                          .filter(Boolean);
                        return (
                          <div key={opt.id} className="rounded bg-white px-2 py-1 text-xs font-bold text-ink">
                            {opt.name}
                            {childNames.length > 0 && (
                              <span className="ml-1 text-leaf">→ {childNames.join("、")}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Shared group editor modal */}
      {sharedGroupPanelOpen && editingSharedGroup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
            <h2 className="mb-4 text-2xl font-black text-ink">
              {sharedGroups.some((sg) => sg.id === editingSharedGroup.id) ? "編輯共用群組" : "新增共用群組"}
            </h2>
            {sharedSaveMessage ? (
              <p className={`mb-4 text-sm font-black ${sharedSaveState === "error" ? "text-tomato" : sharedSaveState === "saving" ? "text-ink" : "text-leaf"}`}>
                {sharedSaveMessage}
              </p>
            ) : null}

            {/* Use OptionGroupEditor for the shared group itself */}
            <OptionGroupEditor
              group={editingSharedGroup}
              depth={0}
              isShared={true}
              sharedGroups={sharedGroups.filter((sg) => sg.id !== editingSharedGroup.id)}
              addChildGroup={sgAddChildGroup}
              addGroupOption={sgAddGroupOption}
              removeGroupOption={sgRemoveGroupOption}
              removeOptionGroup={sgRemoveOptionGroup}
              updateGroupOption={sgUpdateGroupOption}
              updateOptionGroup={sgUpdateOptionGroup}
            />

            {/* Per-option childGroupIds linking — shown in a separate section for clarity */}
            {sharedGroups.filter((sg) => sg.id !== editingSharedGroup.id).length > 0 && editingSharedGroup.options.length > 0 && (
              <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3">
                <p className="mb-2 text-sm font-black text-steel">每個選項連結子共用群組</p>
                <p className="mb-3 text-xs font-bold text-steel">點擊按鈕，讓選取該選項時自動展開對應的共用群組（例如選「紅茶」後出現「糖度」「冰量」）。</p>
                <div className="grid gap-2">
                  {editingSharedGroup.options.map((opt) => {
                    const otherSgs = sharedGroups.filter((sg) => sg.id !== editingSharedGroup.id);
                    const linkedIds = opt.childGroupIds ?? [];
                    return (
                      <div key={opt.id} className="rounded-lg border border-orange-100 bg-white p-2">
                        <p className="mb-1.5 text-xs font-black text-ink">{opt.name || "（未命名選項）"}</p>
                        <div className="flex flex-wrap gap-1">
                          <span className="shrink-0 self-center text-xs font-black text-steel">子群組：</span>
                          {otherSgs.map((sg) => {
                            const linked = linkedIds.includes(sg.id);
                            return (
                              <button
                                key={sg.id}
                                type="button"
                                onClick={() => sgToggleChildGroupId(opt.id, sg.id, linked)}
                                className={`rounded px-2 py-0.5 text-xs font-black transition ${linked ? "bg-leaf text-white" : "border border-orange-200 bg-white text-steel hover:border-leaf hover:text-leaf"}`}
                              >
                                {linked ? "✓ " : "+ "}{sg.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
          setEditingProduct={setEditingProductDraft}
          setProductEditorOpen={setProductEditorOpen}
          sharedGroups={sharedGroups}
          updateGroupOption={updateGroupOption}
          updateOptionGroup={updateOptionGroup}
          saveState={productSaveState}
          saveMessage={productSaveMessage}
        />
      )}
    </main>
  );
}
