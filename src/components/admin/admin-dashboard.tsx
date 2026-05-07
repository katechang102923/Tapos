"use client";

import Link from "next/link";
import { Building2, Database, LogOut, Power, PowerOff, Store as StoreIcon } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import type { Store } from "@/lib/types";

export function AdminDashboard() {
  return (
    <LoginGate allowedRoles={["admin"]} title="管理員後台登入">
      {({ signOutUser }) => <AdminDashboardContent onSignOut={signOutUser} />}
    </LoginGate>
  );
}

function AdminDashboardContent({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const { db, seedDemoData, upsertStore } = useDemoStore({ admin: true });

  function toggleOpen(store: Store) {
    upsertStore({ ...store, isOpen: !store.isOpen });
  }

  function createStore() {
    const id = `store-${Date.now()}`;
    upsertStore({
      id,
      name: "新早餐店",
      logoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=400&q=80",
      isOpen: false,
      notice: "歡迎使用 QR 點餐",
      createdAt: new Date().toISOString()
    });
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
                <p className="text-sm font-black text-leaf">SaaS Admin Console</p>
                <h1 className="text-3xl font-black text-ink">多店家管理</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={seedDemoData} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 font-black text-steel">
                <Database className="size-4" />
                匯入 Demo 資料
              </button>
              <button onClick={createStore} className="rounded-lg bg-leaf px-4 py-3 font-black text-white">
                建立店家
              </button>
              <button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
                <LogOut className="size-4" />
                登出
              </button>
            </div>
          </div>
          <p className="mt-4 max-w-3xl leading-7 text-steel">
            每筆營運資料都以 <code>storeId</code> 隔離。管理員可建立店家；店家帳號則透過 <code>users/&lbrace;uid&rbrace;.storeId</code> 只能讀寫自己的分類、商品與訂單。
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
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
