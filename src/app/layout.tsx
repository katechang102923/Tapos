import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "輕量餐飲 QR 點餐系統 MVP",
  description: "Next.js + Firebase Firestore ready QR ordering MVP demo"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
