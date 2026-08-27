"use client";

import { ArrowRight, FileSpreadsheet } from "lucide-react";

/**
 * 变更确认卡。重新生成报价之前，把这一轮要落下去的改动摆一遍，人确认后才发生。
 *
 * 为什么重新生成之前还要再确认一次
 * ----------------------------------------------------------------------
 * 逐条采纳时看的是「这一条该不该改」，确认时看的是「这一轮总共改了什么」。
 * 两件事不一样：三条分别看着都对，凑在一起可能就把整单金额推过了客户的预算。
 * 落笔前给一次整体的复核，比事后再退一次便宜。
 *
 * 形式上跟参数收集卡一致，也长在输入框上方：它们都是「需要你当场定一件事」的卡，
 * 不该一个长在对话里、一个长在输入框上——同一类东西出现在两个地方，
 * 人就得记住两个地方。
 */
export type QuoteChange = {
  /** 会话参数 id；改的是报价单本身时为 undefined。 */
  fieldId?: string;
  label: string;
  from: string;
  to: string;
  /** 落在会话参数上，还是落在报价单上。 */
  scope: "field" | "quote";
};

export function ChangeConfirmCard({ changes, onConfirm, onCancel }: {
  changes: QuoteChange[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const fieldChanges = changes.filter((change) => change.scope === "field");
  const quoteChanges = changes.filter((change) => change.scope === "quote");

  const renderRow = (change: QuoteChange) => (
    <li key={`${change.scope}-${change.label}`}>
      <strong>{change.label}</strong>
      <span className="quoteNoteDiff">
        <s>{change.from || "—"}</s>
        <ArrowRight size={11} aria-hidden="true" />
        <b>{change.to}</b>
      </span>
    </li>
  );

  return (
    <section className="changeConfirmCard" aria-label="确认本轮改动">
      <header>
        <span className="changeConfirmBadge"><FileSpreadsheet size={14} aria-hidden="true" /></span>
        <div>
          <strong>确认本轮改动</strong>
          <small>确认后按新值重算，并生成新一版报价单</small>
        </div>
      </header>

      {/* 分两组：改参数的会同步到右侧参数收集，改报价单的不会。
          不分组的话，人会以为每一条都能在右边找到对应的那一格。 */}
      {fieldChanges.length ? (
        <div className="changeConfirmGroup">
          <span>报价参数<em>确认后同步到右侧参数收集</em></span>
          <ul>{fieldChanges.map(renderRow)}</ul>
        </div>
      ) : null}

      {quoteChanges.length ? (
        <div className="changeConfirmGroup">
          <span>报价单口径<em>只作用于这一版报价，不改参数</em></span>
          <ul>{quoteChanges.map(renderRow)}</ul>
        </div>
      ) : null}

      <footer>
        <button className="reworkAction" type="button" onClick={onCancel}>再看看</button>
        <button className="reworkAction isPrimary" type="button" onClick={onConfirm}>确认并重新生成</button>
      </footer>
    </section>
  );
}
