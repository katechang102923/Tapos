export type AppEnvironment = "production" | "staging";

export type FirebasePublicConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

type FirebaseEnvSource = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

const genericFirebaseEnv: FirebaseEnvSource = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const stagingFirebaseEnv: FirebaseEnvSource = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_STAGING_API_KEY ?? process.env.NEXT_PUBLIC_STAGING_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_STAGING_AUTH_DOMAIN ?? process.env.NEXT_PUBLIC_STAGING_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_STAGING_PROJECT_ID ?? process.env.NEXT_PUBLIC_STAGING_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STAGING_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_STAGING_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_STAGING_MESSAGING_SENDER_ID ?? process.env.NEXT_PUBLIC_STAGING_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_STAGING_APP_ID ?? process.env.NEXT_PUBLIC_STAGING_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_STAGING_MEASUREMENT_ID ?? process.env.NEXT_PUBLIC_STAGING_FIREBASE_MEASUREMENT_ID,
};

const productionFirebaseEnv: FirebaseEnvSource = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_API_KEY ?? process.env.NEXT_PUBLIC_PRODUCTION_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_AUTH_DOMAIN ?? process.env.NEXT_PUBLIC_PRODUCTION_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID ?? process.env.NEXT_PUBLIC_PRODUCTION_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_PRODUCTION_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_MESSAGING_SENDER_ID ?? process.env.NEXT_PUBLIC_PRODUCTION_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_APP_ID ?? process.env.NEXT_PUBLIC_PRODUCTION_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_MEASUREMENT_ID ?? process.env.NEXT_PUBLIC_PRODUCTION_FIREBASE_MEASUREMENT_ID,
};

const requiredConfigKeys: Array<keyof FirebasePublicConfig> = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const publicEnvNames: Record<keyof FirebasePublicConfig, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  measurementId: "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
};

function normalizeAppEnv(value?: string): AppEnvironment {
  return value?.trim() === "staging" ? "staging" : "production";
}

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function mergeEnv(primary: FirebaseEnvSource, fallback: FirebaseEnvSource): FirebasePublicConfig {
  return {
    apiKey: clean(primary.apiKey) ?? clean(fallback.apiKey),
    authDomain: clean(primary.authDomain) ?? clean(fallback.authDomain),
    projectId: clean(primary.projectId) ?? clean(fallback.projectId),
    storageBucket: clean(primary.storageBucket) ?? clean(fallback.storageBucket),
    messagingSenderId: clean(primary.messagingSenderId) ?? clean(fallback.messagingSenderId),
    appId: clean(primary.appId) ?? clean(fallback.appId),
    measurementId: clean(primary.measurementId) ?? clean(fallback.measurementId),
  };
}

export function getAppEnvironment() {
  return normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV);
}

export function resolveFirebaseEnv() {
  const appEnv = getAppEnvironment();
  const scopedEnv = appEnv === "staging" ? stagingFirebaseEnv : productionFirebaseEnv;
  const config = mergeEnv(scopedEnv, genericFirebaseEnv);

  const missingKeys = requiredConfigKeys.filter((key) => !config[key]);
  const missing = missingKeys.map((key) => publicEnvNames[key]);
  const projectId = config.projectId ?? "";
  const productionUsesStaging = appEnv === "production" && /staging/i.test(projectId);
  const error = missing.length
    ? `Firebase 尚未設定，請確認 Environment Variables：缺少 ${missing.join(", ")}`
    : productionUsesStaging
      ? `Production 環境不可使用 staging Firebase projectId：${projectId}`
      : "";

  return {
    appEnv,
    config,
    missing,
    ok: !error,
    error,
  };
}

export const firebaseEnvStatus = resolveFirebaseEnv();
