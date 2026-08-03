"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * 右侧详情抽屉，顶天立地。
 *
 * 早先用 position: absolute 贴在内容容器上，抽屉高度取决于容器而非视口，
 * 于是不同页面里高度各不相同。这里固定为 fixed + inset-block: 0。
 */
export function Drawer({
  title,
  eyebrow,
  onClose,
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className={cn("bioazUiDrawer", className)} aria-label={title}>
      <header className="bioazUiDrawerHeader">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <strong>{title}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭详情">
          <X size={16} />
        </button>
      </header>
      <div className="bioazUiDrawerBody">{children}</div>
    </aside>
  );
}
