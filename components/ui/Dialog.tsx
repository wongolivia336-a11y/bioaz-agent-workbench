"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useModalDismiss } from "./useModalDismiss";

/**
 * 模态弹窗。
 *
 * 固化两条本轮实测踩过的规范：
 * 1. 底部两个按钮同高、同圆角、同内距——曾出现过 44 vs 34 高、6 vs 10 圆角，
 *    原因是模块样式与通用样式特异性相同、靠文件顺序决出胜负。
 * 2. Escape 与点击遮罩都能关闭。
 *
 * 关闭行为交给 useModalDismiss，不再自己写一份 keydown。原来那份漏了两件事：
 * 没有层栈（弹窗里再开一个弹窗，一次 Esc 会把两层一起掀掉），以及它是
 * 逐次渲染重新注册的（onClose 多为行内箭头函数，每次渲染都换身份）。
 *
 * className 用于给单个调用点挂皮肤（宽度、正文底色）。给了这个口子，
 * 业务侧才不会因为"差一点点"而整份复制 markup——手写 backdrop 一多，
 * Esc、遮罩点击、层栈就会各写各的，这个组件的价值也就没了。
 *
 * 跟 PreviewModal 一样 portal 到 body。原来是就地渲染：遮罩 position: fixed、z-index 80，
 * 但只要调用点在一个 isolation: isolate 的容器里（空间首页 .newTaskHome 就是），
 * 这个 z-index 就只在容器内部算数——顶栏压在遮罩上面，磨砂糊住了整页唯独顶栏是清的。
 */
export function Dialog({
  title,
  description,
  size = "default",
  className,
  onClose,
  footer,
  children,
}: {
  title: string;
  description?: string;
  size?: "compact" | "default";
  className?: string;
  onClose: () => void;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const dismiss = useModalDismiss(onClose);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="modalBackdrop" role="presentation" {...dismiss}>
      <section
        className={cn("bioazUiDialog", `bioazUiDialog--${size}`, className)}
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
    </div>,
    document.body,
  );
}
