# Breakfast QR Ordering POS MVP

Next.js App Router + Firebase Auth + Firestore MVP for a lightweight breakfast shop QR ordering SaaS.

This project does not include payments, invoices, LINE Pay, delivery integrations, accounting, or inventory.

## Tech Stack

- Frontend: Next.js App Router, React, Tailwind CSS
- Auth: Firebase Auth email/password
- Database: Firebase Firestore
- Realtime: Firestore `onSnapshot`
- Hosting target: Vercel

## Routes

- `/` - Home
- `/register` - Store owner registration
- `/login` - Login
- `/forgot-password` - Password reset
- `/onboarding` - First store setup
- `/merchant` - Merchant dashboard
- `/merchant/settings` - Store settings and QR Code
- `/order/{storeId}` - Customer QR ordering page
- `/kitchen/{storeId}` - Kitchen display system
- `/admin` - Admin dashboard

## Environment Variables

This project supports two public environments:

- `production` - formal customer-facing site
- `staging` - internal test site

Create `.env.local` for local development. For Vercel, set variables in Project Settings -> Environment Variables. The selected environment is controlled by:

```bash
NEXT_PUBLIC_APP_ENV=production
# or
NEXT_PUBLIC_APP_ENV=staging
```

Minimum required variables for the selected environment:

```bash
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

You may also provide scoped variables when one Vercel project needs both configs available:

```bash
NEXT_PUBLIC_FIREBASE_PRODUCTION_API_KEY=
NEXT_PUBLIC_FIREBASE_PRODUCTION_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_PRODUCTION_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_PRODUCTION_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_PRODUCTION_APP_ID=
NEXT_PUBLIC_FIREBASE_PRODUCTION_MEASUREMENT_ID=

