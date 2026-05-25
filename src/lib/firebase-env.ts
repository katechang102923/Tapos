/**
 * Resolves Firebase config and environment status from build-time env vars.
 *
 * Supports two patterns:
 *   1. Scoped vars: NEXT_PUBLIC_FIREBASE_STAGING_* / NEXT_PUBLIC_FIREBASE_PRODUCTION_*
 *      These override the generic vars when the matching NEXT_PUBLIC_APP_ENV is set.
 *   2. Generic vars: NEXT_PUBLIC_FIREBASE_API_KEY, etc.
 *      Used as-is when scoped vars are absent.
 *
 * Intentionally side-effect-free — importable from both server (layout.tsx)
 * and client code without triggering the Firebase SDK.
 */

const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "production") as string;

function scopedVar(suffix: string): string | undefined {
  const env = appEnv.toUpperCase(); // "STAGING" | "PRODUCTION"
  const scoped = process.env[`NEXT_PUBLIC_FIREBASE_${env}_${suffix}`]?.trim();
  return scoped || process.env[`NEXT_PUBLIC_FIREBASE_${suffix}`]?.trim();
}

const apiKey             = scopedVar("API_KEY")            ?? "";
const authDomain         = scopedVar("AUTH_DOMAIN")        ?? "";
const projectId          = scopedVar("PROJECT_ID")         ?? "";
const storageBucket      = scopedVar("STORAGE_BUCKET")     ?? "";
const messagingSenderId  = scopedVar("MESSAGING_SENDER_ID") ?? "";
const appId              = scopedVar("APP_ID")             ?? "";
const measurementId      = scopedVar("MEASUREMENT_ID")     ?? "";

const missingKeys: string[] = [];
if (!apiKey)    missingKeys.push("FIREBASE_API_KEY");
if (!projectId) missingKeys.push("FIREBASE_PROJECT_ID");

export const firebaseEnvStatus = {
  /** true when all required Firebase env vars are present */
  ok: missingKeys.length === 0,
  /** Human-readable error when vars are missing; undefined when ok */
  error: missingKeys.length > 0
    ? `Missing env vars: ${missingKeys.join(", ")} (check .env.local or Vercel environment variables)`
    : undefined,
  /** "staging" | "production" — defaults to "production" when unset */
  appEnv,
  /** Resolved Firebase config object — safe to pass to initializeApp() */
  config: {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  },
} as const;
