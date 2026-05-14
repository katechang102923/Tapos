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
  return `找不到 Firestore users/${uid} 使用者資料，請先在 users collection 建立該使用者文件。`;
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
  const bindingCollections = ["storeUserBindings", "storeUsers", "storeMembers"];
  const bindingSnapshots = (await Promise.all(
    bindingCollections.map(async (collectionName) => {
      try {
        return await getDocs(query(collection(firestore!, collectionName), where("email", "==", normalizedEmail)));
      } catch (error) {
        console.warn(`load ${collectionName} bindings failed; continuing with other binding sources`, error);
        return null;
      }
    })
  )).filter(Boolean) as Awaited<ReturnType<typeof getDocs>>[];
  return bindingSnapshots.flatMap((result) => result.docs).reduce<Record<string, StoreMemberRole>>((roles, item) => {
    const data = item.data() as Record<string, unknown>;
    const storeId = typeof data.storeId === "string" ? data.storeId : "";
    const memberRole = normalizeStoreMemberRole(typeof data.storeRole === "string" ? data.storeRole : data.role);
    if (storeId && memberRole) {
      roles[storeId] = memberRole;
    }
    return roles;
  }, {});
}

async function profileWithFreshStoreBindings(rawProfile: User | null): Promise<User | null> {
  if (!rawProfile?.email) return rawProfile;
  const bindingRoles = await storeRolesFromBindings(rawProfile.email);
  const authoritativeRoles = Object.keys(bindingRoles).length > 0
    ? bindingRoles
    : { ...legacyRolesFromProfile(rawProfile), ...normalizeMemberships(rawProfile.memberships), ...normalizeMemberships(rawProfile.storeRoles) };
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

async function ensureFixedAdminUser(uid: string, email: string) {
  if (!firestore) throw new Error("Firebase 尚未設定");
  const userRef = doc(firestore, "users", uid);
  const snapshot = await getDocFromServer(userRef);
  const existingData = snapshot.exists() ? snapshot.data() : {};
  const bindingSnapshots = await Promise.all([
    getDocs(query(collection(firestore, "storeUserBindings"), where("email", "==", email.toLowerCase()))),
    getDocs(query(collection(firestore, "storeUsers"), where("email", "==", email.toLowerCase())))
  ]);
  const bindingRoles = bindingSnapshots.flatMap((result) => result.docs).reduce<Record<string, StoreMemberRole>>((roles, item) => {
    const data = item.data();
    const storeId = typeof data.storeId === "string" ? data.storeId : "";
    const memberRole = normalizeStoreMemberRole(typeof data.storeRole === "string" ? data.storeRole : data.role);
    if (storeId && memberRole) {
      roles[storeId] = memberRole;
    }
    return roles;
  }, {});
  const existingMemberships = normalizeMemberships(existingData.memberships);
  const existingStoreRoles = normalizeMemberships(existingData.storeRoles);
  const mergedStoreRoles = { ...bindingRoles, ...existingMemberships, ...existingStoreRoles };
  const existingStoreIds = Array.isArray(existingData.storeIds) ? existingData.storeIds.filter((item): item is string => typeof item === "string") : [];
  const mergedStoreIds = Array.from(new Set([...existingStoreIds, ...Object.keys(mergedStoreRoles), ...(typeof existingData.storeId === "string" ? [existingData.storeId] : [])]));
  const profile = adminProfile(uid, email, {
    ...existingData,
    storeId: typeof existingData.storeId === "string" ? existingData.storeId : mergedStoreIds[0] ?? null,
    storeIds: mergedStoreIds,
    memberships: mergedStoreRoles,
    storeRoles: mergedStoreRoles
  });
  await setDoc(userRef, {
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
  }, { merge: true });
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

export function useAuthState(): AuthState {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(firebaseEnabled));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseEnabled || !auth || !firestore) {
      setLoading(false);
      return;
    }
    const db = firestore;
    let active = true;

    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      setProfile(null);
      setError("");
      unsubscribeProfile?.();

      if (!user) {
        syncCurrentStoreCache(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await user.getIdToken(true);
      } catch (tokenError) {
        console.warn("refresh Firebase token failed", tokenError);
      }
      const userRef = doc(db, "users", user.uid);
      const isFixedAdmin = isPlatformAdminEmail(user.email);

      if (isFixedAdmin) {
        ensureFixedAdminUser(user.uid, user.email ?? platformAdminEmail)
          .then((fixedAdminProfile) => {
            if (!active) return;
            setProfile(fixedAdminProfile);
            syncCurrentStoreCache(fixedAdminProfile);
            setError("");
            setLoading(false);
          })
          .catch((snapshotError) => {
            if (!active) return;
            setError(snapshotError.message);
            setLoading(false);
          });
      }

      getDocFromServer(userRef)
        .then(async (snapshot) => {
          if (!active) return;
          if (isFixedAdmin) return;
          const nextProfile = await profileWithFreshStoreBindings(profileFromSnapshot(snapshot));
          if (!active) return;
          setProfile(nextProfile);
          syncCurrentStoreCache(nextProfile);
          setError(nextProfile ? "" : missingProfileMessage(user.uid));
          setLoading(false);
        })
        .catch((snapshotError) => {
          if (!active) return;
          setError(snapshotError.message);
          setLoading(false);
        });

      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (!active) return;
          if (isFixedAdmin) {
            const nextProfile = profileFromSnapshot(snapshot);
            if (nextProfile) {
              const nextAdminProfile = adminProfile(user.uid, user.email ?? platformAdminEmail, nextProfile as unknown as Record<string, unknown>);
              setProfile(nextAdminProfile);
              syncCurrentStoreCache(nextAdminProfile);
            } else {
              const nextAdminProfile = adminProfile(user.uid, user.email ?? platformAdminEmail);
              setProfile(nextAdminProfile);
              syncCurrentStoreCache(nextAdminProfile);
            }
            setError("");
            setLoading(false);
            return;
          }
          profileWithFreshStoreBindings(profileFromSnapshot(snapshot))
            .then((nextProfile) => {
              if (!active) return;
              setProfile(nextProfile);
              syncCurrentStoreCache(nextProfile);
              setError(nextProfile ? "" : missingProfileMessage(user.uid));
              setLoading(false);
            })
            .catch((snapshotError) => {
              if (!active) return;
              setError(snapshotError.message);
              setLoading(false);
            });
        },
        (snapshotError) => {
          if (!active) return;
          setError(snapshotError.message);
          setLoading(false);
        }
      );
    });

    return () => {
      active = false;
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error("Firebase Auth 尚未設定");
    setError("");
    clearStoreRuntimeCache();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await credential.user.getIdToken(true);
  }

  async function registerOwner(email: string, password: string, name: string) {
    if (!auth || !firestore) throw new Error("Firebase 尚未設定");
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
    if (!auth) throw new Error("Firebase Auth 尚未設定");
    await sendPasswordResetEmail(auth, email);
  }

  async function signOutUser() {
    if (!auth) return;
    clearStoreRuntimeCache();
    await signOut(auth);
    clearStoreRuntimeCache();
  }

  return { firebaseUser, profile, loading, error, signIn, registerOwner, resetPassword, signOutUser };
}
