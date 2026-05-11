import type { AccessStatus, Store, SubscriptionStatus, User } from "./types";
import { platformAdminEmail } from "./store-access";

/** Parse "YYYY-MM-DD" as local midnight (avoids UTC off-by-one in +8 timezones). */
function parseLocalDate(dateStr: string): Date | null {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day); // local midnight
}

/** Today at local midnight. */
function localToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Days remaining until a YYYY-MM-DD date string (local calendar).
 *  Returns null if no date. Returns negative if already past. */
export function daysUntil(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const target = parseLocalDate(dateStr);
  if (!target) return null;
  const today = localToday();
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / 86_400_000);
}

/** Add N days to a YYYY-MM-DD date string (or today).
 *  Returns result as "YYYY-MM-DD" in local calendar. */
export function addDays(dateStr: string | undefined | null, days: number): string {
  const base = dateStr ? (parseLocalDate(dateStr) ?? localToday()) : localToday();
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format a date string as "YYYY/MM/DD" in local calendar. Returns "—" if absent. */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
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

/** Check user account-level + per-store access. */
export function checkUserAccess(
  user: User | null | undefined,
  storeId: string
): { ok: boolean; reason: string } {
  if (!user) return { ok: false, reason: "尚未登入" };
  // Platform admin is always exempt
  if (user.email?.trim().toLowerCase() === platformAdminEmail) return { ok: true, reason: "" };
  if (user.role === "admin") return { ok: true, reason: "" };

  // Global account status
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
