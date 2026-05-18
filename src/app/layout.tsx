import type { Metadata } from "next";
import { firebaseEnvStatus } from "@/lib/firebase-env";
import "./globals.css";

export const metadata: Metadata = {
  title: "餐飲 QR 點餐系統",
  description: "適用餐飲店的 QR 點餐、POS 前台與 KDS 管理系統",
};

const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? "unknown";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}

        {!firebaseEnvStatus.ok && (
          <div className="pointer-events-none fixed bottom-10 right-3 z-[9999] max-w-[280px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 shadow-lg">
            Firebase 尚未設定，請確認 Environment Variables
          </div>
        )}

        {firebaseEnvStatus.appEnv === "staging" ? (
          <div
            aria-label="Staging environment indicator"
            title={`Tapos v${buildDate}`}
            className="pointer-events-none fixed bottom-3 right-3 z-[9999] rounded-full bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg ring-2 ring-white/30"
          >
            Staging
          </div>
        ) : (
          <div
            aria-label="Production environment indicator"
            title={`Tapos v${buildDate}`}
            className="pointer-events-none fixed bottom-3 right-3 z-[9999] text-[11px] text-[#666] opacity-35"
          >
            Production
          </div>
        )}
      </body>
    </html>
  );
}
