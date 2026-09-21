/**
 * 报价行。
 *
 * 为什么十四项字段之外还要一层
 * ----------------------------------------------------------------------
 * 一份真实的毒理报价不是「每组 N 只 × 单价」一句话：核心组和卫星组只数不同、
 * 采血点不同；同一批血清有 6 个分析物，其中 3 个平台还没定；4 组免疫分型
 * 采血根本没有价目。**按实际关系取数、算小计和总额**（甲方 P0-2）要的是
 * 一行一行的账，而十四项是这份账的**归一化摘要**，不是账本身。
 *
 * 所以十四项不动，下面加这一层：一行 = 一个范围（组别 / 样品集）上的一项服务，
 * 数量 × 单价 = 金额。行按工作包归组，小计和总额从行上算，不另存。
 *
 * 单价有两个来源，手动的压过价目表的
 * ----------------------------------------------------------------------
 * 「SD 手动单价优先于价目表单价；不修改价目表和其他报价」——所以手动价
 * **不写在行上**（行是从事实推出来的，重算就没了），写在会话自己的一张表里
 * 按行 id 查；价目表那份一个字不碰。
 *
 * 算不出的行也是行
 * ----------------------------------------------------------------------
 * 缺参数、待确认、无价目——三种「还算不出来」都留在账上，带原因。
 * 只列算得出的那些，总额看着像整单，其实少了一截，而人不知道少的是什么。
 */

/* 工作包就是 2026-09-21 会上说的「板块」：右栏按它分组，一场实验涉及哪几个就挂哪几个。
   PK / TOX / BA / ADA 是会上点名的四个；动物使用和报告与交付是配套服务，排在最后。 */
export type QuotePackage = "pk-tk" | "tox" | "ba" | "ada" | "animal" | "report";

export const quotePackageLabels: Record<QuotePackage, string> = {
  "pk-tk": "PK / TK 样品采集",
  tox: "TOX",
  ba: "BA",
  ada: "ADA",
  animal: "动物使用",
  report: "报告与交付",
};

export const quotePackageOrder: QuotePackage[] = ["pk-tk", "tox", "ba", "ada", "animal", "report"];

export type QuoteLineStatus = "priced" | "missing-param" | "pending-confirm" | "no-catalog";

export const quoteLineStatusLabels: Record<QuoteLineStatus, string> = {
  priced: "已计价",
  "missing-param": "缺参数",
  "pending-confirm": "待确认",
  "no-catalog": "无价目",
};

export type QuoteLine = {
  id: string;
  package: QuotePackage;
  /** 这一行算的是哪个范围：「1–4 组核心」「2–4 组卫星」「全部 11 只」。 */
  scope: string;
  service: string;
  /* 会上定的右栏四要素里的前两个：待测物 / 检测方法。行本来只有 service，
     采血、动物使用这类没有待测物的行留空，面板画「—」。 */
  analyte?: string;
  method?: string;
  qty: number;
  unit: string;
  /** 数量是怎么来的：「2 只 × 16 点 × 4 组」。给人核的，不参与计算。 */
  formula?: string;
  /** 价目表单价。无价目的行没有。 */
  catalogPrice?: number;
  /** 价目表里对应的条目 id，用来说明「走的是哪一档」。 */
  catalogId?: string;
  status: QuoteLineStatus;
  /** 算不出来时，为什么。 */
  reason?: string;
  /** 这一行等哪个字段。缺参数 / 待确认的行用来把人带到那一格。 */
  dependsOn?: string;
  /**
   * 数量落在哪几组、各多少（组 id → 数量）。P0 的输出口径是「按组费用明细」——
   * 右栏按板块看，明细面板能翻成按组看，同一份账两种切法。
   * 没有它的行是整单项（方法开发、报告），或者不该拆到组的（少于 30 按 30 是按化合物计的）。
   */
  groupShare?: Record<string, number>;
};

/** 谁改的单价。甲方写的是「SD」，指谁没说清，收成一个常量，确认后改一处。
    2026-09-21 会议：权限分级后置，本轮谁改就记谁——会话有账号名时用账号名，这个只是兜底。 */
export const MANUAL_PRICE_BY = "SD";

export type ManualPrice = { price: number; by: string; at: string };

