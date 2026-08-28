"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useModalDismiss } from "../ui/useModalDismiss";
import { AnnotatedQuote } from "./AnnotatedQuote";
import type { QuoteNote } from "../../lib/workbench/quoteData";

/**
 * 带批注的报价预览弹窗。
 *
 * 内容本身由 AnnotatedQuote 渲染——同一屏还会以画布的形式长在会话右侧面板里，
 * 两处必须是同一个东西，否则迟早分叉成「弹窗里能点、画布里不能点」。
 * 这里只负责弹窗这层壳：标题、关闭、叠层。
 */
export function QuotePreviewModal({ notes = [], initialForm = "sheet", title, description, footer, stacked = false, onClose }: {
  notes?: QuoteNote[];
  initialForm?: "sheet" | "doc";
  title: string;
  description?: string;
  /** 额外的底部动作（比如下载）。不传就只有关闭。 */
  footer?: React.ReactNode;
  /** 开在另一个弹窗之上时抬一层——否则它会被下面那层盖住。 */
  stacked?: boolean;
  onClose: () => void;
}) {
  const dismiss = useModalDismiss(onClose);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={cn("modalBackdrop", stacked && "isStacked")} role="presentation" {...dismiss}>
      <section className="previewModal quotePreviewModal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <span>产物预览</span>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>

        <AnnotatedQuote notes={notes} initialForm={initialForm} />

        <footer className="quotePreviewFoot">
          {footer ?? <span />}
          <button className="reworkAction" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
