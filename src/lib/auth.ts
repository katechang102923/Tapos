"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser
} from "firebase/auth";
import { collection, deleteDoc, doc, getDocFromServer, getDocs, onSnapshot, query, setDoc, where, type DocumentSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, firebaseEnabled, firestore } from "./firebase";
import { accessibleStoreIds, isPlatformAdminEmail, platformAdminEmail } from "./store-access";
import { normalizeStoreMemberRole, normalizeUserRole, STORE_MEMBER_ROLES } from "./roles";
import type { StoreMemberRole, User, UserRole } from "./types";

const storeRoles = STORE_MEMBER_ROLES;

function normalizeMemberships(value: unknown): Record<string, StoreMemberRole> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([storeId, role]) => [storeId, normalizeStoreMemberRole(role)] as const)
      .filter((entry): entry is [string, StoreMemberRole] => Boolean(entry[1]))
  );
}

function platformRoleFromStoreRoles(rolesByStore: Record<string, StoreMemberRole>): UserRole {
  const roles = Object.values(rolesByStore);
  if (roles.includes("owner")) return "owner";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("staff")) return "staff";
  return "viewer";
}

function legacyRolesFromProfile(profile: User): Record<string, StoreMemberRole> {
  const role = normalizeStoreMemberRole(profile.role);
  if (!role) return {};
  const ids = new Set<string>();
  if (profile.storeId) ids.add(profile.storeId);
  for (const storeId of profile.storeIds ?? []) ids.add(storeId);
  return Object.fromEntries(Array.from(ids).map((storeId) => [storeId, role]));
}

function profileFromSnapshot(snapshot: DocumentSnapshot): User | null {
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const role = normalizeUserRole(data.role);

  return {
    id: snapshot.id,
    storeId: typeof data.storeId === "string" ? data.storeId : null,
    storeIds: Array.isArray(data.storeIds) ? data.storeIds.filter((item): item is string => typeof item === "string") : [],
    memberships: normalizeMemberships(data.memberships),
    storeRoles: normalizeMemberships(data.storeRoles),
    pending: Boolean(data.pending),
    approved: Boolean(data.approved),
    status: data.status === "active" || data.status === "rejected" || data.status === "pending" ? data.status : "pending",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    name: typeof data.name === "string" ? data.name : "",
    email: typeof data.email === "string" ? data.email : "",
    role
  };
}

function missingProfileMessage(uid: string) {
  return `Missing Firestore users/${uid}. A pending profile was created; please ask the platform admin to bind a store.`;
}

function authDebug(label: string, payload?: unknown) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_ENV !== "staging") return;
  console.log(`[auth] ${label}`, payload ?? "");
}

function authWarn(label: string, payload?: unknown) {
  if (typeof window === "undefined") return;
  console.warn(`[auth] ${label}`, payload ?? "");
}

