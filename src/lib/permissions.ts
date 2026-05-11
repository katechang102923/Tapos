import type { StoreMemberRole, User, UserPermissions } from "./types";

export const ALL_PERMISSIONS: UserPermissions = {
  canViewDailyReport: true,
  canManageMenu: true,
  canManagePromotions: true,
  canUseCashflow: true,
  canUseKDS: true,
  canManageUsers: true,
  canViewOrders: true,
  canCancelOrders: true,
  canApplyDiscounts: true,
  canViewPlatformTools: true,
  canManageMembers: true,
  canUseMemberLookup: true,
  canAdjustMemberPoints: true,
  canUseStoredValue: true,
};

export const NO_PERMISSIONS: UserPermissions = {
  canViewDailyReport: false,
  canManageMenu: false,
  canManagePromotions: false,
  canUseCashflow: false,
  canUseKDS: false,
  canManageUsers: false,
  canViewOrders: false,
  canCancelOrders: false,
  canApplyDiscounts: false,
  canViewPlatformTools: false,
  canManageMembers: false,
  canUseMemberLookup: false,
  canAdjustMemberPoints: false,
  canUseStoredValue: false,
};

export const ROLE_DEFAULT_PERMISSIONS: Record<StoreMemberRole, UserPermissions> = {
  owner: {
    canViewDailyReport: true,
    canManageMenu: true,
    canManagePromotions: true,
    canUseCashflow: true,
    canUseKDS: true,
    canManageUsers: true,
    canViewOrders: true,
    canCancelOrders: true,
    canApplyDiscounts: true,
    canViewPlatformTools: false,
    canManageMembers: true,
    canUseMemberLookup: true,
    canAdjustMemberPoints: true,
    canUseStoredValue: true,
  },
  manager: {
    canViewDailyReport: true,
    canManageMenu: true,
    canManagePromotions: true,
    canUseCashflow: true,
    canUseKDS: true,
    canManageUsers: false,
    canViewOrders: true,
    canCancelOrders: true,
    canApplyDiscounts: true,
    canViewPlatformTools: false,
    canManageMembers: true,
    canUseMemberLookup: true,
    canAdjustMemberPoints: true,
    canUseStoredValue: false,
  },
  staff: {
    canViewDailyReport: false,
    canManageMenu: false,
    canManagePromotions: false,
    canUseCashflow: false,
    canUseKDS: true,
    canManageUsers: false,
    canViewOrders: true,
    canCancelOrders: false,
    canApplyDiscounts: false,
    canViewPlatformTools: false,
    canManageMembers: false,
    canUseMemberLookup: true,
    canAdjustMemberPoints: false,
    canUseStoredValue: false,
  },
  viewer: {
    canViewDailyReport: true,
    canManageMenu: false,
    canManagePromotions: false,
    canUseCashflow: false,
    canUseKDS: false,
    canManageUsers: false,
    canViewOrders: true,
    canCancelOrders: false,
    canApplyDiscounts: false,
    canViewPlatformTools: false,
    canManageMembers: false,
    canUseMemberLookup: false,
    canAdjustMemberPoints: false,
    canUseStoredValue: false,
  },
};

export const ROLE_LABELS: Record<StoreMemberRole, string> = {
  owner: "老闆",
  manager: "店長",
  staff: "員工",
  viewer: "檢視者",
};

export const ROLE_BADGE_CLASSES: Record<StoreMemberRole, string> = {
  owner: "bg-amber-100 text-amber-700 border border-amber-200",
  manager: "bg-blue-100 text-blue-700 border border-blue-200",
  staff: "bg-stone-100 text-stone-600 border border-stone-200",
  viewer: "bg-slate-100 text-slate-500 border border-slate-200",
};

export const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canViewDailyReport: "查看日報 / 日結",
  canManageMenu: "菜單管理",
  canManagePromotions: "活動管理",
  canUseCashflow: "現金流",
  canUseKDS: "廚房 KDS",
  canManageUsers: "管理帳號",
  canViewOrders: "查看訂單",
  canCancelOrders: "取消訂單",
  canApplyDiscounts: "使用折扣",
  canViewPlatformTools: "平台管理工具", // internal — never shown in store UI
  canManageMembers: "會員管理",
  canUseMemberLookup: "會員查詢",
  canAdjustMemberPoints: "調整點數",
  canUseStoredValue: "儲值功能",
};

/**
 * Permission keys that store owners are allowed to configure for their staff.
 * canViewPlatformTools is intentionally excluded — it is system-determined only.
 */
/**
 * Permission keys that store owners are allowed to configure for their staff.
 * canUseKDS is excluded — KDS access is controlled solely by the platform
 *   switch (store.features.kdsEnabled). Individual KDS staff permissions
 *   will be added in a future iteration.
 * canViewPlatformTools is excluded — system-determined only.
 */
export const STORE_PERMISSION_KEYS: Array<keyof UserPermissions> = [
  "canViewDailyReport",
  "canManageMenu",
  "canManagePromotions",
  "canUseCashflow",
  "canManageUsers",
  "canViewOrders",
  "canCancelOrders",
  "canApplyDiscounts",
  "canManageMembers",
  "canUseMemberLookup",
  "canAdjustMemberPoints",
  "canUseStoredValue",
];

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "員工";
  return ROLE_LABELS[role as StoreMemberRole] ?? role;
}

export function roleBadgeClass(role: string | null | undefined): string {
  if (!role) return "bg-stone-100 text-stone-600 border border-stone-200";
  return ROLE_BADGE_CLASSES[role as StoreMemberRole] ?? "bg-stone-100 text-stone-600 border border-stone-200";
}

export function defaultPermissionsForRole(role: StoreMemberRole): UserPermissions {
  return ROLE_DEFAULT_PERMISSIONS[role] ?? NO_PERMISSIONS;
}

/** Resolve effective permissions for a user in a specific store.
 *  - platform admin (role === "admin") → ALL_PERMISSIONS
 *  - user has a store role → start from role defaults, merge custom overrides
 *  - no store membership → NO_PERMISSIONS
 */
export function resolvePermissions(
  profile: User | null | undefined,
  storeId: string
): UserPermissions {
  if (!profile) return NO_PERMISSIONS;
  if (profile.role === "admin") return ALL_PERMISSIONS;

  // Resolve store-level role
  const storeRole =
    profile.storeRoles?.[storeId] ??
    profile.memberships?.[storeId] ??
    null;

  // Also accept global merchant role mapped to owner
  let effectiveRole: StoreMemberRole | null = storeRole;
  if (!effectiveRole && (profile.role === "merchant" || profile.role === "owner")) {
    effectiveRole = "owner";
  }

  if (!effectiveRole) return NO_PERMISSIONS;

  const defaults = ROLE_DEFAULT_PERMISSIONS[effectiveRole];
  const custom = profile.storePermissions?.[storeId];
  // Merge custom overrides, then always force canViewPlatformTools off —
  // only the platform admin (role === "admin") may have that true.
  const merged = custom ? { ...defaults, ...custom } : defaults;
  return { ...merged, canViewPlatformTools: false };
}
