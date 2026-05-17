"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, Bell, BellOff, ChefHat, CheckCircle2, Clock3, FileText, MenuIcon, Minus, Plus, ReceiptText, Send, ShoppingCart, Table2, UserPlus, WalletCards, XCircle } from "lucide-react";
import { collection, doc, getDoc, onSnapshot, query as firestoreQuery, where } from "firebase/firestore";
import { LoginGate } from "@/components/auth/login-gate";
import { ProductOptionModal } from "@/components/product-option-modal";
import { StatusPill } from "@/components/status-pill";
import { useDemoStore } from "@/lib/demo-store";
import { firebaseEnabled, firestore } from "@/lib/firebase";
import { discountLabel, productFinalPrice, productIsAvailable } from "@/lib/pricing";
import { normalizeSelectedOptions, selectionsTotal } from "@/lib/product-options";
import { calculatePromotions } from "@/lib/promotions";
import { resolvePermissions } from "@/lib/permissions";
import { defaultStoreId, isPlatformAdmin, selectorStoreIds, storeRoleFor } from "@/lib/store-access";
import { checkStoreAccess, checkUserAccess } from "@/lib/subscription";
import { businessOrderBlockReason } from "@/lib/business-hours";
import type { CashFlow, CashFlowAmountMode, CashFlowItem, CashFlowType, Customer, Order, OrderItem, OrderItemOption, OrderMode, OrderStatus, Product, StoreMemberRole, Table, User } from "@/lib/types";

type CartItemDiscount = { type: "amount" | "percent"; value: number } | null;
type CartLine = { product: Product; quantity: number; note: string; selectedOptions: OrderItemOption[]; discount: CartItemDiscount };
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
const posAccessRoles: StoreMemberRole[] = ["owner", "manager", "staff"];

export default function MerchantPosPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff"]} title="POS 點餐 / 接單中心">
      {({ profile }) => <MerchantPosShell profile={profile} />}
    </LoginGate>
  );
}
/**
 * Per-user localStorage key used to persist the last POS store selection.
 * The value is validated against the allowed list on every mount; if it is no
 * longer authorised the entry is removed and the first allowed store is used.
 */
function posLsKey(userId: string) {
  return userId ? "pos:storeId:" + userId : "";
}

function MerchantPosShell({ profile }: { profile: User | null }) {
  const isAdmin = isPlatformAdmin(profile);
  const userId = profile?.id ?? "";
  const lsKey = posLsKey(userId);
  const { db: adminDb } = useDemoStore({ admin: isAdmin, skipOrderList: true });

  // Role-mapped store IDs with demo entries already stripped
  const allStoreIds = isAdmin ? adminDb.stores.filter((store) => store.id !== "demo-store" && !store.isDeleted).map((store) => store.id) : selectorStoreIds(profile);

  // Validated store IDs: trimmed to only stores that actually exist in Firestore
  // so stale profile entries (deleted stores, seed data) never reach the selector.
  const [storeIds, setStoreIds] = useState<string[]>(allStoreIds);
  // Display-name cache populated during the Firestore validation pass
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});

  useEffect(() => {
    // Admin is trusted and single-store users need no validation
    if (isAdmin || allStoreIds.length <= 1 || !firebaseEnabled || !firestore) {
      // Guard avoids a re-render when allStoreIds hasn't actually changed
      setStoreIds((prev) => (
        prev.length === allStoreIds.length && prev.every((id, i) => id === allStoreIds[i])
          ? prev : allStoreIds
      ));
      return;
    }
    const fs = firestore;
    let mounted = true;
    Promise.all(allStoreIds.map((id) => getDoc(doc(fs, "stores", id))))
      .then((snapshots) => {
        if (!mounted) return;
        const names: Record<string, string> = {};
        const existing = allStoreIds.filter((id, i) => {
          if (!snapshots[i].exists()) return false;
          const n = snapshots[i].data()?.name;
          if (typeof n === "string" && n) names[id] = n;
          return true;
        });
        setStoreNames(names);
        // Fall back to full list only if every ID was invalid (prevents lock-out)
        setStoreIds(existing.length > 0 ? existing : allStoreIds);
      })
      .catch(() => {
        if (!mounted) return;
        setStoreNames({});
        setStoreIds(allStoreIds);
      });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStoreIds.join(","), isAdmin]);

  // Clear a persisted store selection that is no longer authorised.
  // Runs inside the validation effect rather than a separate effect so we avoid
  // an extra localStorage read on every storeIds change.
  useEffect(() => {
    if (!lsKey) return;
    const saved = window.localStorage.getItem(lsKey) ?? "";
    if (saved && !storeIds.includes(saved)) window.localStorage.removeItem(lsKey);
  }, [storeIds, lsKey]);

  // Prefer a valid persisted selection; otherwise fall back to the profile default
  const [activeStoreId, setActiveStoreId] = useState<string>(() => {
    if (lsKey) {
      const saved = window.localStorage.getItem(lsKey) ?? "";
      if (saved && allStoreIds.includes(saved)) return saved;
    }
    return defaultStoreId(profile);
  });

  function handleStoreChange(id: string) {
    setActiveStoreId(id);
    if (lsKey) window.localStorage.setItem(lsKey, id);
  }

  useEffect(() => {
    const nextStoreId = storeIds.includes(activeStoreId) ? activeStoreId : storeIds[0] ?? "";
    if (nextStoreId !== activeStoreId) {
      setActiveStoreId(nextStoreId);
      if (lsKey) {
        if (nextStoreId) window.localStorage.setItem(lsKey, nextStoreId);
        else window.localStorage.removeItem(lsKey);
      }
    }
  }, [activeStoreId, lsKey, storeIds]);

  const selectedStoreId = storeIds.includes(activeStoreId) ? activeStoreId : storeIds[0] ?? "";
  const storeRole = storeRoleFor(profile, selectedStoreId);
  const hasStoreAccess = Boolean(selectedStoreId && storeRole && posAccessRoles.includes(storeRole));


  if (selectedStoreId && !hasStoreAccess && !isAdmin) {
    return <CenteredNotice title="沒有 POS 權限" text="請確認此帳號是否已被授權為 owner、manager 或 staff。" />;
  }

  return <MerchantPosContent profile={profile} storeId={selectedStoreId} storeIds={storeIds} storeNames={storeNames} activeStoreId={selectedStoreId} activeStoreRole={storeRole} onStoreChange={handleStoreChange} />;
}

