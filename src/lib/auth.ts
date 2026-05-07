"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, firebaseEnabled, firestore } from "./firebase";
import type { User } from "./types";

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

    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setProfile(null);
      unsubscribeProfile?.();

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          setProfile(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as User) : null);
          setLoading(false);
        },
        (snapshotError) => {
          setError(snapshotError.message);
          setLoading(false);
        }
      );
    });

    return () => {
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
