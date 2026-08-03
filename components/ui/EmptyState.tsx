"use client";

import { Folder } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * 空状态。此前有一个组件加四处内联写法，用了三个不同 CSS 类
 * （.libraryEmptyState / .digitalEmptyState / .projectTabEmptyState），
 * 三者留白与字号都不一样。
 *
 * 按文档要求：一句说明 + 一个主行动按钮，不堆解释。
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "panel",
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** panel 用于内容区，inline 用于卡片网格内的占位 */
  variant?: "panel" | "inline";
  className?: string;
}) {
  return (
    <div className={cn("bioazUiEmptyState", `bioazUiEmptyState--${variant}`, className)}>
      {variant === "panel" ? (
        <span className="bioazUiEmptyIcon" aria-hidden="true">
          {icon ?? <Folder size={22} />}
        </span>
      ) : null}
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}
