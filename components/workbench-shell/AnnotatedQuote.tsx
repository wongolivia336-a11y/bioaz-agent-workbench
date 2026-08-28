"use client";

import { ArrowRight, FileSpreadsheet, FileText, MessageSquare } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { ScrollTopButton } from "../ui/ScrollTopButton";
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
 * 带批注的报价：纸面 + 右栏批注，两边互相定位。
 *
 * 为什么抽出来
 * ----------------------------------------------------------------------
 * 同一屏现在有两个落点：站内信里的产物预览弹窗，和会话右侧那个铺开成画布的
 * 面板。两处各写一份，迟早会分叉成「弹窗里能点、画布里不能点」这种事。
 *
 * 为什么两栏必须互相认得
 * ----------------------------------------------------------------------
 * 审批人在批注台上看到的是：被批的那几行有记号，右栏一列批注。撰写人拿回这一版
 * 之后，如果两栏各说各的，他就得对着右栏的文字在纸上找行——而「哪一行」正是
 * 批注里最要紧的那个信息。所以点右栏一条，纸面滚过去并亮起；点纸面一行，
 * 右栏那条亮起。
 *
 * 两种形态都要有：DMPK 的产物本来就是一 Word 一 Excel，报价书给客户看，
 * 计算表推导单价。复核和返工都要在两者之间来回。
 */
export function AnnotatedQuote({ notes = [], initialForm = "sheet", className, toolbarExtra, noteAction }: {
  notes?: QuoteNote[];
  initialForm?: "sheet" | "doc";
  className?: string;
  /** 工具条右端的附加内容，比如下载按钮。 */
  toolbarExtra?: React.ReactNode;
  /* 每条批注下面挂的动作。QA 那边每张审核卡自带「采纳 / 忽略」，
     是同一个道理：**要做的事就长在说明它的那段话下面**，
     不要在别处再列一份一模一样的清单。 */
  noteAction?: (note: QuoteNote) => React.ReactNode;
}) {
  const [form, setForm] = useState<"sheet" | "doc">(initialForm);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const byAnchor = new Map(notes.map((note) => [note.anchorId, note]));
  const blockingCount = notes.filter((note) => note.severity === "blocking").length;

  /** 选中一条锚点：纸面滚到它、亮起来。它在当前这一版纸上不存在就先切过去。 */
  const focusAnchor = (anchorId: string) => {
    setActiveAnchor(anchorId);
    const targetForm = quoteAnchorInDoc(anchorId) ? form : "sheet";
    if (targetForm !== form) setForm(targetForm);
    /* 切了形态要等新的一版纸渲染出来才找得到那一行。 */
    window.requestAnimationFrame(() => {
      scrollRef.current?.querySelector(`[data-anchor="${anchorId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  /* 纸面上点一行:整张纸交给一个事件,不必给 QuotePaper 再加一路回调——
     每一行本来就带着 data-anchor。 */
  const onPaperClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchorId = (event.target as HTMLElement).closest<HTMLElement>("[data-anchor]")?.dataset.anchor;
    if (!anchorId || !byAnchor.has(anchorId)) return;
    setActiveAnchor(anchorId);
  };

  const rowClass = (id: string) => {
    const note = byAnchor.get(id);
    if (!note) return "";
    return `hasNote is-${note.severity}${activeAnchor === id ? " isActive" : ""}`;
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

  return (
    <div className={cn("annotatedQuote", className)}>
      {/* 同一份报价的两种形态，共用一套锚点——切视图不丢批注。
          跟批注台上那个切换器是同一个东西，长得也该一样。 */}
      <div className="annotatedQuoteBar">
        <div className="quoteFormSwitch" role="tablist" aria-label="报价形态">
          <button type="button" role="tab" aria-selected={form === "sheet"} className={form === "sheet" ? "active" : ""} onClick={() => setForm("sheet")}>
            <FileSpreadsheet size={14} />计算表
          </button>
          <button type="button" role="tab" aria-selected={form === "doc"} className={form === "doc" ? "active" : ""} onClick={() => setForm("doc")}>
            <FileText size={14} />报价书
          </button>
        </div>
        {toolbarExtra}
      </div>

      <div className={cn("quotePreviewBody", notes.length > 0 && "hasNotes")}>
        {/* 回顶按钮挂在纸面这一栏上，不挂在整个 body 上：挂外面它会飘到
            右栏批注上方，挡住的正是要照着改的那几条。 */}
        <div className="quotePreviewPaperWrap">
          <div className="quotePreviewPaper" ref={scrollRef} onClick={onPaperClick}>
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
                /* 外框长在 li 上、动作长在里面的 button 上——跟批注台那份清单
                   同一个写法。整条可点：读到哪一条，就想看它批在纸的哪一行。 */
                <li key={note.anchorId} className={cn(`is-${note.severity}`, activeAnchor === note.anchorId && "isActive")}>
                  <button className="quotePreviewNoteBody" type="button" onClick={() => focusAnchor(note.anchorId)}>
                    <span className="quotePreviewNoteHead">
                      <em className="quoteNoteCat">{quoteNoteLabel(note)}</em>
                      <i className={`quoteNoteSev is-${note.severity}`}>{quoteNoteSeverityLabel[note.severity]}</i>
                    </span>
                    <strong>{quoteAnchorLabel(note.anchorId)}</strong>
                    {/* 报价书上没有这一行时说清楚它在哪儿。不说的话，右栏三条、
                        纸上只标了一条，看着就像记号丢了。点它会连带切到计算表。 */}
                    {form === "doc" && !quoteAnchorInDoc(note.anchorId) ? (
                      <span className="quoteNoteOffForm">这一条批在计算表上 · 去看</span>
                    ) : null}
                    {note.suggested ? (
                      <span className="quoteNoteDiff">
                        <s>{quoteCurrentValue(note.anchorId) || "—"}</s>
                        <ArrowRight size={11} aria-hidden="true" />
                        <b>{note.suggested}</b>
                      </span>
                    ) : null}
                    <span className="quotePreviewNoteText">{note.text}</span>
                    <span className="quoteNoteBy">{note.author} · {note.authorRole} · {note.at}</span>
                  </button>
                  {noteAction ? <div className="quotePreviewNoteAction">{noteAction(note)}</div> : null}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
