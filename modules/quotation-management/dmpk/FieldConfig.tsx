"use client";

import { GripVertical, Plus, X } from "lucide-react";
import type { DetectionScenario } from "../components/ScenarioSelector";

const parameterGroups = [
  { id: "assay", label: "检测类型", count: 2 },
  { id: "animal", label: "动物实验", count: 4 },
  { id: "analysis", label: "生物分析", count: 5 },
  { id: "delivery", label: "报告与报价", count: 3 },
];

const animalFields = [
  { label: "动物种属", meta: "单选 · SD 大鼠、Beagle 犬、自定义" },
  { label: "每组动物数", meta: "数字选项 · 3、6、10、自定义输入" },
  { label: "组数", meta: "数字选项 · 3、4、6、自定义输入" },
  { label: "试验周期", meta: "数字选项 · 1、2、4 周、自定义输入" },
];

const parameterFields: Record<string, Array<{ label: string; meta: string }>> = {
  assay: [
    { label: "检测类型", meta: "单选 · PK、BA Only、TOX" },
    { label: "化合物类别", meta: "单选 · 小分子、大分子、自定义" },
  ],
  animal: animalFields,
  analysis: [
    { label: "分析方法", meta: "单选 · LC-MS/MS、配体结合法、自定义" },
    { label: "样本类型", meta: "多选 · 血浆、血清、组织、自定义" },
    { label: "样本数量", meta: "数字选项 · 60、120、240、自定义输入" },
    { label: "待测物数量", meta: "数字选项 · 1、2、3、自定义输入" },
    { label: "是否需要方法开发", meta: "单选 · 是、否" },
  ],
  delivery: [
    { label: "报告语言", meta: "单选 · 中文、英文、中英双语" },
    { label: "报价币种", meta: "单选 · CNY、USD、自定义" },
    { label: "交付格式", meta: "多选 · Word、Excel、PDF" },
  ],
};

export default function FieldConfig({
  scenario,
  activeGroup,
  onActiveGroupChange,
  activeField,
  onActiveFieldChange,
  onAdd,
}: {
  scenario: DetectionScenario;
  activeGroup: string;
  onActiveGroupChange: (group: string) => void;
  activeField: number;
  onActiveFieldChange: (index: number) => void;
  onAdd: () => void;
}) {
  const group = parameterGroups.find((item) => item.id === activeGroup) ?? parameterGroups[0];
  const fields = parameterFields[activeGroup] ?? parameterFields.assay;
  const selectedField = fields[activeField] ?? fields[0];
  const isNumeric = selectedField.meta.includes("数字选项");
  const options = isNumeric ? ["3", "6", "10", "自定义输入"] : selectedField.meta.split("·")[1]?.split("、").map((item) => item.trim()) ?? ["自定义"];

  return (
    <div className="quotationParameterBuilder">
      <aside>
        <h2>参数分组</h2>
        {parameterGroups.map((item) => (
          <button className={item.id === activeGroup ? "active" : ""} type="button" key={item.id} onClick={() => onActiveGroupChange(item.id)}>
            <span>{item.label}</span><small>{item.count}</small>
          </button>
        ))}
        <button className="add" type="button"><Plus size={14} />添加分组</button>
      </aside>
      <section>
        <h2>{group.label}</h2>
        <p>这里的顺序会同步到报价任务右侧参数面板。</p>
        {fields.map((field, index) => (
          <button className={activeField === index ? "active" : ""} type="button" key={field.label} onClick={() => onActiveFieldChange(index)}>
            <GripVertical size={15} />
            <span><strong>{field.label}</strong><small>{field.meta}</small></span>
            <em>必填</em>
          </button>
        ))}
        <footer>
          <button type="button" onClick={onAdd}><Plus size={14} />添加参数</button>
          <button className="primary" type="button">保存为草稿</button>
        </footer>
      </section>
      <aside className="quotationFieldSettings">
        <h2>{selectedField.label}</h2>
        <label>参数名称<input defaultValue={selectedField.label} key={`${activeGroup}-${selectedField.label}`} /></label>
        <label>用户选择方式<select defaultValue={isNumeric ? "数字选项" : selectedField.meta.split(" · ")[0]}><option>单选</option><option>多选</option><option>数字选项</option><option>文本输入</option></select></label>
        <label>常用选项<div className="quotationOptionList">{options.map((item) => <span key={item}>{item}<X size={12} /></span>)}</div></label>
        <ToggleRow label="设为必填" />
        <ToggleRow label="允许自定义输入" />
      </aside>
    </div>
  );
}

function ToggleRow({ label }: { label: string }) {
  return <div className="quotationToggleRow"><span>{label}</span><i><b /></i></div>;
}
