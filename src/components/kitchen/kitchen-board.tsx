"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChefHat, Clock3, Coffee, Flame, Maximize2, Minimize2, MonitorUp, Sandwich } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { StatusPill } from "@/components/status-pill";
import { useDemoStore } from "@/lib/demo-store";
import { normalizeSelectedOptions } from "@/lib/product-options";
import { checkStoreAccess, checkUserAccess } from "@/lib/subscription";
import { accessibleStoreIds } from "@/lib/store-access";
import type { Order, OrderItem, OrderStatus, User } from "@/lib/types";

type Station = "all" | "hot" | "drink";

const tabs: Array<{ status: OrderStatus; statuses: OrderStatus[]; label: string }> = [
  { status: "pending", statuses: ["pending", "waiting", "unprocessed", "accepted"], label: "待處理" },
  { status: "preparing", statuses: ["cooking", "preparing"], label: "製作中" },
  { status: "ready", statuses: ["ready"], label: "可出餐" }
];

function isDrinkName(name: string) {
  return /茶|奶|咖啡|豆漿|飲|汁|可樂/.test(name);
}

function stationItems(order: Order, station: Station) {
  if (station === "all") return order.items;
  return order.items.filter((item) => (station === "drink" ? isDrinkName(item.productName) : !isDrinkName(item.productName)));
}

function elapsedMinutes(createdAt: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
}

function elapsedLabel(createdAt: string, now: number) {
  const minutes = elapsedMinutes(createdAt, now);
  if (minutes < 1) return "剛剛";
  return `${minutes} 分鐘`;
}

export function KitchenBoard({ storeId }: { storeId: string }) {
  return (
    <LoginGate allowedRoles={["merchant", "kitchen", "admin", "owner", "manager", "staff"]} title="廚房 KDS 登入">
      {({ profile }) => {
        const isAdmin = profile?.role === "admin";
        // KDS access = platform kdsEnabled switch only (no individual canUseKDS permission).
        // Any store member (or kitchen-role device) may enter — if the store has KDS enabled.
        // The kdsEnabled gate is enforced below in KitchenBoardContent.
        const isKitchenDevice = profile?.role === "kitchen";
        const isStoreMember = accessibleStoreIds(profile as User | null).includes(storeId);
        const hasKitchenAccess = isAdmin || isKitchenDevice || isStoreMember;
        if (!hasKitchenAccess) {
          return (
            <main className="grid min-h-screen place-items-center bg-[#111111] p-4 text-white">
              <div className="rounded-lg bg-white p-6 text-ink shadow-soft">
                <p className="text-sm font-black text-tomato">無法進入 KDS</p>
                <h1 className="mt-2 text-2xl font-black">此帳號沒有這間店的廚房權限</h1>
              </div>
            </main>
          );
        }
        return <KitchenBoardContent storeId={storeId} isPlatformAdmin={isAdmin} />;
      }}
    </LoginGate>
  );
}

