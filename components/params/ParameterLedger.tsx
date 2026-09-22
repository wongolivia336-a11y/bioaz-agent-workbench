"use client";

import { ChevronDown, Edit3, Quote } from "lucide-react";
import { Fragment, useState } from "react";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";
import { formatParamValue, type ParamField, type ParamGroup, type ParamSource } from "./types";

/**
 * 右栏的参数台账。
 *
 * 显示的是**已落库**的取值，不显示待发草稿——草稿在 composer 的 chips 里，
 * 那是它该在的地方（见 ComposerChipTray）。两边各标一次「未提交」的话，
 * 人得自己判断哪一个是真的。
 *
 * 进度按必填项算：可选项不该把进度条撑到 100% 之外的任何一个位置去，
 * 「还能不能出报价」只由必填项决定。
 *
 * 原文依据（P0-1）
 * ----------------------------------------------------------------------
 * 值后面一枚小标写锚点（「表 2」「§4」「第 7 条」），点开是一张小卡：材料名、
 * 位置、原文那句话。小标长在行按钮里（行本身点了是去改），所以它得把事件拦住；
 * 卡片不悬浮、不压暗，就在这一行下面插一块——320px 的一栏里，悬浮层没地方摆。
 * 人改过的格子换成「人填」，卡片写「原文为 X，已改为 Y」。
 */
export function ParameterLedger({ groups, fields, openGroups, editingFieldId, statusOf, onToggleGroup, onEditField }: {
  groups: ParamGroup[];
  fields: ParamField[];
  openGroups: Record<string, boolean>;
  editingFieldId?: string | null;
  /**
   * 这一项的值是机器认出来的还是人确认过的。
   * 可选：不传就跟原来一模一样（肿瘤线没有文件识别，也就没有这一维）。
   * 只标「识别」，不标「已确认」——台账上多数行都是确认过的，
   * 每行挂一枚「已确认」等于什么都没说。
   */
  statusOf?: (fieldId: string) => "recognized" | "confirmed" | undefined;
  onToggleGroup: (groupId: string) => void;
  onEditField: (fieldId: string) => void;
}) {
  const required = fields.filter((field) => field.required);
  const completed = required.filter((field) => field.value).length;
  const pct = required.length ? Math.round((completed / required.length) * 100) : 0;
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);

  return (
    <div className="dmpkInspectorList paramCollectList">
      <div className="paramCollectProgress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {groups.map((group) => {
        const groupFields = fields.filter((field) => field.group === group.id);
        if (!groupFields.length) return null;
        const open = openGroups[group.id];
        const groupRequired = groupFields.filter((field) => field.required);
        const groupCompleted = groupRequired.filter((field) => field.value).length;
        const progressClass = !groupRequired.length || groupCompleted === groupRequired.length
          ? "isComplete"
          : groupCompleted ? "isPartial" : "isEmpty";
        const stateLabel = progressClass === "isComplete" ? "已完成" : groupCompleted ? "进行中" : "未开始";
        return (
          <section className={`inspectorParameterGroup ${progressClass} ${open ? "isOpen" : ""}`} key={group.id}>
            <button className="inspectorParameterGroupHeader" type="button" aria-expanded={open} onClick={() => onToggleGroup(group.id)}>
              <i className="paramGroupDot" aria-hidden="true" />
              <strong>{group.title}</strong>
              <span className={progressClass}><em className="paramGroupState">{stateLabel}</em><ChevronDown size={14} /></span>
            </button>
            {open ? (
              <div className="inspectorParameterFields">
                {/* 不给行套一层 div：`.inspectorParameterField:last-child` 去掉末行底线，
                    套了层每颗按钮都成了 last-child，两条线的台账底线全没了。
                    来源卡作为兄弟节点插在这一行后面。 */}
                {groupFields.map((field) => field.value ? (
                  <Fragment key={field.id}>
                    <button
                      className={`inspectorParameterField ${editingFieldId === field.id ? "isEditing" : ""}`}
                      type="button"
                      onClick={() => onEditField(field.id)}
                      title={formatParamValue(field, field.value)}
                    >
                      <span>{field.mark ? <i className="paramFieldMark">{field.mark}</i> : null}{field.label}</span>
                      <strong>{formatParamValue(field, field.value)}</strong>
                      {field.source ? (
                        <SourceMark
                          source={field.source}
                          open={openSourceId === field.id}
                          onToggle={() => setOpenSourceId((current) => current === field.id ? null : field.id)}
                        />
                      ) : null}
                      {statusOf?.(field.id) === "recognized" ? <em className="paramFieldStatus">识别</em> : null}
                      <Edit3 size={13} />
                    </button>
                    {field.source && openSourceId === field.id ? (
                      <SourceCard field={field} source={field.source} onClose={() => setOpenSourceId(null)} />
                    ) : null}
                  </Fragment>
                ) : (
                  /* 不适用的空格子不是欠着：写「不适用」，不写「待填写」，也不进进度 */
                  <div className={`inspectorParameterField isEmpty${field.notApplicable ? " isNotApplicable" : ""}`} key={field.id} title={field.notApplicable ? field.hint : undefined}>
                    <span>{field.mark ? <i className="paramFieldMark">{field.mark}</i> : null}{field.label}</span>
                    <strong>{field.notApplicable ? "不适用" : "待填写"}</strong>
                    <span aria-hidden="true" />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/** 小标：document 写锚点，manual 写「人填」。长在行按钮里，所以要把点击拦住。 */
function SourceMark({ source, open, onToggle }: { source: ParamSource; open: boolean; onToggle: () => void }) {
  return (
    <span
      className={`paramFieldSource is-${source.kind}${open ? " isOpen" : ""}`}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={source.kind === "document" ? `原文依据：${source.sourceLabel} · ${source.anchor}` : "人填，原文依据已被改动"}
      /* pointerdown 也拦：卡片的「点外部关闭」听的是 document 上的 pointerdown，
         不拦的话点小标先把卡关掉、紧接着 click 又把它打开——永远关不上。 */
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      {source.kind === "document" ? <Quote size={11} aria-hidden="true" /> : "人填"}
    </span>
  );
}

function SourceCard({ field, source, onClose }: { field: ParamField; source: ParamSource; onClose: () => void }) {
  const ref = useDismissableLayer<HTMLDivElement>(true, onClose);
  if (source.kind === "document") {
    return (
      <div className="paramFieldSourceCard" ref={ref} role="note">
        <header><strong>{source.sourceLabel}</strong><em>{source.anchor}</em></header>
        <blockquote>{source.quote}</blockquote>
      </div>
    );
  }
  return (
    <div className="paramFieldSourceCard is-manual" ref={ref} role="note">
      <header><strong>人填</strong>{source.original ? <em>原文为「{source.original.value}」，已改为「{formatParamValue(field, field.value)}」</em> : null}</header>
      {source.original ? (
        <>
          <small>{source.original.sourceLabel} · {source.original.anchor}</small>
          <blockquote>{source.original.quote}</blockquote>
        </>
      ) : null}
    </div>
  );
}