function timeoutError(label: string) {
  return new Error(`${label} timed out. Please check Firebase project, Firestore rules, and network access.`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError(label)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function ensureDefaultProfile(user: FirebaseUser) {
  if (!firestore) throw new Error("Firebase is not configured");
  const now = new Date().toISOString();
  const email = user.email?.trim().toLowerCase() ?? "";
  const userRef = doc(firestore, "users", user.uid);
  authDebug("ensureDefaultProfile:start", { uid: user.uid, email });
  const snapshot = await withTimeout(getDocFromServer(userRef), 10000, "Load Firestore user profile");
  if (snapshot.exists()) return profileFromSnapshot(snapshot);

  const profile: User = {
    id: user.uid,
    email,
    name: user.displayName || email || "Pending User",
    role: "viewer",
    storeId: null,
    storeIds: [],
    memberships: {},
    storeRoles: {},
    status: "pending",
    approved: false,
    pending: true,
    createdAt: now,
    updatedAt: now,
  };

  await withTimeout(setDoc(userRef, profile), 10000, "Create default Firestore user profile");
  authDebug("ensureDefaultProfile:created", profile);
  return profile;
}
function adminProfile(uid: string, email = platformAdminEmail, data?: Record<string, unknown>): User {
  const now = new Date().toISOString();
  const memberships = normalizeMemberships(data?.memberships);
  const normalizedStoreRoles = normalizeMemberships(data?.storeRoles);
  const explicitStoreIds = Array.isArray(data?.storeIds) ? data.storeIds.filter((item): item is string => typeof item === "string") : [];
  const legacyStoreId = typeof data?.storeId === "string" ? data.storeId : null;
  const mergedStoreIds = Array.from(new Set([...explicitStoreIds, ...Object.keys(memberships), ...Object.keys(normalizedStoreRoles), ...(legacyStoreId ? [legacyStoreId] : [])]));
  return {
    id: uid,
    email,
    name: typeof data?.name === "string" && data.name ? data.name : "Platform Admin",
    role: "systemAdmin",
    storeId: legacyStoreId ?? mergedStoreIds[0] ?? null,
    storeIds: mergedStoreIds,
    memberships,
    storeRoles: normalizedStoreRoles,
    status: "active",
    approved: true,
    pending: false,
    createdAt: typeof data?.createdAt === "string" ? data.createdAt : now,
    updatedAt: now
  };
}

async function storeRolesFromBindings(email: string): Promise<Record<string, StoreMemberRole>> {
  if (!firestore) return {};
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return {};
  authDebug("storeBindings:query", { email: normalizedEmail });
  const bindingCollections = ["storeUserBindings", "storeUsers", "storeMembers"];
  const bindingSnapshots = (await Promise.all(
    bindingCollections.map(async (collectionName) => {
      try {
        return await withTimeout(
          getDocs(query(collection(firestore!, collectionName), where("email", "==", normalizedEmail))),
          3500,
          `Load ${collectionName} bindings`
        );
      } catch (error) {
        authWarn(`load ${collectionName} bindings failed; continuing with other binding sources`, error);
        return null;
      }
    })
  )).filter(Boolean) as Awaited<ReturnType<typeof getDocs>>[];
  const roles = bindingSnapshots.flatMap((result) => result.docs).reduce<Record<string, StoreMemberRole>>((roles, item) => {
    const data = item.data() as Record<string, unknown>;
    const storeId = typeof data.storeId === "string" ? data.storeId : "";
    const memberRole = normalizeStoreMemberRole(typeof data.storeRole === "string" ? data.storeRole : data.role);
    if (storeId && memberRole) {
      roles[storeId] = memberRole;
    }
    return roles;
  }, {});
  authDebug("storeBindings:result", roles);
  return roles;
}

async function profileWithFreshStoreBindings(rawProfile: User | null): Promise<User | null> {
  if (!rawProfile?.email) return rawProfile;
  const embeddedRoles = { ...legacyRolesFromProfile(rawProfile), ...normalizeMemberships(rawProfile.memberships), ...normalizeMemberships(rawProfile.storeRoles) };
  const bindingRoles = Object.keys(embeddedRoles).length > 0 ? {} : await storeRolesFromBindings(rawProfile.email);
  const authoritativeRoles = Object.keys(embeddedRoles).length > 0 ? embeddedRoles : bindingRoles;
  const storeIds = Object.keys(authoritativeRoles);
  const role = rawProfile.role === "systemAdmin"
    ? "systemAdmin"
    : (storeIds.length ? platformRoleFromStoreRoles(authoritativeRoles) : rawProfile.role);
  return {
    ...rawProfile,
    role,
    memberships: authoritativeRoles,
    storeRoles: authoritativeRoles,
    storeIds,
    storeId: storeIds[0] ?? null
  };
}

function clearStoreRuntimeCache() {
  if (typeof window === "undefined") return;
  const exactKeys = new Set([
    "selectedStoreId",
    "activeStoreId",
    "currentStoreId",
    "merchantStore",
    "menuCache",
    "posStore",
    "storeRole",
    "auth:allowedStoreIds"
  ]);
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (
        exactKeys.has(key)
        || key.startsWith("pos:storeId:")
        || key.startsWith("menuCache:")
        || key.startsWith("merchantStore:")
        || key.startsWith("selectedStoreId:")
        || key.startsWith("activeStoreId:")
      ) {
        storage.removeItem(key);
      }
    }
  }
}

