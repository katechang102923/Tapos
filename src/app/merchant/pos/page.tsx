"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, Minus, Plus, ReceiptText, Send, ShoppingCart, Table2, WalletCards, XCircle } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductOptionModal } from "@/components/product-option-modal";
import { StatusPill } from "@/components/status-pill";
import { useDemoStore } from "@/lib/demo-store";
import { discountLabel, productFinalPrice } from "@/lib/pricing";
import { normalizeSelectedOptions, selectionsTotal } from "@/lib/product-options";
import { accessibleStoreIds, defaultStoreId, storeRoleFor } from "@/lib/store-access";
import type { CashFlow, CashFlowType, Order, OrderItem, OrderItemOption, OrderMode, OrderStatus, Product, StoreMemberRole, User } from "@/lib/types";

type CartLine = {
  product: Product;
  quantity: number;
  note: string;
  selectedOptions: OrderItemOption[];
};

type PosPanel = "orders" | "report" | "cash";

const orderTabs: Array<{ key: "new" | "processing" | "completed" | "cancelled"; label: string; statuses: OrderStatus[] }> = [
  { key: "new", label: "新訂單", statuses: ["pending", "waiting", "unprocessed"] },
  { key: "processing", label: "處理中", statuses: ["accepted", "cooking", "preparing", "ready"] },
  { key: "completed", label: "已完成", statuses: ["completed"] },
  { key: "cancelled", label: "已取消", statuses: ["cancelled"] }
];

const reportRoles: Array<StoreMemberRole | "admin"> = ["owner", "manager", "viewer", "admin"];
const cashWriteRoles: Array<StoreMemberRole | "admin"> = ["owner", "manager", "staff", "admin"];
const posAccessRoles: StoreMemberRole[] = ["owner", "manager", "staff", "viewer"];

export default function MerchantPosPage() {
  return (
    <LoginGate allowedRoles={["merchant", "kitchen", "admin", "owner", "manager", "staff", "viewer"]} title="POS 前台工作台">
      {({ profile }) => <MerchantPosShell profile={profile} />}
    </LoginGate>
  );
}

function MerchantPosShell({ profile }: { profile: User | null }) {
  const storeIds = accessibleStoreIds(profile);
  const [activeStoreId, setActiveStoreId] = useState(defaultStoreId(profile));
  const selectedStoreId = storeIds.includes(activeStoreId) ? activeStoreId : storeIds[0] ?? "";
  const storeRole = storeRoleFor(profile, selectedStoreId);
  const hasStoreAccess = Boolean(selectedStoreId && storeRole && posAccessRoles.includes(storeRole));
  const isAdmin = profile?.role === "admin";

  if (selectedStoreId && !hasStoreAccess && !isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">此帳號無法使用 POS 前台</h1>
          <p className="mt-3 text-steel">請確認此帳號已被綁定為 owner、manager、staff 或 viewer。</p>
        </div>
      </main>
    );
  }

  return (
    <MerchantPosContent
      profile={profile}
      storeId={selectedStoreId}
      storeIds={storeIds}
      activeStoreId={selectedStoreId}
      activeStoreRole={storeRole}
      onStoreChange={setActiveStoreId}
    />
  );
}