function KitchenBoardContent({ storeId, isPlatformAdmin }: { storeId: string; isPlatformAdmin: boolean }) {
  const { db, createMockOrder, updateOrderStatus } = useDemoStore({ storeId, todayOrdersOnly: true });
  const [activeStatus, setActiveStatus] = useState<OrderStatus>("pending");
  const [station, setStation] = useState<Station>("all");
  const [largeMode, setLargeMode] = useState(true);
  const [peakMode, setPeakMode] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const store = db.stores.find((item) => item.id === storeId);
  const activeTab = tabs.find((tab) => tab.status === activeStatus) ?? tabs[0];
  const orders = useMemo(
    () => db.orders.filter((order) => order.storeId === storeId && activeTab.statuses.includes(order.status)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [activeTab.statuses, db.orders, storeId]
  );

  const storeAccessCheck = !isPlatformAdmin ? checkStoreAccess(store) : { ok: true, reason: "" };
  if (!isPlatformAdmin && !storeAccessCheck.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#111111] p-4">
        <div className="rounded-lg bg-white p-6 text-ink shadow-soft">
          <p className="text-sm font-black text-tomato">存取受限</p>
          <h1 className="mt-2 text-2xl font-black">{storeAccessCheck.reason}</h1>
        </div>
      </main>
    );
  }

  if (!isPlatformAdmin && !store?.features?.kdsEnabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#111111] p-4">
        <div className="rounded-lg bg-white p-6 text-ink shadow-soft">
          <p className="text-sm font-black text-steel">KDS 功能未開通</p>
          <h1 className="mt-2 text-2xl font-black">此店家尚未開通 KDS 功能</h1>
          <p className="mt-3 text-steel">請聯絡平台管理員開通 KDS 功能。</p>
          <Link href="/merchant/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white">
            回店家後台
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={`${fullscreen ? "fixed inset-0 z-50 overflow-y-auto" : "min-h-screen"} bg-[#111111] p-4 text-white sm:p-6`}>
      <header className="mb-5 flex flex-col gap-4 rounded-lg bg-[#1f1f1f] p-5 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-lg bg-tomato text-white"><ChefHat className="size-8" /></div>
          <div>
            <p className="text-sm font-black text-white/50">Kitchen Display System</p>
            <h1 className="text-4xl font-black">{store?.name ?? "店家"} 廚房看板</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPeakMode((value) => !value)} className={`rounded-lg px-4 py-3 font-black ${peakMode ? "bg-amber-400 text-ink" : "bg-white/10 text-white"}`}>尖峰模式</button>
          <button onClick={() => setLargeMode((value) => !value)} className="rounded-lg bg-white/10 px-4 py-3 font-black text-white">{largeMode ? "一般字級" : "大字模式"}</button>
          <button onClick={() => setFullscreen((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">{fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}全螢幕</button>
          <button onClick={() => createMockOrder(storeId)} className="rounded-lg bg-leaf px-4 py-3 font-black text-white">模擬進單</button>
          <Link href="/merchant/pos" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink"><MonitorUp className="size-5" />回 POS</Link>
        </div>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        {tabs.map((tab) => (
          <button key={tab.status} onClick={() => setActiveStatus(tab.status)} className={`rounded-lg px-4 py-5 text-2xl font-black ${activeStatus === tab.status ? "bg-tomato text-white" : "bg-[#1f1f1f] text-white/65"}`}>
            {tab.label}
          </button>
        ))}
      </section>

      <section className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "all" as Station, label: "全部", icon: ChefHat },
          { key: "hot" as Station, label: "熱食區", icon: Sandwich },
          { key: "drink" as Station, label: "飲料區", icon: Coffee }
        ].map((item) => (
          <button key={item.key} onClick={() => setStation(item.key)} className={`inline-flex items-center gap-2 rounded-lg px-5 py-4 text-xl font-black ${station === item.key ? "bg-white text-ink" : "bg-[#1f1f1f] text-white/65"}`}>
            <item.icon className="size-6" />{item.label}
          </button>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {orders.length === 0 ? (
          <div className="col-span-full rounded-lg bg-[#1f1f1f] p-12 text-center">
            <p className="text-3xl font-black text-white/60">目前沒有訂單</p>
          </div>
        ) : orders.map((order) => {
          const overdue = elapsedMinutes(order.createdAt, now) >= 15 && !["completed", "cancelled"].includes(order.status);
          const items = stationItems(order, station);
          if (items.length === 0) return null;
          return (
            <article key={order.id} className={`rounded-lg bg-[#fffaf0] p-5 text-ink shadow-soft ${overdue ? "animate-urgent-pulse border-4 border-amber-400" : ["pending", "waiting", "unprocessed"].includes(order.status) ? "animate-order-pop border-4 border-tomato" : "border border-stone-200"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-5xl font-black">#{order.orderNumber}</p>
                  <p className="mt-2 text-xl font-black text-steel">{order.mode === "takeout" ? "外帶" : `桌號 ${order.tableNo}`}</p>
                </div>
                <StatusPill status={order.status} />
              </div>
              <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-3 text-base font-black ${overdue ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-steel"}`}>
                <Clock3 className="size-5" />等待 {elapsedLabel(order.createdAt, now)}
                {overdue && <span className="ml-auto rounded-full bg-amber-500 px-3 py-1 text-sm text-white">超過 15 分鐘</span>}
              </div>
              <div className="mt-5 space-y-4">
                {items.map((item: OrderItem) => {
                  const selectedOptions = normalizeSelectedOptions(item.selectedOptions);
                  const itemNote = (item.itemNote ?? item.note ?? "").trim();
                  return (
                    <div key={item.id} className="rounded-lg bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <p className={`${largeMode ? "text-4xl" : "text-xl"} font-black`}>{item.productName}</p>
                        <p className={`${largeMode ? "text-6xl" : "text-3xl"} font-black text-tomato`}>x{item.quantity}</p>
                      </div>
                      {selectedOptions.length > 0 && <div className="mt-2 space-y-1 text-base font-bold text-steel">{selectedOptions.map((option) => <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 18}px` }}>{option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}</p>)}</div>}
                      {itemNote && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-base font-black text-amber-800">品項備註：{itemNote}</p>}
                    </div>
                  );
                })}
              </div>
              {order.customerNote && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-lg font-black text-amber-800">整單備註：{order.customerNote}</p>}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={() => updateOrderStatus(order.id, ["pending", "waiting", "unprocessed", "accepted"].includes(order.status) ? "preparing" : "ready")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-5 text-2xl font-black text-white disabled:bg-stone-300" disabled={order.status === "ready" || order.status === "completed"}>
                  <Flame className="size-6" />{["pending", "waiting", "unprocessed", "accepted"].includes(order.status) ? "開始製作" : "可出餐"}
                </button>
                <button onClick={() => updateOrderStatus(order.id, order.status === "ready" ? "completed" : "ready")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-5 text-2xl font-black text-white disabled:bg-stone-300" disabled={order.status === "completed"}>
                  <CheckCircle2 className="size-6" />{order.status === "ready" ? "完成訂單" : "完成出餐"}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
