import type { Metadata } from "next";
import "../styles/tokens.css";
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
import "./dmpk-rule-assistant.css";
import "./digital-team.css";
import "./composer-attach.css";
import "./composer-chips.css";
import "./inbox.css";
import "./hub.css";
import "./qa-review.css";
import "../styles/design-system.css";
import "./responsive.css";

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
