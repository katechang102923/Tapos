"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, ChefHat, CheckCircle2, Clock3, FileText, Minus, Plus, ReceiptText, Send, ShoppingCart, Table2, UserPlus, WalletCards, XCircle } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductOptionModal } from "@/components/product-option-modal";
import { StatusPill } from "@/components/status-pill";
import { DailyReportPanel } from "@/components/merchant/daily-report-panel";
import { useDemoStore } from "@/lib/demo-store";
import { discountLabel, productFinalPrice } from "@/lib/pricing";
import { normalizeSelectedOptions, selectionsTotal } from "@/lib/product-options";
import { calculatePromotions } from "@/lib/promotions";
import { resolvePermissions } from "@/lib/permissions";
import { accessibleStoreIds, defaultStoreId, storeRoleFor } from "@/lib/store-access";
import { checkStoreAccess, checkUserAccess } from "@/lib/subscription";
import type { CashFlow, CashFlowAmountMode, CashFlowItem, CashFlowType, Customer, Order, OrderItem, OrderItemOption, OrderMode, OrderStatus, Product, StoreMemberRole, User } from "@/lib/types";

type CartItemDiscount = { type: "amount" | "percent"; value: number } | null;
type CartLine = { product: Product; quantity: number; note: string; selectedOptions: OrderItemOption[]; discount: CartItemDiscount };
type PosPanel = "orders" | "report" | "cash" | "daily";
type CashForm = { itemId: string; amount: string; note: string };
type CashItemForm = { name: string; type: CashFlowType; amountMode: CashFlowAmountMode; fixedAmount: string };

function lineBasePrice(line: CartLine) {
  return productFinalPrice(line.product) + selectionsTotal(line.selectedOptions);
}
function lineSubtotal(line: CartLine) {
  return lineBasePrice(line) * line.quantity;
}
function lineDiscountAmount(line: CartLine) {
  if (!line.discount) return 0;
  const sub = lineSubtotal(line);
  if (line.discount.type === "amount") return Math.min(line.discount.value, sub);
  return Math.round(sub * Math.min(line.discount.value, 100) / 100);
}
function lineTotal(line: CartLine) {
  return Math.max(0, lineSubtotal(line) - lineDiscountAmount(line));
}
function computeOrderDiscountAmount(afterItems: number, discount: CartItemDiscount) {
  if (!discount) return 0;
  if (discount.type === "amount") return Math.min(discount.value, afterItems);
  return Math.round(afterItems * Math.min(discount.value, 100) / 100);
}

const orderTabs: Array<{ key: "new" | "processing" | "completed" | "cancelled"; label: string; statuses: OrderStatus[] }> = [
  { key: "new", label: "新訂單", statuses: ["pending", "waiting", "unprocessed"] },
  { key: "processing", label: "處理中", statuses: ["accepted", "cooking", "preparing", "ready"] },
  { key: "completed", label: "已完成", statuses: ["completed"] },
  { key: "cancelled", label: "已取消", statuses: ["cancelled"] }
];

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
  const isAdmin = profile?.role === "admin";
  const hasStoreAccess = Boolean(selectedStoreId && storeRole && posAccessRoles.includes(storeRole));

  useEffect(() => {
    console.log("[POS] auth/store access", {
      currentUserUid: profile?.id ?? null,
      role: profile?.role ?? null,
      storeRole,
      allowedStoreIds: storeIds,
      currentStoreId: selectedStoreId
    });
  }, [profile?.id, profile?.role, selectedStoreId, storeIds, storeRole]);

  if (selectedStoreId && !hasStoreAccess && !isAdmin) {
    return <CenteredNotice title="此帳號無法使用 POS 前台" text="請確認此帳號已被綁定為 owner、manager、staff 或 viewer。" />;
  }

  return <MerchantPosContent profile={profile} storeId={selectedStoreId} storeIds={storeIds} activeStoreId={selectedStoreId} activeStoreRole={storeRole} onStoreChange={setActiveStoreId} />;
}

