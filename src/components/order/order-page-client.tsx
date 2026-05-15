"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, limit, onSnapshot, query as firestoreQuery, setDoc, updateDoc, where } from "firebase/firestore";
import { CheckCircle2, ChevronLeft, Megaphone, Minus, Plus, Search, Send, ShoppingCart, UserPlus } from "lucide-react";
import { ProductOptionModal } from "@/components/product-option-modal";
import { useDemoStore } from "@/lib/demo-store";
import { firebaseEnabled, firestore } from "@/lib/firebase";
import { discountLabel, productFinalPrice, productIsAvailable } from "@/lib/pricing";
import { selectionsTotal } from "@/lib/product-options";
import { calculatePromotions } from "@/lib/promotions";
import { businessOrderBlockReason } from "@/lib/business-hours";
import { checkStoreAccess } from "@/lib/subscription";
import type { Customer, MemberCoupon, Order, OrderItem, OrderItemOption, OrderMode, OrderStatus, Product, RewardCoupon, Store } from "@/lib/types";

type CartLine = {
  product: Product;
  quantity: number;
  selectedOptions: OrderItemOption[];
  note: string;
};

const statusSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: "pending", label: "等待接單" },
  { status: "accepted", label: "製作中" },
  { status: "ready", label: "可取餐" },
  { status: "completed", label: "已完成" }
];

function lineUnitPrice(line: CartLine) {
  return productFinalPrice(line.product) + selectionsTotal(line.selectedOptions);
}

function statusRank(status: OrderStatus) {
  if (status === "completed") return 3;
  if (status === "ready") return 2;
  if (status === "accepted" || status === "cooking" || status === "preparing") return 1;
  return 0;
}

function customerStatusMessage(status: OrderStatus, rejectReason?: string) {
  if (status === "pending" || status === "waiting" || status === "unprocessed") return "等待店家接單";
  if (status === "accepted" || status === "cooking" || status === "preparing") return "餐點製作中";
  if (status === "ready") return "可取餐";
  if (status === "completed") return "已完成";
  if (status === "cancelled") return `訂單取消${rejectReason ? `：${rejectReason}` : ""}`;
  return "等待店家接單";
}

function orderBlockReason(store: Store | undefined, mode: OrderMode) {
  return businessOrderBlockReason(store, mode);
}