NEXT_PUBLIC_FIREBASE_STAGING_API_KEY=
NEXT_PUBLIC_FIREBASE_STAGING_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_STAGING_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STAGING_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_STAGING_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_STAGING_APP_ID=
NEXT_PUBLIC_FIREBASE_STAGING_MEASUREMENT_ID=
```

Resolution order:

1. If `NEXT_PUBLIC_APP_ENV=production`, the app first reads `NEXT_PUBLIC_FIREBASE_PRODUCTION_*`.
2. If `NEXT_PUBLIC_APP_ENV=staging`, the app first reads `NEXT_PUBLIC_FIREBASE_STAGING_*`.
3. If scoped values are empty, the app falls back to generic `NEXT_PUBLIC_FIREBASE_*` values.

`NEXT_PUBLIC_APP_URL` is used for production links and QR Codes. The QR Code URL format is:

```txt
${NEXT_PUBLIC_APP_URL}/order/{storeId}
```

After changing environment variables, restart the local dev server or redeploy on Vercel so Next.js can rebuild the client bundle.

## Firebase Config And Safety Checks

Firebase initialization is in `src/lib/firebase.ts`; environment resolution is in `src/lib/firebase-env.ts`.

The app validates Firebase variables before initialization:

- Missing required Firebase env values do not crash the app.
- The UI shows: `Firebase 撠閮剖?嚗?蝣箄? Environment Variables`.
- The browser console prints only `appEnv`, `projectId`, `authDomain`, and `apiKeyPrefix`; it never prints the full API key.
- If `NEXT_PUBLIC_APP_ENV=production` and `projectId` contains `staging`, Firebase initialization is blocked and `console.error` is emitted.

Environment indicator:

- Production shows a small gray `Production` label at the bottom-right.
- Staging shows a purple `Staging` badge at the bottom-right.

## Staging / Production SOP

### 1. Create Firebase projects

Create two separate Firebase projects:

- Production project, for example `tapos-prod`
- Staging project, for example `tapos-staging`

For each project:

1. Enable Firebase Authentication -> Email/Password.
2. Create Firestore Database.
3. Create a Web App and copy the Firebase config.
4. Deploy the same `firestore.rules` to the corresponding project.

### 2. Configure Vercel projects

Recommended setup:

- Vercel production project or production deployment uses `NEXT_PUBLIC_APP_ENV=production`.
- Vercel staging project or preview deployment uses `NEXT_PUBLIC_APP_ENV=staging`.

Production Vercel variables:

```bash
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_FIREBASE_API_KEY=production-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=production-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=production-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=production-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=production-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=production-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=production-measurement-id
```

Staging Vercel variables:

```bash
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://your-staging-domain.vercel.app
NEXT_PUBLIC_FIREBASE_API_KEY=staging-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=staging-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=staging-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=staging-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=staging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=staging-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=staging-measurement-id
```

### 3. Deploy Firestore rules

For staging:

```bash
firebase use your-staging-project-id
firebase deploy --only firestore:rules
```

For production:

```bash
firebase use your-production-project-id
firebase deploy --only firestore:rules
```

### 4. Deploy app

```bash
npm install
npm run build
git push
```

Then trigger a Vercel deployment for the intended environment.

### 5. Post-deploy checklist

- Production page shows `Production` in the bottom-right.
- Staging page shows `Staging` in the bottom-right.
- Browser console shows the expected Firebase `projectId`.
- Production console must not show a staging projectId.
- `/login`, `/register`, `/merchant/pos`, `/merchant/dashboard`, and `/order/{storeId}` can read/write the expected Firebase project.
## Firestore Collections

- `users/{uid}`
- `stores/{storeId}`
- `categories/{categoryId}`
- `products/{productId}`
- `orders/{orderId}`

Registration and onboarding write data in this order:

1. `users/{uid}` after Firebase Auth registration
2. `stores/{storeId}` during onboarding
3. `users/{uid}.storeId` after store creation
4. `categories/{categoryId}` for the generated demo menu
5. `products/{productId}` for the generated demo menu
6. `orders/{orderId}` when a customer submits an order

## Firestore Rules

Rules are stored in `firestore.rules`.

Deploy rules:

```bash
npm install -g firebase-tools
firebase login
firebase use tapos-7abae
firebase deploy --only firestore:rules
```

Confirm `firebase.json` contains:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

## Vercel Deployment

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Use the Next.js framework preset.
4. Add all `NEXT_PUBLIC_*` variables in Vercel Project Settings -> Environment Variables.
5. Set `NEXT_PUBLIC_APP_URL` to the final Vercel domain or custom domain.
6. Deploy.
7. After deployment, test:
   - `/register`
   - `/login`
   - `/onboarding`
   - `/merchant`
   - `/merchant/settings`
   - `/order/{storeId}`
   - `/kitchen/{storeId}`
   - `/admin`


## Staging Seed Data

A repeatable staging seed script is available at `scripts/seed-staging.mjs`.

It creates or updates:

- Firebase Auth user lookup for `ciut0000@gmail.com`
- `users/{uid}` as `systemAdmin`
- `stores/staging-breakfast-store` as `測試早餐店`
- `storeUsers/{storeId_uid}`
- `storeUserBindings/{storeId_uid}`
- `storeMembers/{storeId_uid}`
- `roles/*` and `permissions/default`
- top-level `categories`, `products`, `tables`
- nested `stores/{storeId}/categories`, `stores/{storeId}/products`, `stores/{storeId}/tables`
- `stores/{storeId}/settings/memberRules`
- `counters/orderNumbers`

Before running, provide a Firebase service account using one of these methods:

```bash
# Option A: service account file
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\tapos-staging-service-account.json"

# Option B: base64 service account JSON, useful for CI
$env:FIREBASE_SERVICE_ACCOUNT_BASE64="base64-json"
```

Run the seed:

```bash
$env:FIREBASE_PROJECT_ID="tapos-staging"
$env:NEXT_PUBLIC_APP_URL="https://your-staging-domain.vercel.app"
npm run seed:staging
```

Optional overrides:

```bash
$env:SEED_ADMIN_EMAIL="ciut0000@gmail.com"
$env:SEED_STORE_ID="staging-breakfast-store"
$env:SEED_STORE_NAME="測試早餐店"
```

The script is safe to run more than once; it uses merge writes and stable document IDs.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

The current dev script starts Next.js on port `3001`.
