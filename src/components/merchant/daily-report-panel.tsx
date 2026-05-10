"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3, CheckCircle2, Clock3, CreditCard, Download, FileText,
  Printer, Send, ShoppingCart, Star, WalletCards, XCircle
} from "lucide-react";
import { useDemoStore } from "@/lib/demo-store";
import { computeDailyReport, formatDate } from "@/lib/daily-report";
import { roleDisplayName } from "@/lib/store-access";
import type { CashFlow, DailyReport, HourSlotStat, Order, PaymentMethodStat } from "@/lib/types";

// ─── Screen helpers ───────────────────────────────────────────────────────────

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

// ─── Payment stats (screen) ───────────────────────────────────────────────────

function PaymentStatsSection({ stats }: { stats: PaymentMethodStat[] }) {
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
              <td className="py-3 text-right font-black text-leaf">${stats.reduce((s, r) => s + r.amount, 0).toLocaleString()}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ─── Hour slots (screen) ──────────────────────────────────────────────────────

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

// ─── Product ranking (screen) ─────────────────────────────────────────────────

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

// ─── PrintReceipt — INLINE STYLES ONLY (no external CSS dependency) ───────────
// This component's innerHTML is extracted and injected into a new window for
// printing, so it must be fully self-contained with inline styles.

const PS = {
  wrap: { fontFamily: "'Courier New', Courier, monospace", fontSize: "12px", lineHeight: "1.5", color: "#000", background: "#fff", padding: "4mm" } as React.CSSProperties,
  h1: { textAlign: "center", fontWeight: "bold", fontSize: "15px", margin: "4px 0" } as React.CSSProperties,
  h2: { textAlign: "center", fontWeight: "bold", fontSize: "12px", margin: "3px 0" } as React.CSSProperties,
  center: { textAlign: "center", fontSize: "11px" } as React.CSSProperties,
  hr: { border: "none", borderTop: "1px dashed #000", margin: "5px 0" } as React.CSSProperties,
  solidHr: { border: "none", borderTop: "1px solid #000", margin: "5px 0" } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "11px" } as React.CSSProperties,
  label: { flex: 1 } as React.CSSProperties,
  value: { textAlign: "right", whiteSpace: "nowrap", paddingLeft: "8px" } as React.CSSProperties,
  sig: { marginTop: "16px", paddingTop: "8px", borderTop: "1px solid #000" } as React.CSSProperties,
  sigLine: { margin: "10px 0", fontSize: "11px" } as React.CSSProperties,
  small: { fontSize: "9px", textAlign: "center", marginTop: "6px" } as React.CSSProperties,
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={PS.row}>
      <span style={PS.label}>{label}</span>
      <span style={PS.value}>{value}</span>
    </div>
  );
}

function PrintReceipt({ report, storeName, cashFlows, operatorLabel }: { report: DailyReport; storeName: string; cashFlows: CashFlow[]; operatorLabel: string }) {
  const genTime = new Date(report.generatedAt).toLocaleString("zh-TW");
  const payStats = report.paymentStats ?? [];
  const hourSlots = report.hourSlots ?? [];
  const peakSlot = hourSlots.find((s) => s.isPeak);

  return (
    <div style={PS.wrap}>
      {/* Header */}
      <p style={PS.h1}>{storeName}</p>
      <p style={PS.center}>日期：{report.date}</p>
      <p style={PS.center}>日結時間：{genTime}</p>
      <p style={PS.center}>日結人員：{operatorLabel}</p>
      <hr style={PS.hr} />

      {/* Revenue */}
      <p style={PS.h2}>═══ 營收摘要 ═══</p>
      <hr style={PS.hr} />
      <Row label="總營收" value={`$${report.totalRevenue.toLocaleString()}`} />
      <Row label="訂單數" value={`${report.orderCount} 筆`} />
      <Row label="完成訂單" value={`${report.completedCount} 筆`} />
      <Row label="完成金額" value={`$${report.completedRevenue.toLocaleString()}`} />
      <Row label="平均客單價" value={`$${report.averageOrderValue}`} />
      <Row label="取消訂單" value={`${report.cancelledCount} 筆`} />
      <Row label="退款金額" value="$0" />
      <Row label="折扣金額" value="$0" />
      <hr style={PS.hr} />

      {/* Payment stats */}
      {payStats.length > 0 && (
        <>
          <p style={PS.h2}>═══ 付款方式統計 ═══</p>
          <hr style={PS.hr} />
          {payStats.map((s) => (
            <Row key={s.method} label={s.label} value={`${s.count}筆  $${s.amount.toLocaleString()}  (${s.percent}%)`} />
          ))}
          <hr style={PS.hr} />
        </>
      )}

      {/* Product TOP10 */}
      {report.products.length > 0 && (
        <>
          <p style={PS.h2}>═══ 商品 TOP 10 ═══</p>
          <hr style={PS.hr} />
          {report.products.slice(0, 10).map((p, i) => (
            <Row key={p.productId} label={`${i + 1}. ${p.productName}`} value={`x${p.quantity}  $${p.totalAmount.toLocaleString()}`} />
          ))}
          <hr style={PS.hr} />
        </>
      )}

      {/* Hour slots */}
      {hourSlots.some((s) => s.orderCount > 0) && (
        <>
          <p style={PS.h2}>═══ 時段分析 ═══</p>
          <hr style={PS.hr} />
          {hourSlots.map((s) => (
            <Row key={s.slot} label={`${s.slot}${s.isPeak ? " ★" : ""}`} value={`${s.orderCount}筆  $${s.revenue.toLocaleString()}`} />
          ))}
          {peakSlot && <p style={{ ...PS.small, textAlign: "left" }}>★ 尖峰時段：{peakSlot.slot}</p>}
          <hr style={PS.hr} />
        </>
      )}

      {/* Cash flow */}
      <p style={PS.h2}>═══ 現金流 ═══</p>
      <hr style={PS.hr} />
      <Row label="現金收入" value={`$${report.cashIncome.toLocaleString()}`} />
      <Row label="現金支出" value={`$${report.cashExpense.toLocaleString()}`} />
      <Row label="現金淨額" value={`$${report.cashNet.toLocaleString()}`} />
      <Row label="預估現金結餘" value={`$${report.estimatedCashBalance.toLocaleString()}`} />
      {cashFlows.length > 0 && (
        <>
          <p style={{ ...PS.small, textAlign: "left", marginTop: "4px" }}>現金流明細：</p>
          {cashFlows.map((f) => (
            <div key={f.id} style={{ ...PS.row, fontSize: "10px" }}>
              <span style={PS.label}>{f.itemName ?? f.category}</span>
              <span style={PS.value}>{f.type === "income" ? "+" : "-"}${f.amount}</span>
            </div>
          ))}
        </>
      )}
      <hr style={PS.hr} />

      {/* Signature */}
      <div style={PS.sig}>
        <p style={PS.sigLine}>日結人員：{operatorLabel}　　____________________________</p>
        <p style={PS.sigLine}>店長簽名：____________________________</p>
        <p style={{ ...PS.small, marginTop: "10px" }}>產生時間：{genTime}</p>
      </div>
    </div>
  );
}

