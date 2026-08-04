"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * 两类切换器，判据是切换的对象：
 *
 * - NavTabs        换「看什么」——不同内容区。下划线式。
 * - SegmentedControl 换「怎么看」——同一内容的不同呈现。分段式。
 *
 * 此前项目中枢、数字团队、报价后台各写一套下划线 Tab，
 * 三处字号字重一致、只有内距差 1~2px，属于无意义的分叉。
 */

export type TabItem<T extends string> = {
  id: T;
  label: string;
  /** 可选计数徽标，如数字团队的 Skills 16 */
  count?: number;
  disabled?: boolean;
};

export function NavTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  children,
}: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  /** 右侧附加内容，如搜索框 */
  children?: ReactNode;
}) {
  return (
    <div className={cn("bioazUiNavTabs", className)} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          className={cn("bioazUiNavTab", value === item.id && "active")}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {typeof item.count === "number" ? <i>{item.count}</i> : null}
        </button>
      ))}
      {children}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: Array<{ id: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("bioazUiSegmented", className)} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          className={cn(value === item.id && "active")}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
