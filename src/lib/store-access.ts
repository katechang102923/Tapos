import type { StoreMemberRole, User } from "./types";

export const platformAdminEmail = "ciut0000@gmail.com";

/**
 * Mock/demo store IDs that must never appear in the store-switcher for non-admin users.
 * These IDs exist only in seed / local-demo data and must not be offered as real
 * switch targets even if they end up in a user's memberships field.
 */
const DEMO_STORE_IDS = new Set(["demo-store"]);

const storeStaffRoles: StoreMemberRole[] = ["owner", "manager", "staff", "viewer"];
const posRoles: StoreMemberRole[] = ["owner", "manager", "staff"];
const managerRoles: StoreMemberRole[] = ["owner", "manager"];

function validStoreRole(value: unknown): value is StoreMemberRole {
  return typeof value === "string" && storeStaffRoles.includes(value as StoreMemberRole);
}

function roleMap(value: unknown): Record<string, StoreMemberRole> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, StoreMemberRole] => validStoreRole(entry[1]))
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
  const roleStoreIds = Object.keys(normalizeStoreRoles(profile));
  if (roleStoreIds.length > 0) return roleStoreIds;
  const explicitStoreIds = Array.isArray(profile.storeIds) ? profile.storeIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  const legacyStoreId = typeof profile.storeId === "string" && profile.storeId.length > 0 ? [profile.storeId] : [];
  return Array.from(new Set([...explicitStoreIds, ...roleStoreIds, ...legacyStoreId]));
}

/** Role-derived store IDs with demo/seed entries removed. Shared by defaultStoreId and selectorStoreIds. */
function roleStoreIds(profile: Pick<User, "memberships" | "storeRoles"> | null | undefined): string[] {
  return Object.keys(normalizeStoreRoles(profile)).filter((id) => !DEMO_STORE_IDS.has(id));
}

export function defaultStoreId(profile: Pick<User, "storeId" | "storeIds" | "memberships" | "storeRoles"> | null | undefined) {
  const ids = roleStoreIds(profile);
  if (ids.length > 0) return ids[0];
  return accessibleStoreIds(profile)[0] ?? "";
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
  if (profile.role === "admin") return accessibleStoreIds(profile);
  const ids = roleStoreIds(profile);
  if (ids.length > 0) return ids;
  const legacyId = typeof profile.storeId === "string" && profile.storeId.length > 0 ? profile.storeId : "";
  return legacyId && !DEMO_STORE_IDS.has(legacyId) ? [legacyId] : [];
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
