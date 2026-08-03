"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * 模态弹窗。
 *
 * 固化两条本轮实测踩过的规范：
 * 1. 底部两个按钮同高、同圆角、同内距——曾出现过 44 vs 34 高、6 vs 10 圆角，
 *    原因是模块样式与通用样式特异性相同、靠文件顺序决出胜负。
 * 2. Escape 与点击遮罩都能关闭。
 */
export function Dialog({
  title,
  description,
  size = "default",
  onClose,
  footer,
  children,
}: {
  title: string;
  description?: string;
  size?: "compact" | "default";
  onClose: () => void;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={cn("bioazUiDialog", `bioazUiDialog--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="bioazUiDialogHeader">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="bioazUiDialogClose" type="button" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>
        {children ? <div className="bioazUiDialogBody">{children}</div> : null}
        {footer ? <footer className="bioazUiDialogFooter">{footer}</footer> : null}
      </section>
    </div>
  );
}
