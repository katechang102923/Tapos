import type { CashFlow, DailyReport, DailyReportProduct, Order } from "./types";

export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dailyReportId(storeId: string, date: string): string {
  return `${storeId}-${date}`;
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
    products
  };
}

export function reportEmailHtml(report: DailyReport, storeName: string): string {
  const top10 = report.products.slice(0, 10);
  const rows = top10.map((p, i) => `<tr><td>${i + 1}</td><td>${p.productName}</td><td>${p.quantity}</td><td>$${p.totalAmount}</td></tr>`).join("");
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
${top10.length > 0 ? `
<h3>商品銷售 TOP 10</h3>
<table border="1" cellpadding="6" cellspacing="0">
  <tr><th>#</th><th>商品名稱</th><th>數量</th><th>金額</th></tr>
  ${rows}
</table>` : ""}
<p>報表產生時間：${new Date(report.generatedAt).toLocaleString("zh-TW")}</p>
`.trim();
}
