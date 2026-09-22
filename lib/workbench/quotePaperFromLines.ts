import { quoteItems, quoteMeta, quoteParams, quoteSubtotals, type QuoteItem, type QuoteParam, type QuoteSubtotal } from "./quoteData";
import {
  adjustedTotal,
  effectiveStatus,
  lineUnitPrice,
  quoteLineStatusLabels,
  categoryOf,
  quoteCategoryLabels,
  quotePackageLabels,
  summarizeByCategory,
  summarizeLines,
  type ManualPrice,
  type QuoteAdjustments,
  type QuoteLine,
} from "./quoteLines";

/**
 * 报价单纸面的数据。
 *
 * QuotePaper 原来直接读 quoteData 里那份固定件（TK-2039，美元）。退回场景仍然
 * 用它——批注锚在它的行上。传了方案、有了报价行的会话，纸面得是这份账：
 * 人在「报价明细」里看到 27 行、改过一档单价，点开 Excel 预览看到的必须是同一批数，
 * 否则预览就没有意义。所以纸面吃一份同形状的数据，谁有账谁传。
 */
export type QuotePaperData = {
  meta: typeof quoteMeta;
  items: QuoteItem[];
  params: QuoteParam[];
  subtotals: QuoteSubtotal[];
};

/** 没有账的会话用的那份——就是原来的固定件。 */
export const defaultQuotePaper: QuotePaperData = {
  meta: quoteMeta,
  items: quoteItems,
  params: quoteParams,
  subtotals: quoteSubtotals,
};

/**
 * 把报价行折成纸面。
 *   计算表左边：一行一项，Category = 工作包，单价 = 生效单价（手动压过价目）；
 *                算不出的行单价「—」，说明里写原因——它们在纸上也得在，不然总额看着像整单
 *   计算表右边：可编辑参数 = 十四项里有值的；小计 = 工作包小计
 *   Standard = 全按价目表算的总额；Discounted = 含手动单价的总额。两者差的就是 SD 调的那部分
 *   报价书：只到 Package / Total
 */
export function quotePaperFromLines(
  lines: QuoteLine[],
  manualPrices: Record<string, ManualPrice>,
  fields: Array<{ id: string; label: string; value: string; group?: string }>,
  title: string,
  adjustments: QuoteAdjustments = {},
): QuotePaperData {
  const withManual = summarizeLines(lines, manualPrices);
  /* Standard 是「全按价目表」的数：临时改价的行按价目价倒回去。
     没价目、现场补价的行（猴类价）例外——补价不是让利，它就是这行唯一的价，Standard 里也按它算；
     不然 Standard 会漏掉整行，跟 Discounted 差出一截，看的人以为打了对折。 */
  const standardTotal = withManual.total + lines.reduce((sum, line) => {
    const manual = manualPrices[line.id];
    return manual && line.catalogPrice !== undefined ? sum + (line.catalogPrice - manual.price) * line.qty : sum;
  }, 0);
  /* 折扣和其他费用作用在合计上：Discounted / Total 是调整后的数 */
  const finalTotal = adjustedTotal(withManual.total, adjustments);
  const items: QuoteItem[] = lines.map((line) => {
    const manual = manualPrices[line.id];
    const status = effectiveStatus(line, manual);
    const priced = status === "priced";
    const parts = [line.scope, line.formula].filter(Boolean);
    if (!priced) parts.push(`${quoteLineStatusLabels[status]}${line.reason ? `：${line.reason}` : ""}`);
    return {
      id: line.id,
      /* 给甲方看的纸按上层四类分（动物 / 实验 / 检测 / 报告与交付）；工作包写在说明里 */
      category: quoteCategoryLabels[categoryOf(line)],
      item: `${line.service} × ${line.qty.toLocaleString("zh-CN")} ${line.unit}`,
      description: [quotePackageLabels[line.package], ...parts].filter((part, index) => index === 0 ? line.package !== "animal" && line.package !== "report" : Boolean(part)).join(" · "),
      unitPrice: priced ? lineUnitPrice(line, manual) : undefined,
      note: manual
        ? `${manual.by} 手动单价${line.catalogPrice !== undefined ? ` · 价目表 ${line.catalogPrice.toLocaleString("zh-CN")}` : ""}`
        : line.catalogId ? `价目表 ${line.catalogId}` : undefined,
    };
  });
  return {
    meta: {
      title,
      docTitle: `${title} · 报价书`,
      validity: "本报价自出具之日起 30 天内有效。",
      currency: "CNY",
      packagePrice: withManual.total,
      otherFees: adjustments.otherFees ?? 0,
      totalPrice: finalTotal,
      standardPrice: standardTotal,
      discountedPrice: finalTotal,
    },
    items,
    params: [
      ...fields.filter((field) => field.value).map((field) => ({ id: `f-${field.id}`, label: field.label, value: field.value })),
      /* 人工调整项也是"可编辑参数"——原表第 22 行黄格子里的 Discount 就是它 */
      ...(adjustments.discount !== undefined ? [{ id: "adj-discount", label: "折扣（人工）", value: String(adjustments.discount) }] : []),
      ...(adjustments.otherFees !== undefined ? [{ id: "adj-other", label: "其他费用（人工）", value: adjustments.otherFees.toLocaleString("zh-CN") }] : []),
    ],
    subtotals: summarizeByCategory(lines, manualPrices).map((group) => ({
      id: `s-${group.id}`,
      label: `${group.label}${group.unpriced ? `（${group.unpriced} 行未计价）` : ""}`,
      amount: group.subtotal,
    })),
  };
}