export function OrderPageClient({ storeId, tableId, orderType }: { storeId: string; tableId?: string; orderType?: OrderMode }) {
  const [customerSessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    const key = `qr-order-session-${storeId}`;
    const current = window.localStorage.getItem(key);
    if (current) return current;
    const next = `customer-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    window.localStorage.setItem(key, next);
    return next;
  });
  const { db, createOrder } = useDemoStore({ storeId, customerSessionId, skipOrderList: true });
  const [mode, setMode] = useState<OrderMode>(orderType ?? (tableId ? "dine-in" : "takeout"));
  const [tableNo, setTableNo] = useState(tableId ?? "1");
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [choosingProduct, setChoosingProduct] = useState<Product | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [lastOrderId, setLastOrderId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(`lastOrderId:${storeId}`);
  });
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [orderListenError, setOrderListenError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberPhone, setMemberPhone] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberBirthday, setMemberBirthday] = useState("");
  const [member, setMember] = useState<Customer | null>(null);
  const [memberMessage, setMemberMessage] = useState("");
  const [memberLoading, setMemberLoading] = useState(false);
  const [rewardCoupons, setRewardCoupons] = useState<RewardCoupon[]>([]);
  const [memberCoupons, setMemberCoupons] = useState<MemberCoupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !firebaseEnabled || !firestore) return;
    const savedMemberId = window.localStorage.getItem(`qr-member-id:${storeId}`);
    if (!savedMemberId) return;
    return onSnapshot(doc(firestore, "stores", storeId, "members", savedMemberId), (snapshot) => {
      if (snapshot.exists()) setMember({ id: snapshot.id, ...snapshot.data() } as Customer);
    });
  }, [storeId]);

  useEffect(() => {
    if (!firebaseEnabled || !firestore) return;
    return onSnapshot(
      firestoreQuery(collection(firestore, "stores", storeId, "rewardCoupons"), where("enabled", "==", true)),
      (snapshot) => setRewardCoupons(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as RewardCoupon)),
      (error) => setMemberMessage(error.message)
    );
  }, [storeId]);

  useEffect(() => {
    if (!firebaseEnabled || !firestore || !member?.id) {
      setMemberCoupons([]);
      setSelectedCouponId("");
      return;
    }
    return onSnapshot(
      firestoreQuery(collection(firestore, "stores", storeId, "memberCoupons"), where("memberId", "==", member.id), where("status", "==", "unused"), limit(20)),
      (snapshot) => setMemberCoupons(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MemberCoupon)),
      (error) => setMemberMessage(error.message)
    );
  }, [member?.id, storeId]);

  const store = db.stores.find((item) => item.id === storeId);
  const announcement = (store?.temporaryNotice || store?.notice || "").trim();
  const subscriptionCheck = checkStoreAccess(store);
  const blockReason = !subscriptionCheck.ok ? subscriptionCheck.reason : orderBlockReason(store, mode);
  const lastOrder = liveOrder ?? submittedOrder ?? (lastOrderId ? db.orders.find((order) => order.id === lastOrderId) ?? null : null);
  const categories = db.categories.filter((item) => item.storeId === storeId && item.isActive).sort((a, b) => a.sort - b.sort);
  const products = db.products
    .filter((item) => item.storeId === storeId)
    .filter((item) => productIsAvailable(item))
    .filter((item) => activeCategory === "all" || item.categoryId === activeCategory)
    .filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.sort - b.sort);

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
  const promotionLines = useMemo(() => cart.map((line) => ({ product: line.product, quantity: line.quantity, unitPrice: lineUnitPrice(line) })), [cart]);
  const promotionCalculation = useMemo(
    () => calculatePromotions(promotionLines, store?.features?.promotionEnabled === false ? [] : (db.promotions ?? []).filter((item) => item.storeId === storeId)),
    [db.promotions, promotionLines, store?.features?.promotionEnabled, storeId]
  );
  const selectedCoupon = memberCoupons.find((item) => item.id === selectedCouponId);
  const couponDiscount = selectedCoupon?.type === "discount" ? Math.min(selectedCoupon.discountAmount ?? 0, Math.max(0, cartSubtotal - promotionCalculation.discountTotal)) : 0;
  const total = Math.max(0, cartSubtotal - promotionCalculation.discountTotal - couponDiscount);

  useEffect(() => {
    if (!lastOrderId) {
      setLiveOrder(null);
      setOrderListenError("");
      return;
    }
    if (!firebaseEnabled || !firestore) return;
    const unsubscribe = onSnapshot(
      doc(firestore, "stores", storeId, "orders", lastOrderId),
      (snapshot) => {
        setOrderListenError("");
        if (snapshot.exists()) {
          setLiveOrder({ id: snapshot.id, ...snapshot.data() } as Order);
        }
      },
      (listenError) => {
        setOrderListenError(listenError.message);
      }
    );
    return unsubscribe;
  }, [lastOrderId, storeId]);

  function addToCart(product: Product) {
    if (!store?.isOpen || !productIsAvailable(product)) return;
    setChoosingProduct(product);
  }

  function confirmProductOptions(selectedOptions: OrderItemOption[]) {
    if (!choosingProduct) return;
    setCart((current) => [...current, { product: choosingProduct, quantity: 1, selectedOptions, note: "" }]);
    setChoosingProduct(null);
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function submitOrder() {
    if (cart.length === 0 || isSubmitting) return;
    setSubmitError("");
    if (blockReason) {
      setSubmitError(blockReason);
      return;
    }
    setIsSubmitting(true);
    try {
      const tableValue = mode === "takeout" ? "外帶" : tableId ?? tableNo;
      const order = await createOrder({
        storeId,
        mode,
        tableNo: tableValue,
        customerName: tableValue,
        tableName: tableValue,
        tableNumber: tableValue,
        orderType: mode,
        customerSessionId,
        customerNote,
        total,
        source: "qr",
        status: "pending",
        memberId: member?.id,
        memberPhone: member?.phone,
        memberName: member?.name,
        ...(member ? { customer: { customerId: member.id, memberNo: member.memberNo, name: member.name, phone: member.phone } } : {}),
        ...(selectedCoupon ? { couponId: selectedCoupon.id, couponTitle: selectedCoupon.title, couponDiscountAmount: couponDiscount } : {}),
        promotionDiscounts: promotionCalculation.appliedPromotions,
        ...(promotionCalculation.discountTotal > 0 ? {
          discountSummary: {
            itemDiscountTotal: 0,
            orderDiscountTotal: promotionCalculation.discountTotal,
            promotionDiscountTotal: promotionCalculation.discountTotal,
            totalDiscount: promotionCalculation.discountTotal
          }
        } : {}),
        items: cart.map<OrderItem>((line) => ({
          id: "",
          orderId: "",
          storeId,
          productId: line.product.id,
          productName: line.product.name,
          name: line.product.name,
          quantity: line.quantity,
          unitPrice: lineUnitPrice(line),
          price: lineUnitPrice(line),
          originalPrice: line.product.price,
          discountType: line.product.discountType ?? "none",
          discountValue: Number(line.product.discountValue ?? 0),
          finalPrice: productFinalPrice(line.product),
          selectedOptions: line.selectedOptions,
          note: line.note,
          itemNote: line.note
        }))
      });
      if (selectedCoupon && firebaseEnabled && firestore) {
        await updateDoc(doc(firestore, "stores", storeId, "memberCoupons", selectedCoupon.id), { status: "used", usedAt: new Date().toISOString() });
      }
      setLastOrderId(order.id);
      window.localStorage.setItem(`lastOrderId:${storeId}`, order.id);
      console.log("[QR Order Created]", {
        orderId: order.id,
        queueNumber: order.pickupNumber ?? order.orderNumber,
        storeId: order.storeId,
        fullPath: `stores/${storeId}/orders/${order.id}`,
        status: order.status,
        source: order.source,
        orderType: order.orderType
      });
      setSubmittedOrder(order);
      setLiveOrder(null);
      setOrderListenError("");
      setCart([]);
      setSelectedCouponId("");
      setCustomerNote("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (writeError) {
      setSubmitError(writeError instanceof Error ? writeError.message : "訂單送出失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function lookupMember() {
    if (!memberPhone.trim() || !firebaseEnabled || !firestore) return;
    setMemberLoading(true);
    setMemberMessage("");
    try {
      const result = await getDocs(firestoreQuery(collection(firestore, "stores", storeId, "members"), where("phone", "==", memberPhone.trim()), limit(1)));
      const found = result.docs[0];
      if (found) {
        const next = { id: found.id, ...found.data() } as Customer;
        setMember(next);
        window.localStorage.setItem(`qr-member-id:${storeId}`, next.id);
        window.localStorage.setItem(`qr-member-phone:${storeId}`, next.phone);
        window.localStorage.setItem(`qr-member-store:${storeId}`, storeId);
        setMemberMessage("已帶入會員資料");
      } else {
        setMember(null);
        setMemberMessage("找不到會員，可直接建立。");
      }
    } catch (err) {
      setMemberMessage(err instanceof Error ? err.message : "查詢會員失敗");
    } finally {
      setMemberLoading(false);
    }
  }

  async function createMember() {
    if (!memberPhone.trim() || !memberName.trim() || !firebaseEnabled || !firestore) {
      setMemberMessage("請輸入姓名與手機");
      return;
    }
    setMemberLoading(true);
    setMemberMessage("");
    try {
      const memberRef = doc(collection(firestore, "stores", storeId, "members"));
      const now = new Date().toISOString();
      const next: Customer = {
        id: memberRef.id,
        storeId,
        memberNo: `M${Date.now()}`,
        name: memberName.trim(),
        phone: memberPhone.trim(),
        points: 0,
        storedValueBalance: 0,
        balance: 0,
        totalSpent: 0,
        totalOrders: 0,
        createdAt: now,
        updatedAt: now
      };
      if (memberBirthday) next.birthday = memberBirthday;
      await setDoc(memberRef, next);
      setMember(next);
      window.localStorage.setItem(`qr-member-id:${storeId}`, next.id);
      window.localStorage.setItem(`qr-member-phone:${storeId}`, next.phone);
      window.localStorage.setItem(`qr-member-store:${storeId}`, storeId);
      setMemberMessage("會員建立成功");
    } catch (err) {
      setMemberMessage(err instanceof Error ? err.message : "建立會員失敗");
    } finally {
      setMemberLoading(false);
    }
  }

  async function redeemCoupon(coupon: RewardCoupon) {
    const couponCost = coupon.pointsCost ?? coupon.pointsRequired ?? 0;
    if (!member || !firebaseEnabled || !firestore || member.points < couponCost) return;
    setMemberLoading(true);
    setMemberMessage("");
    try {
      const now = new Date().toISOString();
      const memberCouponRef = doc(collection(firestore, "stores", storeId, "memberCoupons"));
      const transactionRef = doc(collection(firestore, "stores", storeId, "memberTransactions"));
      const afterPoints = Math.max(0, member.points - couponCost);
      await Promise.all([
        updateDoc(doc(firestore, "stores", storeId, "members", member.id), { points: afterPoints, updatedAt: now }),
        setDoc(transactionRef, {
          id: transactionRef.id,
          storeId,
          customerId: member.id,
          memberId: member.id,
          memberName: member.name,
          type: "points_use",
          amount: 0,
          beforeBalance: member.balance ?? member.storedValueBalance ?? 0,
          afterBalance: member.balance ?? member.storedValueBalance ?? 0,
          beforePoints: member.points,
          afterPoints,
          note: `兌換 ${coupon.title}`,
          createdAt: now
        }),
        setDoc(memberCouponRef, {
          id: memberCouponRef.id,
          storeId,
          memberId: member.id,
          couponId: coupon.id,
          title: coupon.title,
          type: coupon.type,
          discountAmount: coupon.discountAmount,
          exchangeItemName: coupon.exchangeItemName,
          status: "unused",
          createdAt: now
        })
      ]);
      setMember({ ...member, points: afterPoints });
      setMemberMessage("兌換成功，可在購物車使用。");
    } catch (err) {
      setMemberMessage(err instanceof Error ? err.message : "兌換失敗");
    } finally {
      setMemberLoading(false);
    }
  }

  const handleClearOrder = () => {
    setLastOrderId(null);
    window.localStorage.removeItem(`lastOrderId:${storeId}`);
    setSubmittedOrder(null);
    setLiveOrder(null);
    setOrderListenError("");
  };

  if (!store) return <div className="p-8 text-center text-steel">找不到店家資料</div>;

  return (
    <main className="min-h-screen bg-[#fff7e8]">
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <Link href="/" className="grid size-10 place-items-center rounded-lg bg-orange-50 text-ink sm:size-12">
            <ChevronLeft className="size-5 sm:size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-ink sm:text-xl">{store.name}</p>
            <p className={`text-xs font-black sm:text-sm ${!blockReason ? "text-leaf" : "text-tomato"}`}>{blockReason || "營業中"}</p>
          </div>
          <div className="shrink-0 rounded-lg bg-tomato px-2 py-1 text-xs font-black text-white sm:px-4 sm:py-3 sm:text-base">{mode === "takeout" ? "外帶" : `${tableId ?? tableNo} 桌`}</div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:grid lg:grid-cols-[1fr_410px] lg:gap-5">
        <section className="min-w-0 lg:space-y-4">
          <div className="overflow-hidden rounded-lg bg-white shadow-soft">
            <div className="relative h-32 bg-ink sm:h-40">
              <img src={store.bannerUrl || store.logoUrl} alt={store.name} className="h-full w-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                <h1 className="text-2xl font-black sm:text-3xl">{store.name}</h1>
                <p className="mt-1 text-xs font-bold text-white/90 sm:text-sm">送出後請等待店家接單</p>
              </div>
            </div>
            {announcement && (
              <div className="m-3 rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50 p-3 text-amber-900 sm:m-4 sm:p-4">
                <p className="flex items-center gap-2 text-sm font-black sm:text-base">
                  <Megaphone className="size-5 shrink-0" />
                  今日公告
                </p>
                <p className="mt-2 text-base font-black leading-7 sm:text-xl">{announcement}</p>
              </div>
            )}
            <div className="grid gap-2 p-3 sm:grid-cols-[1fr_1fr] sm:gap-3 sm:p-4">
              <div className="grid grid-cols-2 rounded-lg bg-orange-50 p-1">
                {(["takeout", "dine-in"] as OrderMode[]).map((item) => (
                  <button key={item} onClick={() => setMode(item)} className={`rounded-md px-3 py-3 text-sm font-black sm:px-4 sm:py-4 sm:text-lg ${mode === item ? "bg-white text-ink shadow-sm" : "text-steel"}`}>
                    {item === "dine-in" ? "內用" : "外帶"}
                  </button>
                ))}
              </div>
              <input value={tableId ?? tableNo} onChange={(event) => setTableNo(event.target.value)} disabled={mode === "takeout" || Boolean(tableId)} placeholder="桌號" className="rounded-lg border border-orange-200 bg-white px-3 py-3 text-sm font-black disabled:bg-stone-100 sm:px-4 sm:py-4 sm:text-lg" />
            </div>
          </div>

          <div className="rounded-lg bg-white p-3 shadow-soft sm:p-4">
            <div className="flex items-center gap-2">
              <UserPlus className="size-5 text-leaf" />
              <h2 className="text-lg font-black text-ink">會員登入 / 建立會員</h2>
            </div>
            {member ? (
              <div className="mt-3 rounded-lg bg-blue-50 p-3">
                <p className="font-black text-ink">{member.name} <span className="text-sm font-bold text-steel">({member.phone})</span></p>
                <p className="text-sm font-bold text-steel">點數：{member.points} ｜ 儲值金：${member.balance ?? member.storedValueBalance}</p>
                {rewardCoupons.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    <p className="text-xs font-black text-blue-800">點數兌換券</p>
                    {rewardCoupons.map((coupon) => (
                      <button key={coupon.id} onClick={() => redeemCoupon(coupon)} disabled={memberLoading || member.points < (coupon.pointsCost ?? coupon.pointsRequired ?? 0)} className="rounded-lg bg-white px-3 py-2 text-left text-xs font-black text-ink disabled:opacity-50">
                        {coupon.title} ｜ {coupon.pointsCost ?? coupon.pointsRequired ?? 0} 點{coupon.type === "discount" ? ` ｜ 折 $${coupon.discountAmount}` : ` ｜ ${coupon.exchangeItemName ?? "兌換品"}`}
                      </button>
                    ))}
                  </div>
                )}
                {memberCoupons.length > 0 && (
                  <label className="mt-3 block text-xs font-black text-blue-800">
                    可用券
                    <select value={selectedCouponId} onChange={(event) => setSelectedCouponId(event.target.value)} className="mt-1 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-bold">
                      <option value="">不使用</option>
                      {memberCoupons.map((coupon) => <option key={coupon.id} value={coupon.id}>{coupon.title}{coupon.type === "discount" ? ` -$${coupon.discountAmount ?? 0}` : `（${coupon.exchangeItemName ?? "兌換券"}）`}</option>)}
                    </select>
                  </label>
                )}
                <p className="text-sm font-bold text-steel">點數：{member.points} ｜ 儲值金：${member.balance ?? member.storedValueBalance}</p>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <input value={memberPhone} onChange={(event) => setMemberPhone(event.target.value)} placeholder="手機號碼" className="rounded-lg border border-orange-100 px-3 py-3 text-sm font-bold" />
                <input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="新會員姓名" className="rounded-lg border border-orange-100 px-3 py-3 text-sm font-bold" />
                <input value={memberBirthday} onChange={(event) => setMemberBirthday(event.target.value)} placeholder="生日（可選）" className="rounded-lg border border-orange-100 px-3 py-3 text-sm font-bold sm:col-span-2" />
                <button onClick={lookupMember} disabled={memberLoading || !memberPhone.trim()} className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">查詢</button>
                <button onClick={createMember} disabled={memberLoading || !memberPhone.trim() || !memberName.trim()} className="rounded-lg bg-leaf px-4 py-3 text-sm font-black text-white disabled:opacity-50">建立</button>
              </div>
            )}
            {memberMessage && <p className="mt-2 text-xs font-black text-steel">{memberMessage}</p>}
          </div>

          {lastOrder && (
            <div className={`rounded-lg border-2 bg-white p-4 shadow-soft sm:p-5 ${lastOrder.status === "cancelled" ? "border-tomato" : "border-leaf"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`flex items-center gap-2 text-sm font-black sm:text-base ${lastOrder.status === "cancelled" ? "text-tomato" : "text-leaf"}`}>
                    <CheckCircle2 className="size-4 shrink-0 sm:size-5" />
                    {customerStatusMessage(lastOrder.status, lastOrder.cancelReason ?? lastOrder.rejectReason)}
                  </p>
                  <p className="mt-2 text-3xl font-black text-ink sm:text-4xl">取餐號 {lastOrder.pickupNumber}</p>
                  <p className="mt-1 font-mono text-xs font-bold text-steel">訂單編號 {lastOrder.orderNumber}</p>
                </div>
                <button onClick={handleClearOrder} className="shrink-0 rounded-lg bg-orange-50 px-2 py-1 text-xs font-black text-steel hover:bg-orange-100 sm:px-3 sm:py-2">
                  關閉
                </button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1 sm:gap-2">
                {statusSteps.map((step, index) => {
                  const done = lastOrder.status !== "cancelled" && statusRank(lastOrder.status) >= index;
                  return (
                    <div key={step.status} className={`rounded-lg px-2 py-2 text-center text-xs font-black sm:px-3 sm:py-4 sm:text-base ${done ? "bg-leaf text-white" : "bg-stone-100 text-stone-400"}`}>
                      {step.label}
                    </div>
                  );
                })}
              </div>
              {lastOrder.status === "cancelled" && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-xs font-black text-tomato sm:text-sm">原因：{lastOrder.cancelReason ?? lastOrder.rejectReason ?? "店家取消訂單"}</p>}
              {orderListenError && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-xs font-black text-tomato sm:text-sm">訂單狀態監聽失敗：{orderListenError}</p>}
            </div>
          )}

          <div className="sticky top-[58px] z-30 space-y-2 bg-[#fff7e8] py-2 sm:top-[66px] sm:space-y-3 sm:py-3 lg:relative lg:top-auto lg:z-auto lg:bg-transparent lg:py-0">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400 sm:left-4 sm:size-6" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋餐點" className="w-full rounded-lg border border-orange-100 bg-white py-3 pl-10 pr-3 text-sm font-black shadow-sm outline-none focus:border-tomato sm:py-5 sm:pl-13 sm:pr-4 sm:text-lg" />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[{ id: "all", name: "全部" }, ...categories].map((category) => (
                <button key={category.id} onClick={() => setActiveCategory(category.id)} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-black sm:px-6 sm:py-4 sm:text-lg ${activeCategory === category.id ? "bg-ink text-white" : "bg-white text-steel shadow-sm"}`}>
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {products.length === 0 ? (
              <div className="col-span-full rounded-lg bg-white p-8 text-center shadow-sm">
                <p className="font-black text-steel">目前沒有可點選的餐點</p>
              </div>
            ) : (
              products.map((product) => {
                const disabled = !store.isOpen || !productIsAvailable(product);
                return (
                  <article key={product.id} className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${disabled ? "border-stone-200 opacity-60 grayscale" : "border-orange-100"}`}>
                    <div className="relative">
                      <img src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full object-cover" />
                      {product.isSoldOut && <div className="absolute inset-0 grid place-items-center bg-black/55"><span className="rounded-lg bg-white px-4 py-2 text-sm font-black text-ink sm:px-5 sm:py-3 sm:text-lg">售完</span></div>}
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-ink sm:text-2xl">{product.name}</h2>
                          <p className="mt-1 min-h-0 text-xs leading-5 text-steel sm:text-base sm:leading-6">{product.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-black text-tomato sm:text-2xl">${productFinalPrice(product)}</p>
                          {productFinalPrice(product) !== product.price && <p className="text-xs font-bold text-stone-400 line-through">${product.price}</p>}
                          {discountLabel(product.discountType, product.discountValue) && <p className="mt-1 rounded-full bg-tomato/10 px-2 py-1 text-xs font-black text-tomato">{discountLabel(product.discountType, product.discountValue)}</p>}
                        </div>
                      </div>
                      <button onClick={() => addToCart(product)} disabled={disabled} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-3 text-sm font-black text-white disabled:bg-stone-300 sm:mt-4 sm:px-4 sm:py-4 sm:text-base">
                        <Plus className="size-4 sm:size-5" />
                        加入購物車
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <div className="h-4 sm:h-0" />
        </section>

        <aside className="hidden lg:sticky lg:top-20 lg:block lg:h-fit">
          <CartPanel cart={cart} customerNote={customerNote} setCustomerNote={setCustomerNote} submitOrder={submitOrder} total={total} promotionDiscounts={promotionCalculation.appliedPromotions} updateLine={updateLine} setCart={setCart} canSubmit={cart.length > 0 && !isSubmitting} submitError={submitError || blockReason} isSubmitting={isSubmitting} />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white p-2 shadow-[0_-12px_30px_rgba(0,0,0,0.12)] sm:p-3 lg:hidden">
        <details className="group mx-auto max-w-7xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-ink px-3 py-3 text-white sm:px-4 sm:py-5">
            <span className="flex items-center gap-2 text-sm font-black sm:text-xl"><ShoppingCart className="size-5 sm:size-6" />購物車 {totalQuantity} 項</span>
            <span className="text-lg font-black sm:text-2xl">${total}</span>
          </summary>
          <div className="max-h-[50vh] overflow-y-auto pt-2 sm:pt-3">
            <CartPanel cart={cart} customerNote={customerNote} setCustomerNote={setCustomerNote} submitOrder={submitOrder} total={total} promotionDiscounts={promotionCalculation.appliedPromotions} updateLine={updateLine} setCart={setCart} canSubmit={cart.length > 0 && !isSubmitting} submitError={submitError || blockReason} isSubmitting={isSubmitting} />
          </div>
        </details>
      </div>
      {choosingProduct && <ProductOptionModal product={choosingProduct} sharedGroups={db.sharedOptionGroups} onClose={() => setChoosingProduct(null)} onConfirm={confirmProductOptions} />}
    </main>
  );
}

function CartPanel({
  cart,
  customerNote,
  setCustomerNote,
  submitOrder,
  total,
  promotionDiscounts,
  updateLine,
  setCart,
  canSubmit,
  submitError,
  isSubmitting
}: {
  cart: CartLine[];
  customerNote: string;
  setCustomerNote: (value: string) => void;
  submitOrder: () => void;
  total: number;
  promotionDiscounts: Array<{ promotionId: string; promotionName: string; amount: number; targetName?: string }>;
  updateLine: (index: number, patch: Partial<CartLine>) => void;
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  canSubmit: boolean;
  submitError: string;
  isSubmitting: boolean;
}) {
  return (
    <div className="rounded-lg border border-orange-100 bg-white p-3 shadow-soft sm:p-4">
      <h2 className="flex items-center gap-2 text-xl font-black text-ink sm:text-2xl"><ShoppingCart className="size-5 sm:size-6" />購物車</h2>
      {cart.length === 0 ? (
        <p className="mt-3 rounded-lg bg-orange-50 p-4 text-center text-sm font-black text-steel sm:mt-4 sm:p-5 sm:text-lg">尚未加入餐點</p>
      ) : (
        <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
          {cart.map((line, index) => (
            <div key={`${line.product.id}-${index}`} className="rounded-lg border border-orange-100 p-2 sm:p-3">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-ink sm:text-lg">{line.product.name}</p>
                  <p className="text-xs font-semibold text-tomato sm:text-sm">${lineUnitPrice(line)}</p>
                  {line.selectedOptions.length > 0 && (
                    <div className="mt-1 space-y-0.5 text-xs font-bold text-steel sm:mt-2 sm:space-y-1">
                      {line.selectedOptions.map((option) => (
                        <p key={`${option.groupId}-${option.choiceId}`} style={{ marginLeft: `${(option.level ?? 0) * 12}px` }} className="text-xs sm:text-sm">
                          - {option.groupName}：{option.choiceName}{option.priceDelta ? ` +${option.priceDelta}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  {line.note && <p className="mt-2 rounded-lg bg-orange-50 px-2 py-1 text-xs font-bold text-steel">備註：{line.note}</p>}
                </div>
                <button onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid size-8 shrink-0 place-items-center rounded-lg bg-orange-50 sm:size-10">
                  <Minus className="size-4 text-tomato sm:size-5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between sm:mt-3">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })} className="grid size-8 place-items-center rounded-lg bg-orange-50 sm:size-10">
                    <Minus className="size-4 sm:size-5" />
                  </button>
                  <span className="w-8 text-center text-lg font-black sm:w-10 sm:text-2xl">{line.quantity}</span>
                  <button onClick={() => updateLine(index, { quantity: line.quantity + 1 })} className="grid size-8 place-items-center rounded-lg bg-orange-50 sm:size-10">
                    <Plus className="size-4 sm:size-5" />
                  </button>
                </div>
                <p className="text-lg font-black text-ink sm:text-xl">${lineUnitPrice(line) * line.quantity}</p>
              </div>
              <input value={line.note} onChange={(event) => updateLine(index, { note: event.target.value })} placeholder="品項備註，例如不要醬、加辣" className="mt-2 w-full rounded-lg border border-orange-100 px-2 py-2 text-xs sm:mt-3 sm:px-3 sm:py-3 sm:text-base" />
            </div>
          ))}
        </div>
      )}
      <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="整張訂單備註，例如餐具、取餐提醒" className="mt-3 min-h-16 w-full rounded-lg border border-orange-100 px-3 py-2 text-sm sm:mt-4 sm:min-h-20 sm:px-3 sm:py-3 sm:text-lg" />
      {promotionDiscounts.length > 0 ? (
        <div className="mt-3 space-y-1.5 rounded-lg bg-orange-50 p-3">
          <div className="flex justify-between text-sm font-bold text-steel"><span>小計</span><span>${cart.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0)}</span></div>
          {promotionDiscounts.map((discount) => (
            <div key={discount.promotionId} className="flex justify-between text-sm font-black text-leaf"><span>促銷：{discount.promotionName}</span><span>-${discount.amount}</span></div>
          ))}
          <div className="flex justify-between border-t border-orange-200 pt-2 text-lg font-black sm:text-xl"><span>總計</span><span>${total}</span></div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between text-lg font-black sm:mt-4 sm:text-2xl"><span>總計</span><span>${total}</span></div>
      )}
      {submitError && <p className="mt-3 rounded-lg bg-tomato/10 p-3 text-sm font-black text-tomato">{submitError}</p>}
      <button onClick={submitOrder} disabled={!canSubmit} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-tomato px-3 py-4 text-sm font-black text-white disabled:bg-stone-300 sm:mt-4 sm:px-4 sm:py-5 sm:text-lg">
        <Send className="size-5 sm:size-6" />
        {isSubmitting ? "送出中..." : "送出訂單"}
      </button>
    </div>
  );
}