function MerchantPosContent({
  profile,
  storeId,
  storeIds,
  activeStoreId,
  activeStoreRole,
  onStoreChange
}: {
  profile: User | null;
  storeId: string;
  storeIds: string[];
  activeStoreId: string;
  activeStoreRole: StoreMemberRole | null;
  onStoreChange: (storeId: string) => void;
}) {
  const { db, createCashFlow, createOrder, todayCashFlows, todayOrders, updateOrderStatus } = useDemoStore({ storeId });
  const store = db.stores.find((item) => item.id === storeId);
  const categories = useMemo(() => db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort), [db.categories, storeId]);
  const products = useMemo(() => db.products.filter((item) => item.storeId === storeId && item.isAvailable && !item.isSoldOut).sort((a, b) => a.sort - b.sort), [db.products, storeId]);
  const effectiveRole = profile?.role === "admin" ? "admin" : activeStoreRole;
  const canViewReport = Boolean(effectiveRole && reportRoles.includes(effectiveRole));
  const canAddCashFlow = Boolean(effectiveRole && cashWriteRoles.includes(effectiveRole));

  const [activePanel, setActivePanel] = useState<PosPanel>("orders");
  const [activeOrderTab, setActiveOrderTab] = useState<(typeof orderTabs)[number]["key"]>("new");
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [mode, setMode] = useState<OrderMode>("takeout");
  const [tableNo, setTableNo] = useState("1");
  const [customerNote, setCustomerNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [choosingProduct, setChoosingProduct] = useState<Product | null>(null);
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderError, setOrderError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashMessage, setCashMessage] = useState("");
  const [cashError, setCashError] = useState("");
  const [cashForm, setCashForm] = useState({ type: "income" as CashFlowType, amount: "", category: "開店備用金", note: "" });

  const visibleProducts = activeCategoryId === "all" ? products : products.filter((product) => product.categoryId === activeCategoryId);
  const completedOrders = todayOrders.filter((order) => order.status === "completed");
  const cancelledOrders = todayOrders.filter((order) => order.status === "cancelled");
  const activeOrders = todayOrders.filter((order) => order.status !== "cancelled");
  const completedRevenue = completedOrders.reduce((sum, order) => sum + (order.totalAmount ?? order.total), 0);
  const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.totalAmount ?? order.total), 0);
  const averageOrderValue = completedOrders.length ? Math.round(completedRevenue / completedOrders.length) : 0;
  const selectedOrderTab = orderTabs.find((tab) => tab.key === activeOrderTab) ?? orderTabs[0];
  const displayedOrders = todayOrders.filter((order) => selectedOrderTab.statuses.includes(order.status)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const ranking = useMemo(() => salesRanking(completedOrders).slice(0, 10), [completedOrders]);
  const topFive = ranking.slice(0, 5);
  const total = cart.reduce((sum, line) => sum + line.quantity * (productFinalPrice(line.product) + selectionsTotal(line.selectedOptions)), 0);
  const cashIncome = todayCashFlows.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const cashExpense = todayCashFlows.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const cashNet = cashIncome - cashExpense;
  const estimatedCashBalance = completedRevenue + cashNet;
  const paymentStats = paymentSummary(completedOrders);

  if (!storeId) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">請先完成店家設定</h1>
          <p className="mt-3 text-steel">POS 前台需要綁定店家後才能使用。</p>
        </div>
      </main>
    );
  }

  if (!store) return <div className="grid min-h-screen place-items-center bg-[#f4f4f2] font-black text-steel">載入店家資料...</div>;

  function confirmProductOptions(selectedOptions: OrderItemOption[]) {
    if (!choosingProduct) return;
    setCart((current) => [...current, { product: choosingProduct, quantity: 1, note: "", selectedOptions }]);
    setChoosingProduct(null);
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function submitOrder() {
    if (cart.length === 0 || isSubmitting) return;
    setOrderError("");
    setOrderSuccess("");
    setIsSubmitting(true);
    try {
      const order = await createOrder({
        storeId,
        mode,
        tableNo: mode === "takeout" ? "外帶" : tableNo,
        customerNote,
        total,
        source: "pos",
        status: "accepted",
        items: cart.map<OrderItem>((line) => {
          const unitPrice = productFinalPrice(line.product) + selectionsTotal(line.selectedOptions);
          return {
            id: "",
            orderId: "",
            storeId,
            productId: line.product.id,
            productName: line.product.name,
            name: line.product.name,
            quantity: line.quantity,
            unitPrice,
            price: unitPrice,
            originalPrice: line.product.price,
            discountType: line.product.discountType ?? "none",
            discountValue: Number(line.product.discountValue ?? 0),
            finalPrice: productFinalPrice(line.product),
            selectedOptions: line.selectedOptions,
            note: line.note,
            itemNote: line.note
          };
        })
      });
      setCart([]);
      setCustomerNote("");
      setOrderSuccess(`POS 訂單已建立：${order.orderNumber}`);
    } catch (writeError) {
      setOrderError(writeError instanceof Error ? writeError.message : "訂單建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitCashFlow() {
    if (!canAddCashFlow) return;
    setCashError("");
    setCashMessage("");
    const amount = Number(cashForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashError("請輸入正確金額");
      return;
    }
    try {
      await createCashFlow({
        storeId,
        type: cashForm.type,
        amount,
        category: cashForm.category,
        note: cashForm.note,
        createdBy: profile?.email ?? profile?.id ?? ""
      });
      setCashForm({ type: "income", amount: "", category: "開店備用金", note: "" });
      setCashMessage("現金流已新增");
    } catch (error) {
      console.error("createCashFlow failed", error);
      setCashError(error instanceof Error ? error.message : "新增現金流失敗");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f3ee] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-5 flex flex-col gap-3 rounded-lg bg-[#171717] p-5 text-white shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-black text-white/55">POS 前台工作台</p>
            <h1 className="mt-2 text-3xl font-black">{store.name} 接單中心</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-white/65">接單、建立現場訂單、查看今日銷售與現金流。</p>
            {effectiveRole && <p className="mt-2 text-xs font-black text-white/45">目前角色：{effectiveRole}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {storeIds.length > 1 && (
              <select value={activeStoreId} onChange={(event) => onStoreChange(event.target.value)} className="rounded-lg border border-white/20 bg-white px-4 py-3 font-black text-ink">
                {storeIds.map((id) => {
                  const optionStore = db.stores.find((item) => item.id === id);
                  return <option key={id} value={id}>{optionStore?.name ?? id}</option>;
                })}
              </select>
            )}
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink"><ArrowLeft className="size-4" />返回設定中心</Link>
            <Link href="/kds" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white">廚房 KDS</Link>
          </div>
        </header>

        <section className="mb-5 grid gap-3 md:grid-cols-3">
          <PanelButton active={activePanel === "orders"} icon={ReceiptText} label="接單工作台" onClick={() => setActivePanel("orders")} />
          <PanelButton active={activePanel === "report"} icon={BarChart3} label="每日報表" onClick={() => setActivePanel("report")} disabled={!canViewReport} />
          <PanelButton active={activePanel === "cash"} icon={WalletCards} label="現金流" onClick={() => setActivePanel("cash")} disabled={!canAddCashFlow && !canViewReport} />
        </section>

        {orderSuccess && <div className="mb-5 rounded-lg border border-leaf/30 bg-leaf/10 p-5 font-black text-leaf">{orderSuccess}</div>}
        {orderError && <div className="mb-5 rounded-lg border border-tomato/30 bg-tomato/10 p-5 font-black text-tomato">{orderError}</div>}

        {activePanel === "orders" && (
          <>
            <section className="mb-5 grid gap-4 md:grid-cols-4">
              <MetricCard icon={BarChart3} label="今日營收" value={`$${totalRevenue}`} tone="text-tomato" />
              <MetricCard icon={ReceiptText} label="今日訂單數" value={todayOrders.length.toString()} />
              <MetricCard icon={ShoppingCart} label="平均客單價" value={`$${averageOrderValue}`} />
              <MetricCard icon={Table2} label="內用 / 外帶" value={`${todayOrders.filter((order) => order.mode === "dine-in").length} / ${todayOrders.filter((order) => order.mode === "takeout").length}`} tone="text-leaf" />
            </section>

            <div className="grid gap-5 2xl:grid-cols-[minmax(520px,0.95fr)_minmax(560px,1.05fr)_420px]">
              <OrderBoard activeOrderTab={activeOrderTab} displayedOrders={displayedOrders} orderTabs={orderTabs} setActiveOrderTab={setActiveOrderTab} updateOrderStatus={updateOrderStatus} />
              <QuickOrder activeCategoryId={activeCategoryId} categories={categories} customerNote={customerNote} mode={mode} products={visibleProducts} setActiveCategoryId={setActiveCategoryId} setChoosingProduct={setChoosingProduct} setCustomerNote={setCustomerNote} setMode={setMode} setTableNo={setTableNo} tableNo={tableNo} />
              <aside className="space-y-5">
                <CartPanel cart={cart} total={total} updateLine={updateLine} removeLine={(index) => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} submitOrder={submitOrder} isSubmitting={isSubmitting} />
                <SalesRanking ranking={topFive} title="今日商品 TOP 5" />
              </aside>
            </div>
          </>
        )}

        {activePanel === "report" && (
          canViewReport ? (
            <DailyReport averageOrderValue={averageOrderValue} cashExpense={cashExpense} cashIncome={cashIncome} cashNet={cashNet} cancelledCount={cancelledOrders.length} completedRevenue={completedRevenue} estimatedCashBalance={estimatedCashBalance} orderCount={todayOrders.length} paymentStats={paymentStats} ranking={ranking} totalRevenue={totalRevenue} />
          ) : (
            <PermissionNotice text="staff 可新增現金流，但不能查看完整每日報表。" />
          )
        )}

        {activePanel === "cash" && (
          <CashFlowPanel canAddCashFlow={canAddCashFlow} cashError={cashError} cashFlows={todayCashFlows} cashForm={cashForm} cashMessage={cashMessage} cashNet={cashNet} setCashForm={setCashForm} submitCashFlow={submitCashFlow} />
        )}
      </div>
      {choosingProduct && <ProductOptionModal product={choosingProduct} onClose={() => setChoosingProduct(null)} onConfirm={confirmProductOptions} />}
    </main>
  );
}

function OrderBoard({ activeOrderTab, displayedOrders, orderTabs: tabs, setActiveOrderTab, updateOrderStatus }: { activeOrderTab: string; displayedOrders: Order[]; orderTabs: typeof orderTabs; setActiveOrderTab: (key: (typeof orderTabs)[number]["key"]) => void; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">接單進單</h2>
          <p className="mt-1 text-sm font-bold text-steel">新訂單接單後直接進入處理中。</p>
        </div>
        <Clock3 className="size-7 text-tomato" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveOrderTab(tab.key)} className={`rounded-lg px-3 py-3 font-black ${activeOrderTab === tab.key ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {displayedOrders.length === 0 ? <p className="rounded-lg bg-stone-50 p-5 text-center font-black text-steel">目前沒有訂單</p> : displayedOrders.map((order) => <OrderWorkCard key={order.id} order={order} updateOrderStatus={updateOrderStatus} />)}
      </div>
    </section>
  );
}

function QuickOrder({ activeCategoryId, categories, customerNote, mode, products, setActiveCategoryId, setChoosingProduct, setCustomerNote, setMode, setTableNo, tableNo }: { activeCategoryId: string; categories: { id: string; name: string }[]; customerNote: string; mode: OrderMode; products: Product[]; setActiveCategoryId: (id: string) => void; setChoosingProduct: (product: Product) => void; setCustomerNote: (value: string) => void; setMode: (mode: OrderMode) => void; setTableNo: (value: string) => void; tableNo: string }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">快速建立訂單</h2>
          <p className="mt-1 text-sm font-bold text-steel">給櫃台現場點餐使用。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode("takeout")} className={`rounded-lg px-4 py-3 font-black ${mode === "takeout" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>外帶</button>
          <button onClick={() => setMode("dine-in")} className={`rounded-lg px-4 py-3 font-black ${mode === "dine-in" ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>內用</button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
        {mode === "dine-in" && <Field label="桌號" value={tableNo} onChange={setTableNo} />}
        <Field label="訂單備註" value={customerNote} onChange={setCustomerNote} className={mode === "takeout" ? "sm:col-span-2" : ""} />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setActiveCategoryId("all")} className={`shrink-0 rounded-lg px-4 py-3 font-black ${activeCategoryId === "all" ? "bg-leaf text-white" : "bg-orange-50 text-steel"}`}>全部</button>
        {categories.map((category) => <button key={category.id} onClick={() => setActiveCategoryId(category.id)} className={`shrink-0 rounded-lg px-4 py-3 font-black ${activeCategoryId === category.id ? "bg-leaf text-white" : "bg-orange-50 text-steel"}`}>{category.name}</button>)}
      </div>
      <div className="mt-4 grid max-h-[620px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
        {products.map((product) => (
          <button key={product.id} onClick={() => setChoosingProduct(product)} className="rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-leaf hover:bg-[#fbfff4]">
            <div className="flex items-start gap-3">
              <img src={product.imageUrl} alt={product.name} className="size-20 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black">{product.name}</p>
                <p className="mt-1 line-clamp-2 text-xs font-bold text-steel">{product.description}</p>
                <p className="mt-2 text-xl font-black text-tomato">${productFinalPrice(product)}</p>
                {productFinalPrice(product) !== product.price && <p className="text-xs font-bold text-stone-400 line-through">${product.price}</p>}
                {discountLabel(product.discountType, product.discountValue) && <p className="mt-1 text-xs font-black text-tomato">{discountLabel(product.discountType, product.discountValue)}</p>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function DailyReport({ averageOrderValue, cashExpense, cashIncome, cashNet, cancelledCount, completedRevenue, estimatedCashBalance, orderCount, paymentStats, ranking, totalRevenue }: { averageOrderValue: number; cashExpense: number; cashIncome: number; cashNet: number; cancelledCount: number; completedRevenue: number; estimatedCashBalance: number; orderCount: number; paymentStats: Record<string, { label: string; amount: number; count: number }>; ranking: ReturnType<typeof salesRanking>; totalRevenue: number }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard icon={BarChart3} label="今日營收" value={`$${totalRevenue}`} tone="text-tomato" />
          <MetricCard icon={ReceiptText} label="今日訂單數" value={orderCount.toString()} />
          <MetricCard icon={CheckCircle2} label="已完成訂單金額" value={`$${completedRevenue}`} tone="text-leaf" />
          <MetricCard icon={XCircle} label="已取消訂單數" value={cancelledCount.toString()} tone="text-tomato" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard icon={ShoppingCart} label="平均客單價" value={`$${averageOrderValue}`} />
          <MetricCard icon={WalletCards} label="現金收入總額" value={`$${cashIncome}`} tone="text-leaf" />
          <MetricCard icon={WalletCards} label="現金支出總額" value={`$${cashExpense}`} tone="text-tomato" />
          <MetricCard icon={WalletCards} label="預估現金結餘" value={`$${estimatedCashBalance}`} />
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">付款方式統計</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {Object.values(paymentStats).map((item) => (
              <div key={item.label} className="rounded-lg bg-orange-50 p-4">
                <p className="text-sm font-black text-steel">{item.label}</p>
                <p className="mt-2 text-2xl font-black text-ink">${item.amount}</p>
                <p className="text-xs font-bold text-steel">{item.count} 筆</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <aside className="space-y-5">
        <MetricCard icon={WalletCards} label="現金流淨額" value={`$${cashNet}`} tone={cashNet >= 0 ? "text-leaf" : "text-tomato"} />
        <SalesRanking ranking={ranking} title="商品銷售排行 TOP 10" />
      </aside>
    </section>
  );
}

function CashFlowPanel({ canAddCashFlow, cashError, cashFlows, cashForm, cashMessage, cashNet, setCashForm, submitCashFlow }: { canAddCashFlow: boolean; cashError: string; cashFlows: CashFlow[]; cashForm: { type: CashFlowType; amount: string; category: string; note: string }; cashMessage: string; cashNet: number; setCashForm: React.Dispatch<React.SetStateAction<{ type: CashFlowType; amount: string; category: string; note: string }>>; submitCashFlow: () => void }) {
  const categories = cashForm.type === "income" ? ["開店備用金", "額外收入", "其他"] : ["採買", "找零", "退款", "其他"];
  return (
    <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black">新增現金流</h2>
        {!canAddCashFlow && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-700">目前角色只能查看，不能新增現金流。</p>}
        {cashMessage && <p className="mt-3 rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">{cashMessage}</p>}
        {cashError && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{cashError}</p>}
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-black text-steel">
            類型
            <select value={cashForm.type} disabled={!canAddCashFlow} onChange={(event) => setCashForm((current) => ({ ...current, type: event.target.value as CashFlowType, category: event.target.value === "income" ? "開店備用金" : "採買" }))} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink disabled:bg-stone-100">
              <option value="income">現金收入</option>
              <option value="expense">現金支出</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-steel">
            金額
            <input value={cashForm.amount} disabled={!canAddCashFlow} onChange={(event) => setCashForm((current) => ({ ...current, amount: event.target.value }))} type="number" min="0" placeholder="例如 1000" className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink disabled:bg-stone-100" />
          </label>
          <label className="grid gap-1 text-sm font-black text-steel">
            分類
            <select value={cashForm.category} disabled={!canAddCashFlow} onChange={(event) => setCashForm((current) => ({ ...current, category: event.target.value }))} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink disabled:bg-stone-100">
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-steel">
            備註
            <textarea value={cashForm.note} disabled={!canAddCashFlow} onChange={(event) => setCashForm((current) => ({ ...current, note: event.target.value }))} className="min-h-24 rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink disabled:bg-stone-100" />
          </label>
          <button disabled={!canAddCashFlow} onClick={submitCashFlow} className="rounded-lg bg-leaf px-4 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">新增現金流</button>
        </div>
      </div>
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">今日現金流</h2>
          <p className={`text-2xl font-black ${cashNet >= 0 ? "text-leaf" : "text-tomato"}`}>淨額 ${cashNet}</p>
        </div>
        <div className="mt-4 space-y-3">
          {cashFlows.length === 0 ? <p className="rounded-lg bg-stone-50 p-5 text-center font-black text-steel">今日尚無現金流紀錄</p> : cashFlows.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg bg-orange-50 p-4">
              <div>
                <p className="font-black text-ink">{item.category}</p>
                <p className="mt-1 text-sm font-bold text-steel">{item.note || "無備註"} / {new Date(item.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <p className={`text-xl font-black ${item.type === "income" ? "text-leaf" : "text-tomato"}`}>{item.type === "income" ? "+" : "-"}${item.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SalesRanking({ ranking, title }: { ranking: ReturnType<typeof salesRanking>; title: string }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {ranking.length === 0 ? <p className="rounded-lg bg-stone-50 p-4 text-sm font-black text-steel">尚無銷售資料</p> : ranking.map((item, index) => (
          <div key={item.productId} className="flex items-center justify-between rounded-lg bg-[#fffaf0] px-4 py-3">
            <div><p className="font-black">#{index + 1} {item.productName}</p><p className="text-sm font-bold text-steel">售出 {item.quantity} 份</p></div>
            <p className="font-black text-tomato">${item.totalAmount}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function salesRanking(orders: Order[]) {
  const map = new Map<string, { productId: string; productName: string; quantity: number; totalAmount: number }>();
  orders.forEach((order) => order.items.forEach((item) => {
    const current = map.get(item.productId) ?? { productId: item.productId, productName: item.productName, quantity: 0, totalAmount: 0 };
    current.quantity += item.quantity;
    current.totalAmount += item.quantity * item.unitPrice;
    map.set(item.productId, current);
  }));
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

function paymentSummary(orders: Order[]) {
  const stats: Record<string, { label: string; amount: number; count: number }> = {
    cash: { label: "現金", amount: 0, count: 0 },
    linePay: { label: "Line Pay", amount: 0, count: 0 },
    creditCard: { label: "信用卡", amount: 0, count: 0 },
    other: { label: "其他", amount: 0, count: 0 }
  };
  orders.forEach((order) => {
    const method = ((order as Order & { paymentMethod?: keyof typeof stats }).paymentMethod ?? "cash") in stats ? (order as Order & { paymentMethod?: keyof typeof stats }).paymentMethod ?? "cash" : "other";
    stats[method].amount += order.totalAmount ?? order.total;
    stats[method].count += 1;
  });
  return stats;
}

function MetricCard({ icon: Icon, label, value, tone = "text-ink" }: { icon: React.ElementType; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><p className="text-sm font-black text-steel">{label}</p><Icon className="size-5 text-steel" /></div>
      <p className={`mt-3 text-4xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function PanelButton({ active, disabled, icon: Icon, label, onClick }: { active: boolean; disabled?: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-4 font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-ink text-white" : "bg-white text-ink"}`}>
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function PermissionNotice({ text }: { text: string }) {
  return <div className="rounded-lg bg-white p-8 text-center text-xl font-black text-steel shadow-sm">{text}</div>;
}

function OrderWorkCard({ order, updateOrderStatus }: { order: Order; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  const cancelReason = order.cancelReason ?? order.rejectReason;
  return (
    <article className={`rounded-lg border p-4 ${["pending", "waiting", "unprocessed"].includes(order.status) ? "animate-order-pop border-tomato bg-tomato/5" : "border-stone-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-black">#{order.orderNumber}</p>
          <p className="mt-1 text-sm font-bold text-steel">{order.source === "qr" ? "QR 進單" : "POS 現場單"} / {order.mode === "takeout" ? "外帶" : `內用 ${order.tableName ?? order.tableNo}`} / {new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <StatusPill status={order.status} />
      </div>
      {cancelReason && order.status === "cancelled" && <p className="mt-3 rounded-lg bg-tomato/10 px-3 py-2 text-sm font-black text-tomato">取消原因：{cancelReason}</p>}
      {order.customerNote && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">訂單備註：{order.customerNote}</p>}
      <div className="mt-3 space-y-2 text-sm font-bold text-steel">
        {order.items.map((item) => {
          const selectedOptions = normalizeSelectedOptions(item.selectedOptions);
          const itemNote = (item.itemNote ?? item.note ?? "").trim();
          return (
            <div key={item.id} className="rounded-lg bg-stone-50 px-3 py-2">
              <p>{item.quantity} x {item.productName}</p>
              {selectedOptions.length > 0 && <div className="ml-3 mt-1 space-y-1 text-xs">{selectedOptions.map((option) => <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 12}px` }}>- {option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}</p>)}</div>}
              {itemNote && <p className="ml-3 mt-1 rounded bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">備註：{itemNote}</p>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-lg font-black text-tomato">總金額 ${order.totalAmount ?? order.total}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["pending", "waiting", "unprocessed"].includes(order.status) && <button onClick={() => updateOrderStatus(order.id, "accepted")} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-3 py-2 font-black text-white"><CheckCircle2 className="size-4" />接單</button>}
        {["accepted", "cooking", "preparing", "ready"].includes(order.status) && <button onClick={() => updateOrderStatus(order.id, "completed")} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-3 py-2 font-black text-white"><CheckCircle2 className="size-4" />餐點完成</button>}
        {!["completed", "cancelled"].includes(order.status) && <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="inline-flex items-center gap-2 rounded-lg bg-tomato px-3 py-2 font-black text-white"><XCircle className="size-4" />取消</button>}
      </div>
    </article>
  );
}

function CartPanel({ cart, total, removeLine, submitOrder, updateLine, isSubmitting }: { cart: CartLine[]; total: number; removeLine: (index: number) => void; submitOrder: () => void; updateLine: (index: number, patch: Partial<CartLine>) => void; isSubmitting: boolean }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black">現場訂單購物車</h2>
      {cart.length === 0 ? <p className="mt-4 rounded-lg bg-orange-50 p-4 text-center text-sm font-black text-steel">尚未加入餐點</p> : (
        <div className="mt-4 space-y-4">
          {cart.map((line, index) => (
            <div key={`${line.product.id}-${index}`} className="rounded-lg border border-orange-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-ink">{line.product.name}</p>
                  <p className="mt-1 text-sm text-steel">${productFinalPrice(line.product) + selectionsTotal(line.selectedOptions)} x {line.quantity}</p>
                  {line.selectedOptions.length > 0 && <div className="mt-2 space-y-1 text-xs font-bold text-steel">{line.selectedOptions.map((option) => <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 14}px` }}>- {option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}</p>)}</div>}
                </div>
                <button onClick={() => removeLine(index)} className="rounded-lg bg-tomato px-3 py-2 font-black text-white">刪除</button>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"><Minus className="size-4" /></button>
                <span className="text-xl font-black">{line.quantity}</span>
                <button onClick={() => updateLine(index, { quantity: line.quantity + 1 })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"><Plus className="size-4" /></button>
              </div>
              <textarea value={line.note} onChange={(event) => updateLine(index, { note: event.target.value })} placeholder="品項備註" className="mt-4 w-full rounded-lg border border-orange-100 px-3 py-3 text-sm" />
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 rounded-lg bg-orange-50 p-4 text-xl font-black text-ink">總計：${total}</div>
      <button onClick={submitOrder} disabled={cart.length === 0 || isSubmitting} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white disabled:opacity-60">
        <Send className="size-5" />{isSubmitting ? "送出中..." : "送出訂單"}
      </button>
    </section>
  );
}

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`grid gap-1 text-sm font-black text-steel ${className}`}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-orange-200 bg-white px-4 py-3 text-lg font-bold" />
    </label>
  );
}
