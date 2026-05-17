import type { StoreMemberRole, User, UserPermissions } from "./types";
import { normalizeStoreMemberRole } from "./roles";
import { isPlatformAdmin } from "./store-access";

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
  canProcessCheckout: true,
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
  canProcessCheckout: false,
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
    canProcessCheckout: true,
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
    canProcessCheckout: true,
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
    canProcessCheckout: false,
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
    canProcessCheckout: false,
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
  staff: "bg-stone-100 text-stone-700 border border-stone-200",
  viewer: "bg-slate-100 text-slate-600 border border-slate-200",
};

export const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canViewDailyReport: "查看日報 / 報表",
  canManageMenu: "菜單管理",
  canManagePromotions: "促銷管理",
  canUseCashflow: "現金流",
  canUseKDS: "廚房 KDS",
  canManageUsers: "員工管理",
  canViewOrders: "查看訂單",
  canCancelOrders: "取消訂單",
  canApplyDiscounts: "套用折扣",
  canViewPlatformTools: "平台管理工具",
  canManageMembers: "會員管理",
  canUseMemberLookup: "會員查詢",
  canAdjustMemberPoints: "調整會員點數",
  canUseStoredValue: "儲值金",
  canProcessCheckout: "結帳操作",
};

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
  const normalized = normalizeStoreMemberRole(role);
  if (!normalized) return role ?? "員工";
  return ROLE_LABELS[normalized];
}

export function roleBadgeClass(role: string | null | undefined): string {
  const normalized = normalizeStoreMemberRole(role);
  if (!normalized) return "bg-stone-100 text-stone-700 border border-stone-200";
  return ROLE_BADGE_CLASSES[normalized];
}

export function defaultPermissionsForRole(role: StoreMemberRole): UserPermissions {
  return ROLE_DEFAULT_PERMISSIONS[role] ?? NO_PERMISSIONS;
}

export function resolvePermissions(profile: User | null | undefined, storeId: string): UserPermissions {
  if (!profile) return NO_PERMISSIONS;
  if (isPlatformAdmin(profile)) return ALL_PERMISSIONS;

  const effectiveRole = normalizeStoreMemberRole(
    profile.storeRoles?.[storeId] ?? profile.memberships?.[storeId] ?? null
  );
  if (!effectiveRole) return NO_PERMISSIONS;

  const defaults = ROLE_DEFAULT_PERMISSIONS[effectiveRole];
  const custom = profile.storePermissions?.[storeId];
  const merged = custom ? { ...defaults, ...custom } : defaults;
  return { ...merged, canViewPlatformTools: false };
}