function MerchantPosContent({ profile, storeId, storeIds, activeStoreId, activeStoreRole, onStoreChange }: { profile: User | null; storeId: string; storeIds: string[]; activeStoreId: string; activeStoreRole: StoreMemberRole | null; onStoreChange: (storeId: string) => void }) {
  const { db, createCashFlow, createCustomer, createOrder, todayCashFlows, todayOrders, updateOrderStatus, upsertCashFlowItem, lookupCustomerByPhone, lookupCustomerByMemberNo, adjustCustomerPoints, adjustStoredValue, updateCustomerOrderStats, getCalculatePointsEarned, loadMemberRules } = useDemoStore({ storeId, loadCustomers: true, todayOrdersOnly: true });
  const store = db.stores.find((item) => item.id === storeId);
  const categories = useMemo(() => db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort), [db.categories, storeId]);
  const products = useMemo(() => db.products.filter((item) => item.storeId === storeId && item.isAvailable && !item.isSoldOut).sort((a, b) => a.sort - b.sort), [db.products, storeId]);
  const cashFlowItems = useMemo(() => (db.cashFlowItems ?? []).filter((item) => item.storeId === storeId && item.enabled).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")), [db.cashFlowItems, storeId]);
  const permissions = resolvePermissions(profile, storeId);
  const effectiveRole = profile?.role === "admin" ? "admin" : activeStoreRole;
  const canViewReport = permissions.canViewDailyReport;
  const canAddCashFlow = permissions.canUseCashflow;
  const canManageCashItems = permissions.canUseCashflow && permissions.canManageMenu;
  const canApplyDiscounts = permissions.canApplyDiscounts;
  const canCancelOrders = permissions.canCancelOrders;
  const canUseMemberLookup = permissions.canUseMemberLookup;
  const canUseStoredValue = permissions.canUseStoredValue;
  const memberEnabled = store?.features?.memberEnabled ?? false;
  const memberStoredValueEnabled = store?.features?.memberStoredValueEnabled ?? false;
  const posEnabled = store?.posOrderingEnabled ?? true;
  const enablePickupDisplay = store?.enablePickupDisplay ?? true;
  const dailyReportFeature = store?.features?.dailyReportEnabled ?? true;
  const cashFlowFeature = store?.features?.cashFlowEnabled ?? true;

  const [activePanel, setActivePanel] = useState<PosPanel>("orders");
  const [activeOrderTab, setActiveOrderTab] = useState<(typeof orderTabs)[number]["key"]>("new");
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [mode, setMode] = useState<OrderMode>("takeout");
  const [tableNo, setTableNo] = useState("1");
  const [customerNote, setCustomerNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<CartItemDiscount>(null);
  const [choosingProduct, setChoosingProduct] = useState<Product | null>(null);
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderError, setOrderError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashMessage, setCashMessage] = useState("");
  const [cashError, setCashError] = useState("");
  const [cashForm, setCashForm] = useState<CashForm>({ itemId: "", amount: "", note: "" });
  const [cashItemForm, setCashItemForm] = useState<CashItemForm>({ name: "", type: "expense", amountMode: "open", fixedAmount: "" });
  const [boundMember, setBoundMember] = useState<Customer | null>(null);
  const [storedValueUsed, setStoredValueUsed] = useState(0);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);

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
  const itemsSubtotal = cart.reduce((sum, line) => sum + lineSubtotal(line), 0);
  const itemDiscountTotal = cart.reduce((sum, line) => sum + lineDiscountAmount(line), 0);
  const afterItemDiscount = itemsSubtotal - itemDiscountTotal;
  const orderDiscAmt = computeOrderDiscountAmount(afterItemDiscount, orderDiscount);
  const promotionLines = useMemo(() => cart.map((line) => ({ product: line.product, quantity: line.quantity, unitPrice: lineBasePrice(line) })), [cart]);
  const promotionCalculation = useMemo(
    () => calculatePromotions(promotionLines, store?.features?.promotionEnabled === false ? [] : (db.promotions ?? []).filter((item) => item.storeId === storeId)),
    [db.promotions, promotionLines, store?.features?.promotionEnabled, storeId]
  );
  const promotionDiscountTotal = promotionCalculation.discountTotal;
  const finalTotal = Math.max(0, afterItemDiscount - orderDiscAmt - promotionDiscountTotal);
  const storedValueDeduction = Math.min(storedValueUsed, finalTotal);
  const cashDue = finalTotal - storedValueDeduction;
  const cashIncome = todayCashFlows.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const cashExpense = todayCashFlows.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const cashNet = cashIncome - cashExpense;
  const estimatedCashBalance = completedRevenue + cashNet;
  const selectedCashItem = cashFlowItems.find((item) => item.id === cashForm.itemId) ?? null;

  if (!storeId) return <CenteredNotice title="請先完成店家設定" text="POS 前台需要綁定店家後才能使用。" />;
  if (!store) return <CenteredNotice title="載入店家資料..." text="" />;

  const isAdmin = profile?.role === "admin";
  const storeAccess = !isAdmin ? checkStoreAccess(store) : { ok: true, reason: "" };
  const userAccess = !isAdmin ? checkUserAccess(profile, storeId) : { ok: true, reason: "" };
  if (!userAccess.ok) return <CenteredNotice title="帳號存取受限" text={userAccess.reason} />;
  if (!storeAccess.ok) return <CenteredNotice title="店家方案受限" text={storeAccess.reason} />;

  function confirmProductOptions(selectedOptions: OrderItemOption[]) {
    if (!choosingProduct) return;
    setCart((current) => [...current, { product: choosingProduct, quantity: 1, note: "", selectedOptions, discount: null }]);
    setChoosingProduct(null);
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function submitOrder() {
    if (cart.length === 0 || isSubmitting) return;
    setOrderError("");
    setOrderSuccess("");
    if (!posEnabled) {
      setOrderError("POS 現場單目前暫停建立");
      return;
    }
    setIsSubmitting(true);
    try {
      const memberRules = boundMember ? await loadMemberRules(storeId) : null;
      const pointsEarned = boundMember && memberRules?.enablePoints && memberRules.earnAmount > 0
        ? Math.floor(finalTotal / memberRules.earnAmount) * memberRules.earnPoints
        : boundMember ? getCalculatePointsEarned(finalTotal, storeId) : 0;
      const order = await createOrder({
        storeId,
        mode,
        tableNo: mode === "takeout" ? "外帶" : tableNo,
        customerNote,
        total: finalTotal,
        source: "pos",
        status: "accepted",
        memberId: boundMember?.id,
        memberPhone: boundMember?.phone,
        memberName: boundMember?.name,
        ...(storedValueDeduction > 0 ? { paymentMethod: "stored_value" as const } : {}),
        ...(boundMember ? { customer: { customerId: boundMember.id, memberNo: boundMember.memberNo, name: boundMember.name, phone: boundMember.phone } } : {}),
        ...(pointsEarned > 0 ? { pointsEarned } : {}),
        ...(storedValueDeduction > 0 ? { storedValueUsed: storedValueDeduction } : {}),
        items: cart.map<OrderItem>((line) => {
          const unitPrice = lineBasePrice(line);
          const discAmt = lineDiscountAmount(line);
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
            itemNote: line.note,
            ...(line.discount ? { discount: { type: line.discount.type, value: line.discount.value, amount: discAmt } } : {})
          };
        }),
        ...(orderDiscount ? { orderDiscount: { type: orderDiscount.type, value: orderDiscount.value, amount: orderDiscAmt } } : {}),
        promotionDiscounts: promotionCalculation.appliedPromotions,
        ...((itemDiscountTotal > 0 || orderDiscAmt > 0 || promotionDiscountTotal > 0) ? { discountSummary: { itemDiscountTotal, orderDiscountTotal: orderDiscAmt, promotionDiscountTotal, totalDiscount: itemDiscountTotal + orderDiscAmt + promotionDiscountTotal } } : {})
      });
      setCart([]);
      setCustomerNote("");
      setOrderDiscount(null);
      console.log("[POS Order Created]", {
        orderId: order.id,
        storeId: order.storeId,
        source: order.source,
        status: order.status,
        orderType: order.orderType,
        memberId: order.memberId,
        memberPhone: order.memberPhone,
        memberName: order.memberName
      });
      setOrderSuccess(`POS 訂單已建立：${order.orderNumber}`);
      if (boundMember) {
        await updateCustomerOrderStats(boundMember.id, finalTotal);
        if (pointsEarned > 0) {
          await adjustCustomerPoints({ customerId: boundMember.id, storeId, type: "earn", points: pointsEarned, orderId: order.id, note: `訂單 ${order.orderNumber} 消費點數`, createdBy: profile?.email ?? "" });
        }
        if (storedValueDeduction > 0) {
          await adjustStoredValue({ customerId: boundMember.id, storeId, type: "payment", amount: -storedValueDeduction, orderId: order.id, note: `訂單 ${order.orderNumber} 儲值付款`, createdBy: profile?.email ?? "" });
        }
        setBoundMember(null);
        setStoredValueUsed(0);
      }
    } catch (writeError) {
      setOrderError(writeError instanceof Error ? writeError.message : "訂單建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  }

  function lookupMember(query: string) {
    if (!query.trim()) return;
    const byPhone = lookupCustomerByPhone(query.trim(), storeId);
    const byMemberNo = lookupCustomerByMemberNo(query.trim(), storeId);
    const found = byPhone ?? byMemberNo ?? null;
    setBoundMember(found);
    setStoredValueUsed(0);
    return found;
  }

  async function createMember(form: { name: string; phone: string; birthday?: string; note?: string }) {
    const member = await createCustomer({ storeId, ...form, createdBy: profile?.email ?? profile?.id ?? "" });
    setBoundMember(member);
    setStoredValueUsed(0);
    setMemberModalOpen(false);
  }

  async function topupMember(amount: number, note?: string) {
    if (!boundMember || amount <= 0) return;
    await adjustStoredValue({ customerId: boundMember.id, storeId, type: "topup", amount, note: note || "POS 會員儲值", createdBy: profile?.email ?? "" });
    setBoundMember({ ...boundMember, storedValueBalance: (boundMember.storedValueBalance ?? 0) + amount, balance: (boundMember.balance ?? boundMember.storedValueBalance ?? 0) + amount });
    setTopupModalOpen(false);
  }

  async function submitCashFlow() {
    if (!canAddCashFlow) return;
    setCashError("");
    setCashMessage("");
    const item = cashFlowItems.find((cashItem) => cashItem.id === cashForm.itemId);
    if (!item) {
      setCashError("請先選擇現金流項目");
      return;
    }
    const amount = Number(cashForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashError("請輸入正確金額");
      return;
    }
    try {
      await createCashFlow({ storeId, itemId: item.id, itemName: item.name, type: item.type, amount, category: item.name, note: cashForm.note, createdBy: profile?.email ?? profile?.id ?? "" });
      setCashForm({ itemId: "", amount: "", note: "" });
      setCashMessage("現金流已新增");
    } catch (error) {
      console.error("createCashFlow failed", error);
      setCashError(error instanceof Error ? error.message : "新增現金流失敗");
    }
  }

  async function addCashFlowItem() {
    if (!canManageCashItems || !cashItemForm.name.trim()) return;
    const fixedAmount = Number(cashItemForm.fixedAmount);
    await upsertCashFlowItem({
      storeId,
      name: cashItemForm.name.trim(),
      type: cashItemForm.type,
      amountMode: cashItemForm.amountMode,
      fixedAmount: cashItemForm.amountMode === "fixed" && Number.isFinite(fixedAmount) ? fixedAmount : undefined,
      enabled: true
    });
    setCashItemForm({ name: "", type: "expense", amountMode: "open", fixedAmount: "" });
  }

  function chooseCashItem(itemId: string) {
    const item = cashFlowItems.find((cashItem) => cashItem.id === itemId);
    setCashForm({ itemId, amount: item?.amountMode === "fixed" ? String(item.fixedAmount ?? "") : "", note: "" });
  }

  return (
    <main className="min-h-screen bg-[#f5f3ee] p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-5 flex flex-col gap-3 rounded-lg bg-[#171717] p-5 text-white shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-black text-white/55">POS 前台工作台</p>
            <h1 className="mt-2 text-3xl font-black">{store.name} 接單中心</h1>
            <p className="mt-2 text-sm font-bold text-white/65">接單、建立現場訂單、查看今日銷售與現金流。</p>
            {effectiveRole && <p className="mt-2 text-xs font-black text-white/45">目前角色：{effectiveRole}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {storeIds.length > 1 && (
              <select value={activeStoreId} onChange={(event) => onStoreChange(event.target.value)} className="rounded-lg border border-white/20 bg-white px-4 py-3 font-black text-ink">
                {storeIds.map((id) => <option key={id} value={id}>{db.stores.find((item) => item.id === id)?.name ?? id}</option>)}
              </select>
            )}
            {store.features?.kdsEnabled && (
              <Link href={`/kitchen/${storeId}`} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-black text-white"><ChefHat className="size-4" />廚房 KDS</Link>
            )}
            <Link href="/merchant/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-black text-ink"><ArrowLeft className="size-4" />返回設定中心</Link>
          </div>
        </header>

        <section className="mb-5 grid gap-3 md:grid-cols-4">
          <PanelButton active={activePanel === "orders"} icon={ReceiptText} label="接單工作台" onClick={() => setActivePanel("orders")} />
          <PanelButton active={activePanel === "report"} icon={BarChart3} label="每日報表" onClick={() => setActivePanel("report")} disabled={!canViewReport || !dailyReportFeature} />
          <PanelButton active={activePanel === "cash"} icon={WalletCards} label="現金流" onClick={() => setActivePanel("cash")} disabled={(!canAddCashFlow && !canViewReport) || !cashFlowFeature} />
          <PanelButton active={activePanel === "daily"} icon={FileText} label="日結" onClick={() => setActivePanel("daily")} disabled={!canViewReport || !dailyReportFeature} />
        </section>

        {orderSuccess && <div className="mb-5 rounded-lg border border-leaf/30 bg-leaf/10 p-5 font-black text-leaf">{orderSuccess}</div>}
        {orderError && <div className="mb-5 rounded-lg border border-tomato/30 bg-tomato/10 p-5 font-black text-tomato">{orderError}</div>}

        {activePanel === "orders" && (
          <>
            <div className="grid gap-5 2xl:grid-cols-[minmax(520px,0.95fr)_minmax(560px,1.05fr)_420px]">
              <OrderBoard activeOrderTab={activeOrderTab} canCancelOrders={canCancelOrders} displayedOrders={displayedOrders} enablePickupDisplay={enablePickupDisplay} setActiveOrderTab={setActiveOrderTab} updateOrderStatus={updateOrderStatus} />
              <QuickOrder activeCategoryId={activeCategoryId} categories={categories} customerNote={customerNote} mode={mode} posEnabled={posEnabled} products={visibleProducts} setActiveCategoryId={setActiveCategoryId} setChoosingProduct={setChoosingProduct} setCustomerNote={setCustomerNote} setMode={setMode} setTableNo={setTableNo} tableNo={tableNo} />
              <aside className="space-y-5">
                <CartPanel canApplyDiscounts={canApplyDiscounts} cart={cart} itemsSubtotal={itemsSubtotal} itemDiscountTotal={itemDiscountTotal} orderDiscAmt={orderDiscAmt} promotionDiscounts={promotionCalculation.appliedPromotions} finalTotal={finalTotal} cashDue={cashDue} storedValueDeduction={storedValueDeduction} orderDiscount={orderDiscount} setOrderDiscount={setOrderDiscount} updateLine={updateLine} removeLine={(index) => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} submitOrder={submitOrder} isSubmitting={isSubmitting} posEnabled={posEnabled} memberEnabled={memberEnabled} memberStoredValueEnabled={memberStoredValueEnabled} canUseMemberLookup={canUseMemberLookup} canUseStoredValue={canUseStoredValue} boundMember={boundMember} storedValueUsed={storedValueUsed} onLookupMember={lookupMember} onClearMember={() => { setBoundMember(null); setStoredValueUsed(0); }} onStoredValueChange={setStoredValueUsed} onOpenCreateMember={() => setMemberModalOpen(true)} onOpenTopup={() => setTopupModalOpen(true)} />
              </aside>
            </div>
          </>
        )}

        {activePanel === "report" && (canViewReport ? <DailySalesPanel averageOrderValue={averageOrderValue} cashExpense={cashExpense} cashIncome={cashIncome} cashNet={cashNet} cancelledCount={cancelledOrders.length} completedRevenue={completedRevenue} estimatedCashBalance={estimatedCashBalance} orderCount={todayOrders.length} ranking={ranking} totalRevenue={totalRevenue} /> : <PermissionNotice text="staff 可新增現金流，但不能查看完整每日報表。" />)}
        {activePanel === "cash" && <CashFlowPanel addCashFlowItem={addCashFlowItem} canAddCashFlow={canAddCashFlow} canManageCashItems={canManageCashItems} cashError={cashError} cashFlows={todayCashFlows} cashForm={cashForm} cashItemForm={cashItemForm} cashItems={cashFlowItems} cashMessage={cashMessage} cashNet={cashNet} chooseCashItem={chooseCashItem} selectedCashItem={selectedCashItem} setCashForm={setCashForm} setCashItemForm={setCashItemForm} submitCashFlow={submitCashFlow} />}
        {activePanel === "daily" && (canViewReport ? <DailyReportPanel storeId={storeId} storeName={store.name} todayOrders={todayOrders} todayCashFlows={todayCashFlows} userEmail={profile?.email} userRole={effectiveRole ?? undefined} storeFeatures={store.features} customers={db.customers} pointLogs={db.pointLogs} storedValueLogs={db.storedValueLogs} dataRetentionMonths={store.dataRetentionMonths} /> : <PermissionNotice text="日結功能僅限 owner、manager 以上角色。" />)}
      </div>
      {choosingProduct && <ProductOptionModal product={choosingProduct} onClose={() => setChoosingProduct(null)} onConfirm={confirmProductOptions} />}
      {memberModalOpen && <MemberModal onClose={() => setMemberModalOpen(false)} onSubmit={createMember} />}
      {topupModalOpen && boundMember && <TopupModal member={boundMember} onClose={() => setTopupModalOpen(false)} onSubmit={topupMember} />}
    </main>
  );
}

function OrderBoard({ activeOrderTab, canCancelOrders, displayedOrders, enablePickupDisplay, setActiveOrderTab, updateOrderStatus }: { activeOrderTab: string; canCancelOrders: boolean; displayedOrders: Order[]; enablePickupDisplay: boolean; setActiveOrderTab: (key: (typeof orderTabs)[number]["key"]) => void; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-2xl font-black">接單進單</h2><p className="mt-1 text-sm font-bold text-steel">新訂單接單後直接進入處理中。</p></div>
        <Clock3 className="size-7 text-tomato" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {orderTabs.map((tab) => <button key={tab.key} onClick={() => setActiveOrderTab(tab.key)} className={`rounded-lg px-3 py-3 font-black ${activeOrderTab === tab.key ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>{tab.label}</button>)}
      </div>
      <div className="mt-4 space-y-3">
        {displayedOrders.length === 0 ? <p className="rounded-lg bg-stone-50 p-5 text-center font-black text-steel">目前沒有訂單</p> : displayedOrders.map((order) => <OrderWorkCard key={order.id} canCancelOrders={canCancelOrders} enablePickupDisplay={enablePickupDisplay} order={order} updateOrderStatus={updateOrderStatus} />)}
      </div>
    </section>
  );
}

function MemberModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (form: { name: string; phone: string; birthday?: string; note?: string }) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", phone: "", birthday: "", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    if (!form.name.trim() || !form.phone.trim()) {
      setError("姓名與手機必填");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: form.name.trim(), phone: form.phone.trim(), birthday: form.birthday || undefined, note: form.note || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立會員失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-2xl font-black text-ink">新增會員</h2>
        <div className="mt-4 grid gap-3">
          <Field label="姓名" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
          <Field label="手機" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
          <Field label="生日" value={form.birthday} onChange={(value) => setForm((current) => ({ ...current, birthday: value }))} />
          <Field label="備註" value={form.note} onChange={(value) => setForm((current) => ({ ...current, note: value }))} />
        </div>
        {error && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg bg-stone-200 px-4 py-3 font-black text-steel">取消</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:opacity-60">{saving ? "建立中..." : "建立會員"}</button>
        </div>
      </div>
    </div>
  );
}

function TopupModal({ member, onClose, onSubmit }: { member: Customer; onClose: () => void; onSubmit: (amount: number, note?: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = Math.round(Number(amount));
    setError("");
    if (!Number.isFinite(value) || value <= 0) {
      setError("請輸入正確儲值金額");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(value, note.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲值失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-2xl font-black text-ink">會員儲值</h2>
        <p className="mt-2 text-sm font-bold text-steel">{member.name} ｜ 目前餘額 ${member.balance ?? member.storedValueBalance}</p>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" placeholder="儲值金額" className="mt-4 w-full rounded-lg border border-orange-100 px-3 py-3 font-bold" />
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="備註" className="mt-3 min-h-20 w-full rounded-lg border border-orange-100 px-3 py-3 font-bold" />
        {error && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg bg-stone-200 px-4 py-3 font-black text-steel">取消</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-leaf px-4 py-3 font-black text-white disabled:opacity-60">{saving ? "儲值中..." : "確認儲值"}</button>
        </div>
      </div>
    </div>
  );
}

function QuickOrder({ activeCategoryId, categories, customerNote, mode, posEnabled, products, setActiveCategoryId, setChoosingProduct, setCustomerNote, setMode, setTableNo, tableNo }: { activeCategoryId: string; categories: { id: string; name: string }[]; customerNote: string; mode: OrderMode; posEnabled: boolean; products: Product[]; setActiveCategoryId: (id: string) => void; setChoosingProduct: (product: Product) => void; setCustomerNote: (value: string) => void; setMode: (mode: OrderMode) => void; setTableNo: (value: string) => void; tableNo: string }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-2xl font-black">快速建立訂單</h2><p className="mt-1 text-sm font-bold text-steel">{posEnabled ? "給櫃台現場點餐使用。" : "POS 現場單目前暫停建立。"}</p></div>
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
          <button key={product.id} disabled={!posEnabled} onClick={() => setChoosingProduct(product)} className="rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-leaf hover:bg-[#fbfff4] disabled:opacity-50">
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

function CashFlowPanel({ addCashFlowItem, canAddCashFlow, canManageCashItems, cashError, cashFlows, cashForm, cashItemForm, cashItems, cashMessage, cashNet, chooseCashItem, selectedCashItem, setCashForm, setCashItemForm, submitCashFlow }: { addCashFlowItem: () => void; canAddCashFlow: boolean; canManageCashItems: boolean; cashError: string; cashFlows: CashFlow[]; cashForm: CashForm; cashItemForm: CashItemForm; cashItems: CashFlowItem[]; cashMessage: string; cashNet: number; chooseCashItem: (itemId: string) => void; selectedCashItem: CashFlowItem | null; setCashForm: React.Dispatch<React.SetStateAction<CashForm>>; setCashItemForm: React.Dispatch<React.SetStateAction<CashItemForm>>; submitCashFlow: () => void }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">新增現金流</h2>
          {!canAddCashFlow && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-700">目前角色只能查看，不能新增現金流。</p>}
          {cashMessage && <p className="mt-3 rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">{cashMessage}</p>}
          {cashError && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{cashError}</p>}
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-black text-steel">
              現金流項目
              <select value={cashForm.itemId} disabled={!canAddCashFlow} onChange={(event) => chooseCashItem(event.target.value)} className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink disabled:bg-stone-100">
                <option value="">請選擇項目</option>
                {cashItems.map((item) => <option key={item.id} value={item.id}>{item.name} / {item.type === "income" ? "收入" : "支出"}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-black text-steel">
              金額 {selectedCashItem?.amountMode === "fixed" ? "（固定金額，可視情況修改）" : ""}
              <input value={cashForm.amount} disabled={!canAddCashFlow} onChange={(event) => setCashForm((current) => ({ ...current, amount: event.target.value }))} type="number" min="0" placeholder="例如 1000" className="rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink disabled:bg-stone-100" />
            </label>
            <label className="grid gap-1 text-sm font-black text-steel">
              備註
              <textarea value={cashForm.note} disabled={!canAddCashFlow} onChange={(event) => setCashForm((current) => ({ ...current, note: event.target.value }))} className="min-h-24 rounded-lg border border-orange-100 px-4 py-3 font-bold text-ink disabled:bg-stone-100" />
            </label>
            <button disabled={!canAddCashFlow} onClick={submitCashFlow} className="rounded-lg bg-leaf px-4 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">新增現金流</button>
          </div>
        </div>

        {canManageCashItems && (
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">現金流項目管理</h2>
            <div className="mt-4 grid gap-3">
              <Field label="項目名稱" value={cashItemForm.name} onChange={(value) => setCashItemForm((current) => ({ ...current, name: value }))} />
              <select value={cashItemForm.type} onChange={(event) => setCashItemForm((current) => ({ ...current, type: event.target.value as CashFlowType }))} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                <option value="income">收入</option>
                <option value="expense">支出</option>
              </select>
              <select value={cashItemForm.amountMode} onChange={(event) => setCashItemForm((current) => ({ ...current, amountMode: event.target.value as CashFlowAmountMode }))} className="rounded-lg border border-orange-100 px-4 py-3 font-bold">
                <option value="open">開放輸入金額</option>
                <option value="fixed">固定金額</option>
              </select>
              {cashItemForm.amountMode === "fixed" && <Field label="固定金額" value={cashItemForm.fixedAmount} onChange={(value) => setCashItemForm((current) => ({ ...current, fixedAmount: value }))} />}
              <button onClick={addCashFlowItem} className="rounded-lg bg-ink px-4 py-4 font-black text-white">新增項目</button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">今日現金流</h2>
          <p className={`text-2xl font-black ${cashNet >= 0 ? "text-leaf" : "text-tomato"}`}>淨額 ${cashNet}</p>
        </div>
        <div className="mt-4 space-y-3">
          {cashFlows.length === 0 ? <p className="rounded-lg bg-stone-50 p-5 text-center font-black text-steel">今日尚無現金流紀錄</p> : cashFlows.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg bg-orange-50 p-4">
              <div><p className="font-black text-ink">{item.itemName ?? item.category}</p><p className="mt-1 text-sm font-bold text-steel">{item.note || "無備註"} / {new Date(item.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p></div>
              <p className={`text-xl font-black ${item.type === "income" ? "text-leaf" : "text-tomato"}`}>{item.type === "income" ? "+" : "-"}${item.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DailySalesPanel({ averageOrderValue, cashExpense, cashIncome, cashNet, cancelledCount, completedRevenue, estimatedCashBalance, orderCount, ranking, totalRevenue }: { averageOrderValue: number; cashExpense: number; cashIncome: number; cashNet: number; cancelledCount: number; completedRevenue: number; estimatedCashBalance: number; orderCount: number; ranking: ReturnType<typeof salesRanking>; totalRevenue: number }) {
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
      </div>
      <aside className="space-y-5">
        <MetricCard icon={WalletCards} label="現金流淨額" value={`$${cashNet}`} tone={cashNet >= 0 ? "text-leaf" : "text-tomato"} />
        <SalesRanking ranking={ranking} title="商品銷售排行 TOP 10" />
      </aside>
    </section>
  );
}

function SalesRanking({ ranking, title }: { ranking: ReturnType<typeof salesRanking>; title: string }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {ranking.length === 0 ? <p className="rounded-lg bg-stone-50 p-4 text-sm font-black text-steel">尚無銷售資料</p> : ranking.map((item, index) => (
          <div key={item.productId} className="flex items-center justify-between rounded-lg bg-[#fffaf0] px-4 py-3"><div><p className="font-black">#{index + 1} {item.productName}</p><p className="text-sm font-bold text-steel">售出 {item.quantity} 份</p></div><p className="font-black text-tomato">${item.totalAmount}</p></div>
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

function MetricCard({ icon: Icon, label, value, tone = "text-ink" }: { icon: React.ElementType; label: string; value: string; tone?: string }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-black text-steel">{label}</p><Icon className="size-5 text-steel" /></div><p className={`mt-3 text-4xl font-black ${tone}`}>{value}</p></div>;
}

function PanelButton({ active, disabled, icon: Icon, label, onClick }: { active: boolean; disabled?: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-4 font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-ink text-white" : "bg-white text-ink"}`}><Icon className="size-5" />{label}</button>;
}

function PermissionNotice({ text }: { text: string }) {
  return <div className="rounded-lg bg-white p-8 text-center text-xl font-black text-steel shadow-sm">{text}</div>;
}

function CenteredNotice({ title, text }: { title: string; text: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4"><div className="rounded-lg bg-white p-6 shadow-soft"><h1 className="text-2xl font-black text-ink">{title}</h1>{text && <p className="mt-3 text-steel">{text}</p>}</div></main>;
}

function OrderWorkCard({ canCancelOrders, enablePickupDisplay, order, updateOrderStatus }: { canCancelOrders: boolean; enablePickupDisplay: boolean; order: Order; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  const cancelReason = order.cancelReason ?? order.rejectReason;
  const isPosDirectComplete = order.source === "pos" && !enablePickupDisplay;
  return (
    <article className={`rounded-lg border p-4 ${["pending", "waiting", "unprocessed"].includes(order.status) ? "animate-order-pop border-tomato bg-tomato/5" : "border-stone-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-3xl font-black">#{order.orderNumber}</p><p className="mt-1 text-sm font-bold text-steel">{order.source === "qr" ? "QR 進單" : order.source === "pos" ? "POS 現場單" : "自助機/其他"} / {order.mode === "takeout" ? "外帶" : `內用 ${order.tableName ?? order.tableNo}`} / {new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p></div><StatusPill status={order.status} /></div>
      {cancelReason && order.status === "cancelled" && <p className="mt-3 rounded-lg bg-tomato/10 px-3 py-2 text-sm font-black text-tomato">取消原因：{cancelReason}</p>}
      {order.customerNote && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">訂單備註：{order.customerNote}</p>}
      <div className="mt-3 space-y-2 text-sm font-bold text-steel">{order.items.map((item) => <OrderItemLine key={item.id} item={item} />)}</div>
      <p className="mt-3 text-lg font-black text-tomato">總金額 ${order.totalAmount ?? order.total}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["pending", "waiting", "unprocessed"].includes(order.status) && <button onClick={() => updateOrderStatus(order.id, "accepted")} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-3 py-2 font-black text-white"><CheckCircle2 className="size-4" />接單</button>}
        {["accepted", "cooking", "preparing", "ready"].includes(order.status) && <button onClick={() => updateOrderStatus(order.id, "completed")} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-3 py-2 font-black text-white"><CheckCircle2 className="size-4" />{isPosDirectComplete ? "直接完成" : "餐點完成"}</button>}
        {canCancelOrders && !["completed", "cancelled"].includes(order.status) && <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="inline-flex items-center gap-2 rounded-lg bg-tomato px-3 py-2 font-black text-white"><XCircle className="size-4" />取消</button>}
      </div>
    </article>
  );
}

function OrderItemLine({ item }: { item: OrderItem }) {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions);
  const itemNote = (item.itemNote ?? item.note ?? "").trim();
  return <div className="rounded-lg bg-stone-50 px-3 py-2"><p>{item.quantity} x {item.productName}</p>{selectedOptions.length > 0 && <div className="ml-3 mt-1 space-y-1 text-xs">{selectedOptions.map((option) => <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 12}px` }}>- {option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}</p>)}</div>}{itemNote && <p className="ml-3 mt-1 rounded bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">備註：{itemNote}</p>}</div>;
}

function CartPanel({ canApplyDiscounts, cart, itemsSubtotal, itemDiscountTotal, orderDiscAmt, promotionDiscounts, finalTotal, cashDue, storedValueDeduction, orderDiscount, setOrderDiscount, removeLine, submitOrder, updateLine, isSubmitting, posEnabled, memberEnabled, memberStoredValueEnabled, canUseMemberLookup, canUseStoredValue, boundMember, storedValueUsed, onLookupMember, onClearMember, onStoredValueChange, onOpenCreateMember, onOpenTopup }: { canApplyDiscounts: boolean; cart: CartLine[]; itemsSubtotal: number; itemDiscountTotal: number; orderDiscAmt: number; promotionDiscounts: import("@/lib/types").PromotionDiscountLine[]; finalTotal: number; cashDue: number; storedValueDeduction: number; orderDiscount: CartItemDiscount; setOrderDiscount: (d: CartItemDiscount) => void; removeLine: (index: number) => void; submitOrder: () => void; updateLine: (index: number, patch: Partial<CartLine>) => void; isSubmitting: boolean; posEnabled: boolean; memberEnabled: boolean; memberStoredValueEnabled: boolean; canUseMemberLookup: boolean; canUseStoredValue: boolean; boundMember: Customer | null; storedValueUsed: number; onLookupMember: (q: string) => Customer | null | undefined; onClearMember: () => void; onStoredValueChange: (amount: number) => void; onOpenCreateMember: () => void; onOpenTopup: () => void }) {
  const [showOrderDiscForm, setShowOrderDiscForm] = useState(false);
  const [orderDiscType, setOrderDiscType] = useState<"amount" | "percent">("amount");
  const [orderDiscValue, setOrderDiscValue] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberNotFound, setMemberNotFound] = useState(false);

  const promotionDiscountTotal = promotionDiscounts.reduce((sum, p) => sum + p.amount, 0);
  const hasDiscount = itemDiscountTotal > 0 || orderDiscAmt > 0 || promotionDiscountTotal > 0 || storedValueDeduction > 0;

  function handleMemberLookup() {
    if (!memberQuery.trim()) return;
    const found = onLookupMember(memberQuery.trim());
    setMemberNotFound(!found);
    if (found) setMemberQuery("");
  }

  function applyOrderDiscount() {
    const v = Math.round(Number(orderDiscValue));
    if (!Number.isFinite(v) || v <= 0) return;
    setOrderDiscount({ type: orderDiscType, value: v });
    setShowOrderDiscForm(false);
    setOrderDiscValue("");
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black">現場訂單購物車</h2>
      {!posEnabled && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">POS 現場單目前暫停建立</p>}

      {/* Member lookup */}
      {memberEnabled && canUseMemberLookup && (
        <div className="mt-4">
          {boundMember ? (
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-blue-800">已綁定會員</p>
                  <p className="font-black text-ink">{boundMember.name} <span className="text-sm font-bold text-steel">({boundMember.memberNo})</span></p>
                  <p className="text-sm font-bold text-steel">點數：{boundMember.points} 點 {memberStoredValueEnabled ? `｜儲值：$${boundMember.storedValueBalance}` : ""}</p>
                </div>
                <button onClick={onClearMember} className="rounded-lg bg-stone-200 px-2 py-1 text-xs font-black text-steel">清除</button>
              </div>
              {memberStoredValueEnabled && canUseStoredValue && boundMember.storedValueBalance > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs font-black text-blue-700">使用儲值：$</label>
                  <input
                    type="number" min="0" max={boundMember.storedValueBalance}
                    value={storedValueUsed || ""}
                    onChange={(e) => onStoredValueChange(Math.min(Number(e.target.value) || 0, boundMember.storedValueBalance))}
                    placeholder="0"
                    className="w-24 rounded-lg border border-blue-200 px-2 py-1 text-sm font-bold"
                  />
                  <span className="text-xs text-steel">（餘額 ${boundMember.storedValueBalance}）</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <input
                  value={memberQuery}
                  onChange={(e) => { setMemberQuery(e.target.value); setMemberNotFound(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleMemberLookup()}
                  placeholder="手機 / 會員編號查詢"
                  className="flex-1 rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold"
                />
                <button onClick={handleMemberLookup} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white">查詢</button>
              </div>
              {memberNotFound && <p className="mt-1 text-xs font-black text-tomato">找不到會員，請確認手機或會員編號</p>}
            </div>
          )}
        </div>
      )}
      {memberEnabled && canUseMemberLookup && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={onOpenCreateMember} className="inline-flex items-center gap-1 rounded-lg bg-leaf px-3 py-2 text-sm font-black text-white"><UserPlus className="size-4" />新增會員</button>
          {boundMember && memberStoredValueEnabled && canUseStoredValue && <button onClick={onOpenTopup} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white">儲值</button>}
          {boundMember && <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-black text-steel">餘額 ${boundMember.balance ?? boundMember.storedValueBalance}</span>}
        </div>
      )}
      {cart.length === 0
        ? <p className="mt-4 rounded-lg bg-orange-50 p-4 text-center text-sm font-black text-steel">尚未加入餐點</p>
        : <div className="mt-4 space-y-4">{cart.map((line, index) => <CartLineCard key={`${line.product.id}-${index}`} canApplyDiscounts={canApplyDiscounts} index={index} line={line} removeLine={removeLine} updateLine={updateLine} />)}</div>}

      {/* Total breakdown */}
      <div className="mt-6 rounded-lg bg-orange-50 p-4">
        {hasDiscount ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold text-steel"><span>小計</span><span>${itemsSubtotal}</span></div>
            {itemDiscountTotal > 0 && <div className="flex justify-between text-sm font-bold text-tomato"><span>單品折扣</span><span>-${itemDiscountTotal}</span></div>}
            {orderDiscAmt > 0 && <div className="flex justify-between text-sm font-bold text-tomato"><span>整單折扣</span><span>-${orderDiscAmt}</span></div>}
            {promotionDiscounts.map((p) => (
              <div key={p.promotionId} className="flex justify-between text-sm font-bold text-leaf"><span>促銷：{p.promotionName}</span><span>-${p.amount}</span></div>
            ))}
            <div className="flex justify-between border-t border-orange-200 pt-2 text-xl font-black text-ink"><span>訂單總額</span><span>${finalTotal}</span></div>
            {storedValueDeduction > 0 && <div className="flex justify-between text-sm font-bold text-blue-600"><span>儲值扣抵</span><span>-${storedValueDeduction}</span></div>}
            {storedValueDeduction > 0 && <div className="flex justify-between text-lg font-black text-ink"><span>實收現金</span><span>${cashDue}</span></div>}
          </div>
        ) : (
          <p className="text-xl font-black text-ink">總計：${finalTotal}</p>
        )}
      </div>

      {/* Order-level discount */}
      {canApplyDiscounts && orderDiscount ? (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-sm font-black text-amber-700">整單折扣：{orderDiscount.type === "amount" ? `-$${orderDiscount.value}` : `${orderDiscount.value}%`}（實折 -$${orderDiscAmt}）</p>
          <button onClick={() => setOrderDiscount(null)} className="rounded-lg bg-stone-200 px-2 py-1 text-xs font-black text-steel">清除</button>
        </div>
      ) : canApplyDiscounts && showOrderDiscForm ? (
        <div className="mt-3 rounded-lg bg-stone-50 p-3 space-y-3">
          <p className="text-sm font-black text-steel">整單折扣</p>
          <div className="flex gap-2">
            <button onClick={() => setOrderDiscType("amount")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${orderDiscType === "amount" ? "bg-ink text-white" : "bg-stone-200 text-steel"}`}>金額折扣</button>
            <button onClick={() => setOrderDiscType("percent")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${orderDiscType === "percent" ? "bg-ink text-white" : "bg-stone-200 text-steel"}`}>百分比折扣</button>
          </div>
          <div className="flex gap-2">
            <input value={orderDiscValue} onChange={(e) => setOrderDiscValue(e.target.value)} type="number" min="0" max={orderDiscType === "percent" ? "100" : undefined} placeholder={orderDiscType === "amount" ? "折扣金額（元）" : "折扣 % (1–100)"} className="flex-1 rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold" />
            <button onClick={applyOrderDiscount} className="rounded-lg bg-leaf px-3 py-2 text-sm font-black text-white">套用</button>
            <button onClick={() => { setShowOrderDiscForm(false); setOrderDiscValue(""); }} className="rounded-lg bg-stone-200 px-3 py-2 text-sm font-black text-steel">取消</button>
          </div>
        </div>
      ) : canApplyDiscounts ? (
        <button onClick={() => setShowOrderDiscForm(true)} disabled={cart.length === 0} className="mt-3 w-full rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm font-black text-steel hover:border-stone-400 disabled:opacity-40">
          + 整單折扣
        </button>
      ) : null}

      <button onClick={submitOrder} disabled={cart.length === 0 || isSubmitting || !posEnabled} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-4 font-black text-white disabled:opacity-60"><Send className="size-5" />{isSubmitting ? "送出中..." : "送出訂單"}</button>
    </section>
  );
}

function CartLineCard({ canApplyDiscounts, index, line, removeLine, updateLine }: { canApplyDiscounts: boolean; index: number; line: CartLine; removeLine: (index: number) => void; updateLine: (index: number, patch: Partial<CartLine>) => void }) {
  const [discOpen, setDiscOpen] = useState(false);
  const [discType, setDiscType] = useState<"amount" | "percent">("amount");
  const [discValue, setDiscValue] = useState("");

  const basePrice = lineBasePrice(line);
  const sub = lineSubtotal(line);
  const discAmt = lineDiscountAmount(line);
  const after = lineTotal(line);

  function openDiscountForm() {
    if (line.discount) { setDiscType(line.discount.type); setDiscValue(String(line.discount.value)); }
    setDiscOpen(true);
  }

  function applyDiscount() {
    const v = Math.round(Number(discValue));
    if (!Number.isFinite(v) || v <= 0) return;
    updateLine(index, { discount: { type: discType, value: v } });
    setDiscOpen(false);
    setDiscValue("");
  }

  function clearDiscount() {
    updateLine(index, { discount: null });
    setDiscOpen(false);
    setDiscValue("");
  }

  return (
    <div className="rounded-lg border border-orange-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-black text-ink">{line.product.name}</p>
          {line.discount ? (
            <div className="mt-1 space-y-0.5 text-sm">
              <p className="text-steel">原價 ${basePrice} × {line.quantity} = ${sub}</p>
              <p className="font-bold text-tomato">折扣 -{line.discount.type === "percent" ? `${line.discount.value}%` : `$${line.discount.value}`} = -${discAmt}</p>
              <p className="font-black text-ink">小計 ${after}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-steel">${basePrice} × {line.quantity} = ${sub}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button onClick={() => removeLine(index)} className="rounded-lg bg-tomato px-3 py-1.5 text-sm font-black text-white">刪除</button>
          {canApplyDiscounts && (
            <button
              onClick={() => discOpen ? setDiscOpen(false) : openDiscountForm()}
              className={`rounded-lg px-3 py-1.5 text-sm font-black ${line.discount ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-steel"}`}
            >
              {line.discount ? "編輯折扣" : "折扣"}
            </button>
          )}
        </div>
      </div>

      {discOpen && (
        <div className="mt-3 rounded-lg bg-stone-50 p-3 space-y-2.5">
          <div className="flex gap-2">
            <button onClick={() => setDiscType("amount")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${discType === "amount" ? "bg-ink text-white" : "bg-stone-200 text-steel"}`}>金額折扣</button>
            <button onClick={() => setDiscType("percent")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${discType === "percent" ? "bg-ink text-white" : "bg-stone-200 text-steel"}`}>百分比折扣</button>
          </div>
          <div className="flex gap-2">
            <input
              value={discValue}
              onChange={(e) => setDiscValue(e.target.value)}
              type="number"
              min="0"
              max={discType === "percent" ? "100" : undefined}
              placeholder={discType === "amount" ? "折扣金額（元）" : "折扣 % (1–100)"}
              className="flex-1 rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold"
            />
            <button onClick={applyDiscount} className="rounded-lg bg-leaf px-3 py-2 text-sm font-black text-white">套用</button>
          </div>
          {line.discount && (
            <button onClick={clearDiscount} className="w-full rounded-lg bg-stone-200 px-3 py-2 text-sm font-black text-steel">清除折扣</button>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"><Minus className="size-4" /></button>
        <span className="text-xl font-black">{line.quantity}</span>
        <button onClick={() => updateLine(index, { quantity: line.quantity + 1 })} className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50"><Plus className="size-4" /></button>
      </div>
      <textarea value={line.note} onChange={(e) => updateLine(index, { note: e.target.value })} placeholder="品項備註" className="mt-3 w-full rounded-lg border border-orange-100 px-3 py-3 text-sm" />
    </div>
  );
}

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`grid gap-1 text-sm font-black text-steel ${className}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-orange-200 bg-white px-4 py-3 text-lg font-bold" /></label>;
}
