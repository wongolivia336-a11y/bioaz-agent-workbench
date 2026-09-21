"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { effectiveStatus, formatCny, quoteLineStatusLabels, type ManualPrice, type QuoteLine, type QuotePackage, type QuoteSummary } from "../../lib/workbench/quoteLines";
import type { DmpkField } from "./fields";
import { extraPackageOptions, type ExtraPackage } from "./quoteLineFixtures";

/**
 * 积木卡：基础卡底下长出来的板块卡。
 *
 * 会上（09-21）说的「TOX 的卡片在下面再长出一个卡片，像搭积木一样」，等的是八维。
 * P0 工程方案给了：八维正好拆成两层——
 *   基础卡 = ①动物 ②组别 ③数目（全单一份）
 *   板块卡 = ④实验操作 ⑤次数 ⑥检测项目 ⑦方法 ⑧数量，每个工作包一张
 * 板块卡不另存定义：它读的就是右栏那份账（summarizeLines），一个板块一张，
 * 每张按八维摆这个板块的账里有什么、还缺什么。所以右栏改了它跟着改，反之亦然。
 *
 * 十四项不动。「检测类型」单选定主板块；再要哪个板块，「+ 板块」点一下，
 * 账里当场长出那一段（quoteLineFixtures.buildExtraPackageLines），行大多缺参数、
 * 指回参数卡那一格——积木先搭上，格子再填。
 */

const DIM = { ops: "④ 实验操作", times: "⑤ 次数", item: "⑥ 检测项目", method: "⑦ 方法", qty: "⑧ 数量" };

/** 服务名去掉括号和「· 方法」尾巴，几行并成一句：「TK 毒代采血 · 方法开发 · 样品检测」。 */
function shortService(service: string): string {
  return service.replace(/[（(].*?[)）]/g, "").split(" · ")[0].trim();
}

function uniq(items: Array<string | undefined>): string[] {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item))));
}

