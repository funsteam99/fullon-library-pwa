import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Library System",
  description: "Mobile-first library management system",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
