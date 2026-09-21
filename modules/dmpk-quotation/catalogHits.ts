import {
  effectiveStatus,
  quotePackageLabels,
  quotePackageOrder,
  type ManualPrice,
  type QuoteLine,
} from "../../lib/workbench/quoteLines";
import { priceCatalog } from "../quotation-management/dmpk/catalog";

/**
 * 「本单命中的价目」：这一单的行用到了价目表里的哪几档。
 *
 * 会议共识 2 说的是**完整**价目表不进对话；这里列的是本单命中的那一小截——
 * 人在对话里问「这单用了哪些价」，数字同事回一张表，跟去后台翻整表是两件事。
 * 同一档价被几行用（游离 IMQ 和游离 MMAF 的样品检测都是 ¥180 那档）折成一行，
 * 用量合计、板块并列；改过临时价的标出来；没有价目的另起一段。
 */
export type CatalogHit = {
  key: string;
  /** 费用项目：价目表里的名字；没进价目表的用服务名 */
  name: string;
  packages: string[];
  unit: string;
  catalogPrice?: number;
  /** 本单临时价（同一档若几行改了不同的价，取第一行的，行数写在 lineCount 里） */
  manualPrice?: number;
  qty: number;
  lineCount: number;
  status: "priced" | "manual" | "no-catalog" | "pending";
};

export function catalogHitsFor(lines: QuoteLine[], manualPrices: Record<string, ManualPrice>): CatalogHit[] {
  const hits = new Map<string, CatalogHit>();
  const order = (line: QuoteLine) => quotePackageOrder.indexOf(line.package);
  const sorted = [...lines].sort((a, b) => order(a) - order(b));
  for (const line of sorted) {
    const manual = manualPrices[line.id];
    const status = effectiveStatus(line, manual);
    const key = line.catalogId ?? `svc:${line.service}`;
    const catalogItem = line.catalogId ? priceCatalog.find((item) => item.id === line.catalogId) : undefined;
    const pkg = quotePackageLabels[line.package];
    const existing = hits.get(key);
    if (existing) {
      if (!existing.packages.includes(pkg)) existing.packages.push(pkg);
      if (existing.unit === line.unit) existing.qty += line.qty;
      existing.lineCount += 1;
      if (manual && existing.manualPrice === undefined) { existing.manualPrice = manual.price; existing.status = "manual"; }
      continue;
    }
    hits.set(key, {
      key,
      name: catalogItem?.name ?? line.service,
      packages: [pkg],
      unit: line.unit,
      catalogPrice: line.catalogPrice,
      manualPrice: manual?.price,
      qty: line.qty,
      lineCount: 1,
      status: manual ? "manual" : status === "priced" ? "priced" : status === "no-catalog" ? "no-catalog" : "pending",
    });
  }
  const rank: Record<CatalogHit["status"], number> = { manual: 0, priced: 0, pending: 1, "no-catalog": 2 };
  return Array.from(hits.values()).sort((a, b) => rank[a.status] - rank[b.status]);
}
