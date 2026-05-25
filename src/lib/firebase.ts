import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseEnvStatus } from "@/lib/firebase-env";

const firebaseConfig = firebaseEnvStatus.config;

export const firebaseConfigError = firebaseEnvStatus.error;
export const firebaseEnabled = firebaseEnvStatus.ok;

if (typeof window !== "undefined") {
  const logPayload = {
    appEnv: firebaseEnvStatus.appEnv,
    projectId: firebaseConfig.projectId || "(missing)",
    authDomain: firebaseConfig.authDomain || "(missing)",
    apiKeyPrefix: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.slice(0, 8)}...` : "(missing)"
  };

  if (firebaseConfigError) {
    console.error("[firebase] config error", { ...logPayload, error: firebaseConfigError });
  } else {
    console.info("[firebase] config", logPayload);
  }
}

export const firebaseApp = firebaseEnabled
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null;

export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
