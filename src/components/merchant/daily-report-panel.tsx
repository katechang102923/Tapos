"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3, CheckCircle2, Clock3, CreditCard, Download, FileText,
  Printer, Send, ShoppingCart, Star, WalletCards, XCircle
} from "lucide-react";
import { useDemoStore } from "@/lib/demo-store";
import { computeDailyReport, formatDate, PAYMENT_LABELS } from "@/lib/daily-report";
import type { CashFlow, DailyReport, HourSlotStat, Order, PaymentMethodStat } from "@/lib/types";

// ─── small helpers ───────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, tone = "text-ink", sub }: { icon: React.ElementType; label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-steel">{label}</p>
        <Icon className="size-5 text-steel" />
      </div>
      <p className={`mt-3 text-4xl font-black ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-sm font-bold text-steel">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xl font-black text-ink">{children}</h3>;
}

// ─── Payment stats ────────────────────────────────────────────────────────────

function PaymentStatsSection({ stats }: { stats: PaymentMethodStat[] }) {
  const total = stats.reduce((s, r) => s + r.amount, 0);
  if (stats.length === 0) {
    return (
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <SectionTitle>付款方式統計</SectionTitle>
        <p className="mt-4 text-sm font-bold text-steel">無付款方式資料（訂單 paymentMethod 欄位未填寫）</p>
      </section>
    );
  }
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <SectionTitle>付款方式統計</SectionTitle>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="py-2 text-left font-black text-steel">付款方式</th>
              <th className="py-2 text-right font-black text-steel">筆數</th>
              <th className="py-2 text-right font-black text-steel">金額</th>
              <th className="py-2 pl-4 text-left font-black text-steel">佔比</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => (
              <tr key={row.method} className="border-b border-stone-50">
                <td className="py-2 font-black text-ink">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 shrink-0 text-steel" />
                    {row.label}
                  </div>
                </td>
                <td className="py-2 text-right font-bold text-ink">{row.count}</td>
                <td className="py-2 text-right font-black text-tomato">${row.amount.toLocaleString()}</td>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-tomato" style={{ width: `${row.percent}%` }} />
                    </div>
                    <span className="text-xs font-bold text-steel">{row.percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-200">
              <td className="py-3 font-black text-ink">合計</td>
              <td className="py-3 text-right font-black text-ink">{stats.reduce((s, r) => s + r.count, 0)}</td>
              <td className="py-3 text-right font-black text-leaf">${total.toLocaleString()}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ─── Hour slots ───────────────────────────────────────────────────────────────

function HourSlotsSection({ slots }: { slots: HourSlotStat[] }) {
  const maxRevenue = Math.max(...slots.map((s) => s.revenue), 1);
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <SectionTitle>時段營業分析</SectionTitle>
        <Clock3 className="size-5 text-steel" />
      </div>
      <div className="mt-4 space-y-3">
        {slots.map((slot) => {
          const barPct = Math.round((slot.revenue / maxRevenue) * 100);
          return (
            <div key={slot.slot} className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-ink">{slot.slot}</span>
                {slot.isPeak && <Star className="size-3 fill-amber-400 text-amber-400" />}
              </div>
              <div className="relative h-6 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full transition-all ${slot.isPeak ? "bg-amber-400" : "bg-tomato/70"}`}
                  style={{ width: `${barPct}%` }}
                />
                {slot.orderCount > 0 && (
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-black text-white">
                    {slot.orderCount} 筆
                  </span>
                )}
              </div>
              <span className="w-20 text-right text-sm font-black text-ink">
                {slot.revenue > 0 ? `$${slot.revenue.toLocaleString()}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      {slots.some((s) => s.isPeak) && (
        <p className="mt-3 flex items-center gap-1 text-xs font-bold text-amber-600">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          尖峰時段（最高營業額）
        </p>
      )}
    </section>
  );
}

// ─── Product ranking ──────────────────────────────────────────────────────────

function ProductRanking({ products }: { products: DailyReport["products"] }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <SectionTitle>商品銷售 TOP 10</SectionTitle>
      <div className="mt-4 space-y-3">
        {products.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-4 text-sm font-black text-steel">尚無銷售資料</p>
        ) : products.slice(0, 10).map((item, index) => (
          <div key={item.productId} className="flex items-center justify-between rounded-lg bg-[#fffaf0] px-4 py-3">
            <div>
              <p className="font-black">#{index + 1} {item.productName}</p>
              <p className="text-sm font-bold text-steel">售出 {item.quantity} 份</p>
            </div>
            <p className="font-black text-tomato">${item.totalAmount.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Print receipt (hidden on screen, visible on print) ──────────────────────

function PrintReceipt({
  report,
  storeName,
  paperSize,
  cashFlows,
}: {
  report: DailyReport;
  storeName: string;
  paperSize: "58mm" | "80mm";
  cashFlows: CashFlow[];
}) {
  const divider = paperSize === "58mm" ? "================================" : "================================================";
  const genTime = new Date(report.generatedAt).toLocaleString("zh-TW");
  const payStats = report.paymentStats ?? [];
  const hourSlots = report.hourSlots ?? [];
  const peakSlot = hourSlots.find((s) => s.isPeak);

  return (
    <div className="receipt-print-area" style={{ maxWidth: paperSize === "58mm" ? "58mm" : "80mm" }}>
      {/* Header */}
      <p style={{ textAlign: "center", fontWeight: "bold", fontSize: "14pt" }}>{storeName}</p>
      <p style={{ textAlign: "center" }}>日期：{report.date}</p>
      <p style={{ textAlign: "center" }}>日結時間：{genTime}</p>
      {report.generatedBy && <p style={{ textAlign: "center" }}>操作員：{report.generatedBy}</p>}
      <p>{divider}</p>

      {/* Revenue summary */}
      <p style={{ textAlign: "center", fontWeight: "bold" }}>營收摘要</p>
      <p>{divider}</p>
      {[
        ["總營收", `$${report.totalRevenue.toLocaleString()}`],
        ["訂單數", `${report.orderCount} 筆`],
        ["完成訂單", `${report.completedCount} 筆`],
        ["平均客單價", `$${report.averageOrderValue}`],
        ["取消訂單", `${report.cancelledCount} 筆`],
        ["退款金額", "$0"],
        ["折扣金額", "$0"],
      ].map(([label, value]) => (
        <div key={label} className="receipt-row">
          <span className="receipt-row-label">{label}</span>
          <span className="receipt-row-value">{value}</span>
        </div>
      ))}
      <p>{divider}</p>

      {/* Payment stats */}
      {payStats.length > 0 && (
        <>
          <p style={{ textAlign: "center", fontWeight: "bold" }}>付款方式統計</p>
          <p>{divider}</p>
          {payStats.map((s) => (
            <div key={s.method} className="receipt-row">
              <span className="receipt-row-label">{s.label}</span>
              <span className="receipt-row-value">{s.count}筆 ${s.amount.toLocaleString()} ({s.percent}%)</span>
            </div>
          ))}
          <p>{divider}</p>
        </>
      )}

      {/* Product TOP10 */}
      {report.products.length > 0 && (
        <>
          <p style={{ textAlign: "center", fontWeight: "bold" }}>商品 TOP 10</p>
          <p>{divider}</p>
          {report.products.slice(0, 10).map((p, i) => (
            <div key={p.productId} className="receipt-row">
              <span className="receipt-row-label">{i + 1}. {p.productName}</span>
              <span className="receipt-row-value">x{p.quantity} ${p.totalAmount.toLocaleString()}</span>
            </div>
          ))}
          <p>{divider}</p>
        </>
      )}

      {/* Hour slots */}
      {hourSlots.some((s) => s.orderCount > 0) && (
        <>
          <p style={{ textAlign: "center", fontWeight: "bold" }}>時段分析</p>
          <p>{divider}</p>
          {hourSlots.map((s) => (
            <div key={s.slot} className="receipt-row">
              <span className="receipt-row-label">{s.slot}{s.isPeak ? " ★" : ""}</span>
              <span className="receipt-row-value">{s.orderCount}筆 ${s.revenue.toLocaleString()}</span>
            </div>
          ))}
          {peakSlot && <p style={{ fontSize: "9pt" }}>★ 尖峰時段：{peakSlot.slot}</p>}
          <p>{divider}</p>
        </>
      )}

      {/* Cash flow */}
      <p style={{ textAlign: "center", fontWeight: "bold" }}>現金流</p>
      <p>{divider}</p>
      {[
        ["現金收入", `$${report.cashIncome.toLocaleString()}`],
        ["現金支出", `$${report.cashExpense.toLocaleString()}`],
        ["現金淨額", `$${report.cashNet.toLocaleString()}`],
        ["預估現金結餘", `$${report.estimatedCashBalance.toLocaleString()}`],
      ].map(([label, value]) => (
        <div key={label} className="receipt-row">
          <span className="receipt-row-label">{label}</span>
          <span className="receipt-row-value">{value}</span>
        </div>
      ))}
      {cashFlows.length > 0 && (
        <>
          <p style={{ marginTop: "4px", fontSize: "9pt" }}>現金流明細：</p>
          {cashFlows.map((f) => (
            <div key={f.id} className="receipt-row" style={{ fontSize: "9pt" }}>
              <span className="receipt-row-label">{f.itemName ?? f.category}</span>
              <span className="receipt-row-value">{f.type === "income" ? "+" : "-"}${f.amount}</span>
            </div>
          ))}
        </>
      )}
      <p>{divider}</p>

      {/* Signature */}
      <div className="receipt-signature">
        <p>日結人員：________________________</p>
        <p style={{ marginTop: "8px" }}>店長簽名：________________________</p>
        <p style={{ marginTop: "8px", fontSize: "9pt", textAlign: "center" }}>產生時間：{genTime}</p>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type DailyReportPanelProps = {
  storeId: string;
  storeName: string;
  todayOrders: Order[];
  todayCashFlows: CashFlow[];
  userEmail?: string;
};

export function DailyReportPanel({ storeId, storeName, todayOrders, todayCashFlows, userEmail }: DailyReportPanelProps) {
  const { loadDailyReport, saveDailyReport } = useDemoStore({ storeId, skipOrderList: true });
  const [selectedDate, setSelectedDate] = useState(formatDate());
  const [savedReport, setSavedReport] = useState<DailyReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [paperSize, setPaperSize] = useState<"58mm" | "80mm">("80mm");
  const printStyleRef = useRef<HTMLStyleElement | null>(null);

  const isToday = selectedDate === formatDate();
  const liveReport = computeDailyReport(storeId, selectedDate, isToday ? todayOrders : [], isToday ? todayCashFlows : [], userEmail);
  const report: DailyReport = isToday ? liveReport : (savedReport ?? liveReport);

  useEffect(() => {
    setMessage("");
    setSavedReport(null);
    setLoadingReport(true);
    loadDailyReport(storeId, selectedDate)
      .then((loaded) => { setSavedReport(loaded); setLoadingReport(false); })
      .catch(() => setLoadingReport(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, storeId]);

  async function handleGenerate() {
    setIsSaving(true);
    setMessage("");
    try {
      const fresh = computeDailyReport(storeId, selectedDate, isToday ? todayOrders : [], isToday ? todayCashFlows : [], userEmail);
      await saveDailyReport(fresh);
      setSavedReport(fresh);
      setMessage("日結報表已儲存");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrint() {
    // Inject @page size before printing
    printStyleRef.current?.remove();
    const style = document.createElement("style");
    style.textContent = `@media print { @page { size: ${paperSize} auto; margin: 3mm; } }`;
    document.head.appendChild(style);
    printStyleRef.current = style;
    window.print();
  }

  async function handleSendEmail() {
    if (!savedReport) return;
    setIsSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, date: selectedDate, storeName }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      setMessage(json.ok ? "報表 Email 已送出（模擬）" : (json.error ?? "Email 送出失敗"));
    } catch {
      setMessage("Email 送出失敗");
    } finally {
      setIsSending(false);
    }
  }

  const paymentStats = report.paymentStats ?? [];
  const hourSlots = report.hourSlots ?? [];
  const dayFlows = isToday ? todayCashFlows : [];

  return (
    <>
      {/* ── Print receipt (hidden on screen, shown on @media print) ── */}
      <div className="receipt-print-root hidden">
        <PrintReceipt report={report} storeName={storeName} paperSize={paperSize} cashFlows={dayFlows} />
      </div>

      {/* ── Screen content ── */}
      <section className="no-print space-y-5">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-2xl font-black">專業日結報表</h2>
            <p className="mt-1 text-sm font-bold text-steel">選擇日期，產生日結儲存至 Firestore，支援列印與 Email。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              max={formatDate()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-orange-100 px-4 py-3 font-black text-ink"
            />
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as "58mm" | "80mm")}
              className="rounded-lg border border-orange-100 px-4 py-3 font-black text-ink"
            >
              <option value="58mm">58mm 熱感紙</option>
              <option value="80mm">80mm 熱感紙</option>
            </select>
            <button onClick={handleGenerate} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 font-black text-white disabled:opacity-60">
              <FileText className="size-5" />{isSaving ? "儲存中…" : "產生日結"}
            </button>
            <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-3 font-black text-ink shadow-sm">
              <Printer className="size-5" />列印
            </button>
            <button onClick={handleSendEmail} disabled={isSending || !savedReport} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 font-black text-white disabled:opacity-50">
              <Send className="size-5" />{isSending ? "寄送中…" : "Email 報表"}
            </button>
            {savedReport && (
              <a
                href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(savedReport, null, 2))}`}
                download={`report-${storeId}-${selectedDate}.json`}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-3 font-black text-ink shadow-sm"
              >
                <Download className="size-5" />匯出 JSON
              </a>
            )}
          </div>
        </div>

        {message && (
          <div className={`rounded-lg p-4 font-black ${message.includes("失敗") ? "bg-tomato/10 text-tomato" : "bg-leaf/10 text-leaf"}`}>
            {message}
          </div>
        )}

        {loadingReport && <div className="rounded-lg bg-white p-8 text-center font-black text-steel shadow-sm">載入報表中…</div>}

        {!loadingReport && !isToday && !savedReport && (
          <div className="rounded-lg bg-white p-8 text-center font-black text-steel shadow-sm">
            此日期尚無日結記錄，點「產生日結」可建立。
          </div>
        )}

        {!loadingReport && (
          <>
            <p className="text-sm font-bold text-steel">
              報表日期：{selectedDate}
              {isToday ? "（即時預覽）" : ""}
              {savedReport ? `　已儲存 ${new Date(savedReport.generatedAt).toLocaleString("zh-TW")}` : ""}
            </p>

            {/* Revenue metrics */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={BarChart3} label="今日營收" value={`$${report.totalRevenue.toLocaleString()}`} tone="text-tomato" />
              <MetricCard icon={CheckCircle2} label="完成訂單" value={`${report.completedCount} 筆`} sub={`$${report.completedRevenue.toLocaleString()}`} tone="text-leaf" />
              <MetricCard icon={XCircle} label="取消訂單" value={`${report.cancelledCount} 筆`} tone="text-tomato" />
              <MetricCard icon={ShoppingCart} label="平均客單價" value={`$${report.averageOrderValue}`} />
            </div>

            {/* Cash metrics */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={WalletCards} label="現金收入" value={`$${report.cashIncome.toLocaleString()}`} tone="text-leaf" />
              <MetricCard icon={WalletCards} label="現金支出" value={`$${report.cashExpense.toLocaleString()}`} tone="text-tomato" />
              <MetricCard icon={WalletCards} label="現金淨額" value={`$${report.cashNet.toLocaleString()}`} tone={report.cashNet >= 0 ? "text-leaf" : "text-tomato"} />
              <MetricCard icon={WalletCards} label="預估現金結餘" value={`$${report.estimatedCashBalance.toLocaleString()}`} />
            </div>

            {/* Payment stats + Hour slots (side by side on large screens) */}
            <div className="grid gap-5 xl:grid-cols-2">
              <PaymentStatsSection stats={paymentStats} />
              <HourSlotsSection slots={hourSlots.length > 0 ? hourSlots : [
                { slot: "06-08", orderCount: 0, revenue: 0, isPeak: false },
                { slot: "08-10", orderCount: 0, revenue: 0, isPeak: false },
                { slot: "10-12", orderCount: 0, revenue: 0, isPeak: false },
                { slot: "12-14", orderCount: 0, revenue: 0, isPeak: false },
                { slot: "14-16", orderCount: 0, revenue: 0, isPeak: false },
                { slot: "16-18", orderCount: 0, revenue: 0, isPeak: false },
                { slot: "18-20", orderCount: 0, revenue: 0, isPeak: false },
                { slot: "20-22", orderCount: 0, revenue: 0, isPeak: false },
              ]} />
            </div>

            {/* Product ranking */}
            <ProductRanking products={report.products} />
          </>
        )}
      </section>
    </>
  );
}
