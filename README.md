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

Create `.env.local` for local development and set the same variables in Vercel Project Settings -> Environment Variables for production.

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

`NEXT_PUBLIC_APP_URL` is used for production links and QR Codes. The QR Code URL format is:

```txt
${NEXT_PUBLIC_APP_URL}/order/{storeId}
```

After changing environment variables, restart the local dev server or redeploy on Vercel so Next.js can rebuild the client bundle.

## Firebase Config

Firebase initialization is in `src/lib/firebase.ts`.

All Firebase config values are read from `NEXT_PUBLIC_FIREBASE_*` environment variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

The startup console check prints only:

- `projectId`
- `authDomain`
- `apiKeyPrefix`

It does not print the full API key.

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

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

The current dev script starts Next.js on port `3001`.
