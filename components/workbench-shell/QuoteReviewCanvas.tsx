"use client";

import { ArrowRight, Check, FileSpreadsheet, FileText, Highlighter, MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "../ui";
import { QuoteDocPaper, QuoteSheetPaper, money, quoteCategories } from "./QuotePaper";
import { useDismissableLayer } from "./useDismissableLayer";
import {
  quoteItems,
  quoteMeta,
  quoteNoteCategoryLabel,
  quoteNoteLabel,
  quoteNoteNeedsValue,
  quoteNoteSeverityLabel,
  quoteParams,
  quoteSubtotals,
  type QuoteNote,
  type QuoteNoteCategory,
} from "../../lib/workbench/quoteData";
import type { Ticket } from "../../lib/workbench/ticketData";

/**
 * 落定前的确认。
 *
 * 这两个动作都改变归属并写进流转记录:退回之后这件事在提交人手上等他改,
 * 通过之后也回到提交人手上但已收到终态——当场都撤不回来。
 * 所以先把「交给谁、随行带什么、之后会发生什么」摆一遍,而不是点一下就走。
 */
function QuoteDecisionDialog({ kind, ticket, notes, reviewer, anchorLabel, onClose, onConfirm }: {
  kind: "reject" | "archive";
  ticket: Ticket;
  notes: QuoteNote[];
  reviewer: string;
  anchorLabel: (id: string) => string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const reject = kind === "reject";
  const blocking = notes.filter((note) => note.severity === "blocking");
  const title = reject ? "退回修订" : "通过";

  /* 用 components/ui 的 Dialog。这张卡曾经是整份手抄的 backdrop + header +
     footer,跟 Dialog 渲染的一模一样——手抄的代价是 Esc 层栈、遮罩用
     mousedown 还是 click 这些行为,每处都要重新做对一遍。 */
  return (
    <Dialog
      title={title}
      description={ticket.title}
      className="quoteDecisionDialog"
      onClose={onClose}
      footer={
        <>
          <button className="secondaryButton compact" type="button" onClick={onClose}>取消</button>
          <button className="primaryButton compact" type="button" onClick={onConfirm}>{reject ? `确认退回 ${ticket.from}` : `确认通过 · 交回 ${ticket.from}`}</button>
        </>
      }
    >
      <dl className="quoteDecisionFacts">
        <div><dt>交接给</dt><dd>{`${ticket.from}（${ticket.fromRole}）`}</dd></div>
        <div><dt>操作人</dt><dd>{reviewer}</dd></div>
        <div><dt>状态</dt><dd>{reject ? "待处理 → 已驳回" : "待处理 → 已通过"}</dd></div>
        <div><dt>随行产物</dt><dd>{ticket.attachments.map((file) => file.name).join("、") || "无"}</dd></div>
      </dl>

      {reject ? (
        <section className="quoteDecisionNotes">
          <h3>随行退回的批注（{notes.length} 条，其中必须修订 {blocking.length} 条）</h3>
          <ul>
            {notes.map((note) => (
              <li key={note.anchorId}>
                <i className={`quoteNoteSev is-${note.severity}`}>{quoteNoteSeverityLabel[note.severity]}</i>
                {/* 分类要跟着退回去。自定义那一类尤其:复核人特意起的名字,
                    正是这条批注的分类本身,summary 里丢掉它就只剩一句白话。 */}
                <em className="quoteNoteCat">{quoteNoteLabel(note)}</em>
                <strong>{anchorLabel(note.anchorId)}</strong>
                {note.suggested ? <b>建议值 {note.suggested}</b> : null}
                <p>{note.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="quoteDecisionNote">
          {notes.length ? `${notes.length} 条建议修订随这条消息留档，不影响通过。` : "本次复核未提出批注。"}
        </p>
      )}
    </Dialog>
  );
}

/** 草稿:还没落盘的一条批注,连同它在纸面上的纵向位置。 */
type Draft = { anchorId: string; quote: string; top: number; note: QuoteNote };

/**
 * 报价审核画布。跟 QA 审核台同构,不是另起一套:
 *
 *   批注是一个**模式**,不是"选中就弹"。不分模式的话,想复制一段文字、想双击选个词,
 *   都会被一张卡打断——而读原件的时间远多于写批注的时间。
 *   进了模式,纸面透出一层底色,你知道自己现在在批注。
 *
 *   选中文字 → 就地弹一张气泡卡。选中这个动作本身已经说了「我要说这一处」,
 *   再要求先点右侧再回来找位置,等于让人把同一件事说两遍。
 *
 *   右栏只做**记录**:已落盘的批注在那儿排着,点一条回到原文并可改写。
 *   录入发生在纸面上,不在右栏。
 *
 * 跟 QA 的两处差别,各有原因:
 *   1. 没有对话区。报价复核全程人工,拉一个 chatflow 进来只会长出「这里能问 AI 吗」
 *      的期待,而它确实不能。
 *   2. 批注带**建议值**。报价复核是算术:「这个数应该是 6 不是 2」是能写下来、
 *      也能被下一版直接核验的断言,而不是一句要人再读一遍的评语。
 */
export function QuoteReviewCanvas({ ticket, notes, onNotesChange, reviewer, reviewerRole, onReject, onArchive }: {
  ticket: Ticket;
  notes: Record<string, QuoteNote>;
  onNotesChange: (next: Record<string, QuoteNote>) => void;
  reviewer: string;
  reviewerRole: string;
  onReject: (summary: string) => void;
  onArchive: () => void;
}) {
  const [form, setForm] = useState<"sheet" | "doc">("sheet");
  const [annotateMode, setAnnotateMode] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  /* 待确认的处置。不叫 confirm——那个名字会跟全局的 window.confirm 撞上。 */
  const [pendingDecision, setPendingDecision] = useState<"reject" | "archive" | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  /* 点别处就收起气泡卡,跟侧栏菜单同一套。用 useDismissableLayer 而不是
     useModalDismiss:后者带遮罩语义,而这张卡是贴在原文旁边的浮层,不是模态——
     它不该把整页压暗,也不该拦住你去点下一行。
     选区是在 mouseup 之后才建卡的,而这里监听 pointerdown,所以不会自己关掉自己。 */
  const bubbleRef = useDismissableLayer<HTMLElement>(Boolean(draft), () => {
    setDraft(null);
    window.getSelection()?.removeAllRanges();
  });

  const noted = Object.values(notes);
  const blocking = noted.filter((note) => note.severity === "blocking").length;
  const categories = quoteCategories;
  /** 本单已经用过的自定义分类名,给输入框做候选。 */
  const usedCustomLabels = Array.from(new Set(
    noted.map((note) => note.customLabel?.trim()).filter((label): label is string => Boolean(label)),
  ));

  const anchorLabel = (id: string) =>
    quoteParams.find((param) => param.id === id)?.label
    ?? quoteItems.find((item) => item.id === id)?.item
    ?? quoteSubtotals.find((sub) => sub.id === id)?.label
    ?? id;

  const currentValue = (id: string) => {
    const param = quoteParams.find((item) => item.id === id);
    if (param) return param.value;
    const item = quoteItems.find((entry) => entry.id === id);
    return item?.unitPrice === undefined ? "" : money(item.unitPrice);
  };

  /* Esc 先收卡片、再退模式。一次退两层会让人以为自己点错了。 */
  useEffect(() => {
    if (!annotateMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (draft) { setDraft(null); window.getSelection()?.removeAllRanges(); return; }
      setAnnotateMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotateMode, draft]);

  /* 选中文字即批注。锚点从选区往上找最近那一行——选中说的是「这一处」,
     而「这一处」在报价单里天然就是一行:参数或计价项。 */
  const captureSelection = () => {
    if (!annotateMode) return;
    const selection = window.getSelection();
    const quote = selection?.toString().trim() ?? "";
    if (!quote || !selection?.rangeCount) return;
    const node = selection.anchorNode;
    const host = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-anchor]");
    if (!host) return;
    const anchorId = host.dataset.anchor!;
    const pane = paneRef.current;
    if (!pane) return;
    const top = host.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    setDraft({
      anchorId,
      quote,
      top,
      note: notes[anchorId] ?? {
        anchorId, category: "param", severity: "blocking", text: "",
        author: reviewer, authorRole: reviewerRole, at: "刚刚",
      },
    });
  };

  /** 从右栏点一条:回到原文位置改写它。录入始终发生在纸面上。 */
  const editNote = (note: QuoteNote) => {
    const pane = paneRef.current;
    const host = pane?.querySelector<HTMLElement>(`[data-anchor="${note.anchorId}"]`);
    if (!pane || !host) return;
    const top = host.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    host.scrollIntoView({ block: "center", behavior: "smooth" });
    setAnnotateMode(true);
    setDraft({ anchorId: note.anchorId, quote: note.quote ?? anchorLabel(note.anchorId), top, note });
  };

  /* 「其他」必须带名字才算一条批注。这是这个开口唯一的约束,也是它跟一个
     纯倾倒口的全部区别——分类名空着,右栏那条就只写着「其他」,读的人得点开
     正文才知道说的是什么。 */
  const draftReady = Boolean(
    draft?.note.text.trim()
    && (draft.note.category !== "custom" || draft.note.customLabel?.trim()),
  );

  const commit = () => {
    if (!draft || !draftReady) return;
    const note = { ...draft.note, quote: draft.quote, author: reviewer, authorRole: reviewerRole, at: "刚刚" };
    if (note.category === "custom") note.customLabel = note.customLabel?.trim();
    onNotesChange({ ...notes, [draft.anchorId]: note });
    setDraft(null);
    window.getSelection()?.removeAllRanges();
  };
  const remove = (id: string) => {
    const next = { ...notes };
    delete next[id];
    onNotesChange(next);
    if (draft?.anchorId === id) setDraft(null);
  };

  /* 有批注的行留个记号。阻断是琥珀、提醒是灰——严重度必须在原件上就读得出,
     不能只写在右栏,否则扫一遍原件不知道哪儿卡着。 */
  const rowClass = (id: string) => {
    const note = notes[id];
    const active = draft?.anchorId === id;
    return `${note ? `hasNote is-${note.severity}` : ""} ${active ? "isActive" : ""}`.trim();
  };
  const bubble = (id: string) => notes[id] ? <i className="quoteRowBubble" aria-label="已批注"><MessageSquare size={10} /></i> : null;

  return (
    <section className="workbenchView quoteReviewCanvas">
      <div className="quoteReviewHead">
        <div className="ticketDetailTitle">
          <h1>{quoteMeta.title}</h1>
          <p>报价复核 · 全程人工 · 复核人 {reviewer}</p>
        </div>
        <div className="quoteHeadTools">
          {/* 批注是模式。跟 QA 一样给一个明确的开关,而不是"选中就弹"。 */}
          <button
            className={`quoteAnnotateToggle ${annotateMode ? "isOn" : ""}`}
            type="button"
            aria-pressed={annotateMode}
            onClick={() => { setAnnotateMode((value) => !value); setDraft(null); }}
          >
            <Highlighter size={14} />{annotateMode ? "正在批注" : "开始批注"}
          </button>
          {/* 同一张报价的两种形态,共用一套锚点——切视图不丢批注。 */}
          <div className="quoteFormSwitch" role="tablist" aria-label="报价形态">
            <button type="button" role="tab" aria-selected={form === "sheet"} className={form === "sheet" ? "active" : ""} onClick={() => setForm("sheet")}>
              <FileSpreadsheet size={14} />计算表
            </button>
            <button type="button" role="tab" aria-selected={form === "doc"} className={form === "doc" ? "active" : ""} onClick={() => setForm("doc")}>
              <FileText size={14} />报价书
            </button>
          </div>
        </div>
      </div>

      <div className="quoteReviewBody">
        <div className={`quoteDocPane ${annotateMode ? "isAnnotating" : ""}`} ref={paneRef} onMouseUp={captureSelection}>
          {form === "sheet"
            ? <QuoteSheetPaper rowClass={rowClass} bubble={bubble} />
            : <QuoteDocPaper rowClass={rowClass} bubble={bubble} />}

          {/* 就地气泡卡。跟 QA 一个量级:引用 + 一行输入 + 去向,批注多数是一句话,
              给三行文本域等于暗示"你得写一段"。 */}
          {draft ? (
            <aside className="quoteNoteBubble" ref={bubbleRef} style={{ top: draft.top }} aria-label="批注">
              <blockquote>{draft.quote}<em>{anchorLabel(draft.anchorId)}</em></blockquote>

              <div className="quoteNoteCats">
                {(Object.keys(quoteNoteCategoryLabel) as QuoteNoteCategory[]).map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={draft.note.category === category ? "active" : ""}
                    onClick={() => setDraft({ ...draft, note: {
                      ...draft.note,
                      category,
                      suggested: quoteNoteNeedsValue[category] ? draft.note.suggested : undefined,
                      /* 切走就把自定义名清掉,跟 suggested 一个道理:留着它,提交出去的
                         就是一条自己用不上、下一个人看不懂的字段。 */
                      customLabel: category === "custom" ? draft.note.customLabel : undefined,
                    } })}
                  >
                    {quoteNoteCategoryLabel[category]}
                  </button>
                ))}
              </div>

              {/* 选了「其他」就得给它起个名字,否则不让提交。没名字的「其他」正是
                  那个会被塞满、最后没人看的桶;有名字的「交付周期未写」跟固定
                  那五类一样好读。候选项是本单已经用过的标签——同一件事被两个人
                  写成「描述有误」和「表述不清」,分类照样作废。 */}
              {draft.note.category === "custom" ? (
                <label className="quoteNoteCustom">
                  <span>分类名</span>
                  <input
                    value={draft.note.customLabel ?? ""}
                    placeholder="例如：表述有误、条款缺失"
                    list="quoteNoteCustomLabels"
                    onChange={(event) => setDraft({ ...draft, note: { ...draft.note, customLabel: event.target.value } })}
                  />
                  <datalist id="quoteNoteCustomLabels">
                    {usedCustomLabels.map((label) => <option key={label} value={label} />)}
                  </datalist>
                </label>
              ) : null}

              {/* 「现值 X → [建议值]」排成一行。原先只写了个光秃秃的数字加一个箭头,
                  两样都没有名字:那个数是现值还是建议值,得靠猜。而且它挤在一格
                  定死的窄列里,数字和箭头被折成上下两行,看着像排版坏了。 */}
              {quoteNoteNeedsValue[draft.note.category] ? (
                <label className="quoteNoteSuggest">
                  <span className="quoteNoteSuggestFrom">现值 <b>{currentValue(draft.anchorId) || "—"}</b></span>
                  <ArrowRight size={12} aria-hidden="true" />
                  <input
                    value={draft.note.suggested ?? ""}
                    placeholder="建议值"
                    onChange={(event) => setDraft({ ...draft, note: { ...draft.note, suggested: event.target.value } })}
                  />
                </label>
              ) : null}

              <div className="quoteNoteRow">
                <textarea
                  autoFocus
                  rows={1}
                  value={draft.note.text}
                  placeholder="添加批注…"
                  onChange={(event) => setDraft({ ...draft, note: { ...draft.note, text: event.target.value } })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commit(); }
                    if (event.key === "Escape") { event.stopPropagation(); setDraft(null); }
                  }}
                />
                <button className="quoteNoteSend" type="button" disabled={!draftReady} onClick={commit} aria-label="提交批注" title="提交批注（Enter）">
                  <Check size={14} />
                </button>
              </div>

              {/* 两档说的是「对方要做什么」,不是「我多生气」——必须修订会挡住归档,
                  建议修订随单留档但不拦。 */}
              <div className="quoteNoteKind" role="radiogroup" aria-label="处置要求">
                {(["blocking", "advisory"] as const).map((severity) => (
                  <button
                    key={severity}
                    type="button"
                    role="radio"
                    aria-checked={draft.note.severity === severity}
                    className={draft.note.severity === severity ? "isOn" : ""}
                    onClick={() => setDraft({ ...draft, note: { ...draft.note, severity } })}
                  >
                    {quoteNoteSeverityLabel[severity]}
                  </button>
                ))}
              </div>
            </aside>
          ) : null}
        </div>

        {/* 右栏只做记录。录入在纸面上发生,这里排的是已落盘的那些。 */}
        <aside className="quoteNotePane">
          <header>
            <strong>人工批注</strong>
            <small>{noted.length} 条{blocking ? ` · 必须修订 ${blocking} 条` : ""}</small>
          </header>
          <ul className="quoteNoteList">
            {noted.map((note) => (
              <li key={note.anchorId} className={`is-${note.severity}`}>
                {/* 删除跟标签同排,不再绝对定位压在卡上——它是这条批注的一个操作,
                    不是浮在上面的另一层。 */}
                <div className="quoteNoteHead">
                  <em className="quoteNoteCat">{quoteNoteLabel(note)}</em>
                  <i className={`quoteNoteSev is-${note.severity}`}>{quoteNoteSeverityLabel[note.severity]}</i>
                  <button className="quoteNoteRemove" type="button" aria-label={`删除对「${anchorLabel(note.anchorId)}」的批注`} onClick={() => remove(note.anchorId)}><Trash2 size={13} /></button>
                </div>
                <button className="quoteNoteOpen" type="button" onClick={() => editNote(note)}>
                  <strong>{anchorLabel(note.anchorId)}</strong>
                  {note.suggested ? (
                    <span className="quoteNoteDiff"><s>{currentValue(note.anchorId) || "—"}</s><ArrowRight size={11} /><b>{note.suggested}</b></span>
                  ) : null}
                  <p>{note.text}</p>
                  <span className="quoteNoteBy">{note.author} · {note.authorRole} · {note.at}</span>
                </button>
              </li>
            ))}
            {!noted.length ? <li className="quoteNoteEmpty">尚无批注</li> : null}
          </ul>
        </aside>
      </div>

      {/* 二次确认。两个动作都把这件事交回提交人并留痕,落定之后当场撤不回来
          ——所以先把「交给谁、带什么、之后怎样」摆一遍。 */}
      {pendingDecision ? (
        <QuoteDecisionDialog
          kind={pendingDecision}
          ticket={ticket}
          notes={noted}
          reviewer={reviewer}
          anchorLabel={anchorLabel}
          onClose={() => setPendingDecision(null)}
          onConfirm={() => {
            if (pendingDecision === "reject") onReject(`批注 ${noted.length} 条，其中必须修订 ${blocking} 条`);
            else onArchive();
            setPendingDecision(null);
          }}
        />
      ) : null}

      <footer className="ticketDetailActions">
        <p className="ticketDetailHint">
          {blocking ? `必须修订 ${blocking} 条` : noted.length ? `建议修订 ${noted.length} 条` : "尚无批注"}
        </p>
        <button className="secondaryButton compact" type="button" disabled={!noted.length} onClick={() => setPendingDecision("reject")}>
          退回修订
        </button>
        <button className="primaryButton compact" type="button" disabled={blocking > 0} onClick={() => setPendingDecision("archive")}>
          通过
        </button>
      </footer>
    </section>
  );
}
