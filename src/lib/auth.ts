"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser
} from "firebase/auth";
import { doc, getDocFromServer, onSnapshot, setDoc, type DocumentSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, firebaseEnabled, firestore } from "./firebase";
import type { User, UserRole } from "./types";

const supportedRoles: UserRole[] = ["user", "merchant", "kitchen", "admin"];

function profileFromSnapshot(snapshot: DocumentSnapshot): User | null {
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const rawRole = typeof data.role === "string" ? data.role.trim() : "user";
  const role = supportedRoles.includes(rawRole as UserRole) ? (rawRole as UserRole) : "user";

  return {
    id: snapshot.id,
    storeId: typeof data.storeId === "string" ? data.storeId : null,
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
    await setDoc(doc(firestore, "users", credential.user.uid), {
      id: credential.user.uid,
      storeId: null,
      name,
      email,
      role: "user"
    });
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
