"use client";

import { CornerDownRight, GripVertical, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusChip } from "../../../components/ui";
import {
  fieldCatalog,
  fieldGroups,
  fieldOverrideLabels,
  matchesScenario,
  overriddenKeys,
  resolveField,
  scenarioLabels,
  scenarioShortLabels,
  type DetectionScenario,
  type FieldDef,
  type FieldOverride,
  type FieldOverrideKey,
} from "./catalog";

type ScenarioFilter = DetectionScenario | "all";
type Selection = { key: string; scenario: DetectionScenario | null };

const typeLabels: Record<FieldDef["type"], string> = {
  single: "单选",
  multiple: "多选",
  number: "数字",
  text: "文本",
};

export default function FieldConfig({ filter, onAdd }: { filter: ScenarioFilter; onAdd: () => void }) {
  const [fields, setFields] = useState<FieldDef[]>(fieldCatalog);
  const [activeGroup, setActiveGroup] = useState("assay");
  const [selection, setSelection] = useState<Selection | null>({ key: "assayType", scenario: null });

  const visible = useMemo(() => fields.filter((field) => matchesScenario(field.appliesTo, filter)), [fields, filter]);
  const groupList = fieldGroups.filter((group) => visible.some((field) => field.group === group.id));
  const currentGroup = groupList.some((group) => group.id === activeGroup) ? activeGroup : groupList[0]?.id ?? "assay";
  const fieldsInGroup = visible.filter((field) => field.group === currentGroup);

  const selected = selection ? fields.find((field) => field.key === selection.key) ?? null : null;
  const overrideCount = visible.reduce((total, field) => total + field.overrides.length, 0);

  const updateOverride = (key: string, scenario: DetectionScenario, next: FieldOverride | null) => {
    setFields((list) =>
      list.map((field) => {
        if (field.key !== key) return field;
        const rest = field.overrides.filter((item) => item.scenario !== scenario);
        return { ...field, overrides: next ? [...rest, next] : rest };
      }),
    );
  };

  /* 盖住一条属性 = 把主值当前的值抄进例外；恢复跟随 = 把这条键删掉。
     整条例外没有任何键了就整个删除，不留空壳。 */
  const toggleOverrideKey = (field: FieldDef, scenario: DetectionScenario, key: FieldOverrideKey, on: boolean) => {
    const current = field.overrides.find((item) => item.scenario === scenario);
    const next: FieldOverride = { ...(current ?? { scenario }) };
    if (on) {
      const resolved = resolveField(field, scenario);
      if (key === "options") next.options = resolved.options.map((option) => ({ ...option }));
      else if (key === "label") next.label = resolved.label;
      else if (key === "type") next.type = resolved.type;
      else if (key === "required") next.required = resolved.required;
      else next.allowCustom = resolved.allowCustom;
    } else {
      delete next[key];
    }
    updateOverride(field.key, scenario, overriddenKeys(next).length ? next : null);
  };

  return (
    <div className="quotationParameterBuilder">
      <aside>
        <h2>参数分组</h2>
        {groupList.map((group) => (
          <button className={group.id === currentGroup ? "active" : ""} type="button" key={group.id} onClick={() => setActiveGroup(group.id)}>
            <span>{group.label}</span>
            <small>{visible.filter((field) => field.group === group.id).length}</small>
          </button>
        ))}
        <button className="add" type="button"><Plus size={14} />添加分组</button>
      </aside>

      <section>
        <h2>{fieldGroups.find((group) => group.id === currentGroup)?.label ?? "参数"}</h2>
        <p>
          这里的顺序会同步到报价任务右侧参数面板。
          {overrideCount ? <em className="quotationScopeCount"> 当前范围内有 {overrideCount} 条例外。</em> : null}
        </p>
        {fieldsInGroup.map((field) => (
          <FieldRows
            key={field.key}
            field={field}
            filter={filter}
            selection={selection}
            onSelect={setSelection}
          />
        ))}
        <footer>
          <button type="button" onClick={onAdd}><Plus size={14} />添加参数</button>
          <button className="primary" type="button">保存为草稿</button>
        </footer>
      </section>

      {selected && selection ? (
        selection.scenario ? (
          <ExceptionSettings
            field={selected}
            scenario={selection.scenario}
            onToggle={(key, on) => toggleOverrideKey(selected, selection.scenario as DetectionScenario, key, on)}
            onRemoveAll={() => { updateOverride(selected.key, selection.scenario as DetectionScenario, null); setSelection({ key: selected.key, scenario: null }); }}
          />
        ) : (
          <MainSettings
            field={selected}
            onCreateException={(scenario) => {
              const resolved = resolveField(selected, scenario);
              updateOverride(selected.key, scenario, { scenario, options: resolved.options.map((option) => ({ ...option })) });
              setSelection({ key: selected.key, scenario });
            }}
          />
        )
      ) : null}
    </div>
  );
}

