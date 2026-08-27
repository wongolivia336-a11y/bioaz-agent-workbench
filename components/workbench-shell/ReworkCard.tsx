"use client";

import { ArrowRight, Check, CornerDownLeft, FileSearch, RefreshCw, Undo2 } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  quoteAnchorLabel,
  quoteCurrentValue,
  quoteNoteLabel,
  quoteNoteSeverityLabel,
  type QuoteNote,
} from "../../lib/workbench/quoteData";

/**
 * 退回修订卡。被驳回的报价点「进入会话处理」回到原会话时，落在输入框上方。
 *
 * 它是一次交接，不是一张便签
 * ----------------------------------------------------------------------
 * 第一版把它做成了「人自己照着改的清单」——一排勾选框。那是错的：
 * 那样的话数字同事在这一步什么都没做，只是把纸条转交了一下。
 *
 * 退回给撰写人，同时也是**交接给他的数字同事**。所以这里是数字同事读完批注
 * 之后给出的一组处理方案，人只做核对与采纳。这跟报价里那张
 * 「调整本次报价 → 确认调整」是同一个交互：**由它提议，由人决定。**
 *
 * 位置跟交接卡一致：都长在输入框上方、与输入框同宽。
 * 它们是同一类东西——需要人当场做一个决定的卡片，
 * 而决定做完之后紧接着就是打字，所以它该待在手指已经在的地方。
 *
 * 为什么不做「一次全部采纳」
 * ----------------------------------------------------------------------
 * 因为改的是报价。一次点掉全部，等于把「这几个数为什么该这样改」跳过去了，
 * 而下一版还要再送一次审——真正省时间的是一次改对，不是一次点完。
 */
export type ReworkNoteState = "pending" | "accepted" | "deferred";

/** 数字同事对一条批注给出的处理方案。有建议值的照建议值改，没有的按批注调整表述。 */
export function reworkProposal(note: QuoteNote, currentValue?: string) {
  const label = quoteAnchorLabel(note.anchorId);
  if (note.suggested) {
    const from = currentValue || quoteCurrentValue(note.anchorId) || "当前值";
    return `将「${label}」由 ${from} 调整为 ${note.suggested}，并按新值重算整单。`;
  }
  return `按批注修订「${label}」的表述，重新生成后送审。`;
}

export function ReworkCard({ notes, reason, by, at, states, currentValueOf, onAccept, onDefer, onReset, onRegenerate, onOpenQuote }: {
  notes: QuoteNote[];
  /** 驳回时写的总判断。它跟逐条批注不是一回事：一个是结论，一组是账。 */
  reason?: string;
  by: string;
  at: string;
  states: Record<string, ReworkNoteState>;
  /** 取这一条锚点的现值。能映射到会话参数的走会话，其余走报价单。 */
  currentValueOf?: (anchorId: string) => string;
  onAccept: (note: QuoteNote) => void;
  onDefer: (note: QuoteNote) => void;
  /** 撤销这一条的决定。决定要能反悔——尤其当它改的是报价。 */
  onReset: (note: QuoteNote) => void;
  /** 必须修订都处理完之后才给：重出一版。 */
  onRegenerate?: () => void;
  onOpenQuote?: () => void;
}) {
  const blocking = notes.filter((note) => note.severity === "blocking");
  const advisory = notes.filter((note) => note.severity === "advisory");
  const settled = (note: QuoteNote) => (states[note.anchorId] ?? "pending") !== "pending";
  const leftToDo = blocking.filter((note) => !settled(note)).length;
  const valueOf = (anchorId: string) => currentValueOf?.(anchorId) || quoteCurrentValue(anchorId) || "—";

  const renderNote = (note: QuoteNote) => {
    const state = states[note.anchorId] ?? "pending";
    return (
      <li key={note.anchorId} className={cn("reworkNote", `is-${note.severity}`, state !== "pending" && "isSettled")}>
        <div className="reworkNoteHead">
          <i className={`quoteNoteSev is-${note.severity}`}>{quoteNoteSeverityLabel[note.severity]}</i>
          <em className="quoteNoteCat">{quoteNoteLabel(note)}</em>
          <strong>{quoteAnchorLabel(note.anchorId)}</strong>
          {note.suggested ? (
            <span className="quoteNoteDiff">
              <s>{valueOf(note.anchorId)}</s>
              <ArrowRight size={11} aria-hidden="true" />
              <b>{note.suggested}</b>
            </span>
          ) : null}
        </div>
        {/* 批注原话先摆着——方案是对它的解读，不是它的替代。
            人要能看到原话再决定采不采纳。 */}
        <p className="reworkNoteQuote">{note.text}</p>
        <p className="reworkNotePlan"><span>处理方案</span>{reworkProposal(note, valueOf(note.anchorId))}</p>

        {state === "pending" ? (
          <div className="reworkNoteActions">
            <button className="reworkAction isPrimary" type="button" onClick={() => onAccept(note)}>采纳方案</button>
            <button className="reworkAction" type="button" onClick={() => onDefer(note)}>另行说明</button>
          </div>
        ) : (
          <div className="reworkNoteActions isSettledRow">
            <p className="reworkNoteState">
              <Check size={12} aria-hidden="true" />
              {state === "accepted" ? "已采纳，将在重新生成时应用" : "改由你说明，请在下方输入"}
            </p>
            {/* 决定要能反悔。改的是报价，点错一下代价不小，
                而「已经定了就不给改」只会让人不敢点。 */}
            <button className="reworkAction isGhost" type="button" onClick={() => onReset(note)}>
              <Undo2 size={12} aria-hidden="true" />撤销
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="reworkCard" aria-label="退回修订">
      <header>
        <span className="reworkBadge"><CornerDownLeft size={14} aria-hidden="true" /></span>
        <div>
          <strong>本版已退回修订</strong>
          <small>{by} · {at}</small>
        </div>
        <i className={cn("reworkRemaining", !leftToDo && "isClear")}>
          {leftToDo ? `待处理 ${leftToDo} 条必须修订` : "必须修订已全部处理"}
        </i>
      </header>

      {reason ? <p className="reworkReason">{reason}</p> : null}

      <p className="reworkLead">
        已逐条核对{notes.length ? ` ${notes.length} 条批注` : ""}，处理方案如下。逐条采纳，采纳后可撤销。
      </p>

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

      <footer>
        {onOpenQuote ? (
          /* 清单给结论，原件给上下文。改一个数之前多半要先看看它周围那几行。 */
          <button className="reworkAction" type="button" onClick={onOpenQuote}>
            <FileSearch size={14} aria-hidden="true" />查看退回的报价
          </button>
        ) : <span />}
        {/* 重出一版要等必须修订都处理完——留着一条没定就重算，
            出来的还是一版会被退回的报价。 */}
        {onRegenerate ? (
          <button className="reworkAction isPrimary" type="button" disabled={leftToDo > 0} onClick={onRegenerate}>
            <RefreshCw size={14} aria-hidden="true" />重新生成报价单
          </button>
        ) : null}
      </footer>
    </section>
  );
}
