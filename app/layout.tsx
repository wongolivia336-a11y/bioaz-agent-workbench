import type { Metadata } from "next";
import "./globals.css";
import "./iteration.css";

export const metadata: Metadata = {
  title: "BioAZ Tumor Report Agent",
  description: "Pengli tumor report agent workbench prototype",
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
