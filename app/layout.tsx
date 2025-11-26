import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Squat AI",
  description: "AI Squat Counter",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ここを "ja" に変更しました
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}