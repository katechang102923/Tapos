import type { StoreMemberRole, UserRole } from "./types";

const ownerAliases = new Set(["owner", "merchant", "商家", "老闆"]);
const managerAliases = new Set(["manager", "管理員", "店長"]);
const staffAliases = new Set(["staff", "kitchen", "員工"]);
const viewerAliases = new Set(["viewer", "檢視者", "只讀", "只讀/報表"]);
const systemAdminAliases = new Set(["systemAdmin", "softwareAdmin", "admin", "系統管理員", "軟體管理員"]);

export const STORE_MEMBER_ROLES: StoreMemberRole[] = ["owner", "manager", "staff", "viewer"];
export const ACTIVE_STORE_MEMBER_ROLES: StoreMemberRole[] = ["owner", "manager", "staff"];

export function normalizeStoreMemberRole(value: unknown): StoreMemberRole | null {
  const role = typeof value === "string" ? value.trim() : "";
  if (ownerAliases.has(role)) return "owner";
  if (managerAliases.has(role)) return "manager";
  if (staffAliases.has(role)) return "staff";
  if (viewerAliases.has(role)) return "viewer";
  return null;
}

export function normalizeUserRole(value: unknown): UserRole {
  const role = typeof value === "string" ? value.trim() : "";
  if (systemAdminAliases.has(role)) return "systemAdmin";
  return normalizeStoreMemberRole(role) ?? "staff";
}

export function isSystemAdminRole(value: unknown) {
  return normalizeUserRole(value) === "systemAdmin";
}

export const STORE_ROLE_LABELS: Record<StoreMemberRole, string> = {
  owner: "老闆",
  manager: "店長",
  staff: "員工",
  viewer: "檢視者"
};
