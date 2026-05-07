"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChefHat, Clock3, Coffee, Flame, Maximize2, Minimize2, MonitorUp, Sandwich, Sparkles } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { StatusPill } from "@/components/status-pill";
import { useDemoStore } from "@/lib/demo-store";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";

type Station = "all" | "hot" | "drink";

const tabs: Array<{ status: OrderStatus; label: string }> = [
  { status: "new", label: "新訂單" },
  { status: "preparing", label: "製作中" },
  { status: "completed", label: "已完成" }
];

function isDrinkName(name: string) {
  return /飲|茶|奶|咖啡|豆漿|紅茶|綠茶/.test(name);
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
    <LoginGate allowedRoles={["merchant", "owner", "staff", "kitchen", "admin"]} title="廚房 KDS 登入">
      {({ profile }) => {
        if (profile?.role !== "admin" && profile?.storeId !== storeId) {
          return (
            <main className="grid min-h-screen place-items-center bg-[#111111] p-4 text-white">
              <div className="rounded-lg bg-white p-6 text-ink shadow-soft">
                <p className="text-sm font-black text-tomato">無法進入此店家的 KDS</p>
                <h1 className="mt-2 text-2xl font-black">此帳號不屬於這間店</h1>
              </div>
            </main>
          );
        }
        return <KitchenBoardContent storeId={storeId} />;
      }}
    </LoginGate>
  );
}

function KitchenBoardContent({ storeId }: { storeId: string }) {
  const { db, createMockOrder, updateOrderStatus } = useDemoStore({ storeId });
  const [activeStatus, setActiveStatus] = useState<OrderStatus>("new");
  const [station, setStation] = useState<Station>("all");
  const [largeMode, setLargeMode] = useState(true);
  const [peakMode, setPeakMode] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const store = db.stores.find((item) => item.id === storeId);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  const today = new Date().toDateString();
  const todayOrders = useMemo(
    () => db.orders.filter((order) => order.storeId === storeId && new Date(order.createdAt).toDateString() === today),
    [db.orders, storeId, today]
  );
  const orders = todayOrders
    .filter((order) => order.status === activeStatus && stationItems(order, station).length > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <main className={`min-h-screen text-white ${peakMode ? "bg-[#080808]" : "bg-[#111111]"}`}>
      <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-lg bg-tomato text-white">
              <ChefHat className="size-8" />
            </div>
            <div>
              <p className="text-sm font-black text-white/55">BREAKFAST KDS</p>
              <h1 className="text-4xl font-black">{store?.name ?? "早餐店"}</h1>
              {peakMode && <p className="mt-1 font-black text-amber-300">尖峰模式：大字、少資訊、快速完成</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => createMockOrder(storeId)} className="inline-flex items-center gap-2 rounded-lg bg-tomato px-4 py-3 font-black text-white">
              <Sparkles className="size-5" />模擬新訂單
            </button>
            <button onClick={() => setPeakMode((value) => !value)} className="rounded-lg bg-amber-400 px-4 py-3 font-black text-ink">
              {peakMode ? "尖峰中" : "尖峰模式"}
            </button>
            <button onClick={() => setLargeMode((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10">
              <MonitorUp className="size-5" />{largeMode ? "大字模式" : "標準模式"}
            </button>
            <button onClick={toggleFullscreen} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10">
              {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}全螢幕
            </button>
            <Link href="/merchant" className="rounded-lg bg-white px-4 py-3 font-black text-ink">回後台</Link>
          </div>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          {tabs.map((tab) => {
            const count = todayOrders.filter((order) => order.status === tab.status).length;
            return (
              <button key={tab.status} onClick={() => setActiveStatus(tab.status)} className={`rounded-lg px-5 py-4 text-left transition ${activeStatus === tab.status ? "bg-white text-ink" : "bg-white/10 text-white ring-1 ring-white/10"}`}>
                <p className="text-sm font-black opacity-70">{tab.label}</p>
                <p className="mt-1 text-4xl font-black">{count}</p>
              </button>
            );
          })}
        </section>

        <section className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            { id: "all", label: "全部", icon: ChefHat },
            { id: "hot", label: "熱食區", icon: Sandwich },
            { id: "drink", label: "飲料區", icon: Coffee }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setStation(item.id as Station)} className={`inline-flex items-center justify-center gap-3 rounded-lg px-5 py-4 text-xl font-black ${station === item.id ? "bg-tomato text-white" : "bg-white/10 text-white ring-1 ring-white/10"}`}>
                <Icon className="size-6" />{item.label}
              </button>
            );
          })}
        </section>

        {orders.length === 0 ? (
          <div className="mt-10 rounded-lg border border-white/10 bg-white/5 p-12 text-center">
            <CheckCircle2 className="mx-auto size-14 text-leaf" />
            <p className="mt-4 text-3xl font-black">目前沒有{tabs.find((tab) => tab.status === activeStatus)?.label}</p>
          </div>
        ) : (
          <section className={`mt-6 grid gap-5 ${largeMode ? "md:grid-cols-2 2xl:grid-cols-3" : "md:grid-cols-3 2xl:grid-cols-4"}`}>
            {orders.map((order) => {
              const items = stationItems(order, station);
              const minutes = elapsedMinutes(order.createdAt, now);
              const overdue = minutes >= 15 && order.status !== "completed";
              return (
                <article key={order.id} className={`rounded-lg bg-[#fffaf0] p-5 text-ink shadow-soft ${overdue ? "animate-urgent-pulse border-4 border-amber-400" : order.status === "new" ? "animate-order-pop border-4 border-tomato" : "border border-stone-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`${largeMode ? "text-8xl" : "text-5xl"} font-black tracking-normal`}>#{order.pickupNumber}</p>
                      <p className="mt-2 text-2xl font-black text-tomato">{order.mode === "takeout" ? "外帶" : `桌號 ${order.tableNo}`}</p>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-3 text-base font-black ${overdue ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-steel"}`}>
                    <Clock3 className="size-5" />等待 {elapsedLabel(order.createdAt, now)}
                    {overdue && <span className="ml-auto rounded-full bg-amber-500 px-3 py-1 text-sm text-white">超過 15 分</span>}
                  </div>
                  <div className="mt-5 space-y-4">
                    {items.map((item: OrderItem) => (
                      <div key={item.id} className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <p className={`${largeMode ? "text-4xl" : "text-xl"} font-black`}>{item.productName}</p>
                          <p className={`${largeMode ? "text-6xl" : "text-3xl"} font-black text-tomato`}>x{item.quantity}</p>
                        </div>
                        <p className="mt-2 text-base font-bold text-steel">{Object.entries(item.selectedOptions).map(([key, value]) => `${key}: ${value}`).join(" / ")}</p>
                        {item.note && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-base font-black text-amber-800">備註：{item.note}</p>}
                      </div>
                    ))}
                  </div>
                  {order.customerNote && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-lg font-black text-amber-800">整單備註：{order.customerNote}</p>}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button onClick={() => updateOrderStatus(order.id, "preparing")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-5 text-2xl font-black text-white disabled:bg-stone-300" disabled={order.status === "preparing" || order.status === "completed"}>
                      <Flame className="size-6" />製作中
                    </button>
                    <button onClick={() => updateOrderStatus(order.id, "completed")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-5 text-2xl font-black text-white disabled:bg-stone-300" disabled={order.status === "completed"}>
                      <CheckCircle2 className="size-6" />一鍵完成
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
