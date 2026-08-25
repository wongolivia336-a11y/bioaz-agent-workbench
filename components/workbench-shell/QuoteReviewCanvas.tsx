"use client";

import { ArrowLeft, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { StatusChip } from "../ui";
import {
  quoteItems,
  quoteMeta,
  quoteNoteCategoryLabel,
  quoteNoteNeedsValue,
  quoteParams,
  quoteSubtotals,
  type QuoteNote,
  type QuoteNoteCategory,
} from "../../lib/workbench/quoteData";
import type { Ticket } from "../../lib/workbench/ticketData";

const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 报价审核画布。
 *
 * 骨架跟 QA 审核台一样:左边原件、右边批注清单,点原件给它加批注、点批注回到原件。
 * 三处不同,每一处都有原因:
 *
 *   1. 没有对话区。报价复核全程人工,拉一个 chatflow 进来只会长出「这里能问 AI 吗」
 *      的期待,而它确实不能。
 *   2. 锚点是**行**不是选区。报价单本来就是结构化的,有名字的行比一段坐标好定位,
 *      下一版也更容易验证「那一条改了没有」。
 *   3. 批注带**建议值**。报价复核是算术:「这个数应该是 6 不是 2」是能写下来、
 *      也能被下一版直接核验的断言,而不是一句要人再读一遍的评语。
 *
 * 两种形态共用一套锚点:Excel 是内部计算表(有单价和参数),Word 是对外报价书
 * (只有条目和描述)。切视图不丢批注,因为批注锚的是条目 id,不是屏幕位置。
 */
export function QuoteReviewCanvas({ ticket, notes, onNotesChange, onBack }: {
  ticket: Ticket;
  notes: Record<string, QuoteNote>;
  onNotesChange: (next: Record<string, QuoteNote>) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<"sheet" | "doc">("sheet");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuoteNote | null>(null);

  const noted = Object.values(notes);
  const blocking = noted.filter((note) => note.severity === "blocking").length;
  const categories = [...quoteItems.map((item) => item.category)].filter((value, index, list) => list.indexOf(value) === index);

  const anchorLabel = (id: string) =>
    quoteParams.find((param) => param.id === id)?.label
    ?? quoteItems.find((item) => item.id === id)?.item
    ?? quoteSubtotals.find((sub) => sub.id === id)?.label
    ?? id;

  const currentValue = (id: string) => {
    const param = quoteParams.find((item) => item.id === id);
    if (param) return param.value;
    const item = quoteItems.find((entry) => entry.id === id);
    if (item?.unitPrice !== undefined) return money(item.unitPrice);
    return "";
  };

  const pick = (id: string) => {
    setActiveId(id);
    setDraft(notes[id] ?? { anchorId: id, category: "param", severity: "blocking", text: "" });
  };
  const commit = () => {
    if (!draft || !draft.text.trim()) return;
    onNotesChange({ ...notes, [draft.anchorId]: draft });
    setActiveId(null);
    setDraft(null);
  };
  const remove = (id: string) => {
    const next = { ...notes };
    delete next[id];
    onNotesChange(next);
    if (activeId === id) { setActiveId(null); setDraft(null); }
  };

  const marked = (id: string) => notes[id] ? `hasNote is-${notes[id].severity}` : "";

  return (
    <section className="workbenchView quoteReviewCanvas">
      <header className="quoteReviewHead">
        <button className="ticketDetailBack" type="button" onClick={onBack}><ArrowLeft size={15} />返回工单</button>
        <div className="quoteReviewHeadMain">
          <div className="ticketDetailTitle">
            <span>{ticket.id} · 报价复核 · 全程人工</span>
            <h1>{quoteMeta.title}</h1>
          </div>
          {/* 同一张报价的两种形态。审核在计算表这一侧做——Word 里没有单价也没有
              参数,看不出数是怎么算出来的。 */}
          <div className="quoteFormSwitch" role="tablist" aria-label="报价形态">
            <button type="button" role="tab" aria-selected={form === "sheet"} className={form === "sheet" ? "active" : ""} onClick={() => setForm("sheet")}>
              <FileSpreadsheet size={14} />计算表
            </button>
            <button type="button" role="tab" aria-selected={form === "doc"} className={form === "doc" ? "active" : ""} onClick={() => setForm("doc")}>
              <FileText size={14} />报价书
            </button>
          </div>
        </div>
      </header>

      <div className="quoteReviewBody">
        <div className="quoteDocPane">
          {form === "sheet" ? (
            <article className="quoteSheet">
              <header>
                <strong>{quoteMeta.title}</strong>
                <small>内部计算表 · {quoteMeta.currency}</small>
              </header>

              <div className="quoteSheetGrid">
                {/* 左半边:计价明细。单价可批注（走错档是常见问题）。 */}
                <section className="quoteSheetItems">
                  <table>
                    <thead><tr><th>Category</th><th>Item</th><th>Unit Price</th></tr></thead>
                    <tbody>
                      {categories.map((category) => quoteItems.filter((item) => item.category === category).map((item, index) => (
                        <tr key={item.id} className={`${marked(item.id)} ${activeId === item.id ? "isActive" : ""}`}>
                          <td className="quoteCategoryCell">{index === 0 ? category : ""}</td>
                          <td>
                            <button type="button" className="quoteCellButton" onClick={() => pick(item.id)}>
                              <strong>{item.item}</strong>
                              <small>{item.description}</small>
                            </button>
                          </td>
                          <td className="quoteNum">{item.unitPrice === undefined ? "—" : money(item.unitPrice)}</td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </section>

                {/* 右半边:参数与小计。原表里那句「Yellow-highlighted fields are
                    editable」就是在说这一批——它们是人可以改的,也就是最该被核的。 */}
                <section className="quoteSheetParams">
                  <h4>可编辑参数</h4>
                  <table>
                    <tbody>
                      {quoteParams.map((param) => (
                        <tr key={param.id} className={`${marked(param.id)} ${activeId === param.id ? "isActive" : ""}`}>
                          <td>
                            <button type="button" className="quoteCellButton" onClick={() => pick(param.id)}>
                              <strong>{param.label}</strong>
                            </button>
                          </td>
                          <td className="quoteNum quoteEditable">{param.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>小计</h4>
                  <table>
                    <tbody>
                      {quoteSubtotals.map((sub) => (
                        <tr key={sub.id}>
                          <td>{sub.label}</td>
                          <td className="quoteNum">{money(sub.amount)}</td>
                        </tr>
                      ))}
                      <tr className="quoteTotalRow"><td>Standard Price</td><td className="quoteNum">{money(quoteMeta.standardPrice)}</td></tr>
                      <tr className="quoteTotalRow"><td>Discounted Price</td><td className="quoteNum">{money(quoteMeta.discountedPrice)}</td></tr>
                    </tbody>
                  </table>
                </section>
              </div>
            </article>
          ) : (
            <article className="quoteDoc">
              <header>
                <strong>{quoteMeta.docTitle}</strong>
                <small>{quoteMeta.validity}</small>
              </header>
              <table className="quoteDocTable">
                <thead><tr><th>Category</th><th>Item</th><th>Description</th></tr></thead>
                <tbody>
                  {categories.map((category) => quoteItems.filter((item) => item.category === category).map((item, index) => (
                    <tr key={item.id} className={`${marked(item.id)} ${activeId === item.id ? "isActive" : ""}`}>
                      <td className="quoteCategoryCell">{index === 0 ? category : ""}</td>
                      <td>
                        <button type="button" className="quoteCellButton" onClick={() => pick(item.id)}>
                          <strong>{item.item}</strong>
                        </button>
                      </td>
                      <td className="quoteDocDesc">{item.description}</td>
                    </tr>
                  )))}
                  <tr className="quoteTotalRow"><td colSpan={2}>Package Price ({quoteMeta.currency})</td><td className="quoteNum">{money(quoteMeta.packagePrice)}</td></tr>
                  <tr className="quoteTotalRow"><td colSpan={2}>Total Price ({quoteMeta.currency})</td><td className="quoteNum">{money(quoteMeta.totalPrice)}</td></tr>
                </tbody>
              </table>
              {/* 参数不在这一份里。审核人要核数怎么来的,得切到计算表。 */}
              <p className="quoteDocNote">这一份是给客户的，不含单价与参数。要核算法请切到「计算表」。</p>
            </article>
          )}
        </div>

        <aside className="quoteNotePane">
          <header>
            <strong>人工批注</strong>
            <small>{noted.length} 条{blocking ? ` · ${blocking} 条阻断` : ""}</small>
          </header>

          {draft ? (
            <div className="quoteNoteEditor">
              <span className="quoteNoteAnchor">{anchorLabel(draft.anchorId)}</span>
              {currentValue(draft.anchorId) ? <small className="quoteNoteCurrent">当前值 {currentValue(draft.anchorId)}</small> : null}

              {/* 报价复核的改法就那么几类,做成选项而不是让人每次自己组织语言——
                  分类固定下来,下一版才能按类核验。 */}
              <div className="quoteNoteCats">
                {(Object.keys(quoteNoteCategoryLabel) as QuoteNoteCategory[]).map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={draft.category === category ? "active" : ""}
                    onClick={() => setDraft({ ...draft, category, suggested: quoteNoteNeedsValue[category] ? draft.suggested : undefined })}
                  >
                    {quoteNoteCategoryLabel[category]}
                  </button>
                ))}
              </div>

              {quoteNoteNeedsValue[draft.category] ? (
                <label className="quoteNoteSuggest">
                  <span>应为</span>
                  <input
                    value={draft.suggested ?? ""}
                    placeholder="填一个值，下一版会照这个核"
                    onChange={(event) => setDraft({ ...draft, suggested: event.target.value })}
                  />
                </label>
              ) : null}

              <textarea
                autoFocus
                value={draft.text}
                placeholder="说明理由"
                aria-label="批注说明"
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              />

              <div className="quoteNoteSeverity">
                <label><input type="radio" checked={draft.severity === "blocking"} onChange={() => setDraft({ ...draft, severity: "blocking" })} />不改不能过</label>
                <label><input type="radio" checked={draft.severity === "advisory"} onChange={() => setDraft({ ...draft, severity: "advisory" })} />仅提醒</label>
              </div>

              <div className="quoteNoteActions">
                <button className="secondaryButton compact" type="button" onClick={() => { setActiveId(null); setDraft(null); }}>取消</button>
                <button className="primaryButton compact" type="button" disabled={!draft.text.trim()} onClick={commit}>保存批注</button>
              </div>
            </div>
          ) : (
            <p className="quoteNoteHint">点左边任意一条参数或计价项，给它写批注。</p>
          )}

          <ul className="quoteNoteList">
            {noted.map((note) => (
              <li key={note.anchorId} className={`is-${note.severity}`}>
                <button type="button" onClick={() => pick(note.anchorId)}>
                  <span className="quoteNoteTags">
                    <em>{quoteNoteCategoryLabel[note.category]}</em>
                    {note.severity === "blocking" ? <i className="quoteNoteBlock">阻断</i> : null}
                  </span>
                  <strong>{anchorLabel(note.anchorId)}</strong>
                  {note.suggested ? <b>{currentValue(note.anchorId)} → {note.suggested}</b> : null}
                  <p>{note.text}</p>
                </button>
                <button className="quoteNoteRemove" type="button" aria-label="删除批注" onClick={() => remove(note.anchorId)}><Trash2 size={13} /></button>
              </li>
            ))}
            {!noted.length ? <li className="quoteNoteEmpty">还没有批注。没有批注就通过，表示这一版你全部认可。</li> : null}
          </ul>
        </aside>
      </div>

      <footer className="ticketDetailActions">
        <p className="ticketDetailHint">
          {blocking ? `${blocking} 条阻断项，通过前需要先退回修订` : noted.length ? `${noted.length} 条提醒，不影响通过` : "尚无批注"}
        </p>
        <button className="secondaryButton compact" type="button" disabled={!noted.length}>驳回并退回 {ticket.from}</button>
        <button className="primaryButton compact" type="button" disabled={blocking > 0}>通过并归档到数据中枢</button>
      </footer>
    </section>
  );
}
