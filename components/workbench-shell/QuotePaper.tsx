"use client";

import type { ReactNode } from "react";
import { quoteItems, quoteMeta, quoteParams, quoteSubtotals } from "../../lib/workbench/quoteData";

/* 报价的两种纸面形态,抽出来共用。
   -------------------------------------------------------------------
   同一份报价在这套原型里出现在两个地方:审核画布里(可批注),和工单附件的预览
   弹窗里(只读)。它们必须是同一份渲染——预览若另画一版占位,人在预览里看到的
   和进去审的就不是同一张纸,那预览就没有意义了。

   批注相关的东西通过 rowClass / bubble 传进来:画布传真的,预览什么都不传。
   这样只读那条路径上根本没有批注的概念,而不是"有但被关掉了"。 */

export const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 计价项按 Category 分组,组名只在该组第一行显示——原表就是这么排的。 */
export const quoteCategories = quoteItems
  .map((item) => item.category)
  .filter((value, index, list) => list.indexOf(value) === index);

type PaperProps = {
  /** 给行加类名(命中批注时高亮)。预览不传。 */
  rowClass?: (id: string) => string;
  /** 行内那颗「已批注」小标。预览不传。 */
  bubble?: (id: string) => ReactNode;
};

const noClass = () => "";
const noBubble = () => null;

/** 内部计算表:左边计价明细带单价,右边可编辑参数喂小计。 */
export function QuoteSheetPaper({ rowClass = noClass, bubble = noBubble }: PaperProps) {
  return (
    <article className="quoteSheet">
      <header><strong>{quoteMeta.title}</strong><small>内部计算表 · {quoteMeta.currency}</small></header>
      <div className="quoteSheetGrid">
        <section className="quoteSheetItems">
          <table>
            <thead><tr><th>Category</th><th>Item</th><th>Unit Price</th></tr></thead>
            <tbody>
              {quoteCategories.map((category) => quoteItems.filter((item) => item.category === category).map((item, index) => (
                <tr key={item.id} data-anchor={item.id} className={rowClass(item.id)}>
                  <td className="quoteCategoryCell">{index === 0 ? category : ""}</td>
                  <td><strong>{item.item}</strong><small>{item.description}</small>{bubble(item.id)}</td>
                  <td className="quoteNum">{item.unitPrice === undefined ? "—" : money(item.unitPrice)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </section>

        {/* 原表第 22 行那句「Yellow-highlighted fields are editable」说的就是这一批——
            它们是人可以改的,也就是最该被核的。 */}
        <section className="quoteSheetParams">
          <h4>可编辑参数</h4>
          <table>
            <tbody>
              {quoteParams.map((param) => (
                <tr key={param.id} data-anchor={param.id} className={rowClass(param.id)}>
                  <td><strong>{param.label}</strong>{bubble(param.id)}</td>
                  <td className="quoteNum quoteEditable">{param.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>小计</h4>
          <table>
            <tbody>
              {quoteSubtotals.map((sub) => (
                <tr key={sub.id}><td>{sub.label}</td><td className="quoteNum">{money(sub.amount)}</td></tr>
              ))}
              <tr className="quoteTotalRow"><td>Standard Price</td><td className="quoteNum">{money(quoteMeta.standardPrice)}</td></tr>
              <tr className="quoteTotalRow"><td>Discounted Price</td><td className="quoteNum">{money(quoteMeta.discountedPrice)}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </article>
  );
}

/** 客户版报价书:不出现单价推导,只到 Package / Total。 */
export function QuoteDocPaper({ rowClass = noClass, bubble = noBubble }: PaperProps) {
  return (
    <article className="quoteDoc">
      <header><strong>{quoteMeta.docTitle}</strong><small>{quoteMeta.validity}</small></header>
      <table className="quoteDocTable">
        <thead><tr><th>Category</th><th>Item</th><th>Description</th></tr></thead>
        <tbody>
          {quoteCategories.map((category) => quoteItems.filter((item) => item.category === category).map((item, index) => (
            <tr key={item.id} data-anchor={item.id} className={rowClass(item.id)}>
              <td className="quoteCategoryCell">{index === 0 ? category : ""}</td>
              <td><strong>{item.item}</strong>{bubble(item.id)}</td>
              <td className="quoteDocDesc">{item.description}</td>
            </tr>
          )))}
          <tr className="quoteTotalRow"><td colSpan={2}>Package Price ({quoteMeta.currency})</td><td className="quoteNum">{money(quoteMeta.packagePrice)}</td></tr>
          <tr className="quoteTotalRow"><td colSpan={2}>Total Price ({quoteMeta.currency})</td><td className="quoteNum">{money(quoteMeta.totalPrice)}</td></tr>
        </tbody>
      </table>
    </article>
  );
}
