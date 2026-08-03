"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * 状态徽标。
 *
 * 此前每个模块各写一套 label map 和一套色板：解析状态、连接状态、任务状态、
 * 启用状态……颜色在 CSS 里硬编码了 43 处，改一次状态色要全局搜色值。
 *
 * 这里只统一「语气 → 视觉」这一层。各模块仍保留自己的业务文案映射，
 * 因为「解析成功」和「已连接」是不同的业务概念，不该合并成同一个枚举。
 */
export type StatusTone = "neutral" | "running" | "warning" | "success" | "danger";

export function StatusChip({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: StatusTone;
  /** 需要在密集列表里快速扫读时加圆点 */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <em className={cn("bioazUiStatusChip", `bioazUiStatusChip--${tone}`, className)}>
      {dot ? <i className="bioazUiStatusDot" aria-hidden="true" /> : null}
      {children}
    </em>
  );
}
