import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "餐飲 QR 點餐系統",
  description: "適用各類餐飲店的多店家 QR 點餐平台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-2 left-2 z-[9999] text-[11px] text-[#666] opacity-35"
        >
          Tapos v20260515
        </div>
      </body>
    </html>
  );
}