function syncCurrentStoreCache(nextProfile: User | null) {
  if (typeof window === "undefined") return;
  if (!nextProfile) {
    clearStoreRuntimeCache();
    return;
  }
  const currentStoreIds = nextProfile ? accessibleStoreIds(nextProfile) : [];
  const currentSet = new Set(currentStoreIds);
  const cacheKey = "auth:allowedStoreIds";
  const storeSelectionKeys = ["currentStoreId", "selectedStoreId", "activeStoreId"];
  let previousStoreIds: string[] = [];
  try {
    const raw = window.localStorage.getItem(cacheKey);
    previousStoreIds = raw ? JSON.parse(raw) : [];
  } catch {
    previousStoreIds = [];
  }

  const changed = previousStoreIds.length !== currentStoreIds.length
    || previousStoreIds.some((id) => !currentSet.has(id));

  if (changed) {
    const storesToClear = previousStoreIds.filter((id) => !currentSet.has(id));
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const storeId of storesToClear) {
        for (let i = storage.length - 1; i >= 0; i -= 1) {
          const key = storage.key(i);
          if (key && key.includes(storeId)) storage.removeItem(key);
        }
      }
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key?.startsWith("pos:storeId:")) {
          const value = storage.getItem(key) ?? "";
          if (value && !currentSet.has(value)) storage.removeItem(key);
        }
      }
    }
  }

  window.localStorage.setItem(cacheKey, JSON.stringify(currentStoreIds));
  const nextDefaultStoreId = currentStoreIds[0] ?? "";
  for (const key of storeSelectionKeys) {
    const savedStoreId = window.localStorage.getItem(key) ?? "";
    if (savedStoreId && !currentSet.has(savedStoreId)) window.localStorage.removeItem(key);
    if (nextDefaultStoreId) window.localStorage.setItem(key, nextDefaultStoreId);
  }
}

function isStagingApp() {
  return process.env.NEXT_PUBLIC_APP_ENV === "staging";
}

