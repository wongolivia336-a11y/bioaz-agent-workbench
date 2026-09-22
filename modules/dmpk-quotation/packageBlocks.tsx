"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { effectiveStatus, formatCny, quoteLineStatusLabels, type ManualPrice, type QuoteLine, type QuotePackage, type QuoteSummary } from "../../lib/workbench/quoteLines";
import type { DmpkField } from "./fields";
import { extraPackageOptions, type ExtraPackage } from "./quoteLineFixtures";

/**
 * 工作包：挂在「检测」那一组里的一叠小卡（09-22 下午定的层级）。
 *
 * 右栏「参数收集」是四张卡：动物 / 实验 / 检测 / 报告与交付。工作包（PK/TK、TOX、ADA、BA）
 * 不是第五类，它是"检测项目"这一维的多选——检测类型定主包，方案里读出的、人点「再搭一块」
 * 搭上的各一张小卡，都挂在「检测」组的字段下面（ParameterLedger 的 groupExtra）。
 * 早上那版把它们平铺在四张卡后面，看着像第五、第六类，撤了。
 *
 * 每张小卡：实验操作 / 次数 / 方法 / 数量各一行，文案压到一行，不带序号；缺的写「待填写」，点了去那一格。
 * 不另存定义：读的就是右栏那份账（summarizeLines）。
 */

/** 服务名去掉括号和「· 方法」尾巴，几行并成一句 */
const shortService = (service: string) => service.replace(/[（(].*?[)）]/g, "").split(" · ")[0].trim();
const uniq = (items: Array<string | undefined>) => Array.from(new Set(items.filter((item): item is string => Boolean(item))));

