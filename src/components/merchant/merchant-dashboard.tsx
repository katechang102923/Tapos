"use client";

import { useState } from "react";
import Link from "next/link";
import { ChefHat, Copy, Download, ExternalLink, Eye, EyeOff, Flame, ImagePlus, LayoutDashboard, Menu as MenuIcon, Plus, Power, PowerOff, QrCode, ReceiptText, RefreshCcw, Settings, ShoppingCart } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import { getAppUrl } from "@/lib/app-url";
import type { Category, Product, ProductOptionChoice, ProductOptionGroup, Store, UserRole } from "@/lib/types";

const blankProduct: Product = {
  id: "new-product",
  storeId: "",
  categoryId: "cat-burger",
  name: "",
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  originalPrice: 70,
  price: 60,
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

function isDrinkName(name: string) {
  return /飲|茶|奶|咖啡|豆漿|紅茶|綠茶/.test(name);
}

type MerchantView = "dashboard" | "menu" | "qrcode";

export function MerchantDashboard({ view = "dashboard" }: { view?: MerchantView }) {
  return (
    <LoginGate allowedRoles={["merchant", "admin"]} title="店家後台登入">
      {({ profile, signOutUser }) => <MerchantDashboardContent role={profile?.role ?? "user"} storeId={profile?.storeId ?? ""} view={view} onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function MerchantDashboardContent({ storeId, role, view, onSignOut }: { storeId: string; role: UserRole; view: MerchantView; onSignOut: () => Promise<void> }) {
  const { db, deleteProduct, resetDemo, seedDemoData, upsertCategory, upsertProduct, upsertStore } = useDemoStore({ storeId, skipOrderList: true });
  const [editingProduct, setEditingProduct] = useState<Product>(blankProduct);
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [notice, setNotice] = useState("");

  const store = db.stores.find((item) => item.id === storeId);
  const categories = db.categories.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const products = db.products.filter((item) => item.storeId === storeId).sort((a, b) => a.sort - b.sort);
  const canManageStore = role === "merchant" || role === "admin";
  const orderUrl = `${getAppUrl()}/order/${storeId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(orderUrl)}`;

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-leaf">首次登入</p>
          <h1 className="mt-2 text-3xl font-black text-ink">先建立店家</h1>
          <Link href="/onboarding" className="mt-5 inline-flex rounded-lg bg-leaf px-5 py-3 font-black text-white">開始建店</Link>
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
      sort: Number(editingProduct.sort) || products.length + 1,
      categoryId: editingProduct.categoryId || categories[0]?.id || "cat-burger"
    });
    setEditingProduct({ ...blankProduct, storeId, categoryId: categories[0]?.id || "cat-burger", sort: products.length + 2 });
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

  function addCategory() {
    if (!categoryName.trim()) return;
    upsertCategory({ id: "", storeId, name: categoryName.trim(), sort: categories.length + 1, isActive: true });
    setCategoryName("");
  }

  function updateStore(patch: Partial<Store>) {
    if (!store) return;
    upsertStore({ ...store, ...patch });
  }

  function saveNotice() {
    updateStore({ temporaryNotice: notice });
  }

  function copyOrderUrl() {
    navigator.clipboard?.writeText(orderUrl);
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] text-ink lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-orange-100 bg-[#171717] p-4 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-tomato"><ReceiptText className="size-5" /></div>
          <div>
            <p className="font-black">{store?.name ?? "餐飲店"}</p>
            <p className="text-xs font-bold text-white/55">店家管理後台</p>
          </div>
        </div>
        <nav className="mt-6 grid gap-2">
          <SidebarItem href="/merchant/dashboard" icon={LayoutDashboard} label="後台設定中心" active={view === "dashboard"} />
          <SidebarItem href="/merchant/menu" icon={MenuIcon} label="菜單管理" active={view === "menu"} />
          <Link href="/merchant/pos" className="inline-flex items-center gap-3 rounded-lg bg-leaf px-4 py-3 font-black text-white"><ShoppingCart className="size-5" />前往 POS 前台</Link>
          <Link href="/merchant/qrcode" className="inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black text-white/70 hover:bg-white/10"><QrCode className="size-5" />QR Code 管理</Link>
          <Link href="/kds" className="inline-flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ChefHat className="size-5" />廚房 KDS</Link>
          {canManageStore && <Link href="/merchant/settings" className="inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black text-white/70 hover:bg-white/10"><Settings className="size-5" />店家設定</Link>}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-steel">店家後台：店家資料、菜單、商品選項、QR Code 與桌號設定</p>
            <h1 className="text-3xl font-black text-ink">設定管理中心</h1>
            {(store?.temporaryNotice || store?.notice) && <p className="mt-2 font-bold text-tomato">公告：{store.temporaryNotice || store.notice}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageStore && <button onClick={() => updateStore({ isOpen: !store?.isOpen })} className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 font-black text-white ${store?.isOpen ? "bg-leaf" : "bg-tomato"}`}>{store?.isOpen ? <Power className="size-5" /> : <PowerOff className="size-5" />}{store?.isOpen ? "營業中" : "休息中"}</button>}
            {canManageStore && <button onClick={() => updateStore({ peakMode: !store?.peakMode })} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-black text-ink"><Flame className="size-5" />{store?.peakMode ? "尖峰模式中" : "尖峰模式"}</button>}
            <Link href="/merchant/pos" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><ShoppingCart className="size-5" />進入 POS 前台</Link>
            <Link href={`/order/${storeId}`} target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink"><ExternalLink className="size-5" />預覽顧客點餐頁</Link>
            <button onClick={seedDemoData} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">匯入預設菜單</button>
            <button onClick={resetDemo} className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel"><RefreshCcw className="size-5" />重設</button>
            <button onClick={onSignOut} className="rounded-lg border border-orange-200 bg-white px-4 py-3 font-black text-steel">登出</button>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-5">
          <Metric label="商品數" value={products.length.toString()} accent="text-tomato" />
          <Metric label="分類數" value={categories.length.toString()} />
          <Metric label="商品選項" value={products.reduce((sum, product) => sum + (product.optionGroups?.length ?? 0), 0).toString()} />
          <Metric label="QR 桌號" value="12" accent="text-amber-600" />
          <Metric label="營業狀態" value={store?.isOpen ? "營業中" : "休息中"} accent={store?.isOpen ? "text-leaf" : "text-tomato"} />
        </section>

        {view === "dashboard" && canManageStore && (
          <DashboardSettingsCenter
            copyOrderUrl={copyOrderUrl}
            notice={notice}
            orderUrl={orderUrl}
            qrUrl={qrUrl}
            saveNotice={saveNotice}
            setNotice={setNotice}
            store={store}
            storeId={storeId}
            updateStore={updateStore}
          />
        )}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {view === "menu" && canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">商品管理</h2>
                  <button onClick={startNewProduct} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white"><Plus className="size-4" />新增</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {products.map((product) => (
                    <div key={product.id} onClick={() => { setEditingProduct({ ...product, optionGroups: product.optionGroups ?? [] }); setProductEditorOpen(true); }} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition ${editingProduct.id === product.id ? "bg-leaf/10 ring-2 ring-leaf" : "bg-[#fffaf0] hover:bg-orange-50"}`}>
                      <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{product.name}</p>
                        <p className="font-bold text-tomato">${product.price}</p>
                      </div>
                      <button onClick={(event) => { event.stopPropagation(); upsertProduct({ ...product, isAvailable: !product.isAvailable, isSoldOut: false }); }} className={`rounded-lg px-3 py-3 font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-amber-100 text-amber-700"}`}>{product.isAvailable ? "上架中" : "停售中"}</button>
                      <button onClick={(event) => { event.stopPropagation(); setEditingProduct({ ...product, optionGroups: product.optionGroups ?? [] }); setProductEditorOpen(true); }} className="grid size-11 place-items-center rounded-lg bg-white">{product.isAvailable ? <Eye className="size-5 text-leaf" /> : <EyeOff className="size-5 text-stone-400" />}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <aside className="space-y-5">
            {view === "qrcode" && canManageStore && (
              <div className="rounded-lg bg-ink p-5 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-lg bg-white text-ink">
                    <QrCode className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">QR Code 管理</h2>
                    <p className="text-sm font-bold text-white/60">顧客掃碼後進入點餐頁</p>
                  </div>
                </div>
                <img src={qrUrl} alt="顧客點餐 QR Code" className="mt-5 w-full rounded-lg bg-white p-4" />
                <p className="mt-4 break-all rounded-lg bg-white/10 p-3 text-sm font-bold">{orderUrl}</p>
                <div className="mt-4 grid gap-2">
                  <button onClick={copyOrderUrl} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink">
                    <Copy className="size-5" />
                    複製點餐連結
                  </button>
                  <a href={`/order/${storeId}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
                    <ExternalLink className="size-5" />
                    預覽點餐頁
                  </a>
                  <a href={qrUrl} download={`qr-${storeId}.png`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
                    <Download className="size-5" />
                    下載 QR Code 圖片
                  </a>
                </div>
              </div>
            )}

            {view === "menu" && canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">商品編輯器</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-steel">點選商品或按新增後，會開啟完整編輯視窗，可設定多層套餐、子選項與加價。</p>
                <button onClick={startNewProduct} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-4 font-black text-white"><ImagePlus className="size-5" />開啟新增商品</button>
              </div>
            )}

            {view === "menu" && canManageStore && (
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">分類管理</h2>
                <div className="mt-4 flex gap-2">
                  <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新增分類" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
                  <button onClick={addCategory} className="rounded-lg bg-ink px-4 py-3 font-black text-white">新增</button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <button key={category.id} onClick={() => upsertCategory({ ...category, isActive: !category.isActive })} className={`rounded-lg px-4 py-3 font-black ${category.isActive ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-400"}`}>{category.name}</button>)}</div>
              </div>
            )}

          </aside>
        </section>
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

function SidebarItem({ href, icon: Icon, label, active = false }: { href: string; icon: React.ElementType; label: string; active?: boolean }) {
  return <Link href={href} className={`inline-flex items-center gap-3 rounded-lg px-4 py-3 font-black ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"}`}><Icon className="size-5" />{label}</Link>;
}

function Metric({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><p className="text-sm font-black text-steel">{label}</p><p className={`mt-2 text-4xl font-black ${accent}`}>{value}</p></div>;
}

function DashboardSettingsCenter({
  copyOrderUrl,
  notice,
  orderUrl,
  qrUrl,
  saveNotice,
  setNotice,
  store,
  storeId,
  updateStore
}: {
  copyOrderUrl: () => void;
  notice: string;
  orderUrl: string;
  qrUrl: string;
  saveNotice: () => void;
  setNotice: (value: string) => void;
  store?: Store;
  storeId: string;
  updateStore: (patch: Partial<Store>) => void;
}) {
  const tableNumbers = Array.from({ length: 12 }, (_, index) => String(index + 1));

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">後台設定中心</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-steel">這裡負責店家資料、菜單、商品選項、QR Code、桌號與營業狀態設定；每日營運請前往 POS 前台工作台。</p>
            </div>
            <Link href="/merchant/pos" className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 font-black text-white">
              <ShoppingCart className="size-5" />
              進入 POS 前台
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SettingsCard href="/merchant/settings" title="修改店家資訊" description="店名、Logo、Banner、營業時間、地址、電話與店家簡介。" />
          <SettingsCard href="/merchant/menu" title="菜單資訊管理" description="分類、商品、價格、圖片、排序與商品上下架。" />
          <SettingsCard href="/merchant/menu" title="商品選項管理" description="套餐、加購、加料、調味、飲料補差價與多層子選項。" />
          <SettingsCard href="/merchant/qrcode" title="QR Code 產出" description="顧客點餐連結、QR Code 預覽、複製與下載。" />
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">營業狀態設定</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button onClick={() => updateStore({ isOpen: true, temporaryNotice: "" })} className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-leaf text-white" : "bg-stone-100 text-steel"}`}>營業中</button>
            <button onClick={() => updateStore({ isOpen: true, temporaryNotice: "目前暫停接單，請稍候。" })} className="rounded-lg bg-amber-100 px-4 py-4 font-black text-amber-700">暫停接單</button>
            <button onClick={() => updateStore({ isOpen: false })} className={`rounded-lg px-4 py-4 font-black ${store?.isOpen ? "bg-stone-100 text-steel" : "bg-tomato text-white"}`}>休息中</button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="例如：奶茶售完、餐點需等 15 分鐘" className="min-w-0 flex-1 rounded-lg border border-orange-100 px-4 py-3 font-bold" />
            <button onClick={saveNotice} className="rounded-lg bg-ink px-5 py-3 font-black text-white">發布臨時公告</button>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">QR 桌號設定</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-steel">資料結構以 `tables` 保存桌號、排序、啟用狀態與桌號 QR 連結。下方先提供 1 到 12 桌的點餐連結與下載入口。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tableNumbers.map((tableNo) => {
              const tableUrl = `${orderUrl}?table=${encodeURIComponent(tableNo)}`;
              const tableQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(tableUrl)}`;
              return (
                <div key={tableNo} className="rounded-lg border border-orange-100 bg-[#fffaf0] p-4">
                  <p className="text-xl font-black">桌號 {tableNo}</p>
                  <p className="mt-2 break-all text-xs font-bold text-steel">{tableUrl}</p>
                  <div className="mt-3 flex gap-2">
                    <a href={tableQrUrl} download={`table-${storeId}-${tableNo}.png`} className="rounded-lg bg-ink px-3 py-2 text-sm font-black text-white">下載 QR</a>
                    <a href={tableUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-sm font-black text-ink">預覽</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-lg bg-ink p-5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-white text-ink">
              <QrCode className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black">顧客點餐 QR</h2>
              <p className="text-sm font-bold text-white/60">所有顧客掃碼進入同一個點餐頁</p>
            </div>
          </div>
          <img src={qrUrl} alt="顧客點餐 QR Code" className="mt-5 w-full rounded-lg bg-white p-4" />
          <p className="mt-4 break-all rounded-lg bg-white/10 p-3 text-sm font-bold">{orderUrl}</p>
          <div className="mt-4 grid gap-2">
            <button onClick={copyOrderUrl} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink">
              <Copy className="size-5" />
              複製點餐連結
            </button>
            <a href={orderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
              <ExternalLink className="size-5" />
              預覽點餐頁
            </a>
            <a href={qrUrl} download={`qr-${storeId}.png`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">
              <Download className="size-5" />
              下載 QR Code 圖片
            </a>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">資料結構</h2>
          <div className="mt-3 grid gap-2 text-sm font-bold text-steel">
            {["orders", "orderItems", "products", "productOptions", "optionGroups", "tables", "dailySalesSummary"].map((name) => (
              <p key={name} className="rounded-lg bg-orange-50 px-3 py-2">{name}</p>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SettingsCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-lg bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <p className="text-xl font-black text-ink">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-steel">{description}</p>
      <p className="mt-4 font-black text-leaf">前往設定</p>
    </Link>
  );
}

function ProductEditorDialog({
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
