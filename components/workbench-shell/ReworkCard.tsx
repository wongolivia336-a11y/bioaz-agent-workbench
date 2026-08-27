"use client";

import { ArrowRight, Check, ChevronDown, CornerDownLeft, FileSearch, Maximize2, RefreshCw, Undo2, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useModalDismiss } from "../ui/useModalDismiss";
import { ScrollTopButton } from "../ui/ScrollTopButton";
import { QuotePreviewModal } from "./QuotePreviewModal";
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
 * 为什么默认折叠
 * ----------------------------------------------------------------------
 * 三条批注展开就有半屏高，把它上面的对话整个顶出视野——而这张卡是长在
 * 输入框上方的，它越高，能看见的上下文越少。折叠态先答一句「几条、还剩几条」，
 * 那是一眼要知道的；具体怎么改，是决定要做的时候才展开的事。
 *
 * 展开之后给固定高度加内部滚动，跟参数收集卡一个道理：
 * 卡片可以长，但不能长到把对话挤没。真要摊开逐条看，走全屏。
 */
export type ReworkNoteState = "pending" | "accepted" | "deferred";

/** 数字同事对一条批注给出的处理方案。有建议值的照建议值改，没有的按批注修订表述。 */
export function reworkProposal(note: QuoteNote, currentValue?: string) {
  const label = quoteAnchorLabel(note.anchorId);
  if (note.suggested) {
    const from = currentValue || quoteCurrentValue(note.anchorId) || "当前值";
    return `将「${label}」由 ${from} 调整为 ${note.suggested}，并按新值重算整单。`;
  }
  return `按批注修订「${label}」的表述，重新生成后送审。`;
}

type ReworkProps = {
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
  /** 被退回的那份产物上的批注,用于「查看退回的报价」。 */
  quoteNotes?: QuoteNote[];
};

export function ReworkCard(props: ReworkProps) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const { notes, by, at, states } = props;

  const blocking = notes.filter((note) => note.severity === "blocking");
  const settled = (note: QuoteNote) => (states[note.anchorId] ?? "pending") !== "pending";
  const leftToDo = blocking.filter((note) => !settled(note)).length;

  const summary = (
    <i className={cn("reworkRemaining", !leftToDo && "isClear")}>
      {leftToDo ? `待处理 ${leftToDo} 条必须修订` : "必须修订已全部处理"}
    </i>
  );

  return (
    <>
      <section className={cn("reworkCard", open && "isOpen")} aria-label="退回修订">
        {/* 整个头部都是展开开关:卡一折起来,那颗小箭头就是唯一的入口,
            而人会先去点标题。 */}
        <header>
          <button
            className="reworkToggle"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="reworkBadge"><CornerDownLeft size={14} aria-hidden="true" /></span>
            <span className="reworkTitle">
              <strong>本版已退回修订</strong>
              <small>{by} · {at} · 共 {notes.length} 条批注</small>
            </span>
            {summary}
            <ChevronDown size={15} className="reworkChevron" aria-hidden="true" />
          </button>
          {/* 全屏跟参数收集卡同一颗图标、同一个位置——同样的动作该长成同样的样子。 */}
          <button
            className="reworkFullscreen"
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label="全屏查看全部批注"
            title="全屏查看全部批注"
          >
            <Maximize2 size={14} />
          </button>
        </header>

        {open ? <ReworkBody {...props} scrollable /> : null}
      </section>

      {fullscreen ? <ReworkModal {...props} onClose={() => setFullscreen(false)} /> : null}
    </>
  );
}

