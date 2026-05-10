"use client";

import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Download, FileText, Printer, Send, ShoppingCart, WalletCards, XCircle } from "lucide-react";
import { useDemoStore } from "@/lib/demo-store";
import { computeDailyReport, dailyReportId, formatDate } from "@/lib/daily-report";
import type { CashFlow, DailyReport, Order } from "@/lib/types";

function MetricCard({ icon: Icon, label, value, tone = "text-ink" }: { icon: React.ElementType; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-steel">{label}</p>
        <Icon className="size-5 text-steel" />
      </div>
      <p className={`mt-3 text-4xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ProductRanking({ products }: { products: DailyReport["products"] }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="text-xl font-black">商品銷售 TOP 10</h3>
      <div className="mt-4 space-y-3">
        {products.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-4 text-sm font-black text-steel">尚無銷售資料</p>
        ) : products.slice(0, 10).map((item, index) => (
          <div key={item.productId} className="flex items-center justify-between rounded-lg bg-[#fffaf0] px-4 py-3">
            <div>
              <p className="font-black">#{index + 1} {item.productName}</p>
              <p className="text-sm font-bold text-steel">售出 {item.quantity} 份</p>
            </div>
            <p className="font-black text-tomato">${item.totalAmount}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

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

  const isToday = selectedDate === formatDate();

  // Build a live preview for today; use saved report for past dates
  const liveReport: DailyReport = computeDailyReport(storeId, selectedDate, isToday ? todayOrders : [], isToday ? todayCashFlows : [], userEmail);
  const report: DailyReport = isToday ? { ...liveReport, ...(savedReport ?? {}) } : (savedReport ?? liveReport);

  // When date changes, try to load the saved report
  useEffect(() => {
    setMessage("");
    setSavedReport(null);
    setLoadingReport(true);
    loadDailyReport(storeId, selectedDate).then((loaded) => {
      setSavedReport(loaded);
      setLoadingReport(false);
    }).catch(() => setLoadingReport(false));
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

  async function handleSendEmail() {
    if (!savedReport) return;
    setIsSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, date: selectedDate, storeName })
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      setMessage(json.ok ? "報表 Email 已送出（模擬）" : (json.error ?? "Email 送出失敗"));
    } catch {
      setMessage("Email 送出失敗");
    } finally {
      setIsSending(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-2xl font-black">日結報表</h2>
          <p className="mt-1 text-sm font-bold text-steel">選擇日期後「產生日結」可儲存至 Firestore，並支援列印與 Email 寄送。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            max={formatDate()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-orange-100 px-4 py-3 font-black text-ink"
          />
          <button onClick={handleGenerate} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 font-black text-white disabled:opacity-60">
            <FileText className="size-5" />{isSaving ? "儲存中…" : "產生日結"}
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg bg-white border border-stone-200 px-5 py-3 font-black text-ink shadow-sm">
            <Printer className="size-5" />列印
          </button>
          <button onClick={handleSendEmail} disabled={isSending || !savedReport} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 font-black text-white disabled:opacity-50">
            <Send className="size-5" />{isSending ? "寄送中…" : "Email 報表"}
          </button>
          {savedReport && (
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(savedReport, null, 2))}`}
              download={`report-${storeId}-${selectedDate}.json`}
              className="inline-flex items-center gap-2 rounded-lg bg-white border border-stone-200 px-5 py-3 font-black text-ink shadow-sm"
            >
              <Download className="size-5" />匯出 JSON
            </a>
          )}
        </div>
      </div>

      {message && <div className={`rounded-lg p-4 font-black ${message.includes("失敗") ? "bg-tomato/10 text-tomato" : "bg-leaf/10 text-leaf"}`}>{message}</div>}
      {loadingReport && <div className="rounded-lg bg-white p-8 text-center font-black text-steel shadow-sm">載入報表中…</div>}
      {!loadingReport && !isToday && !savedReport && (
        <div className="rounded-lg bg-white p-8 text-center font-black text-steel shadow-sm">此日期尚無日結記錄，點「產生日結」可建立。</div>
      )}

      {(!loadingReport) && (
        <>
          <p className="text-sm font-bold text-steel">
            報表日期：{selectedDate}
            {savedReport ? `（已儲存，產生於 ${new Date(savedReport.generatedAt).toLocaleString("zh-TW")}）` : isToday ? "（即時預覽，尚未儲存）" : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={BarChart3} label="今日營收" value={`$${report.totalRevenue}`} tone="text-tomato" />
            <MetricCard icon={CheckCircle2} label="完成訂單 / 金額" value={`${report.completedCount} / $${report.completedRevenue}`} tone="text-leaf" />
            <MetricCard icon={XCircle} label="取消訂單數" value={report.cancelledCount.toString()} tone="text-tomato" />
            <MetricCard icon={ShoppingCart} label="平均客單價" value={`$${report.averageOrderValue}`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={WalletCards} label="現金收入" value={`$${report.cashIncome}`} tone="text-leaf" />
            <MetricCard icon={WalletCards} label="現金支出" value={`$${report.cashExpense}`} tone="text-tomato" />
            <MetricCard icon={WalletCards} label="現金淨額" value={`$${report.cashNet}`} tone={report.cashNet >= 0 ? "text-leaf" : "text-tomato"} />
            <MetricCard icon={WalletCards} label="預估現金結餘" value={`$${report.estimatedCashBalance}`} />
          </div>
          <ProductRanking products={report.products} />
        </>
      )}
    </section>
  );
}
