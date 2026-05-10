import type { CashFlow, DailyReport, DailyReportProduct, HourSlotStat, Order, PaymentMethod, PaymentMethodStat } from "./types";

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  linepay: "LINE Pay",
  card: "信用卡",
  jkopay: "街口支付",
  ubereats: "Uber Eats",
  foodpanda: "Foodpanda",
  transfer: "轉帳",
  other: "其他",
  unknown: "未指定",
};

const HOUR_SLOT_DEFS = [
  { key: "06-08", start: 6, end: 8 },
  { key: "08-10", start: 8, end: 10 },
  { key: "10-12", start: 10, end: 12 },
  { key: "12-14", start: 12, end: 14 },
  { key: "14-16", start: 14, end: 16 },
  { key: "16-18", start: 16, end: 18 },
  { key: "18-20", start: 18, end: 20 },
  { key: "20-22", start: 20, end: 22 },
];

export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dailyReportId(storeId: string, date: string): string {
  return `${storeId}-${date}`;
}

export function computePaymentStats(orders: Order[]): PaymentMethodStat[] {
  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount ?? o.total), 0);
  const map = new Map<string, { count: number; amount: number }>();
  orders.forEach((o) => {
    const method = o.paymentMethod ?? "unknown";
    const existing = map.get(method) ?? { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += o.totalAmount ?? o.total;
    map.set(method, existing);
  });
  return [...map.entries()]
    .map(([method, { count, amount }]) => ({
      method: method as PaymentMethod | "unknown",
      label: PAYMENT_LABELS[method] ?? method,
      count,
      amount,
      percent: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeHourSlots(orders: Order[]): HourSlotStat[] {
  const slots = HOUR_SLOT_DEFS.map((def) => {
    const slotOrders = orders.filter((o) => {
      const h = new Date(o.createdAt).getHours();
      return h >= def.start && h < def.end;
    });
    return {
      slot: def.key,
      orderCount: slotOrders.length,
      revenue: slotOrders.reduce((sum, o) => sum + (o.totalAmount ?? o.total), 0),
      isPeak: false,
    };
  });
  const maxRevenue = Math.max(...slots.map((s) => s.revenue));
  if (maxRevenue > 0) {
    const peakIdx = slots.findIndex((s) => s.revenue === maxRevenue);
    if (peakIdx >= 0) slots[peakIdx].isPeak = true;
  }
  return slots;
}

export function computeDailyReport(
  storeId: string,
  date: string,
  orders: Order[],
  cashFlows: CashFlow[],
  generatedBy?: string
): DailyReport {
  const dayOrders = orders.filter((o) => o.storeId === storeId && new Date(o.createdAt).toDateString() === new Date(date).toDateString());
  const completed = dayOrders.filter((o) => o.status === "completed");
  const cancelled = dayOrders.filter((o) => o.status === "cancelled");
  const active = dayOrders.filter((o) => o.status !== "cancelled");

  const totalRevenue = active.reduce((sum, o) => sum + (o.totalAmount ?? o.total), 0);
  const completedRevenue = completed.reduce((sum, o) => sum + (o.totalAmount ?? o.total), 0);
  const averageOrderValue = completed.length ? Math.round(completedRevenue / completed.length) : 0;

  const dayFlows = cashFlows.filter((f) => f.storeId === storeId && new Date(f.createdAt).toDateString() === new Date(date).toDateString());
  const cashIncome = dayFlows.filter((f) => f.type === "income").reduce((sum, f) => sum + f.amount, 0);
  const cashExpense = dayFlows.filter((f) => f.type === "expense").reduce((sum, f) => sum + f.amount, 0);
  const cashNet = cashIncome - cashExpense;

  const productMap = new Map<string, DailyReportProduct>();
  completed.forEach((order) => {
    order.items.forEach((item) => {
      const existing = productMap.get(item.productId) ?? { productId: item.productId, productName: item.productName, quantity: 0, totalAmount: 0 };
      existing.quantity += item.quantity;
      existing.totalAmount += item.quantity * item.unitPrice;
      productMap.set(item.productId, existing);
    });
  });
  const products = [...productMap.values()].sort((a, b) => b.quantity - a.quantity);

  return {
    id: dailyReportId(storeId, date),
    storeId,
    date,
    generatedAt: new Date().toISOString(),
    generatedBy,
    orderCount: dayOrders.length,
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    totalRevenue,
    completedRevenue,
    averageOrderValue,
    cashIncome,
    cashExpense,
    cashNet,
    estimatedCashBalance: completedRevenue + cashNet,
    products,
    paymentStats: computePaymentStats(completed),
    hourSlots: computeHourSlots(dayOrders),
  };
}

export function reportEmailHtml(report: DailyReport, storeName: string): string {
  const top10 = report.products.slice(0, 10);
  const productRows = top10.map((p, i) => `<tr><td>${i + 1}</td><td>${p.productName}</td><td>${p.quantity}</td><td>$${p.totalAmount}</td></tr>`).join("");
  const paymentRows = (report.paymentStats ?? []).map((s) => `<tr><td>${s.label}</td><td>${s.count}</td><td>$${s.amount}</td><td>${s.percent}%</td></tr>`).join("");
  return `
<h2>${storeName} 日結報表 ${report.date}</h2>
<table border="1" cellpadding="6" cellspacing="0">
  <tr><th>項目</th><th>數值</th></tr>
  <tr><td>訂單總數</td><td>${report.orderCount}</td></tr>
  <tr><td>完成訂單數</td><td>${report.completedCount}</td></tr>
  <tr><td>取消訂單數</td><td>${report.cancelledCount}</td></tr>
  <tr><td>今日營收</td><td>$${report.totalRevenue}</td></tr>
  <tr><td>已完成訂單金額</td><td>$${report.completedRevenue}</td></tr>
  <tr><td>平均客單價</td><td>$${report.averageOrderValue}</td></tr>
  <tr><td>現金收入</td><td>$${report.cashIncome}</td></tr>
  <tr><td>現金支出</td><td>$${report.cashExpense}</td></tr>
  <tr><td>現金淨額</td><td>$${report.cashNet}</td></tr>
  <tr><td>預估現金結餘</td><td>$${report.estimatedCashBalance}</td></tr>
</table>
${paymentRows ? `
<h3>付款方式統計</h3>
<table border="1" cellpadding="6" cellspacing="0">
  <tr><th>付款方式</th><th>筆數</th><th>金額</th><th>佔比</th></tr>
  ${paymentRows}
</table>` : ""}
${top10.length > 0 ? `
<h3>商品銷售 TOP 10</h3>
<table border="1" cellpadding="6" cellspacing="0">
  <tr><th>#</th><th>商品名稱</th><th>數量</th><th>金額</th></tr>
  ${productRows}
</table>` : ""}
<p>報表產生時間：${new Date(report.generatedAt).toLocaleString("zh-TW")}</p>
`.trim();
}
