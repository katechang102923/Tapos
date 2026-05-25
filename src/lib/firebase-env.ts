/**
 * Firebase config and environment status derived from build-time env vars.
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_* variables when they are
 * accessed via static literal strings (e.g. process.env.NEXT_PUBLIC_FOO).
 * Dynamic / computed property access (process.env[`NEXT_PUBLIC_${key}`])
 * always returns undefined in the browser bundle, so every read below must
 * use an explicit static key.
 *
 * Intentionally side-effect-free — importable from both server (layout.tsx)
 * and client code without triggering the Firebase SDK.
 */

// ── Required fields ───────────────────────────────────────────────────────────
const apiKey    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()    ?? "";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "";

// ── Optional fields ───────────────────────────────────────────────────────────
const authDomain        = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim()         ?? "";
const storageBucket     = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()      ?? "";
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "";
const appId             = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()              ?? "";
const measurementId     = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim()      ?? "";

const missingKeys: string[] = [];
if (!apiKey)    missingKeys.push("NEXT_PUBLIC_FIREBASE_API_KEY");
if (!projectId) missingKeys.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

export const firebaseEnvStatus = {
  /** true when all required Firebase env vars are present */
  ok: missingKeys.length === 0,
  /** Human-readable error when vars are missing; undefined when ok */
  error: missingKeys.length > 0
    ? `Missing env vars: ${missingKeys.join(", ")} — check .env.local or Vercel Environment Variables`
    : undefined,
  /** "staging" | "production" — defaults to "production" when unset */
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
  /** Resolved Firebase config — safe to pass directly to initializeApp() */
  config: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId },
};
