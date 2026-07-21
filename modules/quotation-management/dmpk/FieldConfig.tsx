"use client";

import { GripVertical, Plus, X, AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { DetectionScenario } from "../components/ScenarioSelector";

type FieldType = "single" | "multiple" | "number" | "text";

interface FieldOption {
  value: string;
  label: string;
}

interface FieldDef {
  key: string;           // 系统标识
  label: string;         // 用户看到的中文名
  type: FieldType;
  options: FieldOption[];  // 选项列表
  required: boolean;
  allowCustom: boolean;
  group: string;
}

interface FieldGroup {
  id: string;
  label: string;
}

// PK 检测字段定义
const pkFields: FieldDef[] = [
  { key: "assayType", label: "检测类型", type: "single", options: [
    { value: "pk", label: "PK" },
    { value: "ba-only", label: "BA Only" },
    { value: "tox", label: "TOX" },
  ], required: true, allowCustom: false, group: "assay" },
  { key: "compoundType", label: "化合物类别", type: "single", options: [
    { value: "small", label: "小分子" },
    { value: "large", label: "大分子" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "assay" },
  { key: "animalSpecies", label: "动物种属", type: "single", options: [
    { value: "sd_rat", label: "SD 大鼠" },
    { value: "beagle", label: "Beagle 犬" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "animalCountPerGroup", label: "每组动物数", type: "number", options: [
    { value: "3", label: "3" },
    { value: "6", label: "6" },
    { value: "10", label: "10" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "groupCount", label: "组数", type: "number", options: [
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "6", label: "6" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "trialDuration", label: "试验周期", type: "number", options: [
    { value: "1", label: "1 周" },
    { value: "2", label: "2 周" },
    { value: "4", label: "4 周" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "analysisMethod", label: "分析方法", type: "single", options: [
    { value: "lcms", label: "LC-MS/MS" },
    { value: "ligand", label: "配体结合法" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "sampleType", label: "样本类型", type: "multiple", options: [
    { value: "plasma", label: "血浆" },
    { value: "serum", label: "血清" },
    { value: "tissue", label: "组织" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "sampleCount", label: "样本数量", type: "number", options: [
    { value: "60", label: "60" },
    { value: "120", label: "120" },
    { value: "240", label: "240" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "analyteCount", label: "待测物数量", type: "number", options: [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "methodDev", label: "是否需要方法开发", type: "single", options: [
    { value: "yes", label: "是" },
    { value: "no", label: "否" },
  ], required: true, allowCustom: false, group: "analysis" },
  { key: "reportLanguage", label: "报告语言", type: "single", options: [
    { value: "cn", label: "中文" },
    { value: "en", label: "英文" },
    { value: "both", label: "中英双语" },
  ], required: true, allowCustom: false, group: "delivery" },
  { key: "currency", label: "报价币种", type: "single", options: [
    { value: "cny", label: "CNY" },
    { value: "usd", label: "USD" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "delivery" },
  { key: "deliverFormat", label: "交付格式", type: "multiple", options: [
    { value: "word", label: "Word" },
    { value: "excel", label: "Excel" },
    { value: "pdf", label: "PDF" },
  ], required: true, allowCustom: false, group: "delivery" },
];

// BA Only 字段定义（无动物实验分组）
const baFields: FieldDef[] = [
  { key: "assayType", label: "检测类型", type: "single", options: [
    { value: "pk", label: "PK" },
    { value: "ba-only", label: "BA Only" },
    { value: "tox", label: "TOX" },
  ], required: true, allowCustom: false, group: "assay" },
  { key: "compoundType", label: "化合物类别", type: "single", options: [
    { value: "small", label: "小分子" },
    { value: "large", label: "大分子" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "assay" },
  { key: "analysisMethod", label: "分析方法", type: "single", options: [
    { value: "lcms", label: "LC-MS/MS" },
    { value: "ligand", label: "配体结合法" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "sampleType", label: "样本类型", type: "multiple", options: [
    { value: "plasma", label: "血浆" },
    { value: "serum", label: "血清" },
    { value: "tissue", label: "组织" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "sampleCount", label: "样本数量", type: "number", options: [
    { value: "60", label: "60" },
    { value: "120", label: "120" },
    { value: "240", label: "240" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "methodDev", label: "是否需要方法开发", type: "single", options: [
    { value: "yes", label: "是" },
    { value: "no", label: "否" },
  ], required: true, allowCustom: false, group: "analysis" },
  { key: "reportLanguage", label: "报告语言", type: "single", options: [
    { value: "cn", label: "中文" },
    { value: "en", label: "英文" },
    { value: "both", label: "中英双语" },
  ], required: true, allowCustom: false, group: "delivery" },
  { key: "currency", label: "报价币种", type: "single", options: [
    { value: "cny", label: "CNY" },
    { value: "usd", label: "USD" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "delivery" },
  { key: "deliverFormat", label: "交付格式", type: "multiple", options: [
    { value: "word", label: "Word" },
    { value: "excel", label: "Excel" },
    { value: "pdf", label: "PDF" },
  ], required: true, allowCustom: false, group: "delivery" },
];

// TOX 检测字段定义
const toxFields: FieldDef[] = [
  { key: "assayType", label: "检测类型", type: "single", options: [
    { value: "pk", label: "PK" },
    { value: "ba-only", label: "BA Only" },
    { value: "tox", label: "TOX" },
  ], required: true, allowCustom: false, group: "assay" },
  { key: "compoundType", label: "化合物类别", type: "single", options: [
    { value: "small", label: "小分子" },
    { value: "large", label: "大分子" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "assay" },
  { key: "animalSpecies", label: "动物种属", type: "single", options: [
    { value: "sd_rat", label: "SD 大鼠" },
    { value: "beagle", label: "Beagle 犬" },
    { value: "hamster", label: "仓鼠" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "animalCountPerGroup", label: "每组动物数", type: "number", options: [
    { value: "3", label: "3" },
    { value: "6", label: "6" },
    { value: "10", label: "10" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "groupCount", label: "组数", type: "number", options: [
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "6", label: "6" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "trialDuration", label: "试验周期", type: "number", options: [
    { value: "1", label: "1 周" },
    { value: "2", label: "2 周" },
    { value: "4", label: "4 周" },
    { value: "8", label: "8 周" },
    { value: "13", label: "13 周" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "toxicityEndpoint", label: "毒性终点", type: "multiple", options: [
    { value: "acute", label: "急性" },
    { value: "subacute", label: "亚急性" },
    { value: "chronic", label: "慢性" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "animal" },
  { key: "analysisMethod", label: "分析方法", type: "single", options: [
    { value: "lcms", label: "LC-MS/MS" },
    { value: "ligand", label: "配体结合法" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "sampleType", label: "样本类型", type: "multiple", options: [
    { value: "plasma", label: "血浆" },
    { value: "serum", label: "血清" },
    { value: "tissue", label: "组织" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "sampleCount", label: "样本数量", type: "number", options: [
    { value: "60", label: "60" },
    { value: "120", label: "120" },
    { value: "240", label: "240" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "analyteCount", label: "待测物数量", type: "number", options: [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
  ], required: true, allowCustom: true, group: "analysis" },
  { key: "reportLanguage", label: "报告语言", type: "single", options: [
    { value: "cn", label: "中文" },
    { value: "en", label: "英文" },
    { value: "both", label: "中英双语" },
  ], required: true, allowCustom: false, group: "delivery" },
  { key: "currency", label: "报价币种", type: "single", options: [
    { value: "cny", label: "CNY" },
    { value: "usd", label: "USD" },
    { value: "custom", label: "自定义" },
  ], required: true, allowCustom: true, group: "delivery" },
  { key: "deliverFormat", label: "交付格式", type: "multiple", options: [
    { value: "word", label: "Word" },
    { value: "excel", label: "Excel" },
    { value: "pdf", label: "PDF" },
  ], required: true, allowCustom: false, group: "delivery" },
];

const scenarioFieldMap: Record<DetectionScenario, FieldDef[]> = {
  pk: pkFields,
  "ba-only": baFields,
  tox: toxFields,
};

const groups: Record<string, FieldGroup> = {
  assay: { id: "assay", label: "检测类型" },
  animal: { id: "animal", label: "动物实验" },
  analysis: { id: "analysis", label: "生物分析" },
  delivery: { id: "delivery", label: "报告与报价" },
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
  const allFields = scenarioFieldMap[scenario] ?? pkFields;
  const groupIds = Array.from(new Set(allFields.map((f) => f.group)));
  const groupList = groupIds.map((id) => groups[id]).filter(Boolean);
  const fieldsInGroup = allFields.filter((f) => f.group === activeGroup);
  const selectedField = fieldsInGroup[activeField] ?? fieldsInGroup[0];

  return (
    <div className="quotationParameterBuilder">
      <aside>
        <h2>参数分组</h2>
        {groupList.map((item) => (
          <button
            className={item.id === activeGroup ? "active" : ""}
            type="button"
            key={item.id}
            onClick={() => onActiveGroupChange(item.id)}
          >
            <span>{item.label}</span>
            <small>{allFields.filter((f) => f.group === item.id).length}</small>
          </button>
        ))}
        <button className="add" type="button"><Plus size={14} />添加分组</button>
      </aside>
      <section>
        <h2>{groups[activeGroup]?.label ?? "参数"}</h2>
        <p>这里的顺序会同步到报价任务右侧参数面板。</p>
        {fieldsInGroup.map((field, index) => (
          <button
            className={activeField === index ? "active" : ""}
            type="button"
            key={field.key}
            onClick={() => onActiveFieldChange(index)}
          >
            <GripVertical size={15} />
            <span>
              <strong>{field.label}</strong>
              <small><code>{field.key}</code> · {field.type === "single" ? "单选" : field.type === "multiple" ? "多选" : field.type === "number" ? "数字" : "文本"}</small>
            </span>
            <em>{field.required ? "必填" : "可选"}</em>
          </button>
        ))}
        <footer>
          <button type="button" onClick={onAdd}><Plus size={14} />添加参数</button>
          <button className="primary" type="button">保存为草稿</button>
        </footer>
      </section>
      {selectedField ? (
        <aside className="quotationFieldSettings">
          <h2>{selectedField.label}</h2>
          <div className="fieldKeyRow">
            <code className="fieldKey">{selectedField.key}</code>
            <span className="fieldKeyHint">系统标识</span>
          </div>
          <label>参数名称<input defaultValue={selectedField.label} key={`${activeGroup}-${selectedField.key}-label`} /></label>
          <label>字段类型
            <select defaultValue={selectedField.type} key={`${activeGroup}-${selectedField.key}-type`}>
              <option value="single">单选</option>
              <option value="multiple">多选</option>
              <option value="number">数字选项</option>
              <option value="text">文本输入</option>
            </select>
          </label>
          <label>选项列表
            <div className="quotationOptionList">
              {selectedField.options.map((opt) => (
                <span key={opt.value}>{opt.label}<X size={12} /></span>
              ))}
            </div>
          </label>
          <ToggleRow label="设为必填" defaultOn={selectedField.required} />
          <ToggleRow label="允许自定义输入" defaultOn={selectedField.allowCustom} />
          <div className="fieldRuleWarning">
            <AlertTriangle size={14} />
            <small>新增 key 时请在计价规则中配置对应逻辑，否则可能影响报价计算</small>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? false);
  return (
    <div className="quotationToggleRow" onClick={() => setOn(!on)} style={{ cursor: "pointer" }}>
      <span>{label}</span>
      <i className={on ? "on" : ""}><b /></i>
    </div>
  );
}
