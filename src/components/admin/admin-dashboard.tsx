"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Database, Edit3, LogOut, MenuSquare, Power, PowerOff, Store as StoreIcon, Trash2 } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import type { Product, Store, StoreMemberRole, User } from "@/lib/types";

const storeMemberRoles: StoreMemberRole[] = ["owner", "manager", "staff", "viewer"];

const blankProduct: Product = {
  id: "",
  storeId: "",
  categoryId: "",
  name: "",
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  price: 60,
  isAvailable: true,
  isSoldOut: false,
  sort: 99,
  options: []
};

export function AdminDashboard() {
  return (
    <LoginGate allowedRoles={["admin"]} title="管理員後台登入">
      {({ signOutUser }) => <AdminDashboardContent onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function AdminDashboardContent({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const { db, bindStoreUser, deleteProduct, deleteStoreCascade, seedDemoData, unbindStoreUser, upsertProduct, upsertStore } = useDemoStore({ admin: true });
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [menuStoreId, setMenuStoreId] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product>(blankProduct);
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [bindingEmail, setBindingEmail] = useState<Record<string, string>>({});
  const [bindingRole, setBindingRole] = useState<Record<string, StoreMemberRole>>({});

  const menuStore = db.stores.find((store) => store.id === menuStoreId) ?? null;
  const menuCategories = db.categories.filter((category) => category.storeId === menuStoreId).sort((a, b) => a.sort - b.sort);
  const menuProducts = db.products.filter((product) => product.storeId === menuStoreId).sort((a, b) => a.sort - b.sort);
  const linkedUserCount = useMemo(() => {
    const map = new Map<string, number>();
    db.users.forEach((user) => {
      const ids = user.storeIds?.length ? user.storeIds : user.storeId ? [user.storeId] : [];
      ids.forEach((storeId) => map.set(storeId, (map.get(storeId) ?? 0) + 1));
    });
    return map;
  }, [db.users]);

  function storeUsers(storeId: string) {
    return db.users.filter((user) => user.storeIds?.includes(storeId) || user.storeId === storeId);
  }

  async function bindUser(storeId: string) {
    const email = bindingEmail[storeId]?.trim();
    if (!email) return;
    await bindStoreUser(email, storeId, bindingRole[storeId] ?? "staff");
    setBindingEmail((current) => ({ ...current, [storeId]: "" }));
  }

  function toggleOpen(store: Store) {
    upsertStore({ ...store, isOpen: !store.isOpen });
  }

  function createStore() {
    const id = `store-${Date.now()}`;
    upsertStore({
      id,
      name: "新餐飲店",
      logoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=400&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
      phone: "",
      address: "",
      businessHours: "每日 07:00-20:00",
      description: "提供線上 QR 點餐服務。",
      isOpen: false,
      notice: "歡迎使用 QR 點餐",
      createdAt: new Date().toISOString()
    });
  }

  function saveStore() {
    if (!editingStore?.name.trim()) return;
    upsertStore(editingStore);
    setEditingStore(null);
  }

  function startMenu(storeId: string) {
    setMenuStoreId(storeId);
    const firstCategory = db.categories.find((category) => category.storeId === storeId);
    setEditingProduct({ ...blankProduct, storeId, categoryId: firstCategory?.id ?? "" });
  }

  function saveProduct() {
    if (!menuStore || !editingProduct.name.trim()) return;
    upsertProduct({
      ...editingProduct,
      storeId: menuStore.id,
      categoryId: editingProduct.categoryId || menuCategories[0]?.id || "",
      price: Number(editingProduct.price),
      sort: Number(editingProduct.sort) || menuProducts.length + 1
    });
    setEditingProduct({ ...blankProduct, storeId: menuStore.id, categoryId: menuCategories[0]?.id ?? "", sort: menuProducts.length + 2 });
  }

  async function confirmDeleteStore() {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return;
    await deleteStoreCascade(deleteTarget.id);
    if (menuStoreId === deleteTarget.id) setMenuStoreId("");
    setDeleteTarget(null);
    setDeleteConfirmName("");
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <header className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-lg bg-ink text-white">
                <Building2 className="size-6" />
              </div>
              <div>
                <p className="text-sm font-black text-leaf">平台管理中心</p>
                <h1 className="text-3xl font-black text-ink">多店家管理</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={seedDemoData} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 font-black text-steel">
                <Database className="size-4" />
                匯入預設資料
              </button>
              <button onClick={createStore} className="rounded-lg bg-leaf px-4 py-3 font-black text-white">
                建立店家
              </button>
              <Link href="/admin/users" className="rounded-lg border border-stone-300 bg-white px-4 py-3 font-black text-steel">
                使用者角色管理
              </Link>
              <button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
                <LogOut className="size-4" />
                登出
              </button>
            </div>
          </div>
          <p className="mt-4 max-w-3xl leading-7 text-steel">
            管理員可建立與維護店家資料、協助調整菜單、管理使用者角色，並處理不再使用的店家資料。
          </p>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {db.stores.map((store) => (
            <article key={store.id} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <img src={store.logoUrl} alt={store.name} className="size-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-black text-ink">{store.name}</p>
                  <p className="mt-1 font-mono text-sm text-steel">{store.id}</p>
                  <p className="mt-1 text-sm font-bold text-steel">綁定使用者：{linkedUserCount.get(store.id) ?? 0}</p>
                  <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-black ${store.isOpen ? "bg-leaf/10 text-leaf" : "bg-stone-100 text-stone-500"}`}>
                    {store.isOpen ? "營業中" : "休息中"}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => toggleOpen(store)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
                  {store.isOpen ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                  切換狀態
                </button>
                <Link href={`/order/${store.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-3 font-black text-steel">
                  <StoreIcon className="size-4" />
                  店家點餐頁
                </Link>
                <Link href={`/admin/stores/${store.id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-3 font-black text-steel">
                  <Edit3 className="size-4" />
                  編輯店家
                </Link>
                <Link href={`/admin/stores/${store.id}/menu`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-3 font-black text-steel">
                  <MenuSquare className="size-4" />
                  管理菜單
                </Link>
                <button onClick={() => setDeleteTarget(store)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-tomato px-4 py-3 font-black text-white">
                  <Trash2 className="size-4" />
                  刪除
                </button>
              </div>
              <StoreBindings
                storeId={store.id}
                users={storeUsers(store.id)}
                email={bindingEmail[store.id] ?? ""}
                role={bindingRole[store.id] ?? "staff"}
                onEmailChange={(value) => setBindingEmail((current) => ({ ...current, [store.id]: value }))}
                onRoleChange={(value) => setBindingRole((current) => ({ ...current, [store.id]: value }))}
                onBind={() => bindUser(store.id)}
                onRemove={(userId) => unbindStoreUser(userId, store.id)}
                onRoleUpdate={(user, nextRole) => bindStoreUser(user.email, store.id, nextRole)}
              />
            </article>
          ))}
        </section>

        {editingStore && (
          <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-ink">編輯店家</h2>
              <button onClick={() => setEditingStore(null)} className="rounded-lg border border-stone-300 px-4 py-2 font-black text-steel">關閉</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="店家名稱" value={editingStore.name} onChange={(value) => setEditingStore({ ...editingStore, name: value })} />
              <Field label="店家電話" value={editingStore.phone ?? ""} onChange={(value) => setEditingStore({ ...editingStore, phone: value })} />
              <Field label="店家 Logo" value={editingStore.logoUrl} onChange={(value) => setEditingStore({ ...editingStore, logoUrl: value })} />
              <Field label="Banner 圖片" value={editingStore.bannerUrl ?? ""} onChange={(value) => setEditingStore({ ...editingStore, bannerUrl: value })} />
              <Field label="店家地址" value={editingStore.address ?? ""} onChange={(value) => setEditingStore({ ...editingStore, address: value })} />
              <Field label="營業時間" value={editingStore.businessHours ?? ""} onChange={(value) => setEditingStore({ ...editingStore, businessHours: value })} />
              <label className="flex items-center gap-3 rounded-lg bg-stone-100 px-4 py-3 font-black text-steel">
                <input type="checkbox" checked={editingStore.isOpen} onChange={(event) => setEditingStore({ ...editingStore, isOpen: event.target.checked })} />
                營業中
              </label>
              <textarea value={editingStore.description ?? ""} onChange={(event) => setEditingStore({ ...editingStore, description: event.target.value })} placeholder="店家簡介" className="min-h-24 rounded-lg border border-stone-300 px-4 py-3 md:col-span-2" />
            </div>
            <button onClick={saveStore} className="mt-4 rounded-lg bg-leaf px-5 py-3 font-black text-white">儲存店家資料</button>
          </section>
        )}

        {menuStore && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-leaf">管理菜單</p>
                  <h2 className="text-2xl font-black text-ink">{menuStore.name}</h2>
                </div>
                <button onClick={() => setMenuStoreId("")} className="rounded-lg border border-stone-300 px-4 py-2 font-black text-steel">關閉</button>
              </div>
              <div className="mt-4 grid gap-3">
                {menuProducts.map((product) => (
                  <div key={product.id} className="grid gap-3 rounded-lg bg-[#fffaf0] p-3 md:grid-cols-[64px_1fr_auto] md:items-center">
                    <img src={product.imageUrl} alt={product.name} className="size-16 rounded-lg object-cover" />
                    <div>
                      <p className="font-black text-ink">{product.name}</p>
                      <p className="text-sm font-bold text-steel">${product.price} · {menuCategories.find((category) => category.id === product.categoryId)?.name ?? "未分類"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => upsertProduct({ ...product, isAvailable: !product.isAvailable })} className={`rounded-lg px-3 py-2 font-black ${product.isAvailable ? "bg-leaf/10 text-leaf" : "bg-stone-200 text-stone-500"}`}>
                        {product.isAvailable ? "上架中" : "已下架"}
                      </button>
                      <button onClick={() => setEditingProduct(product)} className="rounded-lg border border-stone-300 px-3 py-2 font-black text-steel">編輯</button>
                      <button onClick={() => deleteProduct(product.id)} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">刪除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-lg bg-white p-5 shadow-sm">
              <h3 className="text-xl font-black text-ink">{editingProduct.id ? "編輯商品" : "新增商品"}</h3>
              <div className="mt-4 grid gap-3">
                <Field label="商品名稱" value={editingProduct.name} onChange={(value) => setEditingProduct({ ...editingProduct, name: value })} />
                <Field label="價格" value={String(editingProduct.price)} type="number" onChange={(value) => setEditingProduct({ ...editingProduct, price: Number(value) })} />
                <select value={editingProduct.categoryId} onChange={(event) => setEditingProduct({ ...editingProduct, categoryId: event.target.value })} className="rounded-lg border border-stone-300 px-4 py-3 font-bold">
                  <option value="">選擇分類</option>
                  {menuCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <Field label="圖片網址" value={editingProduct.imageUrl} onChange={(value) => setEditingProduct({ ...editingProduct, imageUrl: value })} />
                <textarea value={editingProduct.description} onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })} placeholder="商品描述" className="min-h-24 rounded-lg border border-stone-300 px-4 py-3" />
                <label className="flex items-center gap-3 rounded-lg bg-stone-100 px-4 py-3 font-black text-steel">
                  <input type="checkbox" checked={editingProduct.isAvailable} onChange={(event) => setEditingProduct({ ...editingProduct, isAvailable: event.target.checked })} />
                  商品上架
                </label>
                <button onClick={saveProduct} className="rounded-lg bg-leaf px-4 py-3 font-black text-white">儲存商品</button>
                <button onClick={() => setEditingProduct({ ...blankProduct, storeId: menuStore.id, categoryId: menuCategories[0]?.id ?? "", sort: menuProducts.length + 1 })} className="rounded-lg border border-stone-300 px-4 py-3 font-black text-steel">清空新增</button>
              </div>
            </aside>
          </section>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft">
            <p className="text-sm font-black text-tomato">刪除店家</p>
            <h2 className="mt-2 text-2xl font-black text-ink">確定要刪除「{deleteTarget.name}」嗎？</h2>
            <p className="mt-3 leading-7 text-steel">此操作無法復原。系統會刪除店家、商品、分類、訂單，並解除使用者的 storeId 綁定。</p>
            <label className="mt-4 block text-sm font-black text-steel">請輸入店家名稱以確認刪除</label>
            <input value={deleteConfirmName} onChange={(event) => setDeleteConfirmName(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 font-bold" />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }} className="rounded-lg border border-stone-300 px-4 py-3 font-black text-steel">取消</button>
              <button onClick={confirmDeleteStore} disabled={deleteConfirmName !== deleteTarget.name} className="rounded-lg bg-tomato px-4 py-3 font-black text-white disabled:bg-stone-300">確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StoreBindings({
  storeId,
  users,
  email,
  role,
  onEmailChange,
  onRoleChange,
  onBind,
  onRemove,
  onRoleUpdate
}: {
  storeId: string;
  users: User[];
  email: string;
  role: StoreMemberRole;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: StoreMemberRole) => void;
  onBind: () => void;
  onRemove: (userId: string) => void;
  onRoleUpdate: (user: User, role: StoreMemberRole) => void;
}) {
  return (
    <section className="mt-5 rounded-lg bg-[#fffaf0] p-4">
      <h3 className="font-black text-ink">綁定使用者</h3>
      <div className="mt-3 grid gap-2">
        {users.length === 0 ? (
          <p className="rounded-lg bg-white p-3 text-sm font-bold text-steel">尚未綁定使用者</p>
        ) : users.map((user) => (
          <div key={user.id} className="grid gap-2 rounded-lg bg-white p-3">
            <div>
              <p className="font-black text-ink">{user.email}</p>
              <p className="font-mono text-xs text-steel">{user.pending ? "pending invite" : user.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={user.memberships?.[storeId] ?? "staff"} onChange={(event) => onRoleUpdate(user, event.target.value as StoreMemberRole)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold">
                {storeMemberRoles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
              </select>
              <button onClick={() => onRemove(user.id)} className="rounded-lg bg-tomato px-3 py-2 text-sm font-black text-white">移除綁定</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        <input value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="輸入使用者 Email" className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold" />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={role} onChange={(event) => onRoleChange(event.target.value as StoreMemberRole)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold">
            {storeMemberRoles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
          </select>
          <button onClick={onBind} className="rounded-lg bg-ink px-3 py-2 text-sm font-black text-white">新增綁定</button>
        </div>
      </div>
    </section>
  );
}

function roleLabel(role: StoreMemberRole) {
  if (role === "owner") return "owner 老闆";
  if (role === "manager") return "manager 店長";
  if (role === "staff") return "staff 員工";
  return "viewer 只讀/報表";
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-black text-steel">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-stone-300 px-4 py-3 font-bold text-ink" />
    </label>
  );
}
