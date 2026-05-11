/**
 * CSV / HTML export utilities for daily backup downloads.
 * All CSV files are UTF-8 with BOM so Excel opens them correctly.
 */

import type { CashFlow, DailyReport, Order, PaymentMethodStat, PointLog, StoredValueLog } from "./types";

// ─── Internal helpers ──────────────────────────────────────────────────────────

const BOM = "﻿";

function escapeCsv(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCsv).join(",");
}

function formatTs(iso: string): string {
  try { return new Date(iso).toLocaleString("zh-TW"); } catch { return iso; }
}

// ─── Download helpers ──────────────────────────────────────────────────────────

export function downloadBlob(filename: string, content: string, mimeType = "text/csv;charset=utf-8;") {
  const blob = new Blob([BOM + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 1. 交易明細 CSV ──────────────────────────────────────────────────────────

export function generateTransactionsCsv(orders: Order[], categoryMap?: Map<string, string>): string {
  const headers = [
    "訂單時間", "訂單編號", "來源", "模式",
    "商品名稱", "數量", "原價", "單品折扣", "整單折扣", "活動折扣", "實收金額",
    "付款方式", "會員姓名", "會員電話", "訂單狀態", "備註"
  ];
  const lines: string[] = [row(headers)];

  for (const order of orders) {
    const itemDiscountTotal = order.items.reduce((s, item) => s + (item.discount?.amount ?? 0), 0);
    const orderDiscAmt = order.orderDiscount?.amount ?? 0;
    const promoAmt = (order.promotionDiscounts ?? []).reduce((s, p) => s + p.amount, 0);
    const payMethod = order.paymentMethod ?? "";
    const memberName = order.customer?.name ?? "";
    const memberPhone = order.customer?.phone ?? "";

    if (order.items.length === 0) {
      lines.push(row([
        formatTs(order.createdAt), order.orderNumber,
        order.source === "pos" ? "POS" : order.source === "qr" ? "QR" : "KIOSK",
        order.mode === "dine-in" ? "內用" : "外帶",
        "（無品項）", 0, 0, 0, orderDiscAmt, promoAmt, order.total,
        payMethod, memberName, memberPhone, order.status, order.customerNote ?? ""
      ]));
    } else {
      order.items.forEach((item, idx) => {
        const itemDisc = item.discount?.amount ?? 0;
        lines.push(row([
          formatTs(order.createdAt), order.orderNumber,
          order.source === "pos" ? "POS" : order.source === "qr" ? "QR" : "KIOSK",
          order.mode === "dine-in" ? "內用" : "外帶",
          item.productName, item.quantity, item.unitPrice,
          itemDisc,
          idx === 0 ? orderDiscAmt : 0,
          idx === 0 ? promoAmt : 0,
          idx === 0 ? order.total : "",
          idx === 0 ? payMethod : "",
          idx === 0 ? memberName : "",
          idx === 0 ? memberPhone : "",
          idx === 0 ? order.status : "",
          idx === 0 ? (order.customerNote ?? "") : ""
        ]));
      });
    }
  }

  return lines.join("\n");
}

// ─── 2. 商品銷售 CSV ──────────────────────────────────────────────────────────

export function generateProductSalesCsv(report: DailyReport): string {
  const headers = ["商品名稱", "銷售數量", "銷售金額", "折扣金額"];
  const lines: string[] = [row(headers)];

  for (const p of report.products) {
    lines.push(row([p.productName, p.quantity, p.totalAmount, ""]));
  }

  // Summary row
  const totalQty = report.products.reduce((s, p) => s + p.quantity, 0);
  const totalAmt = report.products.reduce((s, p) => s + p.totalAmount, 0);
  lines.push(row(["合計", totalQty, totalAmt, report.discountSummary?.totalDiscount ?? 0]));

  return lines.join("\n");
}

// ─── 3. 現金流 CSV ────────────────────────────────────────────────────────────

export function generateCashFlowCsv(cashFlows: CashFlow[]): string {
  const headers = ["時間", "類型", "項目名稱", "金額", "備註", "操作員"];
  const lines: string[] = [row(headers)];

  for (const cf of cashFlows) {
    lines.push(row([
      formatTs(cf.createdAt),
      cf.type === "income" ? "收入" : "支出",
      cf.itemName ?? cf.category ?? "",
      cf.amount,
      cf.note ?? "",
      cf.createdBy ?? ""
    ]));
  }

  const income = cashFlows.filter((c) => c.type === "income").reduce((s, c) => s + c.amount, 0);
  const expense = cashFlows.filter((c) => c.type === "expense").reduce((s, c) => s + c.amount, 0);
  lines.push(row(["合計收入", "", "", income, "", ""]));
  lines.push(row(["合計支出", "", "", expense, "", ""]));
  lines.push(row(["淨額", "", "", income - expense, "", ""]));

  return lines.join("\n");
}

// ─── 4. 付款方式統計 CSV ──────────────────────────────────────────────────────

export function generatePaymentStatsCsv(stats: PaymentMethodStat[]): string {
  const headers = ["付款方式", "筆數", "金額", "佔比(%)"];
  const lines: string[] = [row(headers)];

  for (const s of stats) {
    lines.push(row([s.label, s.count, s.amount, s.percent]));
  }

  const total = stats.reduce((s, r) => s + r.amount, 0);
  const totalCount = stats.reduce((s, r) => s + r.count, 0);
  lines.push(row(["合計", totalCount, total, 100]));

  return lines.join("\n");
}

// ─── 5. 會員點數異動 CSV ──────────────────────────────────────────────────────

const POINT_LOG_TYPE_LABELS: Record<string, string> = {
  earn: "消費獲點", redeem: "點數兌換", adjust: "手動調整", rollback: "點數回滾"
};

export function generatePointLogsCsv(logs: PointLog[], customerMap?: Map<string, { name: string; phone: string }>): string {
  const headers = ["時間", "操作類型", "點數變動", "關聯訂單", "備註", "操作員", "會員姓名", "會員電話"];
  const lines: string[] = [row(headers)];

  for (const log of logs) {
    const customer = customerMap?.get(log.customerId);
    lines.push(row([
      formatTs(log.createdAt),
      POINT_LOG_TYPE_LABELS[log.type] ?? log.type,
      log.points >= 0 ? `+${log.points}` : String(log.points),
      log.orderId ?? "",
      log.note ?? "",
      log.createdBy ?? "",
      customer?.name ?? "",
      customer?.phone ?? ""
    ]));
  }

  return lines.join("\n");
}

// ─── 6. 儲值金異動 CSV ────────────────────────────────────────────────────────

const SV_LOG_TYPE_LABELS: Record<string, string> = {
  topup: "儲值加值", spend: "儲值消費", adjust: "手動調整", refund: "退款"
};

export function generateStoredValueLogsCsv(logs: StoredValueLog[], customerMap?: Map<string, { name: string; phone: string }>): string {
  const headers = ["時間", "操作類型", "金額變動", "異動前餘額", "異動後餘額", "關聯訂單", "備註", "操作員", "會員姓名", "會員電話"];
  const lines: string[] = [row(headers)];

  for (const log of logs) {
    const customer = customerMap?.get(log.customerId);
    lines.push(row([
      formatTs(log.createdAt),
      SV_LOG_TYPE_LABELS[log.type] ?? log.type,
      log.amount >= 0 ? `+${log.amount}` : String(log.amount),
      log.beforeBalance,
      log.afterBalance,
      log.orderId ?? "",
      log.note ?? "",
      log.createdBy ?? "",
      customer?.name ?? "",
      customer?.phone ?? ""
    ]));
  }

  return lines.join("\n");
}

// ─── 7. 日結報表 HTML ─────────────────────────────────────────────────────────

export function generateReportHtml(
  report: DailyReport,
  storeName: string,
  cashFlows: CashFlow[],
  pointLogs?: PointLog[],
  storedValueLogs?: StoredValueLog[]
): string {
  const genTime = new Date(report.generatedAt).toLocaleString("zh-TW");
  const payStats = report.paymentStats ?? [];
  const topProducts = report.products.slice(0, 10);

  function tableRow(label: string, value: string) {
    return `<tr><td style="padding:4px 8px;font-weight:bold;color:#666">${label}</td><td style="padding:4px 8px;text-align:right;font-weight:900">${value}</td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>${storeName} 日結報表 ${report.date}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans TC',Arial,sans-serif;background:#fff;color:#222;padding:20px;max-width:900px;margin:0 auto}
h1{font-size:22px;font-weight:900;text-align:center;margin-bottom:4px}
h2{font-size:15px;font-weight:900;background:#f5f5f5;padding:6px 10px;margin:16px 0 6px;border-left:4px solid #e63946}
.meta{text-align:center;font-size:12px;color:#888;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#333;color:#fff;padding:6px 8px;text-align:left;font-weight:900}
td{padding:5px 8px;border-bottom:1px solid #eee}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px}
.metric{border:1px solid #eee;border-radius:6px;padding:10px 14px}
.metric .label{font-size:11px;color:#888;font-weight:700}
.metric .value{font-size:22px;font-weight:900;color:#e63946}
.footer{margin-top:32px;padding-top:16px;border-top:2px solid #222;font-size:11px;color:#888;text-align:center}
</style>
</head>
<body>
<h1>${storeName}</h1>
<p class="meta">日結日期：${report.date}　　產生時間：${genTime}</p>

<h2>營收摘要</h2>
<div class="summary-grid">
  <div class="metric"><div class="label">總營收</div><div class="value">$${report.totalRevenue.toLocaleString()}</div></div>
  <div class="metric"><div class="label">完成訂單</div><div class="value">${report.completedCount} 筆</div></div>
  <div class="metric"><div class="label">完成金額</div><div class="value">$${report.completedRevenue.toLocaleString()}</div></div>
  <div class="metric"><div class="label">取消訂單</div><div class="value">${report.cancelledCount} 筆</div></div>
  <div class="metric"><div class="label">平均客單價</div><div class="value">$${report.averageOrderValue}</div></div>
  ${report.discountSummary ? `<div class="metric"><div class="label">總折扣</div><div class="value">-$${report.discountSummary.totalDiscount.toLocaleString()}</div></div>` : ""}
</div>

<h2>現金流</h2>
<table>
  <tbody>
    ${tableRow("現金收入", `$${report.cashIncome.toLocaleString()}`)}
    ${tableRow("現金支出", `$${report.cashExpense.toLocaleString()}`)}
    ${tableRow("現金淨額", `$${report.cashNet.toLocaleString()}`)}
    ${tableRow("預估現金結餘", `$${report.estimatedCashBalance.toLocaleString()}`)}
  </tbody>
</table>

${cashFlows.length > 0 ? `
<h2>現金流明細</h2>
<table>
<thead><tr><th>時間</th><th>類型</th><th>項目</th><th>金額</th><th>備註</th></tr></thead>
<tbody>
${cashFlows.map((c) => `<tr><td>${formatTs(c.createdAt)}</td><td>${c.type === "income" ? "收入" : "支出"}</td><td>${c.itemName ?? c.category ?? ""}</td><td style="text-align:right">${c.type === "income" ? "+" : "-"}$${c.amount}</td><td>${c.note ?? ""}</td></tr>`).join("")}
</tbody></table>` : ""}

${payStats.length > 0 ? `
<h2>付款方式統計</h2>
<table>
<thead><tr><th>付款方式</th><th style="text-align:right">筆數</th><th style="text-align:right">金額</th><th style="text-align:right">佔比</th></tr></thead>
<tbody>
${payStats.map((s) => `<tr><td>${s.label}</td><td style="text-align:right">${s.count}</td><td style="text-align:right">$${s.amount.toLocaleString()}</td><td style="text-align:right">${s.percent}%</td></tr>`).join("")}
</tbody></table>` : ""}

${topProducts.length > 0 ? `
<h2>商品銷售 TOP 10</h2>
<table>
<thead><tr><th>#</th><th>商品名稱</th><th style="text-align:right">數量</th><th style="text-align:right">金額</th></tr></thead>
<tbody>
${topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.productName}</td><td style="text-align:right">${p.quantity}</td><td style="text-align:right">$${p.totalAmount.toLocaleString()}</td></tr>`).join("")}
</tbody></table>` : ""}

${pointLogs && pointLogs.length > 0 ? `
<h2>會員點數異動（${pointLogs.length} 筆）</h2>
<table>
<thead><tr><th>時間</th><th>類型</th><th style="text-align:right">點數</th><th>備註</th></tr></thead>
<tbody>
${pointLogs.map((l) => `<tr><td>${formatTs(l.createdAt)}</td><td>${POINT_LOG_TYPE_LABELS[l.type] ?? l.type}</td><td style="text-align:right">${l.points >= 0 ? "+" : ""}${l.points}</td><td>${l.note ?? ""}</td></tr>`).join("")}
</tbody></table>` : ""}

${storedValueLogs && storedValueLogs.length > 0 ? `
<h2>儲值金異動（${storedValueLogs.length} 筆）</h2>
<table>
<thead><tr><th>時間</th><th>類型</th><th style="text-align:right">金額</th><th style="text-align:right">餘額</th><th>備註</th></tr></thead>
<tbody>
${storedValueLogs.map((l) => `<tr><td>${formatTs(l.createdAt)}</td><td>${SV_LOG_TYPE_LABELS[l.type] ?? l.type}</td><td style="text-align:right">${l.amount >= 0 ? "+" : ""}$${l.amount}</td><td style="text-align:right">$${l.afterBalance}</td><td>${l.note ?? ""}</td></tr>`).join("")}
</tbody></table>` : ""}

<div class="footer">
  <p>${storeName}　日結備份　${report.date}　產生時間：${genTime}</p>
  <p style="margin-top:4px">此文件為系統自動產生，雲端資料保留最近 6 個月，請妥善保存本備份。</p>
</div>
</body>
</html>`;
}

// ─── Batch download all backup files ─────────────────────────────────────────

export type BackupBundle = {
  report: DailyReport;
  storeName: string;
  storeId: string;
  orders: Order[];
  cashFlows: CashFlow[];
  pointLogs?: PointLog[];
  storedValueLogs?: StoredValueLog[];
  memberEnabled?: boolean;
  memberStoredValueEnabled?: boolean;
  customerMap?: Map<string, { name: string; phone: string }>;
};

export function downloadAllBackupFiles(bundle: BackupBundle): string[] {
  const { report, storeName, storeId, orders, cashFlows, pointLogs, storedValueLogs, memberEnabled, memberStoredValueEnabled, customerMap } = bundle;
  const date = report.date;
  const filePrefix = `${storeId}-${date}`;
  const downloaded: string[] = [];

  // 1. HTML report
  const html = generateReportHtml(report, storeName, cashFlows, pointLogs, storedValueLogs);
  downloadHtml(`${filePrefix}-report.html`, html);
  downloaded.push("report_html");

  // Small delay helper (stagger downloads so browser doesn't block)
  const queue: Array<() => void> = [];

  // 2. Transaction CSV
  if (orders.length > 0) {
    queue.push(() => {
      downloadBlob(`${filePrefix}-transactions.csv`, generateTransactionsCsv(orders));
      downloaded.push("transactions_csv");
    });
  }

  // 3. Product sales CSV
  if (report.products.length > 0) {
    queue.push(() => {
      downloadBlob(`${filePrefix}-products.csv`, generateProductSalesCsv(report));
      downloaded.push("products_csv");
    });
  }

  // 4. Cash flow CSV
  if (cashFlows.length > 0) {
    queue.push(() => {
      downloadBlob(`${filePrefix}-cashflow.csv`, generateCashFlowCsv(cashFlows));
      downloaded.push("cashflow_csv");
    });
  }

  // 5. Payment stats CSV
  const payStats = report.paymentStats ?? [];
  if (payStats.length > 0) {
    queue.push(() => {
      downloadBlob(`${filePrefix}-payment-stats.csv`, generatePaymentStatsCsv(payStats));
      downloaded.push("payment_stats_csv");
    });
  }

  // 6. Point logs CSV
  if (memberEnabled && pointLogs && pointLogs.length > 0) {
    queue.push(() => {
      downloadBlob(`${filePrefix}-point-logs.csv`, generatePointLogsCsv(pointLogs, customerMap));
      downloaded.push("point_logs_csv");
    });
  }

  // 7. Stored value logs CSV
  if (memberStoredValueEnabled && storedValueLogs && storedValueLogs.length > 0) {
    queue.push(() => {
      downloadBlob(`${filePrefix}-stored-value-logs.csv`, generateStoredValueLogsCsv(storedValueLogs, customerMap));
      downloaded.push("stored_value_logs_csv");
    });
  }

  // Execute queued downloads with small delays to avoid browser blocking
  queue.forEach((fn, index) => setTimeout(fn, (index + 1) * 250));

  return downloaded;
}
