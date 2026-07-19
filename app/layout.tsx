import type { Metadata } from "next";
import "./globals.css";
import "./iteration.css";
import "./review.css";
import "./quotation-management.css";
import "./quotation-rules-flow.css";
import "./account-menu.css";
import "./admin-sidebar-alignment.css";
import "./dmpk-strategy.css";
import "./dmpk-adjustment-drawer.css";
import "./quotation-dialogs.css";

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
