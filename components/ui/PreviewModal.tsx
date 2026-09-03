"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useModalDismiss } from "./useModalDismiss";

/**
 * `.previewModal` 这层皮的公共外壳。
 *
 * 它不是 `<Dialog>` 的替代品，是**另一套皮肤**——header 是「小标签 + 大标题」
 * 两行结构，跟 `bioazUiDialog` 的单行标题不一样，硬迁会改视觉。
 * 设计规范里把它列为既有例外；这里做的只是「同一套例外不要有第四份拷贝」：
 * 参数全屏面板、DMPK 报价前预览、肿瘤报价预览原本各自手写一遍遮罩、
 * 各自挂一颗关闭键，改一处得改三处。
 *
 * 正文和底部由调用方给——三处的正文结构本来就不同（分组表单 / 预览表格），
 * 强行也参数化只会得到一个到处是 if 的壳。壳负责的是遮罩、层级、Esc、
 * 关闭键这几件每次都一样的事。
 */
export function PreviewModal({ eyebrow, title, ariaLabel, className, children, onClose }: {
  /** 标题上面那行小标签，比如「参数补全」「报价前确认」 */
  eyebrow: string;
  title: string;
  /** 读屏用的名字，不传就用标题 */
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dismiss = useModalDismiss(onClose);
  if (typeof document === "undefined") return null;

  /* 一律 portal 到 body。参数全屏面板必须这样——review.css 有一条
     `.parameterTaskCard *` 把 transition / transform 全清零，留在卡片子树里
     回顶按钮的进出动画会被那条一起清掉。其余两处 portal 不影响，
     但三处走同一条路，才不会出现「有一个弹窗被下面那层盖住」这种事。 */
  return createPortal(
    <div className="modalBackdrop" role="presentation" {...dismiss}>
      <section className={cn("previewModal", className)} role="dialog" aria-modal="true" aria-label={ariaLabel ?? title}>
        <header>
          <div><span>{eyebrow}</span><h2>{title}</h2></div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