/** 卡里和全屏里是同一份内容，只是容器不同——两处各写一份迟早分叉。 */
function ReworkBody({ notes, reason, states, currentValueOf, onAccept, onDefer, onReset, onRegenerate, quoteNotes, scrollable = false }: ReworkProps & { scrollable?: boolean }) {
  /* 「查看退回的报价」自己管一个弹窗,不往外抛回调:它开在卡片(或全屏)之上,
     stacked 抬一层,否则会被下面那层盖住——这个 bug 在截图里就是那样。 */
  const [quoteOpen, setQuoteOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const blocking = notes.filter((note) => note.severity === "blocking");
  const advisory = notes.filter((note) => note.severity === "advisory");
  const settled = (note: QuoteNote) => (states[note.anchorId] ?? "pending") !== "pending";
  const leftToDo = blocking.filter((note) => !settled(note)).length;
  const valueOf = (anchorId: string) => currentValueOf?.(anchorId) || quoteCurrentValue(anchorId) || "—";

  const renderNote = (note: QuoteNote) => {
    const state = states[note.anchorId] ?? "pending";
    return (
      <li key={note.anchorId} className={cn("reworkNote", `is-${note.severity}`, state !== "pending" && "isSettled")}>
        <div className="reworkNoteMain">
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
          {/* 批注原话先摆着——方案是对它的解读，不是它的替代。 */}
          <p className="reworkNoteQuote">{note.text}</p>
          <p className="reworkNotePlan"><span>处理方案</span>{reworkProposal(note, valueOf(note.anchorId))}</p>
        </div>

        {/* 动作靠右，但横着排在自己那一行——挤成一条窄竖列会让两个按钮
            又瘦又高，读起来像被塞在边角上。 */}
        <div className="reworkNoteSide">
          {state === "pending" ? (
            <>
              <button className="reworkAction isPrimary" type="button" onClick={() => onAccept(note)}>采纳方案</button>
              <button className="reworkAction" type="button" onClick={() => onDefer(note)}>另行说明</button>
            </>
          ) : (
            <>
              <p className="reworkNoteState">
                <Check size={12} aria-hidden="true" />
                {state === "accepted" ? "已采纳" : "改由你说明"}
              </p>
              {/* 决定要能反悔。改的是报价，点错一下代价不小。 */}
              <button className="reworkAction isGhost" type="button" onClick={() => onReset(note)}>
                <Undo2 size={12} aria-hidden="true" />撤销
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <div className={cn("reworkBody", scrollable && "isScrollable")} ref={scrollable ? bodyRef : undefined}>
        {reason ? <p className="reworkReason">{reason}</p> : null}
        <p className="reworkLead">
          已逐条核对 {notes.length} 条批注，处理方案如下。逐条采纳，采纳后可撤销。
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
      </div>
      {/* 卡里那 320px 也是会滚到底的。回顶按钮浮在页脚上方一点，
          压不到「重新生成报价单」——那颗按钮任何时候都得点得到。 */}
      {scrollable ? <ScrollTopButton targetRef={bodyRef} /> : null}

      <footer className="reworkFoot">
        {/* 清单给结论，原件给上下文。改一个数之前多半要先看看它周围那几行——
            而且看到的应该就是审批人当时那一屏：行内记号 + 右栏批注。 */}
        <button className="reworkAction" type="button" onClick={() => setQuoteOpen(true)}>
          <FileSearch size={14} aria-hidden="true" />查看退回的报价
        </button>
        {/* 重出一版要等必须修订都处理完——留着一条没定就重算，
            出来的还是一版会被退回的报价。 */}
        {onRegenerate ? (
          <button className="reworkAction isPrimary" type="button" disabled={leftToDo > 0} onClick={onRegenerate}>
            <RefreshCw size={14} aria-hidden="true" />重新生成报价单
          </button>
        ) : null}
      </footer>

      {quoteOpen ? (
        <QuotePreviewModal
          title="被退回的报价"
          description="审批人复核时看到的就是这一屏"
          notes={quoteNotes ?? notes}
          stacked
          onClose={() => setQuoteOpen(false)}
        />
      ) : null}
    </>
  );
}

/** 全屏。叉号、Esc、点遮罩三条路都能关，跟这套界面里其他弹窗一致。 */
function ReworkModal({ onClose, ...props }: ReworkProps & { onClose: () => void }) {
  const dismiss = useModalDismiss(onClose);
  const scrollRef = useRef<HTMLDivElement>(null);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modalBackdrop" role="presentation" {...dismiss}>
      <section className="previewModal reworkModal" role="dialog" aria-modal="true" aria-label="退回修订">
        <header>
          <div><span>退回修订</span><h2>{props.by} · {props.at}</h2></div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="reworkModalBody" ref={scrollRef}>
          <ReworkBody {...props} />
        </div>
        {/* 批注多的时候要能一键回顶。挂在滚动容器外面——放进去会跟着内容滚走。 */}
        <ScrollTopButton targetRef={scrollRef} />
      </section>
    </div>,
    document.body,
  );
}
