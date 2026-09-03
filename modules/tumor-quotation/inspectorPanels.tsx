"use client";

import { Eye, FileCheck2, FileSpreadsheet, FileText, ListChecks, SlidersHorizontal } from "lucide-react";
import { ParameterLedger } from "../../components/params";
import {
  resolveInspectorPanels,
  type InspectorPanelRegistry,
  type ResolvedInspectorPanel,
} from "../../components/workbench-inspector/WorkbenchInspector";
import { tumorGroups, type TumorField, type TumorGroupId, type TumorStage } from "./fields";

export type TumorInspectorPanelId = "parameters" | "process" | "artifacts";

export type TumorInspectorContext = {
  stage: TumorStage;
  fields: TumorField[];
  projectName: string;
  taskTitle: string;
  openGroups: Record<TumorGroupId, boolean>;
  onToggleGroup: (group: TumorGroupId) => void;
  onEditField: (fieldId: string) => void;
  editingFieldId?: string | null;
  onPreviewArtifact: (kind: "word" | "excel") => void;
};

const stageLabels: Record<TumorStage, string> = {
  idle: "等待任务描述",
  thinking: "识别报价意图",
  collecting: "补全报价参数",
  ready: "等待报价确认",
  generating: "生成报价产物",
  generated: "报价已生成",
};

/* 三个 tab，不多给。DMPK 那边的「输入材料 / 缺失项 / 计算依据 / 审核记录」
   都是它自己流程里长出来的东西；肿瘤报价现在没有那几步，先摆上一个
   永远是空态的 tab，只会让人每次都去点一下确认它还是空的。 */
const tumorInspectorPanelRegistry: InspectorPanelRegistry<TumorInspectorContext> = [
  {
    id: "parameters",
    label: "参数台账",
    icon: SlidersHorizontal,
    primary: true,
    defaultWhen: (context) => context.stage !== "generated",
    state: () => "populated",
    render: (context) => (
      <ParameterLedger
        groups={tumorGroups}
        fields={context.fields}
        openGroups={context.openGroups}
        editingFieldId={context.editingFieldId}
        onToggleGroup={(groupId) => context.onToggleGroup(groupId as TumorGroupId)}
        onEditField={context.onEditField}
      />
    ),
  },
  {
    id: "process",
    label: "处理过程",
    icon: ListChecks,
    state: (context) => (context.stage === "thinking" || context.stage === "generating" ? "loading" : "populated"),
    render: (context) => <ProcessPanel context={context} />,
  },
  {
    id: "artifacts",
    label: "报价结果",
    icon: FileCheck2,
    primary: true,
    expandable: true,
    available: (context) => context.stage === "generated",
    defaultWhen: (context) => context.stage === "generated",
    state: () => "populated",
    render: (context) => <ArtifactsPanel onPreview={context.onPreviewArtifact} />,
  },
];

export function getTumorInspectorPanels(context: TumorInspectorContext): ResolvedInspectorPanel[] {
  return resolveInspectorPanels(tumorInspectorPanelRegistry, context);
}

function ProcessPanel({ context }: { context: TumorInspectorContext }) {
  const filled = context.fields.filter((field) => field.value).length;
  const steps = [
    ["读取任务上下文", context.projectName, true],
    ["识别肿瘤药效报价类型", "匹配肿瘤报价数字同事", context.stage !== "idle"],
    ["核对计价关键字段", `${filled}/${context.fields.length} 项已确认`, ["collecting", "ready", "generating", "generated"].includes(context.stage)],
    ["生成并校验报价产物", "Word 与 Excel 金额一致", context.stage === "generated"],
  ] as const;

  return (
    <div className="dmpkInspectorList">
      <div className="dmpkInspectorIntro"><strong>{stageLabels[context.stage]}</strong><span>{context.taskTitle}</span></div>
      {steps.map(([title, meta, done], index) => (
        <div className="dmpkInspectorStep" key={title}>
          <span className={done ? "done" : index === steps.findIndex((step) => !step[2]) ? "active" : ""} />
          <div><strong>{title}</strong><small>{meta}</small></div>
        </div>
      ))}
    </div>
  );
}

function ArtifactsPanel({ onPreview }: { onPreview: (kind: "word" | "excel") => void }) {
  return (
    <div className="dmpkInspectorList">
      <div className="dmpkInspectorIntro"><strong>报价产物</strong><span>Word 报价单与 Excel 报价明细，金额校验一致</span></div>
      {([
        ["word", FileText, "中文 Word 报价单", "30% 管理费"],
        ["excel", FileSpreadsheet, "Excel 报价明细", "15% 管理费"],
      ] as const).map(([kind, Icon, title, meta]) => (
        <div className="dmpkInspectorArtifact" key={kind}>
          <Icon size={17} />
          <div><strong>{title}</strong><small>{meta}</small></div>
          <button type="button" aria-label={`预览${title}`} onClick={() => onPreview(kind)}><Eye size={14} /></button>
        </div>
      ))}
    </div>
  );
}
