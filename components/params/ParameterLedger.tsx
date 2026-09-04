"use client";

import { ChevronDown, Edit3 } from "lucide-react";
import { formatParamValue, type ParamField, type ParamGroup } from "./types";

/**
 * 右栏的参数台账。
 *
 * 显示的是**已落库**的取值，不显示待发草稿——草稿在 composer 的 chips 里，
 * 那是它该在的地方（见 ComposerChipTray）。两边各标一次「未提交」的话，
 * 人得自己判断哪一个是真的。
 *
 * 进度按必填项算：可选项不该把进度条撑到 100% 之外的任何一个位置去，
 * 「还能不能出报价」只由必填项决定。
 */
export function ParameterLedger({ groups, fields, openGroups, editingFieldId, onToggleGroup, onEditField }: {
  groups: ParamGroup[];
  fields: ParamField[];
  openGroups: Record<string, boolean>;
  editingFieldId?: string | null;
  onToggleGroup: (groupId: string) => void;
  onEditField: (fieldId: string) => void;
}) {
  const required = fields.filter((field) => field.required);
  const completed = required.filter((field) => field.value).length;
  const pct = required.length ? Math.round((completed / required.length) * 100) : 0;

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
                {groupFields.map((field) => field.value ? (
                  <button
                    className={`inspectorParameterField ${editingFieldId === field.id ? "isEditing" : ""}`}
                    type="button"
                    key={field.id}
                    onClick={() => onEditField(field.id)}
                    title={formatParamValue(field, field.value)}
                  >
                    <span>{field.label}</span>
                    <strong>{formatParamValue(field, field.value)}</strong>
                    <Edit3 size={13} />
                  </button>
                ) : (
                  <div className="inspectorParameterField isEmpty" key={field.id}>
                    <span>{field.label}</span>
                    <strong>待填写</strong>
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
