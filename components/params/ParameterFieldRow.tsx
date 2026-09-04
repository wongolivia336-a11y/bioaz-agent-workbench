"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { CompactSelect } from "../workbench-shell/ShellControls";
import {
  joinMulti,
  joinRepeat,
  lockedPlaceholder,
  resolveOptions,
  splitMulti,
  splitRepeat,
  unmetDependencies,
  type ParamField,
} from "./types";

/**
 * 一项参数的行。行内卡和全屏弹窗共用这一份——两套实现迟早会分叉。
 *
 * 五种 kind 共用同一副骨架
 * ----------------------------------------------------------------------
 * 序号圆点 / 标签 / 必填-可选 chip / 说明 / 控件区，顺序和间距对所有 kind
 * 都一样。「样式统一」落在这副骨架上，**不落在控件类型上**——
 * 逼所有字段都用选项按钮反而会散架：实测把肿瘤那 8 个中英双语模型选项塞进
 * `.optionGrid`（可用宽 795px），渲染出来是 127px 高、折 4 行、最宽一项 437px，
 * 而 DMPK 现在一行 28px。长选项必须走下拉，这不是妥协，是同一套规范下的
 * 另一个正确取值。
 *
 * 里面不用裸 <span> 和裸 <p>
 * ----------------------------------------------------------------------
 * `.warningDecisionList span { color: var(--amber) }` 和
 * `.parameterTaskCard .decisionCopy span { font-size: 12px }` 是按标签名写的，
 * 新加一个 <span> 就会被染成琥珀色粗体。已有的 `.requiredTag` 是 <span>，
 * 那是历史，照原样留着；新的一律用带类名的 <em> / <b> / <div>。
 */
