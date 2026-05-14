"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoginGate } from "@/components/auth/login-gate";
import { useDemoStore } from "@/lib/demo-store";
import type { Store } from "@/lib/types";

export function AdminStoreEdit({ storeId }: { storeId: string }) {
  return (
    <LoginGate allowedRoles={["systemAdmin"]} title="平台管理中心登入">
      {() => <AdminStoreEditContent storeId={storeId} />}
    </LoginGate>
  );
}

function AdminStoreEditContent({ storeId }: { storeId: string }) {
  const { db, upsertStore } = useDemoStore({ admin: true });
  const store = db.stores.find((item) => item.id === storeId);
  const [form, setForm] = useState<Store | null>(null);

  useEffect(() => {
    if (store) setForm(store);
  }, [store]);

  if (!store || !form) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4 font-black text-steel">載入店家資料...</main>;
  }

  function save() {
    if (!form?.name.trim()) return;
    upsertStore(form);
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 sm:p-6">
      <section className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-soft">
        <p className="text-sm font-black text-leaf">平台管理中心</p>
        <h1 className="mt-2 text-3xl font-black text-ink">編輯店家</h1>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Field label="店家名稱" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Field label="店家電話" value={form.phone ?? ""} onChange={(value) => setForm({ ...form, phone: value })} />
          <Field label="店家地址" value={form.address ?? ""} onChange={(value) => setForm({ ...form, address: value })} />
          <Field label="營業時間" value={form.businessHours ?? ""} onChange={(value) => setForm({ ...form, businessHours: value })} />
          <Field label="Logo 圖片網址" value={form.logoUrl} onChange={(value) => setForm({ ...form, logoUrl: value })} />
          <Field label="Banner 圖片網址" value={form.bannerUrl ?? ""} onChange={(value) => setForm({ ...form, bannerUrl: value })} />
          <label className="flex items-center gap-3 rounded-lg bg-stone-100 px-4 py-3 font-black text-steel">
            <input type="checkbox" checked={form.isOpen} onChange={(event) => setForm({ ...form, isOpen: event.target.checked })} />
            營業中
          </label>
          <textarea value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="店家簡介" className="min-h-24 rounded-lg border border-stone-300 px-4 py-3 md:col-span-2" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={save} className="rounded-lg bg-leaf px-5 py-3 font-black text-white">儲存店家資料</button>
          <Link href="/admin" className="rounded-lg border border-stone-300 px-5 py-3 font-black text-steel">回多店家管理</Link>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-black text-steel">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-stone-300 px-4 py-3 font-bold text-ink" />
    </label>
  );
}
