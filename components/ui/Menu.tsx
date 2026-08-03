"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";

/**
 * 图标触发的下拉菜单。此前在 FileManager、KnowledgeBasePage、ProjectPlanTab
 * 各有一份几乎相同的实现，改一处筛选行为要同步三遍。
 *
 * 类名沿用既有的 .toolMenuWrap / .toolIconButton / .toolMenu，样式不动，
 * 迁移后视觉与迁移前完全一致。
 */
export function Menu({
  icon,
  label,
  active = false,
  align = "end",
  closeOnSelect = true,
  children,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  align?: "start" | "end";
  /** 单选类菜单选完即关；多选类（如标签筛选）传 false 保持展开 */
  closeOnSelect?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="toolMenuWrap">
      <button
        className={cn("toolIconButton", active && "active")}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
      </button>
      {open ? (
        <div
          className={cn("toolMenu", align === "start" && "alignStart")}
          onClick={closeOnSelect ? () => setOpen(false) : undefined}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="toolMenuGroup">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function MenuItem({
  active = false,
  onSelect,
  children,
}: {
  active?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button className={cn("toolMenuItem", active && "active")} type="button" onClick={onSelect}>
      <span>{children}</span>
      {active ? <Check size={13} /> : null}
    </button>
  );
}
