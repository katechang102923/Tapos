"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Clock3, CreditCard, ReceiptText, Trophy } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { DailyReportPanel } from "@/components/merchant/daily-report-panel";
import { useDemoStore } from "@/lib/demo-store";
import { accessibleStoreIds, defaultStoreId, isPlatformAdmin } from "@/lib/store-access";
import type { CashFlow, Order, PaymentMethod, User } from "@/lib/types";

const paymentLabels: Record<string, string> = {
  cash: "現金",
  stored_value: "儲值金",
  linepay: "Line Pay",
  card: "信用卡",
  other: "其他",
  unknown: "未紀錄"
};

export default function MerchantReportsPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "viewer"]} title="報表中心">
      {({ profile }) => <ReportsShell profile={profile} />}
    </LoginGate>
  );
}

function ReportsShell({ profile }: { profile: User | null }) {
  const isAdmin = isPlatformAdmin(profile);
  const { db: adminDb } = useDemoStore({ admin: isAdmin, skipOrderList: true });
  const storeIds = isAdmin ? adminDb.stores.filter((store) => !store.isDeleted).map((store) => store.id) : accessibleStoreIds(profile);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId(profile) || storeIds[0] || "");
  const storeId = storeIds.includes(selectedStoreId) ? selectedStoreId : storeIds[0] || "";
  const { db, todayCashFlows, todayOrders } = useDemoStore({ storeId, loadCustomers: true, todayOrdersOnly: true });
  const store = db.stores.find((item) => item.id === storeId) ?? adminDb.stores.find((item) => item.id === storeId);
  const storeName = store?.name || "未命名店家";
  const completedOrders = todayOrders.filter((order) => order.status === "completed");
  const cancelledOrders = todayOrders.filter((order) => order.status === "cancelled");
  const completedRevenue = completedOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const averageOrderValue = completedOrders.length ? Math.round(completedRevenue / completedOrders.length) : 0;
  const ranking = useMemo(() => productRanking(completedOrders), [completedOrders]);
  const paymentStats = useMemo(() => paymentSummary(completedOrders), [completedOrders]);
  const hourlyStats = useMemo(() => hourlySummary(completedOrders), [completedOrders]);
  const cashIncome = todayCashFlows.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const cashExpense = todayCashFlows.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);

  if (!storeId) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4"><div className="rounded-lg bg-white p-6 font-black text-ink shadow-soft">尚未取得可查看的店家。</div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-3 rounded-lg bg-[#172033] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white/60">日報與銷售狀況</p>
            <h1 className="mt-1 text-3xl font-black">{storeName} 日報與銷售狀況</h1>
            <p className="mt-2 text-sm font-bold text-white/65">營收統計、商品排行、付款方式與時段分析集中管理。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && storeIds.length > 1 && (
              <select value={storeId} onChange={(event) => setSelectedStoreId(event.target.value)} className="rounded-lg border border-white/20 bg-white px-4 py-3 font-black text-ink">
                {storeIds.map((id) => <option key={id} value={id}>{adminDb.stores.find((storeItem) => storeItem.id === id)?.name ?? id}</option>)}
              </select>
            )}
            <Link href="/merchant/pos" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20"><ReceiptText className="size-4" />POS 前台</Link>
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink"><ArrowLeft className="size-4" />返回後台</Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric icon={BarChart3} label="今日營收" value={`$${completedRevenue}`} />
          <Metric icon={ReceiptText} label="今日訂單數" value={`${todayOrders.length}`} />
          <Metric icon={Trophy} label="平均客單價" value={`$${averageOrderValue}`} />
          <Metric icon={Clock3} label="已取消訂單" value={`${cancelledOrders.length}`} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">商品銷售排行</h2>
            <div className="mt-4 space-y-2">
              {ranking.length === 0 ? <p className="rounded-lg bg-stone-50 p-4 text-sm font-bold text-steel">尚無銷售資料</p> : ranking.map((item, index) => (
                <div key={item.productId} className="grid grid-cols-[40px_1fr_80px_100px] items-center gap-2 rounded-lg bg-stone-50 px-3 py-3 text-sm">
                  <span className="font-black text-steel">#{index + 1}</span>
                  <span className="font-black">{item.productName}</span>
                  <span className="font-bold text-steel">{item.quantity} 份</span>
                  <span className="text-right font-black text-tomato">${item.totalAmount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">付款方式統計</h2>
            <div className="mt-4 space-y-2">
              {paymentStats.map((item) => (
                <div key={item.method} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-3">
                  <div className="flex items-center gap-2"><CreditCard className="size-4 text-steel" /><span className="font-black">{paymentLabels[item.method] ?? item.method}</span></div>
                  <span className="font-black text-tomato">${item.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">時段分析</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {hourlyStats.map((slot) => <div key={slot.label} className="rounded-lg bg-stone-50 p-3"><p className="text-sm font-black text-steel">{slot.label}</p><p className="mt-1 text-2xl font-black">${slot.revenue}</p><p className="text-xs font-bold text-steel">{slot.count} 筆訂單</p></div>)}
          </div>
        </section>

        <section id="daily-close" className="mt-5">
          <DailyReportPanel storeId={storeId} storeName={storeName} todayOrders={todayOrders} todayCashFlows={todayCashFlows} userEmail={profile?.email} userRole={profile?.role} storeFeatures={store?.features} customers={db.customers} pointLogs={db.pointLogs} storedValueLogs={db.storedValueLogs} dataRetentionMonths={store?.dataRetentionMonths ?? undefined} />
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric icon={BarChart3} label="現金收入" value={`$${cashIncome}`} />
          <Metric icon={BarChart3} label="現金支出" value={`$${cashExpense}`} />
          <Metric icon={BarChart3} label="現金流淨額" value={`$${cashIncome - cashExpense}`} />
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-black text-steel">{label}</p><Icon className="size-5 text-steel" /></div><p className="mt-3 text-3xl font-black">{value}</p></div>;
}

function orderTotal(order: Order) {
  return order.totalAmount ?? order.total ?? 0;
}

function productRanking(orders: Order[]) {
  const map = new Map<string, { productId: string; productName: string; quantity: number; totalAmount: number }>();
  orders.forEach((order) => order.items?.forEach((item) => {
    const current = map.get(item.productId) ?? { productId: item.productId, productName: item.productName || item.name || "未命名商品", quantity: 0, totalAmount: 0 };
    current.quantity += item.quantity;
    current.totalAmount += item.quantity * (item.finalPrice ?? item.price ?? item.unitPrice ?? 0);
    map.set(item.productId, current);
  }));
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
}

function paymentSummary(orders: Order[]) {
  const map = new Map<string, { method: string; amount: number }>();
  orders.forEach((order) => {
    const method = order.paymentMethod ?? "unknown";
    const current = map.get(method) ?? { method, amount: 0 };
    current.amount += orderTotal(order);
    map.set(method, current);
  });
  return [...map.values()] as Array<{ method: PaymentMethod | "unknown"; amount: number }>;
}

function hourlySummary(orders: Order[]) {
  const slots = [
    { label: "06-10", start: 6, end: 10, revenue: 0, count: 0 },
    { label: "10-14", start: 10, end: 14, revenue: 0, count: 0 },
    { label: "14-18", start: 14, end: 18, revenue: 0, count: 0 },
    { label: "18-24", start: 18, end: 24, revenue: 0, count: 0 }
  ];
  orders.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    const slot = slots.find((item) => hour >= item.start && hour < item.end) ?? slots[0];
    slot.count += 1;
    slot.revenue += orderTotal(order);
  });
  return slots;
}
