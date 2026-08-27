"use client";

import { ArrowRight, Check, CornerDownLeft, FileSearch } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import {
  quoteAnchorLabel,
  quoteCurrentValue,
  quoteNoteLabel,
  quoteNoteSeverityLabel,
  type QuoteNote,
} from "../../lib/workbench/quoteData";

/**
 * 退回修订卡。被驳回的报价点「进入会话处理」回到原会话时，落在对话末尾。
 *
 * 为什么要有它
 * ----------------------------------------------------------------------
 * 「回到那个会话」只做到一半是没用的。回去了，但**要改什么不在眼前**——
 * 撰写人还得切回站内信、逐条读批注、记住哪几行，再切回来改。
 * 那正是这套东西要消灭的来回。
 *
 * 所以批注跟着人一起回到会话里，变成一张可以照着做的清单：
 * 哪一行、现在是多少、建议改成多少、谁说的。
 *
 * 为什么不做「一键按建议值改」
 * ----------------------------------------------------------------------
 * 批注锚在报价单的条目上（quoteData 里那 15 个可编辑参数），
 * 而会话里收的是 DMPK 模块自己那套字段（fields.ts）。两套词表不是一一对应的，
 * 硬做一个只有个别字段能用的按钮，比不做更糟——**它会让人以为每条都能一键改**。
 * 等两套词表对齐了再说。
 *
 * 勾选是「我改完这一条了」，纯本地。它不改任何状态，只是让人在一屏之内
 * 记住自己走到哪儿了——改一条勾一条，本来就是人会做的事。
 */
export function ReworkCard({ notes, reason, by, at, onOpenQuote }: {
  notes: QuoteNote[];
  /** 驳回时写的理由。它跟逐条批注不是一回事：一个是总的判断，一组是具体的账。 */
  reason?: string;
  by: string;
  at: string;
  /** 打开被退回的那份报价（带批注标记）。没有就不显示这个动作。 */
  onOpenQuote?: () => void;
}) {
  const [done, setDone] = useState<string[]>([]);
  const blocking = notes.filter((note) => note.severity === "blocking");
  const advisory = notes.filter((note) => note.severity === "advisory");
  const leftToDo = blocking.filter((note) => !done.includes(note.anchorId)).length;

  const toggle = (anchorId: string) =>
    setDone((current) => current.includes(anchorId)
      ? current.filter((id) => id !== anchorId)
      : [...current, anchorId]);

  const renderNote = (note: QuoteNote) => {
    const isDone = done.includes(note.anchorId);
    return (
      <li key={note.anchorId} className={cn("reworkNote", `is-${note.severity}`, isDone && "isDone")}>
        <button
          type="button"
          className="reworkCheck"
          role="checkbox"
          aria-checked={isDone}
          aria-label={`标记「${quoteAnchorLabel(note.anchorId)}」已改`}
          onClick={() => toggle(note.anchorId)}
        >
          {isDone ? <Check size={12} /> : null}
        </button>
        <div className="reworkNoteBody">
          <div className="reworkNoteHead">
            <em className="quoteNoteCat">{quoteNoteLabel(note)}</em>
            <strong>{quoteAnchorLabel(note.anchorId)}</strong>
            {note.suggested ? (
              <span className="quoteNoteDiff">
                <s>{quoteCurrentValue(note.anchorId) || "—"}</s>
                <ArrowRight size={11} aria-hidden="true" />
                <b>{note.suggested}</b>
              </span>
            ) : null}
          </div>
          <p>{note.text}</p>
        </div>
      </li>
    );
  };

  return (
    <section className="reworkCard" aria-label="退回修订">
      <header>
        <span className="reworkBadge"><CornerDownLeft size={14} aria-hidden="true" /></span>
        <div>
          <strong>这一版被退回了</strong>
          <small>{by} · {at}</small>
        </div>
        {/* 还剩几条必须改的。这是这张卡唯一需要「读一眼就知道」的数字。 */}
        <i className={cn("reworkRemaining", !leftToDo && "isClear")}>
          {leftToDo ? `还剩 ${leftToDo} 条必须修订` : "必须修订已全部处理"}
        </i>
      </header>

      {reason ? <p className="reworkReason">{reason}</p> : null}

      {blocking.length ? (
        <div className="reworkGroup">
          <span>{quoteNoteSeverityLabel.blocking}</span>
          <ul>{blocking.map(renderNote)}</ul>
        </div>
      ) : null}

      {advisory.length ? (
        <div className="reworkGroup">
          <span>{quoteNoteSeverityLabel.advisory}</span>
          <ul>{advisory.map(renderNote)}</ul>
        </div>
      ) : null}

      {onOpenQuote ? (
        <footer>
          {/* 清单给结论，原件给上下文。改一个数之前多半要先看看它周围那几行。 */}
          <button className="secondaryButton compact" type="button" onClick={onOpenQuote}>
            <FileSearch size={14} />查看退回的报价
          </button>
        </footer>
      ) : null}
    </section>
  );
}
