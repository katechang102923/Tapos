import type { StoreMemberRole, User } from "./types";
import { ACTIVE_STORE_MEMBER_ROLES, normalizeStoreMemberRole, normalizeUserRole } from "./roles";

export const platformAdminEmail = "ciut0000@gmail.com";

/**
 * Mock/demo store IDs that must never appear in the store-switcher for non-admin users.
 * These IDs exist only in seed / local-demo data and must not be offered as real
 * switch targets even if they end up in a user's memberships field.
 */
const DEMO_STORE_IDS = new Set(["demo-store"]);

const posRoles = ACTIVE_STORE_MEMBER_ROLES;
const managerRoles: StoreMemberRole[] = ["owner", "manager"];

function validStoreRole(value: unknown): value is StoreMemberRole {
  return Boolean(normalizeStoreMemberRole(value));
}

function roleMap(value: unknown): Record<string, StoreMemberRole> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([storeId, role]) => [storeId, normalizeStoreMemberRole(role)] as const)
      .filter((entry): entry is [string, StoreMemberRole] => Boolean(entry[1]))
  );
}

export function normalizeStoreRoles(profile: Pick<User, "memberships" | "storeRoles"> | null | undefined) {
  return {
    ...roleMap(profile?.memberships),
    ...roleMap(profile?.storeRoles)
  };
}

export function accessibleStoreIds(profile: Pick<User, "storeId" | "storeIds" | "memberships" | "storeRoles"> | null | undefined) {
  if (!profile) return [];
  return roleStoreIdsFromProfile(profile);
}

/** Role-derived store IDs with demo/seed entries removed. Shared by defaultStoreId and selectorStoreIds. */
function roleStoreIdsFromProfile(profile: Pick<User, "memberships" | "storeRoles"> | null | undefined): string[] {
  return Object.keys(normalizeStoreRoles(profile)).filter((id) => !DEMO_STORE_IDS.has(id));
}

export function defaultStoreId(profile: Pick<User, "storeId" | "storeIds" | "memberships" | "storeRoles"> | null | undefined) {
  return roleStoreIdsFromProfile(profile)[0] ?? "";
}

/**
 * Store IDs to show in the store-switcher dropdown.
 * Admin sees everything; non-admin sees only role-mapped stores with demo IDs stripped.
 * This prevents stale Firestore entries (e.g. deleted stores, seed data) from appearing.
 */
export function selectorStoreIds(
  profile: Pick<User, "storeId" | "storeIds" | "memberships" | "storeRoles" | "role"> | null | undefined
): string[] {
  if (!profile) return [];
  return roleStoreIdsFromProfile(profile);
}

export function storeRoleFor(profile: Pick<User, "memberships" | "storeRoles"> | null | undefined, storeId: string) {
  if (!storeId) return null;
  return normalizeStoreRoles(profile)[storeId] ?? null;
}

export function canUseStorePos(profile: User | null | undefined, storeId: string) {
  const role = storeRoleFor(profile, storeId);
  return Boolean(role && posRoles.includes(role));
}

export function canManageStoreSettings(profile: User | null | undefined, storeId: string) {
  const role = storeRoleFor(profile, storeId);
  return Boolean(role && managerRoles.includes(role));
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === platformAdminEmail;
}

export function isPlatformAdmin(profile: Partial<Pick<User, "email" | "role" | "approved" | "status">> | null | undefined) {
  if (!profile) return false;
  return isPlatformAdminEmail(profile.email)
    || (
      normalizeUserRole(profile.role) === "systemAdmin"
      && profile.approved === true
      && profile.status === "active"
    );
}

export function canSwitchStore(profile: Partial<Pick<User, "email" | "role" | "approved" | "status">> | null | undefined) {
  return isPlatformAdmin(profile);
}

export function canManageAnyStore(profile: Partial<Pick<User, "email" | "role" | "approved" | "status">> | null | undefined) {
  return isPlatformAdmin(profile);
}

export function canAccessStore(profile: User | null | undefined, storeId: string) {
  return Boolean(storeId && (isPlatformAdmin(profile) || storeRoleFor(profile, storeId)));
}

export function canManageMenu(profile: User | null | undefined, storeId: string) {
  const role = storeRoleFor(profile, storeId);
  return Boolean(storeId && (isPlatformAdmin(profile) || role === "owner" || role === "manager"));
}

export function canViewReports(profile: User | null | undefined, storeId: string) {
  const role = storeRoleFor(profile, storeId);
  return Boolean(storeId && (isPlatformAdmin(profile) || role === "owner" || role === "manager" || role === "viewer"));
}

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  owner: "老闆",
  merchant: "老闆",
  manager: "店長",
  staff: "員工",
  cashier: "櫃台",
  kitchen: "廚房",
  admin: "系統管理員",
  viewer: "檢視者",
};

export function roleDisplayName(role: string | null | undefined): string {
  if (!role) return "操作員";
  return ROLE_DISPLAY_NAMES[role] ?? "操作員";
}
