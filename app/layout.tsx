import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Squat Master",
  description: "AI Training Assistant",
  manifest: "/manifest.json", // ★マニフェストを読み込む
  appleWebApp: {
    capable: true, // ★iPhoneでアプリとして動く許可
    statusBarStyle: "black-translucent", // ★上の時計などのバーを黒く透過
    title: "Squat Master",
  },
};

// ★拡大縮小を禁止してアプリっぽくする
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}