function MerchantPosContent({ profile, storeId, storeIds, storeNames = {}, activeStoreId, activeStoreRole, onStoreChange }: { profile: User | null; storeId: string; storeIds: string[]; storeNames?: Record<string, string>; activeStoreId: string; activeStoreRole: StoreMemberRole | null; onStoreChange: (storeId: string) => void }) {
  const { db, createCashFlow, createCustomer, createOrder, todayCashFlows, todayOrders, updateOrderStatus, updateOrderPayment, upsertCashFlowItem, upsertStore, lookupCustomerByPhone, lookupCustomerByMemberNo, adjustCustomerPoints, adjustStoredValue, updateCustomerOrderStats, getCalculatePointsEarned, loadMemberRules } = useDemoStore({ storeId, loadCustomers: true, todayOrdersOnly: true });
  const store = db.stores.find((item) => item.id === storeId);
  const categories = useMemo(() => db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort), [db.categories, storeId]);
  const products = useMemo(() => db.products.filter((item) => item.storeId === storeId && productIsAvailable(item)).sort((a, b) => a.sort - b.sort), [db.products, storeId]);
  const cashFlowItems = useMemo(() => (db.cashFlowItems ?? []).filter((item) => item.storeId === storeId && item.enabled).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")), [db.cashFlowItems, storeId]);
  const permissions = resolvePermissions(profile, storeId);
  const effectiveRole = isPlatformAdmin(profile) ? "systemAdmin" : activeStoreRole;
  const canViewReport = permissions.canViewDailyReport;
  const canAddCashFlow = permissions.canUseCashflow;
  const canManageCashItems = permissions.canUseCashflow && permissions.canManageMenu;
  const canApplyDiscounts = permissions.canApplyDiscounts;
  const canCancelOrders = permissions.canCancelOrders;
  const canUseMemberLookup = permissions.canUseMemberLookup;
  const canUseStoredValue = permissions.canUseStoredValue;
  const canProcessCheckout = permissions.canProcessCheckout;
  const memberEnabled = store?.features?.memberEnabled ?? false;
  const memberStoredValueEnabled = store?.features?.memberStoredValueEnabled ?? false;
  const posEnabled = store?.posOrderingEnabled ?? true;
  const checkoutMode = store?.checkoutMode ?? "prepaid";
  const printSettings = store?.printSettings ?? null;
  const enablePickupDisplay = store?.enablePickupDisplay ?? true;
  const dailyReportFeature = store?.features?.dailyReportEnabled ?? true;
  const cashFlowFeature = store?.features?.cashFlowEnabled ?? true;
  const storeDisplayName = store?.name || storeNames[storeId] || "未命名店家";

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState("");
  const [rightTab, setRightTab] = useState<"cart" | "orders" | "unpaid">("cart");
  const [nowTick, setNowTick] = useState(Date.now());

  // P0-3: 成功/失敗通知 3 秒後自動消失
  useEffect(() => {
    if (!orderSuccess && !orderError) return;
    const t = setTimeout(() => { setOrderSuccess(""); setOrderError(""); }, 3000);
    return () => clearTimeout(t);
  }, [orderSuccess, orderError]);

  // 大型送單成功 Toast 3 秒後自動消失
  useEffect(() => {
    if (!successOrderNumber) return;
    const t = setTimeout(() => setSuccessOrderNumber(""), 3000);
    return () => clearTimeout(t);
  }, [successOrderNumber]);

  // 30s tick — OrderWorkCard 用來計算等待時間
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── 新訂單通知系統 ────────────────────────────────────────────────────────
  type NewOrderToast = { key: string; text: string };
  const [newOrderToasts, setNewOrderToasts] = useState<NewOrderToast[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("pos:soundEnabled") === "1";
  });
  const soundEnabledRef = useRef(soundEnabled);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync with state
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      if (typeof window !== "undefined") window.localStorage.setItem("pos:soundEnabled", next ? "1" : "0");
      return next;
    });
  }

  function playBeep() {
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      // 叮咚兩音：C6 (叮) → G5 (咚)，模擬超商進店提示音
      function chime(freq: number, startAt: number, vol: number) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + startAt + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + 0.65);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + 0.7);
      }
      chime(1047, 0,    0.30); // 叮 — C6
      chime(784,  0.32, 0.25); // 咚 — G5
    } catch {
      // Browser may block audio without user gesture
    }
  }

  function addNewOrderToast(text: string) {
    const key = `nt-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setNewOrderToasts((prev) => [...prev, { key, text }]);
    setTimeout(() => setNewOrderToasts((prev) => prev.filter((t) => t.key !== key)), 4500);
  }

  // ── Dedicated Firestore onSnapshot for new-order notifications ───────────
  // Independent of useDemoStore — fires the moment Firestore pushes an update.
  // On first snapshot: seed knownOrderIds (no toast). On subsequent snapshots:
  // any unseen order that is pending + not from POS triggers a toast + beep.
  useEffect(() => {
    if (!firebaseEnabled || !firestore || !storeId) return;
    // Reset per storeId so switching stores doesn't leak old IDs
    initializedRef.current = false;
    knownOrderIds.current = new Set();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const unsubscribe = onSnapshot(
      firestoreQuery(
        collection(firestore, "stores", storeId, "orders"),
        where("createdAt", ">=", todayStart.toISOString())
      ),
      (snapshot) => {
        if (!initializedRef.current) {
          // First snapshot: record existing order IDs so we don't notify for them
          initializedRef.current = true;
          snapshot.docs.forEach((d) => knownOrderIds.current.add(d.id));
          return;
        }
        const newPending = snapshot.docs.filter(
          (d) =>
            !knownOrderIds.current.has(d.id) &&
            d.data().source !== "pos" &&
            ["pending", "waiting", "unprocessed"].includes(d.data().status as string)
        );
        snapshot.docs.forEach((d) => knownOrderIds.current.add(d.id));
        if (newPending.length === 0) return;
        if (soundEnabledRef.current) playBeep();
        newPending.forEach((d) => {
          const data = d.data();
          const num = (data.orderNumber ?? d.id.slice(-4)) as string;
          const tableText =
            data.tableNo && data.tableNo !== "外帶"
              ? `${data.tableNo} 桌新訂單 #${num}`
              : `新訂單 #${num} 已進單`;
          addNewOrderToast(tableText);
        });
      }
    );

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);
  // ── 新訂單通知系統結束 ────────────────────────────────────────────────────

  const visibleProducts = activeCategoryId === "all" ? products : products.filter((product) => product.categoryId === activeCategoryId);
  const completedOrders = todayOrders.filter((order) => order.status === "completed");
  const cancelledOrders = todayOrders.filter((order) => order.status === "cancelled");
  const activeOrders = todayOrders.filter((order) => order.status !== "cancelled");
  const completedRevenue = completedOrders.reduce((sum, order) => sum + (order.totalAmount ?? order.total), 0);
  const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.totalAmount ?? order.total), 0);
  const averageOrderValue = completedOrders.length ? Math.round(completedRevenue / completedOrders.length) : 0;
  const selectedOrderTab = orderTabs.find((tab) => tab.key === activeOrderTab) ?? orderTabs[0];
  const displayedOrders = todayOrders.filter((order) => selectedOrderTab.statuses.includes(order.status)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const processingOrderCount = todayOrders.filter((order) => ["pending", "waiting", "unprocessed", "accepted", "cooking", "preparing", "ready"].includes(order.status)).length;
  const pendingOrderCount = todayOrders.filter((order) => ["pending", "waiting", "unprocessed"].includes(order.status)).length;
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
  const cartItemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  // 後結帳：未付款訂單（已進廚房但尚未結帳）
  const unpaidOrders = useMemo(
    () => checkoutMode === "postpaid"
      ? todayOrders.filter((o) => o.paymentStatus === "unpaid" && o.status !== "cancelled").sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      : [],
    [checkoutMode, todayOrders]
  );
  const unpaidOrderCount = unpaidOrders.length;
  const tables = useMemo(() => (db.tables ?? []).filter((t) => t.storeId === storeId && t.enabled !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)), [db.tables, storeId]);
  const tableUnpaidCounts = useMemo(() => {
    const map = new Map<string, number>();
    unpaidOrders.forEach((o) => {
      if (o.tableNo && o.tableNo !== "外帶") map.set(o.tableNo, (map.get(o.tableNo) ?? 0) + 1);
    });
    return map;
  }, [unpaidOrders]);

  // 有新待接單且購物車空的 → 自動切換到接單 tab（不打斷正在結帳的操作）
  useEffect(() => {
    if (pendingOrderCount > 0 && cartItemCount === 0) setRightTab("orders");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderCount]);

  // ── 持續響鈴：有待接單時每 5 秒播一次叮咚，接單 / 取消後停止 ────────────
  useEffect(() => {
    // Clear any previous interval before (re)evaluating
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    if (pendingOrderCount > 0 && soundEnabled) {
      alertIntervalRef.current = setInterval(playBeep, 5000);
    }
    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderCount, soundEnabled]);

  if (!storeId) return <CenteredNotice title="請先完成店家設定" text="POS 前台需要有效的店家授權。" />;
  if (!store) return <CenteredNotice title="載入店家資料中..." text="" />;

  const isAdmin = isPlatformAdmin(profile);
  const storeAccess = !isAdmin ? checkStoreAccess(store) : { ok: true, reason: "" };
  const userAccess = !isAdmin ? checkUserAccess(profile, storeId) : { ok: true, reason: "" };
  if (!userAccess.ok) return <CenteredNotice title="帳號無法使用" text={userAccess.reason} />;
  if (!storeAccess.ok) return <CenteredNotice title="店家無法使用" text={storeAccess.reason} />;

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
    if (!posEnabled) {
      setOrderError("POS 現場單目前暫停接單");
      return;
    }
    // 後結帳：內用必須填桌號
    if (checkoutMode === "postpaid" && mode === "dine-in" && !tableNo.trim()) {
      setOrderError("後結帳模式：內用訂單必須填寫桌號");
      return;
    }
    const businessBlockReason = businessOrderBlockReason(store, "pos");
    if (businessBlockReason) {
      setOrderError(businessBlockReason);
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
        paymentStatus: checkoutMode === "postpaid" ? "unpaid" : "paid",
        createdBy: profile?.id ?? "",
        memberId: boundMember?.id,
        memberPhone: boundMember?.phone,
        memberName: boundMember?.name,
        ...(storedValueDeduction > 0 && checkoutMode === "prepaid" ? { paymentMethod: "stored_value" as const } : {}),
        ...(boundMember ? { customer: { customerId: boundMember.id, memberNo: boundMember.memberNo, name: boundMember.name, phone: boundMember.phone } } : {}),
        ...(pointsEarned > 0 ? { pointsEarned } : {}),
        ...(storedValueDeduction > 0 && checkoutMode === "prepaid" ? { storedValueUsed: storedValueDeduction } : {}),
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
      setMode("takeout");
      setTableNo("1");
      setCartOpen(false);
      setSuccessOrderNumber(order.orderNumber ?? "");
      setOrderSuccess("POS 訂單已建立：" + order.orderNumber);
      if (boundMember) {
        await updateCustomerOrderStats(boundMember.id, finalTotal);
        if (pointsEarned > 0) {
          await adjustCustomerPoints({ customerId: boundMember.id, storeId, type: "earn", points: pointsEarned, orderId: order.id, note: "訂單 " + order.orderNumber + " 消費贈點", createdBy: profile?.email ?? "" });
        }
        if (storedValueDeduction > 0 && checkoutMode === "prepaid") {
          await adjustStoredValue({ customerId: boundMember.id, storeId, type: "payment", amount: -storedValueDeduction, orderId: order.id, note: "訂單 " + order.orderNumber + " 儲值金付款", createdBy: profile?.email ?? "" });
        }
        setBoundMember(null);
        setStoredValueUsed(0);
      }
    } catch (writeError) {
      console.error("submitOrder failed", writeError);
      const msg = writeError instanceof Error ? writeError.message : String(writeError);
      const isPermissionError = /permission|PERMISSION_DENIED|insufficient/i.test(msg);
      setOrderError(isPermissionError
        ? "現場單建立失敗：權限不足，請檢查店家帳號綁定與 Firestore 規則"
        : msg || "訂單建立失敗");
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
    setCashError("請輸入正確金額");
    setCashMessage("現金流已新增");
    const item = cashFlowItems.find((cashItem) => cashItem.id === cashForm.itemId);
    if (!item) {
      setCashError("請輸入正確金額");
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
    <main className="min-h-screen bg-[#f5f3ee] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#f5f3ee]/95 px-3 py-3 backdrop-blur sm:px-5">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#17202a] px-4 py-3 text-white shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black sm:text-2xl">{storeDisplayName}</p>
              <p className="text-xs font-bold text-white/55 sm:text-sm">POS 點餐 / 接單中心{effectiveRole ? " / " + effectiveRole : ""}</p>
            </div>
            {/* P0-5 接單開關 */}
            {store && (
              <button
                onClick={() => upsertStore({ ...store, isOpen: !store.isOpen, orderStatus: store.isOpen ? "closed" : "open" })}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black transition ${store.isOpen ? "bg-leaf/80 text-white hover:bg-leaf" : "bg-tomato/80 text-white hover:bg-tomato"}`}
              >
                {store.isOpen ? "●  營業中" : "○  休息中"}
              </button>
            )}
            {/* 提示音開關 */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? "提示音已啟用（點擊關閉）" : "點擊啟用新訂單提示音"}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black transition ${soundEnabled ? "bg-amber-500/80 text-white hover:bg-amber-500" : "bg-white/10 text-white/60 hover:bg-white/15"}`}
            >
              {soundEnabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            </button>
            <button onClick={() => setToolsOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 font-black text-white hover:bg-white/15">
              <MenuIcon className="size-5" />
              功能
            </button>
          </div>
        </header>

        <div className="flex-1 p-3 pb-24 sm:p-5 xl:pb-5">
          {orderSuccess && <div className="mb-4 rounded-xl border border-leaf/30 bg-leaf/10 p-4 font-black text-leaf">{orderSuccess}</div>}
          {orderError && <div className="mb-4 rounded-xl border border-tomato/30 bg-tomato/10 p-4 font-black text-tomato">{orderError}</div>}

          {/* 待接單提醒 */}
          {pendingOrderCount > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
              <Bell className="size-5 shrink-0 animate-bounce text-amber-600" />
              <p className="font-black text-amber-800">
                目前有 <span className="text-2xl text-tomato">{pendingOrderCount}</span> 筆待接單！請盡快處理。
              </p>
              <button onClick={() => setOrdersOpen(true)} className="ml-auto rounded-lg bg-amber-600 px-3 py-2 text-sm font-black text-white">
                查看
              </button>
            </div>
          )}

          <PosStatusBar
            activeOrderCount={processingOrderCount}
            checkoutMode={checkoutMode}
            orderCount={todayOrders.length}
            paused={!store.isOpen || store.orderStatus === "closed"}
            posEnabled={posEnabled}
            updateStore={(patch) => upsertStore({ ...store, ...patch })}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
            <QuickOrder activeCategoryId={activeCategoryId} categories={categories} checkoutMode={checkoutMode} customerNote={customerNote} mode={mode} posEnabled={posEnabled} products={visibleProducts} setActiveCategoryId={setActiveCategoryId} setChoosingProduct={setChoosingProduct} setCustomerNote={setCustomerNote} setMode={setMode} setTableNo={setTableNo} tableNo={tableNo} tables={tables} tableUnpaidCounts={tableUnpaidCounts} onViewUnpaidTable={() => setRightTab("unpaid")} />
            <aside className="hidden xl:sticky xl:top-24 xl:block xl:h-fit xl:space-y-2">
              {/* Right-column tab bar */}
              <div className="flex gap-1 rounded-2xl bg-stone-100 p-1">
                <button
                  onClick={() => setRightTab("cart")}
                  className={"flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-black transition " + (rightTab === "cart" ? "bg-white text-ink shadow" : "text-steel hover:text-ink")}
                >
                  <ShoppingCart className="size-3.5" />
                  購物車
                  {cartItemCount > 0 && <span className="inline-flex size-5 items-center justify-center rounded-full bg-tomato text-xs font-black text-white">{cartItemCount}</span>}
                </button>
                <button
                  onClick={() => setRightTab("orders")}
                  className={"flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-black transition " + (rightTab === "orders" ? "bg-white text-ink shadow" : "text-steel hover:text-ink")}
                >
                  <ReceiptText className="size-3.5" />
                  接單
                  {pendingOrderCount > 0 && <span className="inline-flex size-5 items-center justify-center rounded-full bg-tomato text-xs font-black text-white">{pendingOrderCount}</span>}
                </button>
                {checkoutMode === "postpaid" && (
                  <button
                    onClick={() => setRightTab("unpaid")}
                    className={"flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-black transition " + (rightTab === "unpaid" ? "bg-white text-ink shadow" : "text-steel hover:text-ink")}
                  >
                    <WalletCards className="size-3.5" />
                    待結帳
                    {unpaidOrderCount > 0 && <span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white">{unpaidOrderCount}</span>}
                  </button>
                )}
              </div>
              {rightTab === "cart" && <CartPanel canApplyDiscounts={canApplyDiscounts} cart={cart} checkoutMode={checkoutMode} customerNote={customerNote} setCustomerNote={setCustomerNote} itemsSubtotal={itemsSubtotal} itemDiscountTotal={itemDiscountTotal} orderDiscAmt={orderDiscAmt} promotionDiscounts={promotionCalculation.appliedPromotions} finalTotal={finalTotal} cashDue={cashDue} storedValueDeduction={storedValueDeduction} orderDiscount={orderDiscount} setOrderDiscount={setOrderDiscount} updateLine={updateLine} removeLine={(index) => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} submitOrder={submitOrder} isSubmitting={isSubmitting} posEnabled={posEnabled} memberEnabled={memberEnabled} memberStoredValueEnabled={memberStoredValueEnabled} canUseMemberLookup={canUseMemberLookup} canUseStoredValue={canUseStoredValue} boundMember={boundMember} storedValueUsed={storedValueUsed} onLookupMember={lookupMember} onClearMember={() => { setBoundMember(null); setStoredValueUsed(0); }} onStoredValueChange={setStoredValueUsed} onOpenCreateMember={() => setMemberModalOpen(true)} onOpenTopup={() => setTopupModalOpen(true)} />}
              {rightTab === "orders" && <OrderBoard activeOrderTab={activeOrderTab} canCancelOrders={canCancelOrders} displayedOrders={displayedOrders} enablePickupDisplay={enablePickupDisplay} nowTick={nowTick} onAcceptPrint={printSettings?.printOnAccept ? (order) => printOrder(order, storeDisplayName, printSettings) : undefined} pendingCount={pendingOrderCount} setActiveOrderTab={setActiveOrderTab} updateOrderStatus={updateOrderStatus} />}
              {rightTab === "unpaid" && checkoutMode === "postpaid" && <UnpaidOrderBoard canProcessCheckout={canProcessCheckout} nowTick={nowTick} unpaidOrders={unpaidOrders} updateOrderPayment={updateOrderPayment} updateOrderStatus={updateOrderStatus} onAddMore={(order) => { setTableNo(order.tableNo); setMode("dine-in"); setRightTab("cart"); }} />}
            </aside>
          </div>
        </div>

        {/* 手機版固定底列 */}
        <div className="fixed inset-x-0 bottom-0 z-40 xl:hidden">
          <div className="border-t border-stone-200 bg-white px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.10)]">
            <div className="flex gap-2">
              {pendingOrderCount > 0 && (
                <button
                  onClick={() => setOrdersOpen(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-tomato px-4 py-3 font-black text-white"
                >
                  <Bell className="size-5 animate-bounce" />
                  {pendingOrderCount}
                </button>
              )}
              {checkoutMode === "postpaid" && unpaidOrderCount > 0 && (
                <button
                  onClick={() => { setCartOpen(false); setOrdersOpen(true); }}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-3 font-black text-white"
                >
                  <WalletCards className="size-5" />
                  {unpaidOrderCount}
                </button>
              )}
              <button
                onClick={() => setCartOpen(true)}
                className="flex flex-1 items-center justify-between rounded-xl bg-[#17202a] px-4 py-3 font-black text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  購物車
                  {cartItemCount > 0 && <span className="rounded-full bg-tomato px-2 py-0.5 text-xs">{cartItemCount}</span>}
                </span>
                <span className="text-lg">${finalTotal}</span>
              </button>
            </div>
          </div>
        </div>

        {/* P1-3: 受控 slide-up sheet */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 xl:hidden" onClick={() => setCartOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-orange-100 bg-white px-5 py-4">
                <h2 className="text-xl font-black text-ink">購物車</h2>
                <button onClick={() => setCartOpen(false)} className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-black text-steel">關閉</button>
              </div>
              <div className="p-4">
                <CartPanel canApplyDiscounts={canApplyDiscounts} cart={cart} checkoutMode={checkoutMode} customerNote={customerNote} setCustomerNote={setCustomerNote} itemsSubtotal={itemsSubtotal} itemDiscountTotal={itemDiscountTotal} orderDiscAmt={orderDiscAmt} promotionDiscounts={promotionCalculation.appliedPromotions} finalTotal={finalTotal} cashDue={cashDue} storedValueDeduction={storedValueDeduction} orderDiscount={orderDiscount} setOrderDiscount={setOrderDiscount} updateLine={updateLine} removeLine={(index) => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} submitOrder={submitOrder} isSubmitting={isSubmitting} posEnabled={posEnabled} memberEnabled={memberEnabled} memberStoredValueEnabled={memberStoredValueEnabled} canUseMemberLookup={canUseMemberLookup} canUseStoredValue={canUseStoredValue} boundMember={boundMember} storedValueUsed={storedValueUsed} onLookupMember={lookupMember} onClearMember={() => { setBoundMember(null); setStoredValueUsed(0); }} onStoredValueChange={setStoredValueUsed} onOpenCreateMember={() => setMemberModalOpen(true)} onOpenTopup={() => setTopupModalOpen(true)} />
              </div>
            </div>
          </div>
        )}
      </div>
      {toolsOpen && <ToolsDrawer
        cashFlowEnabled={cashFlowFeature && (canAddCashFlow || canViewReport)}
        dineInEnabled={store.dineInOrderingEnabled ?? store.dineInEnabled ?? true}
        kdsEnabled={Boolean(store.features?.kdsEnabled)}
        onClose={() => setToolsOpen(false)}
        onOpenOrders={() => { setToolsOpen(false); setOrdersOpen(true); }}
        onToggleDineIn={() => upsertStore({ ...store, dineInOrderingEnabled: !(store.dineInOrderingEnabled ?? store.dineInEnabled ?? true) })}
        onToggleTakeout={() => upsertStore({ ...store, takeoutOrderingEnabled: !(store.takeoutOrderingEnabled ?? store.takeoutEnabled ?? true) })}
        storeId={storeId}
        takeoutEnabled={store.takeoutOrderingEnabled ?? store.takeoutEnabled ?? true}
      />}
      {ordersOpen && (
        <SideDrawer title="接單進單" onClose={() => setOrdersOpen(false)}>
          <OrderBoard activeOrderTab={activeOrderTab} canCancelOrders={canCancelOrders} displayedOrders={displayedOrders} enablePickupDisplay={enablePickupDisplay} nowTick={nowTick} onAcceptPrint={printSettings?.printOnAccept ? (order) => printOrder(order, storeDisplayName, printSettings) : undefined} pendingCount={pendingOrderCount} setActiveOrderTab={setActiveOrderTab} updateOrderStatus={updateOrderStatus} />
        </SideDrawer>
      )}
      {/* 新訂單 Toast 通知堆疊 */}
      {newOrderToasts.length > 0 && (
        <div className="fixed right-4 top-20 z-[55] flex flex-col gap-2">
          {newOrderToasts.map((toast) => (
            <div
              key={toast.key}
              onClick={() => setNewOrderToasts((prev) => prev.filter((t) => t.key !== toast.key))}
              className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#17202a] px-5 py-4 text-white shadow-2xl"
            >
              <Bell className="size-5 shrink-0 text-amber-400" />
              <span className="font-black">{toast.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* P1-4: 大型送單成功 Toast */}
      {successOrderNumber && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => setSuccessOrderNumber("")}
        >
          <div className="mx-4 rounded-3xl bg-leaf px-10 py-10 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto size-16 text-white" />
            <p className="mt-4 text-6xl font-black tracking-tight text-white">#{successOrderNumber}</p>
            <p className="mt-3 text-xl font-black text-white/80">訂單已送出</p>
            <p className="mt-4 text-sm font-bold text-white/50">點擊任意處關閉</p>
          </div>
        </div>
      )}
      {choosingProduct && <ProductOptionModal product={choosingProduct} sharedGroups={db.sharedOptionGroups} onClose={() => setChoosingProduct(null)} onConfirm={confirmProductOptions} />}
      {memberModalOpen && <MemberModal onClose={() => setMemberModalOpen(false)} onSubmit={createMember} />}
      {topupModalOpen && boundMember && <TopupModal member={boundMember} onClose={() => setTopupModalOpen(false)} onSubmit={topupMember} />}
    </main>
  );
}

function PosSideRail({ cashFlowEnabled, kdsEnabled, onOpenOrders, storeId }: { cashFlowEnabled: boolean; kdsEnabled: boolean; onOpenOrders: () => void; storeId: string }) {
  return (
    <aside className="hidden rounded-2xl bg-white p-3 shadow-sm xl:block">
      <div className="space-y-2">
        <button onClick={onOpenOrders} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-black text-slate-700 transition hover:bg-slate-100">
          <ReceiptText className="size-5 text-slate-500" />
          接單進單
        </button>
        <Link href="/merchant/customers" className="flex items-center gap-3 rounded-xl px-3 py-3 font-black text-slate-700 transition hover:bg-slate-100">
          <UserPlus className="size-5 text-slate-500" />
          會員
        </Link>
        {cashFlowEnabled && (
          <Link href="/merchant/cashflow" className="flex items-center gap-3 rounded-xl px-3 py-3 font-black text-slate-700 transition hover:bg-slate-100">
            <WalletCards className="size-5 text-slate-500" />
            現金流
          </Link>
        )}
        {kdsEnabled && (
          <Link href={"/kitchen/" + storeId} className="flex items-center gap-3 rounded-xl px-3 py-3 font-black text-slate-700 transition hover:bg-slate-100">
            <ChefHat className="size-5 text-slate-500" />
            廚房 KDS
          </Link>
        )}
        <Link href="/merchant/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 font-black text-slate-700 transition hover:bg-slate-100">
          <ArrowLeft className="size-5 text-slate-500" />
          返回設定中心
        </Link>
      </div>
    </aside>
  );
}

function PosStatusBar({
  activeOrderCount,
  checkoutMode,
  orderCount,
  paused,
  posEnabled,
  updateStore,
}: {
  activeOrderCount: number;
  checkoutMode: "prepaid" | "postpaid";
  orderCount: number;
  paused: boolean;
  posEnabled: boolean;
  updateStore: (patch: Partial<import("@/lib/types").Store>) => void;
}) {
  return (
    <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        type="button"
        onClick={() => updateStore({ isOpen: paused, orderStatus: paused ? "open" : "closed" })}
        className={`min-h-12 rounded-2xl px-4 py-3 text-left text-sm font-black shadow-sm transition ${paused ? "bg-tomato text-white" : "bg-white text-slate-800"}`}
      >
        <span className="block text-xs opacity-70">接單狀態</span>
        {paused ? "暫停接單" : "正常接單"}
      </button>
      <div className="min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">
        <span className="block text-xs text-slate-400">今日訂單數</span>
        {orderCount}
      </div>
      <div className="min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">
        <span className="block text-xs text-slate-400">製作中</span>
        {posEnabled ? activeOrderCount : "POS 關閉"}
      </div>
      <div className="min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">
        <span className="block text-xs text-slate-400">結帳模式</span>
        {checkoutMode === "postpaid" ? "後結帳" : "先結帳"}
      </div>
    </section>
  );
}

function ToolsDrawer({ cashFlowEnabled, dineInEnabled, kdsEnabled, onClose, onOpenOrders, onToggleDineIn, onToggleTakeout, storeId, takeoutEnabled }: { cashFlowEnabled: boolean; dineInEnabled: boolean; kdsEnabled: boolean; onClose: () => void; onOpenOrders: () => void; onToggleDineIn: () => void; onToggleTakeout: () => void; storeId: string; takeoutEnabled: boolean }) {
  return (
    <SideDrawer title="POS 功能" onClose={onClose}>
      <div className="grid gap-2">
        <button onClick={onOpenOrders} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4 text-left font-black text-slate-800">
          <ReceiptText className="size-5 text-slate-500" />
          接單進單
        </button>
        {/* QR 開關 */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-black text-slate-400">QR 點餐開關</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onToggleTakeout}
              className={"flex items-center justify-between rounded-lg px-3 py-2.5 font-black transition " + (takeoutEnabled ? "bg-leaf/10 text-leaf" : "bg-tomato/10 text-tomato")}
            >
              <span>外帶 QR</span>
              <span className="text-sm">{takeoutEnabled ? "開放中" : "已關閉"}</span>
            </button>
            <button
              onClick={onToggleDineIn}
              className={"flex items-center justify-between rounded-lg px-3 py-2.5 font-black transition " + (dineInEnabled ? "bg-leaf/10 text-leaf" : "bg-tomato/10 text-tomato")}
            >
              <span>內用 QR</span>
              <span className="text-sm">{dineInEnabled ? "開放中" : "已關閉"}</span>
            </button>
          </div>
        </div>
        <Link href="/merchant/customers" className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4 font-black text-slate-800">
          <UserPlus className="size-5 text-slate-500" />
          會員
        </Link>
        {cashFlowEnabled && (
          <Link href="/merchant/cashflow" className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4 font-black text-slate-800">
            <WalletCards className="size-5 text-slate-500" />
            現金流
          </Link>
        )}
        {kdsEnabled && (
          <Link href={"/kitchen/" + storeId} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4 font-black text-slate-800">
            <ChefHat className="size-5 text-slate-500" />
            廚房 KDS
          </Link>
        )}
        <Link href="/merchant/dashboard" className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4 font-black text-slate-800">
          <ArrowLeft className="size-5 text-slate-500" />
          返回設定中心
        </Link>
      </div>
    </SideDrawer>
  );
}

function SideDrawer({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40">
      <button aria-label="關閉" className="absolute inset-0 size-full cursor-default" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-600">關閉</button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

function OrderBoard({ activeOrderTab, canCancelOrders, displayedOrders, enablePickupDisplay, nowTick, onAcceptPrint, pendingCount, setActiveOrderTab, updateOrderStatus }: { activeOrderTab: string; canCancelOrders: boolean; displayedOrders: Order[]; enablePickupDisplay: boolean; nowTick: number; onAcceptPrint?: (order: Order) => void; pendingCount: number; setActiveOrderTab: (key: (typeof orderTabs)[number]["key"]) => void; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">接單進單</h2>
        </div>
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tomato px-3 py-1.5 text-sm font-black text-white">
            <Bell className="size-4 animate-bounce" />
            {pendingCount} 待接
          </span>
        ) : <Clock3 className="size-6 text-steel" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {orderTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveOrderTab(tab.key)}
            className={"relative rounded-lg px-3 py-2.5 text-sm font-black " + (activeOrderTab === tab.key ? "bg-ink text-white" : "bg-stone-100 text-steel")}
          >
            {tab.label}
            {tab.key === "new" && pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-tomato text-xs font-black text-white">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {displayedOrders.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-5 text-center font-black text-steel">目前沒有訂單</p>
        ) : (
          displayedOrders.map((order) => (
            <OrderWorkCard key={order.id} canCancelOrders={canCancelOrders} enablePickupDisplay={enablePickupDisplay} nowTick={nowTick} onAcceptPrint={onAcceptPrint} order={order} updateOrderStatus={updateOrderStatus} />
          ))
        )}
      </div>
    </section>
  );
}
function UnpaidOrderBoard({ canProcessCheckout, nowTick, onAddMore, unpaidOrders, updateOrderPayment, updateOrderStatus }: { canProcessCheckout: boolean; nowTick: number; onAddMore: (order: Order) => void; unpaidOrders: Order[]; updateOrderPayment: (orderId: string, paymentStatus: "paid" | "unpaid", paymentMethod?: import("@/lib/types").PaymentMethod) => void; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  type CheckoutTarget = { orderId: string; total: number; orderNumber: string };
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  function pay(method: import("@/lib/types").PaymentMethod) {
    if (!checkoutTarget) return;
    updateOrderPayment(checkoutTarget.orderId, "paid", method);
    setCheckoutTarget(null);
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">待結帳訂單</h2>
        {unpaidOrders.length > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-700">{unpaidOrders.length} 筆</span>
        )}
      </div>
      {!canProcessCheckout && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">僅老闆或店長可執行結帳操作</p>
      )}
      <div className="mt-3 space-y-3">
        {unpaidOrders.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-5 text-center font-black text-steel">目前沒有待結帳訂單</p>
        ) : (
          unpaidOrders.map((order) => {
            const isTakeout = order.mode === "takeout";
            const tableLabel = order.tableName ?? order.tableNo ?? "";
            const waitMs = nowTick - new Date(order.createdAt).getTime();
            const waitMin = Math.max(0, Math.floor(waitMs / 60_000));
            const isCancelConfirm = cancelConfirmId === order.id;
            return (
              <article key={order.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-black">#{order.orderNumber}</p>
                      {isTakeout
                        ? <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-700">外帶</span>
                        : <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">{tableLabel ? tableLabel + " 桌" : "內用"}</span>
                      }
                    </div>
                    <p className="mt-1 text-xs font-bold text-steel">
                      {new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                      {waitMin > 0 && ` · ${waitMin} 分`}
                    </p>
                  </div>
                  <p className="text-lg font-black text-ink">$ {order.totalAmount ?? order.total}</p>
                </div>
                {order.customerNote && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-steel">備註：{order.customerNote}</p>}
                <div className="mt-2 space-y-1 text-sm font-bold text-steel">
                  {order.items.map((item) => (
                    <p key={item.id}>{item.quantity} × {item.productName}</p>
                  ))}
                </div>
                {/* Action buttons */}
                {isCancelConfirm ? (
                  <div className="mt-3 rounded-xl bg-tomato/10 p-3">
                    <p className="mb-2 text-sm font-black text-tomato">確定要作廢這筆訂單？</p>
                    <div className="flex gap-2">
                      <button onClick={() => { updateOrderStatus(order.id, "cancelled"); setCancelConfirmId(null); }} className="flex-1 rounded-xl bg-tomato px-3 py-2.5 font-black text-white">確定作廢</button>
                      <button onClick={() => setCancelConfirmId(null)} className="rounded-xl bg-stone-200 px-3 py-2.5 font-black text-steel">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={!canProcessCheckout}
                      onClick={() => setCheckoutTarget({ orderId: order.id, total: order.totalAmount ?? order.total, orderNumber: order.orderNumber })}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-black text-white disabled:opacity-40"
                    >
                      <WalletCards className="size-4" />
                      結帳
                    </button>
                    <button
                      onClick={() => onAddMore(order)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-3 font-black text-white"
                    >
                      <Plus className="size-4" />
                      加點
                    </button>
                    <button
                      disabled={!canProcessCheckout}
                      onClick={() => setCancelConfirmId(order.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-200 px-3 py-3 font-black text-steel disabled:opacity-40"
                    >
                      <XCircle className="size-4" />
                      作廢
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Payment method modal */}
      {checkoutTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setCheckoutTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-ink">選擇付款方式</h3>
            <p className="mt-1 text-sm font-bold text-steel">訂單 #{checkoutTarget.orderNumber} · 總計 ${checkoutTarget.total}</p>
            <div className="mt-5 grid gap-3">
              <button onClick={() => pay("cash")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-4 font-black text-white">
                <WalletCards className="size-5" />
                現金結帳
              </button>
              <button onClick={() => pay("card")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-4 font-black text-white">
                <WalletCards className="size-5" />
                刷卡結帳
              </button>
            </div>
            <button onClick={() => setCheckoutTarget(null)} className="mt-4 w-full rounded-xl bg-stone-100 py-3 font-black text-steel">取消</button>
          </div>
        </div>
      )}
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
      setError("姓名與手機為必填");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: form.name.trim(), phone: form.phone.trim(), birthday: form.birthday || undefined, note: form.note || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "會員建立失敗");
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
        <p className="mt-2 text-sm font-bold text-steel">{member.name} 目前餘額 ${member.balance ?? member.storedValueBalance}</p>
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

function QuickOrder({ activeCategoryId, categories, checkoutMode, customerNote, mode, posEnabled, products, setActiveCategoryId, setChoosingProduct, setCustomerNote, setMode, setTableNo, tableNo, tables, tableUnpaidCounts, onViewUnpaidTable }: { activeCategoryId: string; categories: { id: string; name: string }[]; checkoutMode: "prepaid" | "postpaid"; customerNote: string; mode: OrderMode; posEnabled: boolean; products: Product[]; setActiveCategoryId: (id: string) => void; setChoosingProduct: (product: Product) => void; setCustomerNote: (value: string) => void; setMode: (mode: OrderMode) => void; setTableNo: (value: string) => void; tableNo: string; tables: Table[]; tableUnpaidCounts: Map<string, number>; onViewUnpaidTable: (tableNo: string) => void }) {
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const isPostpaid = checkoutMode === "postpaid";

  function handleModeChange(next: OrderMode) {
    setMode(next);
    if (next === "takeout") setTablePickerOpen(false);
  }

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      {/* Compact 1-line strip: mode + table + note */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-3 py-2">
        <div className="flex rounded-lg bg-stone-100 p-0.5">
          <button onClick={() => handleModeChange("takeout")} className={"rounded-md px-3 py-1.5 text-sm font-black transition " + (mode === "takeout" ? "bg-white text-ink shadow-sm" : "text-steel")}>外帶</button>
          <button onClick={() => handleModeChange("dine-in")} className={"rounded-md px-3 py-1.5 text-sm font-black transition " + (mode === "dine-in" ? "bg-white text-ink shadow-sm" : "text-steel")}>內用</button>
        </div>
        {mode === "dine-in" && !isPostpaid && (
          <input value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="桌號" className="w-16 rounded-lg border border-stone-200 px-2 py-1.5 text-sm font-bold" />
        )}
        {mode === "dine-in" && isPostpaid && (
          <button
            onClick={() => setTablePickerOpen((v) => !v)}
            className={"flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-black transition " + (tableNo ? "border-blue-200 bg-blue-50 text-blue-700" : "border-stone-200 text-steel hover:border-stone-400")}
          >
            <Table2 className="size-3.5" />
            {tableNo ? `${tableNo} 桌` : "選擇桌號"}
            <span className="text-xs opacity-60">{tablePickerOpen ? "▲" : "▾"}</span>
          </button>
        )}
        <input value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder="訂單備註（選填）" className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-sm font-bold" />
        {!posEnabled && <span className="shrink-0 text-xs font-black text-tomato">POS 暫停</span>}
      </div>
      {/* Table picker — postpaid dine-in only */}
      {mode === "dine-in" && isPostpaid && tablePickerOpen && (
        <div className="border-b border-stone-100 p-3">
          {tables.length === 0 ? (
            <p className="py-3 text-center text-sm font-bold text-steel">尚未設定桌位，請至設定中心新增桌位</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-4 2xl:grid-cols-5">
              {tables.map((table) => {
                const key = table.tableName;
                const unpaidCount = tableUnpaidCounts.get(key) ?? 0;
                const isOccupied = unpaidCount > 0;
                const isSelected = tableNo === key;
                return (
                  <button
                    key={table.id}
                    onClick={() => {
                      if (isOccupied) {
                        setTableNo(key);
                        setTablePickerOpen(false);
                        onViewUnpaidTable(key);
                      } else {
                        setTableNo(key);
                        setTablePickerOpen(false);
                      }
                    }}
                    className={
                      "rounded-xl border-2 px-2 py-3 text-center text-sm font-black transition " +
                      (isSelected
                        ? "border-blue-500 bg-blue-100 text-blue-700"
                        : isOccupied
                        ? "border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400"
                        : "border-stone-200 bg-white text-ink hover:border-leaf hover:bg-[#fbfff4]")
                    }
                  >
                    <p className="truncate">{table.tableName}</p>
                    <p className={"mt-0.5 text-xs font-bold " + (isOccupied ? "text-orange-500" : "text-steel")}>
                      {isOccupied ? `${unpaidCount} 筆待結帳` : "空桌"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Category tabs */}
      <div className="sticky top-[68px] z-10 flex gap-2 overflow-x-auto bg-white/95 px-3 pb-2 pt-2 backdrop-blur">
        <button onClick={() => setActiveCategoryId("all")} className={"shrink-0 rounded-full px-4 py-1.5 text-sm font-black " + (activeCategoryId === "all" ? "bg-leaf text-white" : "bg-orange-50 text-steel")}>全部</button>
        {categories.map((category) => (
          <button key={category.id} onClick={() => setActiveCategoryId(category.id)} className={"shrink-0 rounded-full px-4 py-1.5 text-sm font-black " + (activeCategoryId === category.id ? "bg-leaf text-white" : "bg-orange-50 text-steel")}>{category.name}</button>
        ))}
      </div>
      {/* Product grid */}
      <div className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:max-h-[calc(100vh-200px)] xl:overflow-y-auto xl:pr-1 2xl:grid-cols-4">
          {products.map((product) => (
            <button key={product.id} disabled={!posEnabled} onClick={() => setChoosingProduct(product)} className="rounded-2xl border border-stone-200 bg-white p-3 text-left transition hover:border-leaf hover:bg-[#fbfff4] disabled:opacity-50">
              <div className="flex items-start gap-3">
                <img src={product.imageUrl} alt={product.name} className="size-16 rounded-xl object-cover sm:size-20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black sm:text-lg">{product.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-bold text-steel">{product.description}</p>
                  <p className="mt-2 text-xl font-black text-tomato">${productFinalPrice(product)}</p>
                  {productFinalPrice(product) !== product.price && <p className="text-xs font-bold text-stone-400 line-through">${product.price}</p>}
                  {discountLabel(product.discountType, product.discountValue) && <p className="mt-1 text-xs font-black text-tomato">{discountLabel(product.discountType, product.discountValue)}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 4) + "***" + phone.slice(-3);
}

function generateReceiptHtml(order: Order, storeName: string, settings: import("@/lib/types").PrintSettings): string {
  const isTakeout = order.mode === "takeout";
  const tableLabel = order.tableName ?? order.tableNo ?? "";
  const customerName = settings.showCustomerName ? (order.customerName || order.memberName || "") : "";
  const customerPhone = settings.showCustomerPhone ? maskPhone(order.customerPhone || order.memberPhone || "") : "";
  const createdAt = new Date(order.createdAt).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const total = order.totalAmount ?? order.total;
  const fontSizeMap: Record<string, string> = { small: "11px", medium: "13px", large: "15px" };
  const tableNoFontMap: Record<string, string> = { medium: "24px", large: "32px", extraLarge: "48px" };
  const isCompact = settings.layout === "compact";

  const itemsHtml = order.items.map((item) => {
    const opts = item.selectedOptions?.map((o) => `<p style="margin-left:6px;font-size:0.88em;color:#555">${(o as {groupName?:string;choiceName?:string}).groupName ?? ""}：${(o as {choiceName?:string}).choiceName ?? ""}</p>`).join("") ?? "";
    const note = (item.itemNote ?? item.note ?? "").trim();
    return `<div style="margin:${isCompact ? "2px 0" : "5px 0"}">
      <div style="font-weight:bold">${item.quantity} × ${item.productName}${settings.showPrice ? `  $${item.unitPrice}` : ""}</div>
      ${opts}
      ${note ? `<p style="margin-left:6px;font-size:0.88em;color:#b45">[備註：${note}]</p>` : ""}
    </div>`;
  }).join("");

  const copies = [
    ...Array(Math.max(0, settings.kitchenCopies)).fill("廚房單"),
    ...Array(Math.max(0, settings.receiptCopies)).fill("收據"),
  ];

  const receiptBody = `
    <p style="text-align:center;font-weight:bold;font-size:1.05em">${storeName}</p>
    <p style="text-align:center;font-size:2.2em;font-weight:900;margin:4px 0">#${order.orderNumber}</p>
    ${settings.emphasizeOrderType ? `<p style="text-align:center;font-weight:bold;font-size:1.1em;padding:2px 8px;display:inline-block;border:2px solid #000;border-radius:4px">${isTakeout ? "外帶" : "內用"}</p>` : ""}
    <p style="text-align:center;font-size:${tableNoFontMap[settings.tableNoFontSize]};font-weight:900;margin:4px 0">${isTakeout ? `取餐 ${order.pickupNumber ?? order.orderNumber}` : `桌 ${tableLabel}`}</p>
    ${customerName ? `<p>客戶：${customerName}</p>` : ""}
    ${customerPhone ? `<p>電話：${customerPhone}</p>` : ""}
    <p>-------------------------------</p>
    ${itemsHtml}
    <p>-------------------------------</p>
    <p style="font-size:1.2em;font-weight:bold;text-align:right">合計 $${total}</p>
    ${order.customerNote ? `<p style="margin-top:4px">備註：${order.customerNote}</p>` : ""}
    <p style="font-size:0.85em;color:#666;margin-top:6px">${createdAt}</p>
  `;

  const copiesHtml = copies.length === 0
    ? `<div style="padding:10mm;font-weight:bold">（張數設定為 0，無列印內容）</div>`
    : copies.map((copyType, i) => `
      <div${i < copies.length - 1 ? ' style="page-break-after:always"' : ""}>
        <p style="font-size:0.75em;text-align:right;color:#999">${copyType}</p>
        ${receiptBody}
      </div>
    `).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>#${order.orderNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace,"Noto Sans TC",sans-serif;font-size:${fontSizeMap[settings.fontSize]};padding:4mm}@media print{body{padding:0}}</style>
</head><body>${copiesHtml}</body></html>`;
}

function printOrder(order: Order, storeName: string, settings: import("@/lib/types").PrintSettings) {
  const html = generateReceiptHtml(order, storeName, settings);
  const w = window.open("", "_blank", "width=420,height=600,scrollbars=yes");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
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
  return <div className="rounded-lg bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-black text-steel">{label}</p><Icon className="size-5 text-steel" /></div><p className={"mt-3 text-4xl font-black " + tone}>{value}</p></div>;
}

function PanelButton({ active, disabled, icon: Icon, label, onClick }: { active: boolean; disabled?: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className={"inline-flex items-center justify-center gap-2 rounded-lg px-5 py-4 font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50 " + (active ? "bg-ink text-white" : "bg-white text-ink")}><Icon className="size-5" />{label}</button>;
}

function QuickLinkButton({ disabled, href, icon: Icon, label }: { disabled?: boolean; href: string; icon: React.ElementType; label: string }) {
  if (disabled) return <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-white px-5 py-4 font-black text-ink opacity-50 shadow-sm"><Icon className="size-5" />{label}</span>;
  return <Link href={href} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-4 font-black text-ink shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"><Icon className="size-5" />{label}</Link>;
}

function PermissionNotice({ text }: { text: string }) {
  return <div className="rounded-lg bg-white p-8 text-center text-xl font-black text-steel shadow-sm">{text}</div>;
}

function CenteredNotice({ title, text }: { title: string; text: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4"><div className="rounded-lg bg-white p-6 shadow-soft"><h1 className="text-2xl font-black text-ink">{title}</h1>{text && <p className="mt-3 text-steel">{text}</p>}</div></main>;
}

function OrderWorkCard({ canCancelOrders, enablePickupDisplay, nowTick, onAcceptPrint, order, updateOrderStatus }: { canCancelOrders: boolean; enablePickupDisplay: boolean; nowTick: number; onAcceptPrint?: (order: Order) => void; order: Order; updateOrderStatus: (orderId: string, status: OrderStatus) => void }) {
  const cancelReason = order.cancelReason ?? order.rejectReason;
  const isPending = ["pending", "waiting", "unprocessed"].includes(order.status);
  const isPosDirectComplete = order.source === "pos" && !enablePickupDisplay;
  const isTakeout = order.mode === "takeout";
  const tableLabel = order.tableName ?? order.tableNo ?? "";
  const customerDisplayName = order.customerName || order.memberName || "";
  const customerDisplayPhone = order.customerPhone || order.memberPhone || "";

  const waitMs = nowTick - new Date(order.createdAt).getTime();
  const waitMin = Math.max(0, Math.floor(waitMs / 60_000));
  const isOverdue = isPending && waitMin >= 10;

  return (
    <article className={
      "rounded-xl border p-4 " +
      (isOverdue
        ? "animate-pulse border-tomato bg-tomato/5 ring-2 ring-tomato ring-offset-1"
        : isPending
        ? "animate-order-pop border-tomato bg-tomato/5"
        : "border-stone-200 bg-white")
    }>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-2xl font-black">#{order.orderNumber}</p>
            {isTakeout
              ? <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-700">外帶</span>
              : <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">{tableLabel ? tableLabel + " 桌" : "內用"}</span>
            }
            {isOverdue && <span className="rounded-full bg-tomato px-2.5 py-1 text-xs font-black text-white">等待過久</span>}
          </div>
          <p className="mt-1 text-xs font-bold text-steel">
            {new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
            {isPending && waitMin > 0 && <span className={" · 等待 " + waitMin + " 分" + (isOverdue ? " ⚠️" : "")}></span>}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>
      {cancelReason && order.status === "cancelled" && <p className="mt-3 rounded-lg bg-tomato/10 px-3 py-2 text-sm font-black text-tomato">取消原因：{cancelReason}</p>}
      {(customerDisplayName || customerDisplayPhone) && (
        <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm font-bold text-steel">
          {customerDisplayName && <p>客戶：{customerDisplayName}</p>}
          {customerDisplayPhone && <p>電話：{maskPhone(customerDisplayPhone)}</p>}
        </div>
      )}
      {order.customerNote && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">備註：{order.customerNote}</p>}
      <div className="mt-3 space-y-2 text-sm font-bold text-steel">{order.items.map((item) => <OrderItemLine key={item.id} item={item} />)}</div>
      <p className="mt-3 text-lg font-black text-tomato">$ {order.totalAmount ?? order.total}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isPending && (
          <button onClick={() => { updateOrderStatus(order.id, "accepted"); onAcceptPrint?.(order); }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-3 font-black text-white">
            <CheckCircle2 className="size-5" />
            接單
          </button>
        )}
        {["accepted", "cooking", "preparing", "ready"].includes(order.status) && (
          <button onClick={() => updateOrderStatus(order.id, "completed")} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-3 font-black text-white">
            <CheckCircle2 className="size-5" />
            {isPosDirectComplete ? "完成訂單" : "餐點完成"}
          </button>
        )}
        {canCancelOrders && !["completed", "cancelled"].includes(order.status) && (
          <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-4 py-3 font-black text-steel">
            <XCircle className="size-5" />
            取消
          </button>
        )}
      </div>
    </article>
  );
}

function OrderItemLine({ item }: { item: OrderItem }) {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions);
  const itemNote = (item.itemNote ?? item.note ?? "").trim();
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <p>{item.quantity} x {item.productName}</p>
      {selectedOptions.length > 0 && (
        <div className="ml-3 mt-1 space-y-1 text-xs">
          {selectedOptions.map((option) => (
            <p key={option.groupId + "-" + option.choiceId} style={{ marginLeft: ((option.level ?? 0) * 12) + "px" }}>
              - {option.groupName}：{option.choiceName}{option.priceDelta ? " +" + option.priceDelta : ""}
            </p>
          ))}
        </div>
      )}
      {itemNote && <p className="ml-3 mt-1 rounded bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">備註：{itemNote}</p>}
    </div>
  );
}

function CartPanel({ canApplyDiscounts, cart, checkoutMode, customerNote, setCustomerNote, itemsSubtotal, itemDiscountTotal, orderDiscAmt, promotionDiscounts, finalTotal, cashDue, storedValueDeduction, orderDiscount, setOrderDiscount, removeLine, submitOrder, updateLine, isSubmitting, posEnabled, memberEnabled, memberStoredValueEnabled, canUseMemberLookup, canUseStoredValue, boundMember, storedValueUsed, onLookupMember, onClearMember, onStoredValueChange, onOpenCreateMember, onOpenTopup }: { canApplyDiscounts: boolean; cart: CartLine[]; checkoutMode: "prepaid" | "postpaid"; customerNote: string; setCustomerNote: (v: string) => void; itemsSubtotal: number; itemDiscountTotal: number; orderDiscAmt: number; promotionDiscounts: import("@/lib/types").PromotionDiscountLine[]; finalTotal: number; cashDue: number; storedValueDeduction: number; orderDiscount: CartItemDiscount; setOrderDiscount: (d: CartItemDiscount) => void; removeLine: (index: number) => void; submitOrder: () => void; updateLine: (index: number, patch: Partial<CartLine>) => void; isSubmitting: boolean; posEnabled: boolean; memberEnabled: boolean; memberStoredValueEnabled: boolean; canUseMemberLookup: boolean; canUseStoredValue: boolean; boundMember: Customer | null; storedValueUsed: number; onLookupMember: (q: string) => Customer | null | undefined; onClearMember: () => void; onStoredValueChange: (amount: number) => void; onOpenCreateMember: () => void; onOpenTopup: () => void }) {
  const [showOrderDiscForm, setShowOrderDiscForm] = useState(false);
  const [orderDiscType, setOrderDiscType] = useState<"amount" | "percent">("amount");
  const [orderDiscValue, setOrderDiscValue] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberNotFound, setMemberNotFound] = useState(false);
  const [memberSectionOpen, setMemberSectionOpen] = useState(false);

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
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-xl font-black text-ink">購物車</h2>
      {!posEnabled && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">POS 現場單目前暫停接單</p>}

      {/* 1. Cart items */}
      {cart.length === 0
        ? <p className="mt-3 rounded-lg bg-orange-50 p-4 text-center text-sm font-black text-steel">尚未加入商品</p>
        : <div className="mt-3 space-y-3">{cart.map((line, index) => <CartLineCard key={line.product.id + "-" + index} canApplyDiscounts={canApplyDiscounts} index={index} line={line} removeLine={removeLine} updateLine={updateLine} />)}</div>}

      {/* Discount toggle */}
      {canApplyDiscounts && orderDiscount ? (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-sm font-black text-amber-700">整單折扣：{orderDiscount.type === "amount" ? "-$" + orderDiscount.value : orderDiscount.value + "%"}，折抵 -${orderDiscAmt}</p>
          <button onClick={() => setOrderDiscount(null)} className="rounded-lg bg-stone-200 px-2 py-1 text-xs font-black text-steel">清除</button>
        </div>
      ) : canApplyDiscounts && showOrderDiscForm ? (
        <div className="mt-3 space-y-3 rounded-lg bg-stone-50 p-3">
          <p className="text-sm font-black text-steel">整單折扣</p>
          <div className="flex gap-2">
            <button onClick={() => setOrderDiscType("amount")} className={"flex-1 rounded-lg px-3 py-2 text-sm font-black " + (orderDiscType === "amount" ? "bg-ink text-white" : "bg-stone-200 text-steel")}>折扣金額</button>
            <button onClick={() => setOrderDiscType("percent")} className={"flex-1 rounded-lg px-3 py-2 text-sm font-black " + (orderDiscType === "percent" ? "bg-ink text-white" : "bg-stone-200 text-steel")}>折扣百分比</button>
          </div>
          <div className="flex gap-2">
            <input value={orderDiscValue} onChange={(e) => setOrderDiscValue(e.target.value)} type="number" min="0" max={orderDiscType === "percent" ? "100" : undefined} placeholder={orderDiscType === "amount" ? "折扣金額" : "折扣 % (1-100)"} className="flex-1 rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold" />
            <button onClick={applyOrderDiscount} className="rounded-lg bg-leaf px-3 py-2 text-sm font-black text-white">套用</button>
            <button onClick={() => { setShowOrderDiscForm(false); setOrderDiscValue(""); }} className="rounded-lg bg-stone-200 px-3 py-2 text-sm font-black text-steel">取消</button>
          </div>
        </div>
      ) : canApplyDiscounts ? (
        <button onClick={() => setShowOrderDiscForm(true)} disabled={cart.length === 0} className="mt-3 w-full rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm font-black text-steel hover:border-stone-400 disabled:opacity-40">
          + 整單折扣
        </button>
      ) : null}

      {/* 2. Total */}
      <div className="mt-4 rounded-lg bg-orange-50 p-4">
        {hasDiscount ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold text-steel"><span>小計</span><span>${itemsSubtotal}</span></div>
            {itemDiscountTotal > 0 && <div className="flex justify-between text-sm font-bold text-tomato"><span>單品折扣</span><span>-${itemDiscountTotal}</span></div>}
            {orderDiscAmt > 0 && <div className="flex justify-between text-sm font-bold text-tomato"><span>整單折扣</span><span>-${orderDiscAmt}</span></div>}
            {promotionDiscounts.map((p) => (
              <div key={p.promotionId} className="flex justify-between text-sm font-bold text-leaf"><span>促銷：{p.promotionName}</span><span>-${p.amount}</span></div>
            ))}
            <div className="flex justify-between border-t border-orange-200 pt-2 text-xl font-black text-ink"><span>訂單總額</span><span>${finalTotal}</span></div>
            {storedValueDeduction > 0 && <div className="flex justify-between text-sm font-bold text-blue-600"><span>儲值折抵</span><span>-${storedValueDeduction}</span></div>}
            {storedValueDeduction > 0 && <div className="flex justify-between text-lg font-black text-ink"><span>應收現金</span><span>${cashDue}</span></div>}
          </div>
        ) : (
          <p className="text-xl font-black text-ink">總計：${finalTotal}</p>
        )}
      </div>

      {/* 3. Submit */}
      <button onClick={submitOrder} disabled={cart.length === 0 || isSubmitting || !posEnabled} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-4 font-black text-white disabled:opacity-60">
        <Send className="size-5" />
        {isSubmitting ? "送出中..." : checkoutMode === "postpaid" ? "建立訂單" : "送出並結帳"}
      </button>

      {/* 4. Member section — collapsed by default */}
      {memberEnabled && canUseMemberLookup && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <button
            onClick={() => setMemberSectionOpen((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-black text-steel"
          >
            <span>{boundMember ? `會員：${boundMember.name}` : "綁定會員（選填）"}</span>
            <span className="text-xs">{memberSectionOpen ? "▲" : "▼"}</span>
          </button>

          {memberSectionOpen && (
            <div className="mt-3">
              {boundMember ? (
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-blue-800">已綁定會員</p>
                      <p className="font-black text-ink">{boundMember.name} <span className="text-sm font-bold text-steel">({boundMember.memberNo})</span></p>
                      <p className="text-sm font-bold text-steel">點數：{boundMember.points} 點{memberStoredValueEnabled ? " · 儲值 $" + boundMember.storedValueBalance : ""}</p>
                    </div>
                    <button onClick={onClearMember} className="rounded-lg bg-stone-200 px-2 py-1 text-xs font-black text-steel">清除</button>
                  </div>
                  {memberStoredValueEnabled && canUseStoredValue && boundMember.storedValueBalance > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs font-black text-blue-700">使用儲值金 $</label>
                      <input
                        type="number" min="0" max={boundMember.storedValueBalance}
                        value={storedValueUsed || ""}
                        onChange={(e) => onStoredValueChange(Math.min(Number(e.target.value) || 0, boundMember.storedValueBalance))}
                        placeholder="0"
                        className="w-24 rounded-lg border border-blue-200 px-2 py-1 text-sm font-bold"
                      />
                      <span className="text-xs text-steel">可用 ${boundMember.storedValueBalance}</span>
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
                  {memberNotFound && <p className="mt-1 text-xs font-black text-tomato">查無會員，可直接新增會員。</p>}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={onOpenCreateMember} className="inline-flex items-center gap-1 rounded-lg bg-leaf px-3 py-2 text-sm font-black text-white"><UserPlus className="size-4" />新增會員</button>
                {boundMember && memberStoredValueEnabled && canUseStoredValue && <button onClick={onOpenTopup} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white">儲值</button>}
              </div>
            </div>
          )}
        </div>
      )}
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
              <p className="text-steel">單價 ${basePrice} x {line.quantity} = ${sub}</p>
              <p className="font-bold text-tomato">折扣 -{line.discount.type === "percent" ? line.discount.value + "%" : "$" + line.discount.value} = -${discAmt}</p>
              <p className="font-black text-ink">小計 ${after}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-steel">${basePrice} x {line.quantity} = ${sub}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button onClick={() => removeLine(index)} className="rounded-lg bg-tomato px-3 py-1.5 text-sm font-black text-white">刪除</button>
          {canApplyDiscounts && (
            <button
              onClick={() => discOpen ? setDiscOpen(false) : openDiscountForm()}
              className={"rounded-lg px-3 py-1.5 text-sm font-black " + (line.discount ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-steel")}
            >
              {line.discount ? "修改折扣" : "折扣"}
            </button>
          )}
        </div>
      </div>

      {discOpen && (
        <div className="mt-3 space-y-2.5 rounded-lg bg-stone-50 p-3">
          <div className="flex gap-2">
            <button onClick={() => setDiscType("amount")} className={"flex-1 rounded-lg px-3 py-2 text-sm font-black " + (discType === "amount" ? "bg-ink text-white" : "bg-stone-200 text-steel")}>折扣金額</button>
            <button onClick={() => setDiscType("percent")} className={"flex-1 rounded-lg px-3 py-2 text-sm font-black " + (discType === "percent" ? "bg-ink text-white" : "bg-stone-200 text-steel")}>折扣百分比</button>
          </div>
          <div className="flex gap-2">
            <input
              value={discValue}
              onChange={(e) => setDiscValue(e.target.value)}
              type="number"
              min="0"
              max={discType === "percent" ? "100" : undefined}
              placeholder={discType === "amount" ? "折扣金額" : "折扣 % (1-100)"}
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
      <input value={line.note} onChange={(e) => updateLine(index, { note: e.target.value })} placeholder="品項備註（如：不加洋蔥）" className="mt-3 w-full rounded-lg border border-orange-100 px-3 py-2 text-sm font-bold" />
    </div>
  );
}
function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={"grid gap-1 text-sm font-black text-steel " + className}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-orange-200 bg-white px-4 py-3 text-lg font-bold" /></label>;
}
