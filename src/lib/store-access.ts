import type { StoreMemberRole, User } from "./types";

export const platformAdminEmail = "ciut0000@gmail.com";

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
  const explicitStoreIds = Array.isArray(profile.storeIds) ? profile.storeIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  const legacyStoreId = typeof profile.storeId === "string" && profile.storeId.length > 0 ? [profile.storeId] : [];
  return Array.from(new Set([...explicitStoreIds, ...roleStoreIds, ...legacyStoreId]));
}

export function defaultStoreId(profile: Pick<User, "storeId" | "storeIds" | "memberships" | "storeRoles"> | null | undefined) {
  return accessibleStoreIds(profile)[0] ?? "";
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