// ─── Build the standalone print HTML ─────────────────────────────────────────

function buildPrintHtml(innerHtml: string, storeName: string, date: string, paperSize: "58mm" | "80mm"): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>${storeName} 日結 ${date}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #fff; color: #000; }
@page { size: ${paperSize} auto; margin: 3mm; }
</style>
</head>
<body>${innerHtml}</body>
</html>`;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const EMPTY_SLOTS: HourSlotStat[] = [
  "06-08", "08-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"
].map((slot) => ({ slot, orderCount: 0, revenue: 0, isPeak: false }));

type DailyReportPanelProps = {
  storeId: string;
  storeName: string;
  todayOrders: Order[];
  todayCashFlows: CashFlow[];
  userEmail?: string;
  userRole?: string;
};

export function DailyReportPanel({ storeId, storeName, todayOrders, todayCashFlows, userEmail, userRole }: DailyReportPanelProps) {
  const operatorLabel = roleDisplayName(userRole);
  const { loadDailyReport, saveDailyReport } = useDemoStore({ storeId, skipOrderList: true });
  const [selectedDate, setSelectedDate] = useState(formatDate());
  const [savedReport, setSavedReport] = useState<DailyReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [paperSize, setPaperSize] = useState<"58mm" | "80mm">("80mm");
  const printAreaRef = useRef<HTMLDivElement>(null);

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
    const el = printAreaRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) {
      alert("請允許彈出視窗以列印報表");
      return;
    }
    win.document.write(buildPrintHtml(el.innerHTML, storeName, selectedDate, paperSize));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 350);
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
  const hourSlots = report.hourSlots?.length ? report.hourSlots : EMPTY_SLOTS;
  const dayFlows = isToday ? todayCashFlows : [];

  return (
    <>
      {/* Hidden print area — extracted via innerHTML and rendered in a new window */}
      <div ref={printAreaRef} aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: 0, width: "1px", overflow: "hidden" }}>
        <PrintReceipt report={report} storeName={storeName} cashFlows={dayFlows} operatorLabel={operatorLabel} />
      </div>

      <section className="space-y-5">
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

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={BarChart3} label="今日營收" value={`$${report.totalRevenue.toLocaleString()}`} tone="text-tomato" />
              <MetricCard icon={CheckCircle2} label="完成訂單" value={`${report.completedCount} 筆`} sub={`$${report.completedRevenue.toLocaleString()}`} tone="text-leaf" />
              <MetricCard icon={XCircle} label="取消訂單" value={`${report.cancelledCount} 筆`} tone="text-tomato" />
              <MetricCard icon={ShoppingCart} label="平均客單價" value={`$${report.averageOrderValue}`} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={WalletCards} label="現金收入" value={`$${report.cashIncome.toLocaleString()}`} tone="text-leaf" />
              <MetricCard icon={WalletCards} label="現金支出" value={`$${report.cashExpense.toLocaleString()}`} tone="text-tomato" />
              <MetricCard icon={WalletCards} label="現金淨額" value={`$${report.cashNet.toLocaleString()}`} tone={report.cashNet >= 0 ? "text-leaf" : "text-tomato"} />
              <MetricCard icon={WalletCards} label="預估現金結餘" value={`$${report.estimatedCashBalance.toLocaleString()}`} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <PaymentStatsSection stats={paymentStats} />
              <HourSlotsSection slots={hourSlots} />
            </div>

            <ProductRanking products={report.products} />
          </>
        )}
      </section>
    </>
  );
}