async function ensureStagingAdminSeed(uid: string, email: string): Promise<Record<string, StoreMemberRole>> {
  if (!firestore || !isStagingApp()) return {};
  const db = firestore;
  const now = new Date().toISOString();
  const storeId = "staging-breakfast-store";
  const normalizedEmail = email.toLowerCase();
  authDebug("staging seed:start", { uid, email: normalizedEmail, storeId });

  const storePayload = {
    id: storeId,
    name: "Test Store",
    logoUrl: "",
    bannerUrl: "",
    phone: "07-000-0000",
    address: "Test Address",
    addressCity: "Kaohsiung",
    addressDistrict: "Qianzhen",
    addressDetail: "Test Address",
    businessHours: "Daily 06:00-14:00",
    businessSchedule: {
      mon: { enabled: true, start: "06:00", end: "14:00" },
      tue: { enabled: true, start: "06:00", end: "14:00" },
      wed: { enabled: true, start: "06:00", end: "14:00" },
      thu: { enabled: true, start: "06:00", end: "14:00" },
      fri: { enabled: true, start: "06:00", end: "14:00" },
      sat: { enabled: true, start: "06:00", end: "14:00" },
      sun: { enabled: true, start: "06:00", end: "14:00" },
    },
    closedDates: [],
    temporaryClosed: false,
    temporaryPaused: false,
    allowPosOutsideBusinessHours: true,
    description: "Staging 測試店家",
    takeoutEnabled: true,
    dineInEnabled: true,
    takeoutOrderingEnabled: true,
    dineInOrderingEnabled: true,
    posOrderingEnabled: true,
    checkoutMode: "postpaid",
    ownerId: uid,
    storeType: "breakfast",
    businessType: "breakfast",
    contactName: "Tapos Admin",
    isOpen: true,
    orderStatus: "open",
    peakMode: false,
    demoBreakfastMenuImported: true,
    temporaryNotice: "",
    notice: "",
    subscriptionStatus: "trial",
    subscriptionStartsAt: now,
    subscriptionEndsAt: "2099-12-31T23:59:59.000Z",
    features: {
      kdsEnabled: true,
      dailyReportEnabled: true,
      promotionEnabled: true,
      cashFlowEnabled: true,
      memberEnabled: true,
      memberStoredValueEnabled: true,
    },
    createdAt: now,
    status: "active",
    isDeleted: false,
    updatedAt: now,
  };

  const categories = [
    { id: "staging-cat-burger", name: "漢堡", sort: 1 },
    { id: "staging-cat-toast", name: "吐司", sort: 2 },
    { id: "staging-cat-eggroll", name: "蛋餅", sort: 3 },
    { id: "staging-cat-drink", name: "飲料", sort: 4 },
    { id: "staging-cat-snack", name: "點心", sort: 5 },
  ];
  const flavorGroup = {
    id: "flavor",
    name: "調味",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    type: "single",
    options: [
      { id: "normal", name: "正常", priceDelta: 0, isAvailable: true },
      { id: "less-sauce", name: "少醬", priceDelta: 0, isAvailable: true },
      { id: "no-onion", name: "不加洋蔥", priceDelta: 0, isAvailable: true },
      { id: "spicy", name: "加辣", priceDelta: 0, isAvailable: true },
    ],
  };
  const addonsGroup = {
    id: "addons",
    name: "加料",
    required: false,
    minSelect: 0,
    maxSelect: 3,
    type: "multiple",
    options: [
      { id: "egg", name: "加蛋", priceDelta: 15, isAvailable: true },
      { id: "cheese", name: "加起司", priceDelta: 10, isAvailable: true },
      { id: "hashbrown", name: "加薯餅", priceDelta: 20, isAvailable: true },
    ],
  };
  const products = [
    { id: "staging-prod-burger", categoryId: "staging-cat-burger", categoryName: "漢堡", name: "招牌豬肉蛋堡", price: 65, cost: 35, sort: 1, optionGroups: [flavorGroup, addonsGroup] },
    { id: "staging-prod-toast", categoryId: "staging-cat-toast", categoryName: "吐司", name: "火腿蛋吐司", price: 45, cost: 25, sort: 2, optionGroups: [flavorGroup, addonsGroup] },
    { id: "staging-prod-eggroll", categoryId: "staging-cat-eggroll", categoryName: "蛋餅", name: "起司蛋餅", price: 40, cost: 20, sort: 3, optionGroups: [flavorGroup, addonsGroup] },
    { id: "staging-prod-fries", categoryId: "staging-cat-snack", categoryName: "點心", name: "黃金脆薯", price: 45, cost: 20, sort: 4, optionGroups: [] },
    { id: "staging-prod-tea", categoryId: "staging-cat-drink", categoryName: "飲料", name: "紅茶", price: 25, cost: 8, sort: 5, optionGroups: [] },
    { id: "staging-prod-milk-tea", categoryId: "staging-cat-drink", categoryName: "飲料", name: "奶茶", price: 30, cost: 10, sort: 6, optionGroups: [] },
  ];
  const tables = ["A1", "A2", "A3", "B1", "B2", "Takeout"];

  await withTimeout(Promise.all([
    setDoc(doc(db, "stores", storeId), storePayload, { merge: true }),
    setDoc(doc(db, "storeUsers", `${storeId}_${uid}`), { id: `${storeId}_${uid}`, userId: uid, uid, email: normalizedEmail, storeId, role: "owner", storeRole: "owner", status: "active", approved: true, createdAt: now, updatedAt: now }, { merge: true }),
    setDoc(doc(db, "storeUserBindings", `${storeId}_${uid}`), { id: `${storeId}_${uid}`, userId: uid, uid, email: normalizedEmail, storeId, role: "owner", storeRole: "owner", status: "active", approved: true, createdAt: now, updatedAt: now }, { merge: true }),
    setDoc(doc(db, "storeMembers", `${storeId}_${uid}`), { id: `${storeId}_${uid}`, userId: uid, uid, email: normalizedEmail, storeId, role: "owner", storeRole: "owner", status: "active", approved: true, createdAt: now, updatedAt: now }, { merge: true }),
    setDoc(doc(db, "roles", "systemAdmin"), { id: "systemAdmin", name: "System Admin", permissions: ["*"], updatedAt: now }, { merge: true }),
    setDoc(doc(db, "roles", "owner"), { id: "owner", name: "Owner", permissions: ["store:*"], updatedAt: now }, { merge: true }),
    setDoc(doc(db, "permissions", "default"), { id: "default", updatedAt: now }, { merge: true }),
    setDoc(doc(db, "counters", "orderNumbers"), { qr: 1, pos: 1, kiosk: 1 }, { merge: true }),
    setDoc(doc(db, "stores", storeId, "settings", "memberRules"), { enablePoints: true, earnAmount: 100, earnPoints: 1, pointValue: 1, enableCouponExchange: true, birthdayRewardEnabled: false, birthdayRewardPoints: 0, updatedAt: now }, { merge: true }),
    setDoc(doc(db, "stores", storeId, "settings", "storeSettings"), { storeId, kdsEnabled: true, dailyReportEnabled: true, cashFlowEnabled: true, memberEnabled: true, memberStoredValueEnabled: true, promotionEnabled: true, updatedAt: now }, { merge: true }),
    ...categories.flatMap((category) => [
      setDoc(doc(db, "stores", storeId, "categories", category.id), { ...category, storeId, isActive: true, createdAt: now, updatedAt: now }, { merge: true }),
      setDoc(doc(db, "categories", category.id), { ...category, storeId, isActive: true, createdAt: now, updatedAt: now }, { merge: true }),
    ]),
    ...products.flatMap((product) => {
      const payload = { ...product, storeId, description: `${product.name} staging 測試商品`, imageUrl: "", isActive: true, isAvailable: true, originalPrice: product.price, discountType: "none", discountValue: 0, scheduledChanges: [], createdAt: now, updatedAt: now };
      return [
        setDoc(doc(db, "stores", storeId, "products", product.id), payload, { merge: true }),
        setDoc(doc(db, "products", product.id), payload, { merge: true }),
      ];
    }),
    ...tables.map((tableName, index) => setDoc(doc(db, "stores", storeId, "tables", `staging-table-${index + 1}`), {
      id: `staging-table-${index + 1}`,
      storeId,
      tableName,
      area: tableName === "Takeout" ? "Takeout" : tableName.replace(/\d+/g, ""),
      number: index + 1,
      enabled: true,
      qrUrl: `/order/${storeId}?type=${tableName === "Takeout" ? "takeout" : `dineIn&table=${encodeURIComponent(tableName)}`}`,
      createdAt: now,
      updatedAt: now,
    }, { merge: true })),
  ]), 15000, "Create staging default store data");

  authDebug("staging seed:done", { storeId });
  return { [storeId]: "owner" };
}
async function ensureFixedAdminUser(uid: string, email: string) {
  if (!firestore) throw new Error("Firebase is not configured");
  const userRef = doc(firestore, "users", uid);
  authDebug("ensureFixedAdminUser:start", { uid, email });
  const snapshot = await withTimeout(getDocFromServer(userRef), 10000, "Load fixed admin Firestore user profile");
  const existingData = snapshot.exists() ? snapshot.data() : {};
  const existingMemberships = normalizeMemberships(existingData.memberships);
  const existingStoreRoles = normalizeMemberships(existingData.storeRoles);
  let mergedStoreRoles = { ...existingMemberships, ...existingStoreRoles };
  if (Object.keys(mergedStoreRoles).length === 0 && isStagingApp()) {
    mergedStoreRoles = { "staging-breakfast-store": "owner" };
    ensureStagingAdminSeed(uid, email).catch((seedError) => authWarn("staging background seed failed", seedError));
  }
  const existingStoreIds = Array.isArray(existingData.storeIds) ? existingData.storeIds.filter((item): item is string => typeof item === "string") : [];
  const mergedStoreIds = Array.from(new Set([...existingStoreIds, ...Object.keys(mergedStoreRoles), ...(typeof existingData.storeId === "string" ? [existingData.storeId] : [])]));
  const profile = adminProfile(uid, email, {
    ...existingData,
    storeId: typeof existingData.storeId === "string" ? existingData.storeId : mergedStoreIds[0] ?? null,
    storeIds: mergedStoreIds,
    memberships: mergedStoreRoles,
    storeRoles: mergedStoreRoles
  });
  await withTimeout(setDoc(userRef, {
    id: uid,
    email,
    name: profile.name,
    role: "systemAdmin",
    storeId: profile.storeId,
    storeIds: profile.storeIds,
    memberships: profile.memberships,
    storeRoles: profile.storeRoles,
    status: "active",
    approved: true,
    pending: false,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  }, { merge: true }), 10000, "Upsert fixed admin Firestore user profile");
  authDebug("ensureFixedAdminUser:done", profile);
  return profile;
}
export type AuthState = {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  registerOwner: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

let cachedFirebaseUser: FirebaseUser | null = null;
let cachedProfile: User | null = null;
let cachedAuthReady = false;
let cachedAuthError = "";

function cacheAuthState(next: Partial<Pick<AuthState, "firebaseUser" | "profile" | "loading" | "error">>) {
  if ("firebaseUser" in next) cachedFirebaseUser = next.firebaseUser ?? null;
  if ("profile" in next) cachedProfile = next.profile ?? null;
  if ("loading" in next) cachedAuthReady = !next.loading;
  if ("error" in next) cachedAuthError = next.error ?? "";
}

export function useAuthState(): AuthState {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(cachedFirebaseUser);
  const [profile, setProfile] = useState<User | null>(cachedProfile);
  const [loading, setLoading] = useState(Boolean(firebaseEnabled) && !cachedAuthReady);
  const [error, setError] = useState(cachedAuthError);

  useEffect(() => {
    if (!firebaseEnabled || !auth || !firestore) {
      setLoading(false);
      return;
    }
    const db = firestore;
    let active = true;
    const authInitTimer = setTimeout(() => {
      if (!active) return;
      authWarn("loading timeout", { reason: "onAuthStateChanged did not resolve within 15 seconds" });
      setError("Login loading timed out. Please check Firebase config, network access, and Firestore rules.");
      setLoading(false);
    }, 15000);

    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      clearTimeout(authInitTimer);
      const warmProfile = user && cachedProfile?.id === user.uid ? cachedProfile : null;
      setFirebaseUser(user);
      cacheAuthState({ firebaseUser: user });
      setProfile(warmProfile);
      cacheAuthState({ profile: warmProfile });
      setError("");
      cacheAuthState({ error: "" });
      unsubscribeProfile?.();
      authDebug("auth state changed", { uid: user?.uid ?? null, email: user?.email ?? null });

      if (!user) {
        syncCurrentStoreCache(null);
        cacheAuthState({ firebaseUser: null, profile: null, loading: false, error: "" });
        setLoading(false);
        return;
      }

      if (warmProfile) {
        authDebug("auth warm profile", { uid: user.uid, storeId: warmProfile.storeId, storeIds: accessibleStoreIds(warmProfile) });
        syncCurrentStoreCache(warmProfile);
        setLoading(false);
        cacheAuthState({ loading: false });
      } else {
        setLoading(true);
        cacheAuthState({ loading: true });
      }
      try {
        await withTimeout(user.getIdToken(true), 10000, "Refresh Firebase ID token");
      } catch (tokenError) {
        authWarn("refresh Firebase token failed", tokenError);
      }
      const userRef = doc(db, "users", user.uid);
      const isFixedAdmin = isPlatformAdminEmail(user.email);

      if (isFixedAdmin) {
        if (warmProfile) {
          ensureFixedAdminUser(user.uid, user.email ?? platformAdminEmail)
            .then((fixedAdminProfile) => {
              cacheAuthState({ profile: fixedAdminProfile, loading: false, error: "" });
              setProfile(fixedAdminProfile);
              syncCurrentStoreCache(fixedAdminProfile);
            })
            .catch((snapshotError) => authWarn("fixed admin background refresh failed", snapshotError));
          return;
        }
        try {
          const fixedAdminProfile = await ensureFixedAdminUser(user.uid, user.email ?? platformAdminEmail);
          if (!active) return;
          authDebug("userProfile", fixedAdminProfile);
          authDebug("activeStore", { storeId: fixedAdminProfile.storeId, storeIds: accessibleStoreIds(fixedAdminProfile) });
          setProfile(fixedAdminProfile);
          cacheAuthState({ profile: fixedAdminProfile });
          syncCurrentStoreCache(fixedAdminProfile);
          setError("");
          cacheAuthState({ error: "" });
          setLoading(false);
          cacheAuthState({ loading: false });
        } catch (snapshotError) {
          if (!active) return;
          authWarn("fixed admin profile failed", snapshotError);
          setError(snapshotError instanceof Error ? snapshotError.message : "Platform admin profile failed");
          cacheAuthState({ error: snapshotError instanceof Error ? snapshotError.message : "Platform admin profile failed" });
          setLoading(false);
          cacheAuthState({ loading: false });
        }
        return;
      }

      if (!warmProfile) {
        withTimeout(getDocFromServer(userRef), 10000, "Load Firestore user profile")
          .then(async (snapshot) => {
            if (!active) return;
            const baseProfile = profileFromSnapshot(snapshot) ?? await ensureDefaultProfile(user);
            const nextProfile = await profileWithFreshStoreBindings(baseProfile);
            if (!active) return;
            authDebug("userProfile", nextProfile);
            authDebug("activeStore", { storeId: nextProfile?.storeId ?? null, storeIds: nextProfile ? accessibleStoreIds(nextProfile) : [] });
            setProfile(nextProfile);
            cacheAuthState({ profile: nextProfile });
            syncCurrentStoreCache(nextProfile);
            const nextError = nextProfile?.status === "pending" ? missingProfileMessage(user.uid) : "";
            setError(nextError);
            cacheAuthState({ error: nextError });
            setLoading(false);
            cacheAuthState({ loading: false });
          })
          .catch((snapshotError) => {
            if (!active) return;
            authWarn("initial profile load failed", snapshotError);
            const nextError = snapshotError instanceof Error ? snapshotError.message : "User profile load failed";
            setError(nextError);
            cacheAuthState({ error: nextError, loading: false });
            setLoading(false);
          });
      }

      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (!active) return;
          if (isFixedAdmin) {
            const nextProfile = profileFromSnapshot(snapshot);
            if (nextProfile) {
              const nextAdminProfile = adminProfile(user.uid, user.email ?? platformAdminEmail, nextProfile as unknown as Record<string, unknown>);
              setProfile(nextAdminProfile);
              cacheAuthState({ profile: nextAdminProfile });
              syncCurrentStoreCache(nextAdminProfile);
            } else {
              const nextAdminProfile = adminProfile(user.uid, user.email ?? platformAdminEmail);
              setProfile(nextAdminProfile);
              cacheAuthState({ profile: nextAdminProfile });
              syncCurrentStoreCache(nextAdminProfile);
            }
            setError("");
            cacheAuthState({ error: "" });
            setLoading(false);
            cacheAuthState({ loading: false });
            return;
          }
          Promise.resolve(profileFromSnapshot(snapshot) ?? ensureDefaultProfile(user))
            .then((baseProfile) => profileWithFreshStoreBindings(baseProfile))
            .then((nextProfile) => {
              if (!active) return;
              authDebug("userProfile:snapshot", nextProfile);
              authDebug("activeStore:snapshot", { storeId: nextProfile?.storeId ?? null, storeIds: nextProfile ? accessibleStoreIds(nextProfile) : [] });
              setProfile(nextProfile);
              cacheAuthState({ profile: nextProfile });
              syncCurrentStoreCache(nextProfile);
              const nextError = nextProfile?.status === "pending" ? missingProfileMessage(user.uid) : "";
              setError(nextError);
              cacheAuthState({ error: nextError });
              setLoading(false);
              cacheAuthState({ loading: false });
            })
            .catch((snapshotError) => {
              if (!active) return;
              authWarn("profile snapshot processing failed", snapshotError);
              const nextError = snapshotError instanceof Error ? snapshotError.message : "User profile sync failed";
              setError(nextError);
              cacheAuthState({ error: nextError });
              setLoading(false);
              cacheAuthState({ loading: false });
            });
        },
        (snapshotError) => {
          if (!active) return;
          authWarn("profile snapshot listener failed", snapshotError);
          setError(snapshotError.message);
          cacheAuthState({ error: snapshotError.message });
          setLoading(false);
          cacheAuthState({ loading: false });
        }
      );
    });

    return () => {
      active = false;
      clearTimeout(authInitTimer);
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error("Firebase Auth is not configured");
    setError("");
    cacheAuthState({ error: "", loading: true, profile: null, firebaseUser: null });
    clearStoreRuntimeCache();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await credential.user.getIdToken(true);
  }

  async function registerOwner(email: string, password: string, name: string) {
    if (!auth || !firestore) throw new Error("Firebase is not configured");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const pendingSnapshot = await getDocs(query(collection(firestore, "users"), where("email", "==", email), where("pending", "==", true)));
    const pendingData = pendingSnapshot.docs[0]?.data();
    const memberships = normalizeMemberships(pendingData?.memberships);
    const storeRoles = normalizeMemberships(pendingData?.storeRoles);
    const mergedStoreRoles = { ...memberships, ...storeRoles };
    const storeIds = Array.isArray(pendingData?.storeIds) ? pendingData.storeIds.filter((item): item is string => typeof item === "string") : Object.keys(mergedStoreRoles);
    const defaultStoreId = typeof pendingData?.storeId === "string" ? pendingData.storeId : storeIds[0] ?? null;
    const pendingRole = normalizeUserRole(pendingData?.role);
    const now = new Date().toISOString();
    const isFixedAdmin = isPlatformAdminEmail(email);
    await setDoc(doc(firestore, "users", credential.user.uid), {
      id: credential.user.uid,
      storeId: defaultStoreId,
      storeIds,
      memberships: mergedStoreRoles,
      storeRoles: mergedStoreRoles,
      name,
      email,
      role: isFixedAdmin ? "systemAdmin" : (Object.keys(mergedStoreRoles).length ? platformRoleFromStoreRoles(mergedStoreRoles) : pendingRole),
      pending: false,
      approved: isFixedAdmin,
      status: isFixedAdmin ? "active" : "pending",
      createdAt: now,
      updatedAt: now
    });
    await Promise.all(pendingSnapshot.docs.map((item) => deleteDoc(item.ref)));
  }

  async function resetPassword(email: string) {
    if (!auth) throw new Error("Firebase Auth is not configured");
    await sendPasswordResetEmail(auth, email);
  }

  async function signOutUser() {
    if (!auth) return;
    clearStoreRuntimeCache();
    await signOut(auth);
    cacheAuthState({ firebaseUser: null, profile: null, loading: false, error: "" });
    clearStoreRuntimeCache();
  }

  return { firebaseUser, profile, loading, error, signIn, registerOwner, resetPassword, signOutUser };
}
