"use client";

import { ArrowRight, FileSpreadsheet, FileText, MessageSquare, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { ScrollTopButton } from "../ui/ScrollTopButton";
import { useModalDismiss } from "../ui/useModalDismiss";
import { QuoteDocPaper, QuoteSheetPaper } from "./QuotePaper";
import {
  quoteAnchorInDoc,
  quoteAnchorLabel,
  quoteCurrentValue,
  quoteNoteLabel,
  quoteNoteSeverityLabel,
  type QuoteNote,
} from "../../lib/workbench/quoteData";

/**
 * 带批注的报价预览。
 *
 * 为什么两边看到的必须是同一屏
 * ----------------------------------------------------------------------
 * 审批人在批注台上看到的是：纸面上被批的那几行有记号，右栏一列批注。
 * 撰写人拿回这一版之后，如果只给他一份干净的纸，他就得对着别处的清单
 * 在纸上找行——而「哪一行」正是批注最要紧的那个信息。
 *
 * 所以这里把审批人那一屏原样给出来：同一份 QuotePaper、同一套行内记号、
 * 同一列批注。区别只有一个——他不能改批注，只能读。
 *
 * 两种形态都要有：DMPK 的产物本来就是一 Word 一 Excel，
 * 报价书给客户看，计算表推导单价。复核和返工都要在两者之间来回。
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
  const [form, setForm] = useState<"sheet" | "doc">(initialForm);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dismiss = useModalDismiss(onClose);

  const byAnchor = new Map(notes.map((note) => [note.anchorId, note]));
  const rowClass = (id: string) => {
    const note = byAnchor.get(id);
    return note ? `hasNote is-${note.severity}` : "";
  };
  const bubble = (id: string) => {
    const note = byAnchor.get(id);
    if (!note) return null;
    return (
      <i className="quoteRowBubble" title={`${quoteNoteSeverityLabel[note.severity]}：${note.text}`} aria-label="已批注">
        <MessageSquare size={10} />
      </i>
    );
  };

  const blockingCount = notes.filter((note) => note.severity === "blocking").length;

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
          {/* 同一份报价的两种形态，共用一套锚点——切视图不丢批注。
              跟批注台上那个切换器是同一个东西，长得也该一样。 */}
          <div className="quoteFormSwitch" role="tablist" aria-label="报价形态">
            <button type="button" role="tab" aria-selected={form === "sheet"} className={form === "sheet" ? "active" : ""} onClick={() => setForm("sheet")}>
              <FileSpreadsheet size={14} />计算表
            </button>
            <button type="button" role="tab" aria-selected={form === "doc"} className={form === "doc" ? "active" : ""} onClick={() => setForm("doc")}>
              <FileText size={14} />报价书
            </button>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>

        <div className={cn("quotePreviewBody", notes.length > 0 && "hasNotes")}>
          {/* 回顶按钮挂在纸面这一栏上，不挂在整个 body 上：挂外面它会飘到
              右栏批注上方，挡住的正是要照着改的那几条。 */}
          <div className="quotePreviewPaperWrap">
            <div className="quotePreviewPaper" ref={scrollRef}>
              {form === "sheet"
                ? <QuoteSheetPaper rowClass={rowClass} bubble={bubble} />
                : <QuoteDocPaper rowClass={rowClass} bubble={bubble} />}
            </div>
            <ScrollTopButton targetRef={scrollRef} />
          </div>

          {/* 右栏只读。撰写人不是来批注的，是来照着改的——
              给他一个能落笔的输入框，反而会让人以为可以在这儿回话。 */}
          {notes.length ? (
            <aside className="quotePreviewNotes">
              <header>
                <strong>人工批注</strong>
                <small>{notes.length} 条{blockingCount ? ` · 必须修订 ${blockingCount} 条` : ""}</small>
              </header>
              <ul>
                {notes.map((note) => (
                  <li key={note.anchorId} className={`is-${note.severity}`}>
                    <div className="quotePreviewNoteHead">
                      <em className="quoteNoteCat">{quoteNoteLabel(note)}</em>
                      <i className={`quoteNoteSev is-${note.severity}`}>{quoteNoteSeverityLabel[note.severity]}</i>
                    </div>
                    <strong>{quoteAnchorLabel(note.anchorId)}</strong>
                    {/* 报价书上没有这一行时说清楚它在哪儿。不说的话，右栏三条、
                        纸上只标了一条，看着就像记号丢了。 */}
                    {form === "doc" && !quoteAnchorInDoc(note.anchorId) ? (
                      <button className="quoteNoteOffForm" type="button" onClick={() => setForm("sheet")}>
                        这一条批在计算表上 · 去看
                      </button>
                    ) : null}
                    {note.suggested ? (
                      <span className="quoteNoteDiff">
                        <s>{quoteCurrentValue(note.anchorId) || "—"}</s>
                        <ArrowRight size={11} aria-hidden="true" />
                        <b>{note.suggested}</b>
                      </span>
                    ) : null}
                    <p>{note.text}</p>
                    <span className="quoteNoteBy">{note.author} · {note.authorRole} · {note.at}</span>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>

        <footer className="quotePreviewFoot">
          {footer ?? <span />}
          <button className="reworkAction" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
