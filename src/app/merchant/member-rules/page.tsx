"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { LoginGate } from "@/components/auth/login-gate";
import { firebaseEnabled, firestore } from "@/lib/firebase";
import { defaultStoreId } from "@/lib/store-access";
import type { MemberRules, RewardCoupon } from "@/lib/types";

const defaultRules: MemberRules = {
  enablePoints: true,
  earnAmount: 100,
  earnPoints: 1,
  pointValue: 1,
  enableCouponExchange: true,
  birthdayRewardEnabled: false,
  birthdayRewardPoints: 0
};

export default function MemberRulesPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager"]} title="會員點數規則">
      {({ profile }) => <MemberRulesContent storeId={defaultStoreId(profile)} />}
    </LoginGate>
  );
}

function MemberRulesContent({ storeId }: { storeId: string }) {
  const [rules, setRules] = useState<MemberRules>(defaultRules);
  const [coupons, setCoupons] = useState<RewardCoupon[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", type: "discount" as RewardCoupon["type"], pointsCost: "10", discountAmount: "10", exchangeItemName: "", enabled: true });

  useEffect(() => {
    if (!storeId || !firebaseEnabled || !firestore) return;
    const unsubRules = onSnapshot(doc(firestore, "stores", storeId, "settings", "memberRules"), (snapshot) => {
      setRules({ ...defaultRules, ...(snapshot.exists() ? snapshot.data() : {}) } as MemberRules);
    });
    const unsubCoupons = onSnapshot(collection(firestore, "stores", storeId, "rewardCoupons"), (snapshot) => {
      setCoupons(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as RewardCoupon));
    });
    return () => {
      unsubRules();
      unsubCoupons();
    };
  }, [storeId]);

  const sortedCoupons = useMemo(() => [...coupons].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")), [coupons]);

  async function saveRules() {
    if (!firestore || !storeId) return;
    await setDoc(doc(firestore, "stores", storeId, "settings", "memberRules"), { ...rules, updatedAt: new Date().toISOString() }, { merge: true });
    setMessage("會員點數規則已儲存");
  }

  async function saveCoupon() {
    if (!firestore || !storeId || !form.title.trim()) return;
    const now = new Date().toISOString();
    const ref = doc(collection(firestore, "stores", storeId, "rewardCoupons"));
    await setDoc(ref, {
      id: ref.id,
      storeId,
      title: form.title.trim(),
      type: form.type,
      pointsCost: Number(form.pointsCost) || 0,
      discountAmount: Number(form.discountAmount) || 0,
      exchangeItemName: form.exchangeItemName.trim(),
      enabled: form.enabled,
      createdAt: now,
      updatedAt: now
    });
    setForm({ title: "", type: "discount", pointsCost: "10", discountAmount: "10", exchangeItemName: "", enabled: true });
    setMessage("兌換券已新增");
  }

  async function toggleCoupon(coupon: RewardCoupon) {
    if (!firestore) return;
    await updateDoc(doc(firestore, "stores", storeId, "rewardCoupons", coupon.id), { enabled: !coupon.enabled, updatedAt: new Date().toISOString() });
  }

  async function removeCoupon(couponId: string) {
    if (!firestore) return;
    await deleteDoc(doc(firestore, "stores", storeId, "rewardCoupons", couponId));
  }

  if (!storeId) return <main className="grid min-h-screen place-items-center bg-[#fff7e8] p-4"><div className="rounded-lg bg-white p-6 font-black shadow-soft">請先完成店家綁定</div></main>;

  return (
    <main className="min-h-screen bg-[#fff7e8] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-black text-steel shadow-sm hover:text-ink">
            <ArrowLeft className="size-4" />返回後台
          </Link>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_420px]">
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-leaf">會員設定</p>
          <h1 className="mt-1 text-3xl font-black">會員點數規則</h1>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Toggle label="啟用點數" checked={rules.enablePoints} onChange={(value) => setRules((current) => ({ ...current, enablePoints: value }))} />
            <Toggle label="啟用點數兌換券" checked={rules.enableCouponExchange} onChange={(value) => setRules((current) => ({ ...current, enableCouponExchange: value }))} />
            <NumberField label="消費滿多少元" value={rules.earnAmount} onChange={(value) => setRules((current) => ({ ...current, earnAmount: value }))} />
            <NumberField label="贈送幾點" value={rules.earnPoints} onChange={(value) => setRules((current) => ({ ...current, earnPoints: value }))} />
            <NumberField label="1 點可折抵多少元" value={rules.pointValue} onChange={(value) => setRules((current) => ({ ...current, pointValue: value }))} />
            <Toggle label="啟用生日禮" checked={rules.birthdayRewardEnabled} onChange={(value) => setRules((current) => ({ ...current, birthdayRewardEnabled: value }))} />
            <NumberField label="生日禮點數" value={rules.birthdayRewardPoints} onChange={(value) => setRules((current) => ({ ...current, birthdayRewardPoints: value }))} />
          </div>
          <button onClick={saveRules} className="mt-5 rounded-lg bg-leaf px-5 py-3 font-black text-white">儲存規則</button>
          {message && <p className="mt-3 rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">{message}</p>}
        </section>

        <aside className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">點數兌換券</h2>
          <div className="mt-4 grid gap-3">
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="券名稱" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as RewardCoupon["type"] }))} className="rounded-lg border border-orange-100 px-3 py-3 font-bold">
              <option value="discount">折價券</option>
              <option value="exchange">兌換券</option>
            </select>
            <input value={form.pointsCost} onChange={(event) => setForm((current) => ({ ...current, pointsCost: event.target.value }))} type="number" placeholder="所需點數" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
            <input value={form.discountAmount} onChange={(event) => setForm((current) => ({ ...current, discountAmount: event.target.value }))} type="number" placeholder="折抵金額" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
            <input value={form.exchangeItemName} onChange={(event) => setForm((current) => ({ ...current, exchangeItemName: event.target.value }))} placeholder="兌換品名稱" className="rounded-lg border border-orange-100 px-3 py-3 font-bold" />
            <Toggle label="啟用" checked={form.enabled} onChange={(value) => setForm((current) => ({ ...current, enabled: value }))} />
            <button onClick={saveCoupon} className="rounded-lg bg-ink px-4 py-3 font-black text-white">新增兌換券</button>
          </div>
          <div className="mt-5 space-y-3">
            {sortedCoupons.map((coupon) => (
              <div key={coupon.id} className="rounded-lg bg-orange-50 p-3">
                <p className="font-black">{coupon.title}</p>
                <p className="text-sm font-bold text-steel">{coupon.pointsCost} 點 ｜ {coupon.type === "discount" ? `折 $${coupon.discountAmount}` : coupon.exchangeItemName}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => toggleCoupon(coupon)} className="rounded-lg bg-white px-3 py-2 text-sm font-black text-ink">{coupon.enabled ? "停用" : "啟用"}</button>
                  <button onClick={() => removeCoupon(coupon.id)} className="rounded-lg bg-tomato px-3 py-2 text-sm font-black text-white">刪除</button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1 text-sm font-black text-steel">{label}<input value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} type="number" className="rounded-lg border border-orange-100 px-3 py-3 font-bold text-ink" /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-3 text-sm font-black text-ink">{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5" /></label>;
}