export function ParameterFieldRow({
  field,
  index,
  fields,
  values,
  onChange,
}: {
  field: ParamField;
  index: number;
  /** 全部字段，求依赖时要按 id 找标签 */
  fields: ParamField[];
  /** 当前生效取值（草稿已经盖过落库值） */
  values: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const kind = field.kind ?? "options";
  const value = values[field.id] ?? "";
  const unmet = unmetDependencies(field, fields, values);
  const locked = unmet.length > 0;
  const done = Boolean(value);

  return (
    <article className={`decisionRow ${done ? "done" : ""} ${locked ? "isLocked" : ""}`}>
      <div className="decisionCopy">
        <div className="decisionTitleRow">
          <span className="decisionIndex">{done ? <Check size={15} /> : index}</span>
          <strong>{field.label}</strong>
          <span className="requiredTag">{field.required ? "必填" : "可选"}</span>
        </div>
        {field.hint ? <em className="paramFieldHint">{field.hint}</em> : null}
        {locked ? (
          /* 中性占位，不是红字。这一项还没轮到，不是填错了。 */
          <div className="paramLockedNote">{lockedPlaceholder(unmet)}</div>
        ) : kind === "options" ? (
          <OptionsControl field={field} value={value} values={values} onChange={onChange} />
        ) : kind === "select" ? (
          <SelectControl field={field} value={value} values={values} onChange={onChange} />
        ) : kind === "text" ? (
          <TextControl field={field} value={value} onChange={onChange} />
        ) : kind === "multi" ? (
          <MultiControl field={field} value={value} values={values} onChange={onChange} />
        ) : (
          <RepeatControl field={field} value={value} onChange={onChange} />
        )}
      </div>
    </article>
  );
}

/** 选项按钮平铺。DMPK 原样，唯一的变化是选项列表改成算出来的。 */
function OptionsControl({ field, value, values, onChange }: {
  field: ParamField;
  value: string;
  values: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const [editingCustom, setEditingCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const options = resolveOptions(field, values);
  /* 「自定义」是**按项开**的，不是所有 options 字段都该有。
     报告格式、分析方法这类是封闭词表，多一个自定义出口等于邀请人写出
     系统认不了的取值；而每组动物数、采血点数这类天然是开放数字。 */
  const list = field.allowCustom ? [...options, "自定义"] : options;
  const commit = () => {
    const next = customValue.trim();
    if (next) onChange(next);
    setEditingCustom(false);
  };

  return (
    <div className="optionGrid">
      {list.map((option) => option === "自定义" && editingCustom ? (
        <input
          autoFocus
          className="customOptionInput"
          key={option}
          value={customValue}
          placeholder="输入"
          onBlur={commit}
          onChange={(event) => setCustomValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              /* 全屏时 Esc 是关弹窗的。这里必须拦住，否则想取消一个自定义输入，
                 会连整张弹窗一起关掉——把人填到一半的东西收走。 */
              event.stopPropagation();
              setEditingCustom(false);
            }
          }}
        />
      ) : (
        <button
          className={value === option ? "selected" : ""}
          type="button"
          key={option}
          onClick={() => option === "自定义" ? setEditingCustom(true) : onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/**
 * 下拉。给选项长到平铺会占掉半屏的那些字段用（模型、动物品系、细胞系）。
 *
 * 用 CompactSelect 而不是原生 `<select>`：原生下拉展开的是系统皮肤，
 * 白底、行高和字号都不归这套设计管，在参数卡里明显是另一个东西
 * ——而这次要的恰恰是「和 DMPK 长一个样」。CompactSelect 是仓库里现成的
 * 那一个（`.compactSelect`，浮层走 useDismissableLayer），
 * 站内信的交接弹窗、助手上下文条用的都是它。
 */
function SelectControl({ field, value, values, onChange }: {
  field: ParamField;
  value: string;
  values: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const options = resolveOptions(field, values);
  return (
    <div className="paramControlWrap">
      <CompactSelect
        className="paramSelect"
        value={value}
        options={options}
        placeholder={field.placeholder ?? `选择${field.label}`}
        onChange={onChange}
      />
    </div>
  );
}

function TextControl({ field, value, onChange }: {
  field: ParamField;
  value: string;
  onChange: (value: string) => void;
}) {
  /* 跟下拉共用同一个外框：上边距和最大宽度写在框上，两种控件本身只管
     自己的样子。重复行里的输入框**不套这个框**——它们是 grid 的直接子元素，
     多一层就没法跟表头共用同一条列宽规则了。 */
  return (
    <div className="paramControlWrap">
      <input
        className="paramTextInput"
        value={value}
        placeholder={field.placeholder ?? `填写${field.label}`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/**
 * 多选 chips。检测指标这类「勾几项」的字段。
 *
 * 跟单选用同一颗按钮的形状和尺寸，只有选中态的语义不同——
 * 单选是「换成这个」，多选是「加上这个／去掉这个」。
 */
function MultiControl({ field, value, values, onChange }: {
  field: ParamField;
  value: string;
  values: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const [customValue, setCustomValue] = useState("");
  const options = resolveOptions(field, values);
  const picked = splitMulti(value);
  const exclusive = field.exclusiveOptions ?? [];
  /* 互斥项两个方向都要清：选中「不需要检测」时把别的清掉，
     选中别的时把「不需要检测」清掉。只做一个方向的话，先勾 IVIS 再勾
     「不需要检测」是干净的，反过来就留下一对自相矛盾的选中态——
     而人不会知道这两条路的结果不一样。 */
  const withExclusion = (next: string[], added: string) =>
    exclusive.includes(added) ? [added] : next.filter((item) => !exclusive.includes(item));
  const toggle = (option: string) => {
    onChange(joinMulti(picked.includes(option)
      ? picked.filter((item) => item !== option)
      : withExclusion([...picked, option], option)));
  };
  const addCustom = () => {
    const next = customValue.trim();
    if (!next || picked.includes(next)) return;
    onChange(joinMulti(withExclusion([...picked, next], next)));
    setCustomValue("");
  };
  /* 自己加的那几项：不在选项表里，但已经被选中。也要能点掉，
     否则输错一个字就只能整条重来。 */
  const extras = picked.filter((item) => !options.includes(item));

  return (
    <div className="paramMultiWrap">
      <div className="optionGrid">
        {options.map((option) => (
          <button
            className={picked.includes(option) ? "selected" : ""}
            type="button"
            key={option}
            aria-pressed={picked.includes(option)}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
        {extras.map((option) => (
          <button
            className="selected isCustomPick"
            type="button"
            key={option}
            aria-pressed
            onClick={() => toggle(option)}
          >
            {option}
            <X size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      {field.allowCustom ? (
        <div className="paramMultiAdd">
          <input
            className="paramTextInput"
            value={customValue}
            placeholder={field.placeholder ?? "输入并回车添加"}
            onChange={(event) => setCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addCustom();
            }}
          />
          <button className="paramMultiAddButton" type="button" onClick={addCustom} aria-label={`添加${field.label}`}>
            <Plus size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 可重复行。分组及给药剂量：一行就是一个实验组。
 *
 * 每行末尾一颗删除键，**按类名选中**（`.paramRepeatRemove`），不写
 * `.paramRepeatRow button`——这个仓库里有过一次教训：给卡片主体写的
 * `width:100%` 把后加的 24px 删除图标撑成了 189px 的误删带。
 */
function RepeatControl({ field, value, onChange }: {
  field: ParamField;
  value: string;
  onChange: (value: string) => void;
}) {
  const columns = field.columns ?? [];
  const rows = splitRepeat(value);
  /* **空行不进 value**——`joinRepeat` 会把全空的一行滤掉，否则取值末尾会挂一串
     没意义的分隔符。所以「屏幕上有几行」只能由组件自己记：少了这一笔，
     点「添加一行」是毫无反应的——新行全空、当场被滤掉、再渲染回来还是原样。 */
  const [blankRows, setBlankRows] = useState(0);
  /* 一行都没有时至少摆一行空的：给一个「点这里开始」的空白框，
     比给一颗孤零零的「添加」按钮更清楚这一项要填什么。 */
  const blanks = rows.length ? blankRows : Math.max(blankRows, 1);
  const display = [...rows, ...Array.from({ length: blanks }, () => columns.map(() => ""))];

  const write = (next: string[][]) => {
    const kept = next.filter((cells) => cells.some((cell) => cell.trim()));
    setBlankRows(next.length - kept.length);
    onChange(joinRepeat(next));
  };
  const setCell = (rowIndex: number, colIndex: number, cell: string) => {
    const next = display.map((row, index) => index !== rowIndex
      ? [...row]
      : columns.map((_, ci) => ci === colIndex ? cell : (row[ci] ?? "")));
    write(next);
  };

  return (
    <div className="paramRepeat">
      <div className="paramRepeatHead">
        {columns.map((column) => <em key={column.id}>{column.label}</em>)}
        <em className="paramRepeatHeadSpacer" aria-hidden="true" />
      </div>
      {display.map((row, rowIndex) => (
        <div className="paramRepeatRow" key={rowIndex}>
          {columns.map((column, colIndex) => column.options?.length ? (
            <CompactSelect
              className="paramSelect"
              key={column.id}
              value={row[colIndex] ?? ""}
              options={column.options}
              placeholder={column.placeholder ?? column.label}
              onChange={(next) => setCell(rowIndex, colIndex, next)}
            />
          ) : (
            <input
              className="paramTextInput"
              key={column.id}
              value={row[colIndex] ?? ""}
              placeholder={column.placeholder ?? column.label}
              onChange={(event) => setCell(rowIndex, colIndex, event.target.value)}
            />
          ))}
          <button
            className="paramRepeatRemove"
            type="button"
            disabled={display.length === 1}
            onClick={() => write(display.filter((_, index) => index !== rowIndex))}
            aria-label={`删除第 ${rowIndex + 1} 行`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        className="paramRepeatAdd"
        type="button"
        onClick={() => write([...display, columns.map(() => "")])}
      >
        <Plus size={14} aria-hidden="true" />添加一行
      </button>
    </div>
  );
}
