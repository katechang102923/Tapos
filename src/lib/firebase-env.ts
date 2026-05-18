export type AppEnvironment = "production" | "staging";

type FirebaseEnvKey =
  | "API_KEY"
  | "AUTH_DOMAIN"
  | "PROJECT_ID"
  | "STORAGE_BUCKET"
  | "MESSAGING_SENDER_ID"
  | "APP_ID"
  | "MEASUREMENT_ID";

export type FirebasePublicConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

const requiredKeys: FirebaseEnvKey[] = [
  "API_KEY",
  "AUTH_DOMAIN",
  "PROJECT_ID",
  "STORAGE_BUCKET",
  "MESSAGING_SENDER_ID",
  "APP_ID",
];

const configMap: Record<FirebaseEnvKey, keyof FirebasePublicConfig> = {
  API_KEY: "apiKey",
  AUTH_DOMAIN: "authDomain",
  PROJECT_ID: "projectId",
  STORAGE_BUCKET: "storageBucket",
  MESSAGING_SENDER_ID: "messagingSenderId",
  APP_ID: "appId",
  MEASUREMENT_ID: "measurementId",
};

function normalizeAppEnv(value?: string): AppEnvironment {
  return value === "staging" ? "staging" : "production";
}

function readPublicEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function readFirebaseValue(appEnv: AppEnvironment, key: FirebaseEnvKey) {
  const envPrefix = appEnv === "staging" ? "STAGING" : "PRODUCTION";
  return (
    readPublicEnv(`NEXT_PUBLIC_FIREBASE_${envPrefix}_${key}`) ??
    readPublicEnv(`NEXT_PUBLIC_${envPrefix}_FIREBASE_${key}`) ??
    readPublicEnv(`NEXT_PUBLIC_FIREBASE_${key}`)
  );
}

export function getAppEnvironment() {
  return normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV);
}

export function resolveFirebaseEnv() {
  const appEnv = getAppEnvironment();
  const config: FirebasePublicConfig = {};

  (Object.keys(configMap) as FirebaseEnvKey[]).forEach((key) => {
    config[configMap[key]] = readFirebaseValue(appEnv, key);
  });

  const missing = requiredKeys.filter((key) => !config[configMap[key]]);
  const projectId = config.projectId ?? "";
  const productionUsesStaging = appEnv === "production" && /staging/i.test(projectId);
  const stagingUsesNonStaging = appEnv === "staging" && projectId !== "tapos-staging";
  const error = missing.length
    ? `Firebase 尚未設定，請確認 Environment Variables：缺少 ${missing.map((key) => `NEXT_PUBLIC_FIREBASE_${key}`).join(", ")}`
    : productionUsesStaging
      ? `Production 環境不可使用 staging Firebase projectId：${projectId}`
      : stagingUsesNonStaging
        ? `Staging 環境必須連到 tapos-staging，目前 projectId：${projectId}`
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
