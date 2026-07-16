import type { Metadata } from "next";
import "./globals.css";
import "./iteration.css";

export const metadata: Metadata = {
  title: "BioAZ Agent Workbench",
  description: "Reusable BioAZ workbench shell and agent modules",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