function FieldRows({
  field,
  filter,
  selection,
  onSelect,
}: {
  field: FieldDef;
  filter: ScenarioFilter;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const overrides = field.overrides.filter((item) => filter === "all" || item.scenario === filter);
  const isActive = selection?.key === field.key && selection.scenario === null;

  return (
    <>
      <button className={isActive ? "active" : ""} type="button" onClick={() => onSelect({ key: field.key, scenario: null })}>
        <GripVertical size={15} />
        <span>
          <strong>{field.label}</strong>
          <small><code>{field.key}</code> · {typeLabels[field.type]}</small>
        </span>
        <span className="quotationScopeTags">
          {field.appliesTo.map((scenario) => (
            <i
              className={filter !== "all" && filter === scenario ? "isActive" : ""}
              key={scenario}
              data-overridden={field.overrides.some((item) => item.scenario === scenario) ? "true" : undefined}
            >
              {scenarioShortLabels[scenario]}
            </i>
          ))}
        </span>
        <em>{field.required ? "必填" : "可选"}</em>
      </button>
      {overrides.map((override) => (
        <button
          className={`isException ${selection?.key === field.key && selection.scenario === override.scenario ? "active" : ""}`}
          type="button"
          key={override.scenario}
          onClick={() => onSelect({ key: field.key, scenario: override.scenario })}
        >
          <CornerDownRight size={14} />
          <span>
            <strong>{scenarioShortLabels[override.scenario]} 例外</strong>
            <small>盖住了 {overriddenKeys(override).map((key) => fieldOverrideLabels[key]).join("、")}</small>
          </span>
          <span className="quotationScopeTags"><i className="isActive">{scenarioShortLabels[override.scenario]}</i></span>
          <StatusChip tone="warning">例外</StatusChip>
        </button>
      ))}
    </>
  );
}

function MainSettings({ field, onCreateException }: { field: FieldDef; onCreateException: (scenario: DetectionScenario) => void }) {
  const [picking, setPicking] = useState(false);
  const available = field.appliesTo.filter((scenario) => !field.overrides.some((item) => item.scenario === scenario));

  return (
    <aside className="quotationFieldSettings">
      <h2>{field.label}</h2>
      <div className="fieldKeyRow">
        <code className="fieldKey">{field.key}</code>
        <span className="fieldKeyHint">系统标识</span>
      </div>

      <p className="quotationFieldScope">
        <TriangleAlert size={14} />
        <span>此字段适用于 <strong>{field.appliesTo.map((id) => scenarioShortLabels[id]).join("、")}</strong>，在这里修改会同时生效。</span>
      </p>

      <label>参数名称<input defaultValue={field.label} key={`${field.key}-label`} /></label>
      <label>字段类型
        <select defaultValue={field.type} key={`${field.key}-type`}>
          <option value="single">单选</option>
          <option value="multiple">多选</option>
          <option value="number">数字选项</option>
          <option value="text">文本输入</option>
        </select>
      </label>
      <label>选项列表
        <div className="quotationOptionList">
          {field.options.map((option) => <span key={option.value}>{option.label}</span>)}
        </div>
      </label>
      <ToggleRow label="设为必填" on={field.required} />
      <ToggleRow label="允许自定义输入" on={field.allowCustom} />

      {available.length ? (
        picking ? (
          <div className="quotationScopePicker">
            <small>为哪一类设置例外？</small>
            <div>
              {available.map((scenario) => (
                <button type="button" key={scenario} onClick={() => { setPicking(false); onCreateException(scenario); }}>{scenarioLabels[scenario]}</button>
              ))}
            </div>
          </div>
        ) : (
          <button className="quotationDrawerSecondary" type="button" onClick={() => setPicking(true)}>仅为某一类设为例外</button>
        )
      ) : null}

      <div className="fieldRuleWarning">
        <TriangleAlert size={14} />
        <small>新增 key 时请在计价规则中配置对应逻辑，否则可能影响报价计算</small>
      </div>
    </aside>
  );
}

function ExceptionSettings({
  field,
  scenario,
  onToggle,
  onRemoveAll,
}: {
  field: FieldDef;
  scenario: DetectionScenario;
  onToggle: (key: FieldOverrideKey, on: boolean) => void;
  onRemoveAll: () => void;
}) {
  const override = field.overrides.find((item) => item.scenario === scenario);
  const resolved = resolveField(field, scenario);
  const keys = Object.keys(fieldOverrideLabels) as FieldOverrideKey[];

  const describe = (key: FieldOverrideKey, source: FieldDef) => {
    if (key === "label") return source.label;
    if (key === "type") return typeLabels[source.type];
    if (key === "required") return source.required ? "必填" : "可选";
    if (key === "allowCustom") return source.allowCustom ? "允许" : "不允许";
    return source.options.map((option) => option.label).join(" / ");
  };

  return (
    <aside className="quotationFieldSettings">
      <h2>{field.label} · {scenarioShortLabels[scenario]} 例外</h2>
      <div className="fieldKeyRow">
        <code className="fieldKey">{field.key}</code>
        <span className="fieldKeyHint">与主值同一个字段</span>
      </div>

      <p className="quotationFieldScope isException">
        <span>没有盖住的属性继续跟随主值——主值改了，这里跟着变。</span>
      </p>

      <div className="quotationOverrideList">
        {keys.map((key) => {
          const isOverridden = override?.[key] !== undefined;
          return (
            <div className={`quotationOverrideRow ${isOverridden ? "isOverridden" : ""}`} key={key}>
              <header>
                <strong>{fieldOverrideLabels[key]}</strong>
                <button type="button" onClick={() => onToggle(key, !isOverridden)}>
                  {isOverridden ? "恢复跟随" : "盖住"}
                </button>
              </header>
              {isOverridden ? (
                <>
                  <p className="quotationOverrideBase"><span>主值</span>{describe(key, field)}</p>
                  <p className="quotationOverrideValue"><span>{scenarioShortLabels[scenario]}</span>{describe(key, resolved)}</p>
                </>
              ) : (
                <p className="quotationOverrideBase"><span>跟随主值</span>{describe(key, field)}</p>
              )}
            </div>
          );
        })}
      </div>

      {override?.note ? <p className="quotationOverrideNote">{override.note}</p> : null}

      <button className="quotationDrawerDanger" type="button" onClick={onRemoveAll}>整条例外恢复跟随主值</button>
    </aside>
  );
}

function ToggleRow({ label, on }: { label: string; on: boolean }) {
  const [value, setValue] = useState(on);
  return (
    <div className="quotationToggleRow" onClick={() => setValue(!value)} style={{ cursor: "pointer" }}>
      <span>{label}</span>
      <i className={value ? "on" : ""}><b /></i>
    </div>
  );
}
