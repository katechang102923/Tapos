"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { DailyReportPanel } from "@/components/merchant/daily-report-panel";
import { useDemoStore } from "@/lib/demo-store";
import { defaultStoreId } from "@/lib/store-access";
import type { User } from "@/lib/types";

export default function MerchantReportsPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff", "viewer"]} title="訂單與報表">
      {({ profile }) => <MerchantReportsContent storeId={defaultStoreId(profile)} profile={profile} />}
    </LoginGate>
  );
}

function MerchantReportsContent({ storeId, profile }: { storeId: string; profile: User | null }) {
  const { db, todayOrders, todayCashFlows } = useDemoStore({ storeId, loadCustomers: true, todayOrdersOnly: true });
  const store = db.stores.find((s) => s.id === storeId);

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="border-b border-orange-100 bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">店家後台</p>
            <h1 className="text-3xl font-black text-ink">{store?.name} · 訂單與報表</h1>
            <p className="mt-1 text-sm font-bold text-steel">今日訂單、銷售排行、日結與現金流。</p>
          </div>
          <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-4 py-3 font-black text-ink">
            <ArrowLeft className="size-5" />
            回上一層
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-4">
        <DailyReportPanel
          storeId={storeId}
          storeName={store?.name ?? ""}
          todayOrders={todayOrders}
          todayCashFlows={todayCashFlows}
          userEmail={profile?.email ?? ""}
          userRole={profile?.role}
          storeFeatures={store?.features}
          customers={db.customers ?? []}
          pointLogs={db.pointLogs ?? []}
          storedValueLogs={db.storedValueLogs ?? []}
          dataRetentionMonths={store?.dataRetentionMonths ?? undefined}
        />
      </div>
    </main>
  );
}