function PackageCard({ id, label, lines, subtotal, manualPrices, primary, extra, defaultOpen, onEditField, onRemove }: {
  id: QuotePackage;
  label: string;
  lines: QuoteLine[];
  subtotal: number;
  manualPrices: Record<string, ManualPrice>;
  /** 检测类型定的那一个 */
  primary: boolean;
  extra: boolean;
  defaultOpen: boolean;
  onEditField: (fieldId: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const statusOf = (line: QuoteLine) => effectiveStatus(line, manualPrices[line.id]);
  const pending = lines.filter((line) => statusOf(line) !== "priced");
  const missing = pending.filter((line) => line.status === "missing-param" && line.dependsOn);
  /* ④⑤⑦⑧ 各压成一句 */
  const ops = uniq(lines.map((line) => shortService(line.service))).slice(0, 4);
  const times = uniq(lines.map((line) => line.formula?.split(" · ")[0])).slice(0, 2);
  const methods = uniq(lines.map((line) => line.method?.replace(/（.*?）/g, "")));
  const qtyByUnit = lines.reduce<Record<string, number>>((acc, line) => { if (line.qty) acc[line.unit] = (acc[line.unit] ?? 0) + line.qty; return acc; }, {});
  const qty = Object.entries(qtyByUnit).slice(0, 2).map(([unit, n]) => `${n.toLocaleString("zh-CN")} ${unit}`).join(" · ");
  const state = pending.length ? (pending.length === lines.length ? "isEmpty" : "isPartial") : "isComplete";
  const rows: Array<{ label: string; value: string; fieldId?: string }> = [
    { label: "实验操作", value: ops.join(" · ") },
    { label: "次数", value: times.join("；"), fieldId: missing.find((line) => line.dependsOn === "bloodPoints")?.dependsOn },
    { label: "方法", value: methods.join(" · "), fieldId: missing.find((line) => line.dependsOn === "method")?.dependsOn },
    { label: "数量", value: qty, fieldId: missing.find((line) => line.dependsOn === "analyteCount" || line.dependsOn === "animalsPerGroup" || line.dependsOn === "groupCount")?.dependsOn },
  ];

  return (
    <section className={`dmpkPackageCard ${state} ${open ? "isOpen" : ""}`} data-package={id}>
      <button className="dmpkPackageCardHead" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <i className="paramGroupDot" aria-hidden="true" />
        <strong>{label}{primary ? <em className="dmpkPackageCardTag isPrimary">主</em> : extra ? <em className="dmpkPackageCardTag">搭上的</em> : null}</strong>
        <span className={state}><em className="paramGroupState">{pending.length ? `${pending.length} 待定` : subtotal ? formatCny(subtotal) : "已完成"}</em><ChevronDown size={14} /></span>
      </button>
      {open ? (
        <div className="inspectorParameterFields">
          {rows.map((row) => row.value ? (
            <div className="inspectorParameterField isStatic" key={row.label} title={row.value}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <span aria-hidden="true" />
            </div>
          ) : row.fieldId ? (
            <button className="inspectorParameterField isEmpty" type="button" key={row.label} onClick={() => onEditField(row.fieldId!)}>
              <span>{row.label}</span>
              <strong>待填写</strong>
              <span aria-hidden="true" />
            </button>
          ) : (
            <div className="inspectorParameterField isEmpty" key={row.label}>
              <span>{row.label}</span>
              <strong>—</strong>
              <span aria-hidden="true" />
            </div>
          ))}
          {/* 待确认 / 无价目：一行一句原因，不带按钮——出口在板块面板 */}
          {pending.filter((line) => line.status !== "missing-param").map((line) => (
            <div className="inspectorParameterField isEmpty dmpkPackageCardNote" key={line.id} title={line.reason}>
              <span>{shortService(line.service)}</span>
              <strong>{quoteLineStatusLabels[statusOf(line)]}</strong>
              <span aria-hidden="true" />
            </div>
          ))}
          {extra && onRemove ? (
            <button type="button" className="dmpkPackageCardRemove" onClick={onRemove}><X size={12} aria-hidden="true" />去掉这块</button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** 主板块 = 检测类型定的那个；它已经是台账里的「④–⑧」那张卡，这里不重复长。 */
const primaryPackageOf = (fields: DmpkField[]): QuotePackage | undefined => {
  const assay = fields.find((field) => field.id === "assayType")?.value;
  return assay === "PK" ? "pk-tk" : assay === "TOX" ? "tox" : assay === "BA Only" ? "ba" : undefined;
};

export function DmpkPackageCards({ summary, fields, manualPrices, extraPackages, onAddPackage, onRemovePackage, onEditField }: {
  summary: QuoteSummary;
  fields: DmpkField[];
  manualPrices: Record<string, ManualPrice>;
  extraPackages: ExtraPackage[];
  onAddPackage?: (pkg: ExtraPackage) => void;
  onRemovePackage?: (pkg: ExtraPackage) => void;
  onEditField: (fieldId: string) => void;
}) {
  const primary = primaryPackageOf(fields);
  /* 动物 / 报告是配套，不是检测项目。主包（检测类型定的）也列出来、标「主」——这一单做什么，一处看全。 */
  const cards = summary.packages.filter((pkg) => pkg.id !== "animal" && pkg.id !== "report");
  const present = new Set(summary.packages.map((pkg) => pkg.id));
  const addable = onAddPackage ? extraPackageOptions.filter((option) => !present.has(option.id) && option.id !== primary) : [];
  if (!cards.length && !addable.length) return null;

  return (
    <div className="dmpkPackageCards">
      <div className="dmpkPackageCardsHead"><span>工作包</span><small>这一单测什么——检测类型定主包，再要的搭上去</small></div>
      {cards.map((pkg) => (
        <PackageCard
          key={pkg.id}
          id={pkg.id}
          label={pkg.label}
          lines={pkg.lines}
          subtotal={pkg.subtotal}
          manualPrices={manualPrices}
          primary={pkg.id === primary}
          extra={extraPackages.includes(pkg.id as ExtraPackage)}
          /* 刚搭上的开着——人要看它长出了什么；别的折着，右栏板块面板已经在列 */
          defaultOpen={extraPackages.includes(pkg.id as ExtraPackage)}
          onEditField={onEditField}
          onRemove={onRemovePackage && extraPackages.includes(pkg.id as ExtraPackage) ? () => onRemovePackage(pkg.id as ExtraPackage) : undefined}
        />
      ))}
      {addable.length ? (
        <div className="dmpkPackageAdd">
          <span><Plus size={12} aria-hidden="true" />再搭一块</span>
          {addable.map((option) => (
            <button type="button" key={option.id} title={option.hint} onClick={() => onAddPackage?.(option.id)}>{option.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
