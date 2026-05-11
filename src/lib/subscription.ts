import type { AccessStatus, Store, SubscriptionStatus, User } from "./types";
import { platformAdminEmail } from "./store-access";

/** Returns today as midnight UTC ISO string (YYYY-MM-DD) for comparison */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Days remaining until a date string (YYYY-MM-DD or ISO).
 *  Returns null if no date. Returns negative if already past. */
export function daysUntil(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  return Math.ceil(diffMs / 86_400_000);
}

/** Add N days to a date string (or today if undefined) and return ISO date string. */
export function addDays(dateStr: string | undefined | null, days: number): string {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(base.getTime())) return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  return new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Is the store's subscription currently active (not expired / suspended)? */
export function isStoreSubscriptionActive(store: Store | undefined): boolean {
  if (!store) return false;
  if (store.subscriptionStatus === "suspended") return false;
  if (store.subscriptionEndsAt) {
    const days = daysUntil(store.subscriptionEndsAt);
    if (days !== null && days < 0) return false;
  }
  return true;
}

/** Detailed check — returns { ok, reason } */
export function checkStoreAccess(store: Store | undefined): { ok: boolean; reason: string } {
  if (!store) return { ok: false, reason: "找不到店家資料" };
  if (store.subscriptionStatus === "suspended") {
    return { ok: false, reason: "此店家已被平台暫停，請聯繫平台管理員" };
  }
  if (store.subscriptionEndsAt) {
    const days = daysUntil(store.subscriptionEndsAt);
    if (days !== null && days < 0) {
      return { ok: false, reason: "此店家方案已到期，請聯繫平台管理員續約" };
    }
  }
  return { ok: true, reason: "" };
}

/** Check user account-level access (global accessEndsAt / accessStatus). */
export function checkUserAccess(
  user: User | null | undefined,
  storeId: string
): { ok: boolean; reason: string } {
  if (!user) return { ok: false, reason: "尚未登入" };
  // Platform admin is always exempt
  if (user.email?.trim().toLowerCase() === platformAdminEmail) return { ok: true, reason: "" };
  if (user.role === "admin") return { ok: true, reason: "" };

  // Global account expiry
  if (user.accessStatus === "suspended") {
    return { ok: false, reason: "此帳號已被停用，請聯繫平台管理員" };
  }
  if (user.accessStatus === "expired" || (user.accessEndsAt && (daysUntil(user.accessEndsAt) ?? 1) < 0)) {
    return { ok: false, reason: "此帳號使用期限已到期，請聯繫平台管理員" };
  }

  // Per-store access
  if (storeId) {
    const storeAccess = user.storeAccess?.[storeId];
    if (storeAccess?.accessStatus === "suspended") {
      return { ok: false, reason: "此帳號在此店家的存取已被停用" };
    }
    if (storeAccess?.accessStatus === "expired" || (storeAccess?.accessEndsAt && (daysUntil(storeAccess.accessEndsAt) ?? 1) < 0)) {
      return { ok: false, reason: "此帳號在此店家的使用期限已到期" };
    }
  }

  return { ok: true, reason: "" };
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "試用中",
  active: "訂閱中",
  expired: "已到期",
  suspended: "已暫停",
};

export const SUBSCRIPTION_STATUS_COLORS: Record<SubscriptionStatus, string> = {
  trial: "bg-amber-100 text-amber-700 border border-amber-200",
  active: "bg-leaf/15 text-leaf border border-leaf/25",
  expired: "bg-tomato/10 text-tomato border border-tomato/20",
  suspended: "bg-stone-200 text-stone-500 border border-stone-300",
};

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  active: "使用中",
  expired: "已到期",
  suspended: "已停用",
};

/** Derive effective subscription status from Store fields */
export function effectiveSubscriptionStatus(store: Store | undefined): SubscriptionStatus {
  if (!store) return "expired";
  if (store.subscriptionStatus === "suspended") return "suspended";
  if (store.subscriptionEndsAt) {
    const days = daysUntil(store.subscriptionEndsAt);
    if (days !== null && days < 0) return "expired";
  }
  return store.subscriptionStatus ?? "active";
}

/** True if we should show an expiry warning (within 7 days) */
export function isExpiryWarning(store: Store | undefined): boolean {
  if (!store?.subscriptionEndsAt) return false;
  const days = daysUntil(store.subscriptionEndsAt);
  return days !== null && days >= 0 && days <= 7;
}

/** Safe formatting of a date string */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}