export function lineUnitPrice(line: QuoteLine, manual?: ManualPrice): number | undefined {
  return manual?.price ?? line.catalogPrice;
}

/**
 * 这一行现在算不算得出来。手动给了单价的，无价目也算得出来——
 * 那正是「待补价」的出口：后台没价，SD 现场给一个，只作用于这一单。
 */
export function effectiveStatus(line: QuoteLine, manual?: ManualPrice): QuoteLineStatus {
  if (manual) return line.status === "no-catalog" ? "priced" : line.status;
  return line.status;
}

export function lineAmount(line: QuoteLine, manual?: ManualPrice): number | undefined {
  if (effectiveStatus(line, manual) !== "priced") return undefined;
  const unit = lineUnitPrice(line, manual);
  return unit === undefined ? undefined : round2(line.qty * unit);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export type QuotePackageSummary = {
  id: QuotePackage;
  label: string;
  lines: QuoteLine[];
  subtotal: number;
  unpriced: number;
};

export type QuoteSummary = {
  packages: QuotePackageSummary[];
  total: number;
  pricedCount: number;
  unpricedCount: number;
  unpricedByStatus: Partial<Record<Exclude<QuoteLineStatus, "priced">, number>>;
  manualCount: number;
};

export function summarizeLines(lines: QuoteLine[], manualPrices: Record<string, ManualPrice> = {}): QuoteSummary {
  const packages = quotePackageOrder
    .map((id) => {
      const packageLines = lines.filter((line) => line.package === id);
      const subtotal = round2(packageLines.reduce((sum, line) => sum + (lineAmount(line, manualPrices[line.id]) ?? 0), 0));
      const unpriced = packageLines.filter((line) => effectiveStatus(line, manualPrices[line.id]) !== "priced").length;
      return { id, label: quotePackageLabels[id], lines: packageLines, subtotal, unpriced };
    })
    .filter((item) => item.lines.length);
  const unpricedByStatus: QuoteSummary["unpricedByStatus"] = {};
  let pricedCount = 0;
  for (const line of lines) {
    const status = effectiveStatus(line, manualPrices[line.id]);
    if (status === "priced") pricedCount += 1;
    else unpricedByStatus[status] = (unpricedByStatus[status] ?? 0) + 1;
  }
  return {
    packages,
    total: round2(packages.reduce((sum, item) => sum + item.subtotal, 0)),
    pricedCount,
    unpricedCount: lines.length - pricedCount,
    unpricedByStatus,
    manualCount: lines.filter((line) => manualPrices[line.id]).length,
  };
}

/**
 * 人工调整项（P0 工程方案第五层：猴类人工价格、折扣和其他费用作为独立人工调整项保存）。
 * 猴类价格走的是行上的补价（它是某一行的单价）；折扣和其他费用不属于任何一行，
 * 作用在合计上，所以另存一份、另算一次。跟 manualPrices 一样只在会话里，不进价目表。
 *   discount   折扣系数，0.9 = 九折；不填 = 不打折
 *   otherFees  其他费用，整单一笔
 */
export type QuoteAdjustments = { discount?: number; otherFees?: number };

export function adjustedTotal(total: number, adjustments: QuoteAdjustments = {}): number {
  const discounted = adjustments.discount !== undefined ? total * adjustments.discount : total;
  return round2(discounted + (adjustments.otherFees ?? 0));
}

export function hasAdjustments(adjustments: QuoteAdjustments = {}): boolean {
  return adjustments.discount !== undefined || adjustments.otherFees !== undefined;
}

export function formatCny(amount: number): string {
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * 影响提示：改了参数之后，账上哪些板块变了、变了几行、合计从多少到多少。
 * 「影响 PK / TK 样品采集 2 行、动物使用 1 行；合计 ¥14,580 → ¥16,200。」
 * 两份账逐行比：行的数量、单价、状态任一不同就算变了；新增或消失的行也算。
 * 没变返回空串——没影响就别说话。
 */
export function impactSentence(before: QuoteSummary, after: QuoteSummary, manualPrices: Record<string, ManualPrice> = {}): string {
  const fingerprint = (line: QuoteLine) => `${line.qty}|${lineUnitPrice(line, manualPrices[line.id]) ?? ""}|${effectiveStatus(line, manualPrices[line.id])}`;
  const beforeLines = new Map(before.packages.flatMap((pkg) => pkg.lines).map((line) => [line.id, fingerprint(line)]));
  const changed: Record<string, number> = {};
  for (const pkg of after.packages) {
    for (const line of pkg.lines) {
      if (beforeLines.get(line.id) === fingerprint(line)) continue;
      changed[pkg.label] = (changed[pkg.label] ?? 0) + 1;
    }
  }
  const afterIds = new Set(after.packages.flatMap((pkg) => pkg.lines.map((line) => line.id)));
  for (const pkg of before.packages) {
    for (const line of pkg.lines) if (!afterIds.has(line.id)) changed[pkg.label] = (changed[pkg.label] ?? 0) + 1;
  }
  const parts = Object.entries(changed).map(([label, count]) => `${label} ${count} 行`);
  if (!parts.length && before.total === after.total) return "";
  const totals = before.total !== after.total ? `合计 ${formatCny(before.total)} → ${formatCny(after.total)}` : "合计不变";
  return `影响 ${parts.join("、") || "计价状态"}；${totals}。`;
}

/**
 * 同一份账按组切（P0 输出口径：按组费用明细）。
 * 每组列它分到的行：数量是这一组的份额，金额 = 份额 × 单价（临时价照样压过价目价）。
 * 没标组的行归「整单项」。各组小计 + 整单项 = 按板块看的合计，两种切法对得上。
 */
export type QuoteGroupShare = { line: QuoteLine; qty: number; amount?: number };
export type QuoteGroupBreakdown = {
  groups: Array<{ id: string; label: string; shares: QuoteGroupShare[]; subtotal: number; unpriced: number }>;
  whole: { shares: QuoteGroupShare[]; subtotal: number; unpriced: number };
};

export function groupBreakdown(lines: QuoteLine[], manualPrices: Record<string, ManualPrice> = {}, labels: Record<string, string> = {}): QuoteGroupBreakdown {
  const shareOf = (line: QuoteLine, qty: number): QuoteGroupShare => {
    const manual = manualPrices[line.id];
    const unit = lineUnitPrice(line, manual);
    const priced = effectiveStatus(line, manual) === "priced" && unit !== undefined;
    return { line, qty, amount: priced ? round2(qty * unit) : undefined };
  };
  const byGroup = new Map<string, QuoteGroupShare[]>();
  const whole: QuoteGroupShare[] = [];
  for (const line of lines) {
    if (!line.groupShare) { whole.push(shareOf(line, line.qty)); continue; }
    for (const [groupId, qty] of Object.entries(line.groupShare)) {
      if (!byGroup.has(groupId)) byGroup.set(groupId, []);
      byGroup.get(groupId)!.push(shareOf(line, qty));
    }
  }
  const sum = (shares: QuoteGroupShare[]) => round2(shares.reduce((total, share) => total + (share.amount ?? 0), 0));
  const unpricedIn = (shares: QuoteGroupShare[]) => shares.filter((share) => share.amount === undefined).length;
  /* 组的顺序：有标签表就按表的顺序，没有就按出现顺序 */
  const order = Object.keys(labels);
  const ids = Array.from(byGroup.keys()).sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
  });
  return {
    groups: ids.map((id) => ({ id, label: labels[id] ?? id, shares: byGroup.get(id)!, subtotal: sum(byGroup.get(id)!), unpriced: unpricedIn(byGroup.get(id)!) })),
    whole: { shares: whole, subtotal: sum(whole), unpriced: unpricedIn(whole) },
  };
}

/** 对话里那一句：「已计价 20 项 ¥612,340；5 项未计价（待确认 2 · 无价目 3）」。 */
export function pricingSentence(summary: QuoteSummary): string {
  const parts = (Object.entries(summary.unpricedByStatus) as Array<[Exclude<QuoteLineStatus, "priced">, number]>)
    .map(([status, count]) => `${quoteLineStatusLabels[status]} ${count}`);
  const unpriced = summary.unpricedCount ? `；${summary.unpricedCount} 项未计价（${parts.join(" · ")}）` : "";
  return `已计价 ${summary.pricedCount} 项 ${formatCny(summary.total)}${unpriced}`;
}