function PackageBlock({ id, label, lines, subtotal, manualPrices, extra, defaultOpen, onEditField, onRemove }: {
  id: QuotePackage;
  label: string;
  lines: QuoteLine[];
  subtotal: number;
  manualPrices: Record<string, ManualPrice>;
  extra: boolean;
  defaultOpen: boolean;
  onEditField: (fieldId: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const statusOf = (line: QuoteLine) => effectiveStatus(line, manualPrices[line.id]);
  const pending = lines.filter((line) => statusOf(line) !== "priced");
  const ops = uniq(lines.map((line) => shortService(line.service)));
  const methods = uniq(lines.map((line) => line.method));
  const analytes = uniq(lines.map((line) => line.analyte));
  /* ⑤ 次数：公式里「N 只 × M 点」那一截，几行相同就只说一次 */
  const times = uniq(lines.map((line) => line.formula?.split(" · ")[0]));
  /* ⑧ 数量按单位各报一个数：「161 份 · 5 项」 */
  const qtyByUnit = lines.reduce<Record<string, number>>((acc, line) => {
    if (line.qty) acc[line.unit] = (acc[line.unit] ?? 0) + line.qty;
    return acc;
  }, {});
  const qty = Object.entries(qtyByUnit).map(([unit, n]) => `${n.toLocaleString("zh-CN")} ${unit}`).join(" · ");

  return (
    <article className={`dmpkBlock${extra ? " isExtra" : ""}`} data-package={id}>
      <button type="button" className="dmpkBlockHead" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <strong>{label}</strong>
        <small>{lines.length} 行{pending.length ? ` · ${pending.length} 待定` : ""}</small>
        <b>{subtotal ? formatCny(subtotal) : "—"}</b>
        <ChevronDown size={14} className="dmpkBlockChevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="dmpkBlockBody">
          <dl className="dmpkBlockDims">
            <div><dt>{DIM.ops}</dt><dd>{ops.length ? ops.join(" · ") : "—"}</dd></div>
            <div><dt>{DIM.times}</dt><dd>{times.length ? times.slice(0, 2).join("；") : "—"}</dd></div>
            <div><dt>{DIM.item}</dt><dd>{label}{analytes.length ? <small>{analytes.join(" · ")}</small> : null}</dd></div>
            <div><dt>{DIM.method}</dt><dd>{methods.length ? methods.join(" · ") : "—"}</dd></div>
            <div><dt>{DIM.qty}</dt><dd>{qty || "—"}</dd></div>
          </dl>
          {/* 这个板块还差什么，就在卡上说：缺参数的指回那一格，待确认 / 无价目写原因。 */}
          {pending.length ? (
            <ul className="dmpkBlockPending">
              {pending.map((line) => {
                const status = statusOf(line);
                return (
                  <li key={line.id} data-status={status}>
                    <i>{quoteLineStatusLabels[status]}</i>
                    <span>{shortService(line.service)}{line.reason ? ` · ${line.reason}` : ""}</span>
                    {status === "missing-param" && line.dependsOn ? <button type="button" onClick={() => onEditField(line.dependsOn!)}>去填</button> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {extra && onRemove ? (
            <button type="button" className="dmpkBlockRemove" onClick={onRemove}><X size={12} aria-hidden="true" />去掉这个板块</button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function DmpkPackageBlocks({ summary, fields, manualPrices, extraPackages, onAddPackage, onRemovePackage, onEditField }: {
  summary: QuoteSummary;
  fields: DmpkField[];
  manualPrices: Record<string, ManualPrice>;
  extraPackages: ExtraPackage[];
  onAddPackage: (pkg: ExtraPackage) => void;
  onRemovePackage: (pkg: ExtraPackage) => void;
  onEditField: (fieldId: string) => void;
}) {
  const value = (id: string) => fields.find((field) => field.id === id)?.value ?? "";
  const notApplicable = (id: string) => fields.find((field) => field.id === id)?.notApplicable;
  /* 动物 / 报告是配套，不是检测项目，积木里不长它们——右栏照旧列 */
  const blocks = summary.packages.filter((pkg) => pkg.id !== "animal" && pkg.id !== "report");
  const present = new Set(blocks.map((pkg) => pkg.id));
  const addable = extraPackageOptions.filter((option) => !present.has(option.id));
  const base: Array<{ id: string; label: string; text: string }> = [
    { id: "species", label: "① 动物", text: notApplicable("species") ? "不适用" : value("species") },
    { id: "groupCount", label: "② 组别", text: notApplicable("groupCount") ? "不适用" : value("groupCount") ? `${value("groupCount")} 组` : "" },
    { id: "animalsPerGroup", label: "③ 数目", text: notApplicable("animalsPerGroup") ? "不适用" : value("animalsPerGroup") ? `每组 ${value("animalsPerGroup")} 只` : "" },
    { id: "cycle", label: "周期", text: notApplicable("cycle") ? "不适用" : value("cycle") },
  ];
  if (!blocks.length) return null;

  return (
    <section className="dmpkBlocks" aria-label="板块积木">
      {/* 基础卡一行：①②③ 全单一份。缺的写「待填」并能点过去。 */}
      <div className="dmpkBlockBase">
        <span className="dmpkBlockBaseLabel">基础</span>
        {base.map((item) => (
          <span key={item.id} className={item.text ? "" : "isEmpty"}>
            <em>{item.label}</em>
            {item.text || <button type="button" onClick={() => onEditField(item.id)}>待填</button>}
          </span>
        ))}
      </div>
      <div className="dmpkBlockStack">
        {blocks.map((pkg) => (
          <PackageBlock
            key={pkg.id}
            id={pkg.id}
            label={pkg.label}
            lines={pkg.lines}
            subtotal={pkg.subtotal}
            manualPrices={manualPrices}
            extra={extraPackages.includes(pkg.id as ExtraPackage)}
            /* 刚搭上的那块开着——人要看它长出了什么；账里本来就有的折着，右栏已经在列 */
            defaultOpen={extraPackages.includes(pkg.id as ExtraPackage)}
            onEditField={onEditField}
            onRemove={extraPackages.includes(pkg.id as ExtraPackage) ? () => onRemovePackage(pkg.id as ExtraPackage) : undefined}
          />
        ))}
      </div>
      {addable.length ? (
        <div className="dmpkBlockAdd">
          <span><Plus size={12} aria-hidden="true" />再搭一块</span>
          {addable.map((option) => (
            <button type="button" key={option.id} title={option.hint} onClick={() => onAddPackage(option.id)}>{option.label}</button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
