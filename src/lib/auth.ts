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
import type { StoreMemberRole, User, UserRole } from "./types";

const supportedRoles: UserRole[] = ["user", "merchant", "kitchen", "admin", "owner", "manager", "staff", "viewer"];
const storeRoles: StoreMemberRole[] = ["owner", "manager", "staff", "viewer"];
const platformAdminEmail = "ciut0000@gmail.com";

function normalizeMemberships(value: unknown): Record<string, StoreMemberRole> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, StoreMemberRole] => storeRoles.includes(entry[1] as StoreMemberRole))
  );
}

function profileFromSnapshot(snapshot: DocumentSnapshot): User | null {
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const rawRole = typeof data.role === "string" ? data.role.trim() : "user";
  const role = supportedRoles.includes(rawRole as UserRole) ? (rawRole as UserRole) : "user";

  return {
    id: snapshot.id,
    storeId: typeof data.storeId === "string" ? data.storeId : null,
    storeIds: Array.isArray(data.storeIds) ? data.storeIds.filter((item): item is string => typeof item === "string") : [],
    memberships: normalizeMemberships(data.memberships),
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
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      setFirebaseUser(user);
      setProfile(null);
      setError("");
      unsubscribeProfile?.();

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const userRef = doc(db, "users", user.uid);

      getDocFromServer(userRef)
        .then((snapshot) => {
          if (!active) return;
          if (!snapshot.exists() && user.email?.toLowerCase() === platformAdminEmail) {
            const now = new Date().toISOString();
            return setDoc(userRef, {
              id: user.uid,
              email: platformAdminEmail,
              name: "Platform Admin",
              role: "admin",
              storeId: null,
              storeIds: [],
              memberships: {},
              status: "active",
              approved: true,
              pending: false,
              createdAt: now,
              updatedAt: now
            }).then(() => {
              if (!active) return;
              setProfile({
                id: user.uid,
                email: platformAdminEmail,
                name: "Platform Admin",
                role: "admin",
                storeId: null,
                storeIds: [],
                memberships: {},
                status: "active",
                approved: true,
                pending: false,
                createdAt: now,
                updatedAt: now
              });
              setError("");
              setLoading(false);
            });
          }
          const nextProfile = profileFromSnapshot(snapshot);
          setProfile(nextProfile);
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
          const nextProfile = profileFromSnapshot(snapshot);
          setProfile(nextProfile);
          setError(nextProfile ? "" : missingProfileMessage(user.uid));
          setLoading(false);
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
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function registerOwner(email: string, password: string, name: string) {
    if (!auth || !firestore) throw new Error("Firebase 尚未設定");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const pendingSnapshot = await getDocs(query(collection(firestore, "users"), where("email", "==", email), where("pending", "==", true)));
    const pendingData = pendingSnapshot.docs[0]?.data();
    const memberships = normalizeMemberships(pendingData?.memberships);
    const storeIds = Array.isArray(pendingData?.storeIds) ? pendingData.storeIds.filter((item): item is string => typeof item === "string") : Object.keys(memberships);
    const defaultStoreId = typeof pendingData?.storeId === "string" ? pendingData.storeId : storeIds[0] ?? null;
    const pendingRole = typeof pendingData?.role === "string" && supportedRoles.includes(pendingData.role as UserRole) ? pendingData.role as UserRole : "user";
    const now = new Date().toISOString();
    const isFixedAdmin = email.trim().toLowerCase() === platformAdminEmail;
    await setDoc(doc(firestore, "users", credential.user.uid), {
      id: credential.user.uid,
      storeId: isFixedAdmin ? null : defaultStoreId,
      storeIds: isFixedAdmin ? [] : storeIds,
      memberships: isFixedAdmin ? {} : memberships,
      name,
      email,
      role: isFixedAdmin ? "admin" : pendingRole,
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
    await signOut(auth);
  }

  return { firebaseUser, profile, loading, error, signIn, registerOwner, resetPassword, signOutUser };
}
