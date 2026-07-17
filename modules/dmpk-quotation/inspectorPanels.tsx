"use client";

import {
  Calculator,
  ChevronDown,
  CircleAlert,
  Clock3,
  Edit3,
  Eye,
  FileCheck2,
  FileInput,
  FileSpreadsheet,
  FileText,
  History,
  ListChecks,
  SlidersHorizontal,
} from "lucide-react";
import {
  resolveInspectorPanels,
  type InspectorContentState,
  type InspectorPanelRegistry,
  type ResolvedInspectorPanel,
} from "../../components/workbench-inspector/WorkbenchInspector";

export type DmpkInspectorStage = "idle" | "thinking" | "collecting" | "ready" | "generating" | "generated";
export type DmpkInspectorGroup = "assay" | "animal" | "analysis" | "delivery";

export type DmpkInspectorField = {
  id: string;
  label: string;
  value: string;
  required: boolean;
  group: DmpkInspectorGroup;
};

export type DmpkInspectorContext = {
  stage: DmpkInspectorStage;
  fields: DmpkInspectorField[];
  activeGroup: DmpkInspectorGroup;
  projectName: string;
  taskTitle: string;
  requestText: string;
  openGroups: Record<DmpkInspectorGroup, boolean>;
  onToggleGroup: (group: DmpkInspectorGroup) => void;
  errorMessage?: string;
  onEditField: (fieldId: string) => void;
  onPreviewArtifact: (kind: "word" | "excel") => void;
  onPreviewQuotation: () => void;
};

const groupLabels: Record<DmpkInspectorGroup, string> = {
  assay: "检测类型",
  animal: "动物实验",
  analysis: "生物分析",
  delivery: "报告与报价",
};

const stageLabels: Record<DmpkInspectorStage, string> = {
  idle: "等待任务描述",
  thinking: "识别报价意图",
  collecting: "补全报价参数",
  ready: "等待报价确认",
  generating: "生成报价产物",
  generated: "报价已生成",
};

const withError = (
  context: DmpkInspectorContext,
  state: InspectorContentState = "populated",
): InspectorContentState => context.errorMessage ? "error" : state;

const dmpkInspectorPanelRegistry: InspectorPanelRegistry<DmpkInspectorContext> = [
  {
    id: "parameters",
    label: "参数收集",
    icon: SlidersHorizontal,
    defaultWhen: (context) => context.stage !== "generated",
    state: (context) => withError(context),
    render: (context) => <ParametersPanel context={context} />,
  },
  {
    id: "process",
    label: "处理过程",
    icon: ListChecks,
    state: (context) => withError(
      context,
      context.stage === "thinking" || context.stage === "generating" ? "loading" : "populated",
    ),
    errorMessage: "处理过程暂时不可用",
    render: (context) => <ProcessPanel context={context} />,
  },
  {
    id: "materials",
    label: "输入材料",
    icon: FileInput,
    state: (context) => withError(context),
    errorMessage: "输入材料暂时不可用",
    render: (context) => <MaterialsPanel context={context} />,
  },
  {
    id: "gaps",
    label: "风险与缺失项",
    icon: CircleAlert,
    available: (context) => context.fields.some((field) => field.required && !field.value),
    state: (context) => withError(context),
    errorMessage: "缺失项检查暂时不可用",
    render: (context) => <GapsPanel context={context} />,
  },
  {
    id: "evidence",
    label: "计算依据",
    icon: Calculator,
    available: (context) => ["ready", "generating", "generated"].includes(context.stage),
    state: (context) => withError(context),
    errorMessage: "计算依据暂时不可用",
    render: (context) => <EvidencePanel onPreview={context.onPreviewQuotation} />,
  },
  {
    id: "artifacts",
    label: "报价结果",
    icon: FileCheck2,
    available: (context) => context.stage === "generated",
    defaultWhen: (context) => context.stage === "generated",
    state: (context) => withError(context),
    errorMessage: "报价结果暂时不可用",
    render: (context) => <ArtifactsPanel onPreview={context.onPreviewArtifact} />,
  },
  {
    id: "review",
    label: "审核记录",
    icon: History,
    available: (context) => context.stage === "generated",
    state: (context) => withError(context, "empty"),
    emptyMessage: "暂无审核记录",
    errorMessage: "审核记录暂时不可用",
    render: () => null,
  },
];

export function getDmpkInspectorPanels(context: DmpkInspectorContext): ResolvedInspectorPanel[] {
  return resolveInspectorPanels(dmpkInspectorPanelRegistry, context);
}

function ProcessPanel({ context }: { context: DmpkInspectorContext }) {
  const steps = [
    ["读取任务上下文", context.projectName, true],
    ["识别 DMPK 报价类型", "匹配报价数字同事", context.stage !== "idle"],
    ["核对计价关键字段", `${context.fields.filter((field) => field.value).length}/${context.fields.length} 项已确认`, ["collecting", "ready", "generating", "generated"].includes(context.stage)],
    ["生成并校验报价产物", "Word 与 Excel 金额一致", context.stage === "generated"],
  ] as const;

  return (
    <div className="dmpkInspectorList">
      <PanelIntro title={stageLabels[context.stage]} meta={context.taskTitle} />
      {steps.map(([title, meta, done], index) => (
        <div className="dmpkInspectorStep" key={title}>
          <span className={done ? "done" : index === steps.findIndex((step) => !step[2]) ? "active" : ""} />
          <div><strong>{title}</strong><small>{meta}</small></div>
        </div>
      ))}
    </div>
  );
}

function ParametersPanel({ context }: { context: DmpkInspectorContext }) {
  const completed = context.fields.filter((field) => field.value).length;
  return <div className="dmpkInspectorList"><PanelIntro title={`${completed}/${context.fields.length} 项已确认`} meta="计价参数会随对话实时更新" />{(Object.keys(groupLabels) as DmpkInspectorGroup[]).map((group) => {
    const fields = context.fields.filter((field) => field.group === group);
    const open = context.openGroups[group];
    const status = fields.every((field) => field.value) ? "已完成" : group === context.activeGroup ? "进行中" : "待填写";
    return <section className={`inspectorParameterGroup ${open ? "isOpen" : ""}`} key={group}><button className="inspectorParameterGroupHeader" type="button" aria-expanded={open} onClick={() => context.onToggleGroup(group)}><strong>{groupLabels[group]}</strong><span>{status}<ChevronDown size={14} /></span></button>{open ? <div className="inspectorParameterFields">{fields.map((field) => <button type="button" key={field.id} onClick={() => context.onEditField(field.id)}><span>{field.label}</span><strong className={field.value ? "" : "empty"}>{field.value || "待填写"}</strong><Edit3 size={13} /></button>)}</div> : null}</section>;
  })}</div>;
}

function MaterialsPanel({ context }: { context: DmpkInspectorContext }) {
  return (
    <div className="dmpkInspectorList">
      <PanelIntro title="当前任务上下文" meta={context.projectName} />
      <InspectorInfoRow icon={FileText} title="用户需求" meta={context.requestText || "等待用户补充任务要求"} />
      <InspectorInfoRow icon={FileSpreadsheet} title="项目资料" meta="当前项目文件 · 可调用" />
      <InspectorInfoRow icon={FileCheck2} title="报价规则" meta="组织规则 · 已发布版本" />
    </div>
  );
}

function GapsPanel({ context }: { context: DmpkInspectorContext }) {
  const missingGroups = (Object.keys(groupLabels) as DmpkInspectorGroup[])
    .map((group) => ({
      group,
      fields: context.fields.filter((field) => field.group === group && field.required && !field.value),
    }))
    .filter((item) => item.fields.length > 0);

  return (
    <div className="dmpkInspectorList">
      <PanelIntro title={`${missingGroups.reduce((sum, item) => sum + item.fields.length, 0)} 项待补充`} meta="补齐后才能生成正式报价" />
      {missingGroups.map(({ group, fields }) => (
        <div className="dmpkInspectorIssue" key={group}>
          <div><strong>{groupLabels[group]}</strong><small>{fields.map((field) => field.label).join("、")}</small></div>
          <button type="button" aria-label={`补充${groupLabels[group]}`} onClick={() => context.onEditField(fields[0].id)}><Edit3 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function EvidencePanel({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="dmpkInspectorList">
      <PanelIntro title="计价规则" meta="以已确认参数匹配当前发布版本" />
      <InspectorInfoRow icon={Calculator} title="动物实验" meta="种属、组数、数量与周期" />
      <InspectorInfoRow icon={Calculator} title="生物分析" meta="方法、样品与待测物数量" />
      <InspectorInfoRow icon={Calculator} title="交付管理费" meta="Word 30% · Excel 15%" />
      <button className="dmpkInspectorTextAction" type="button" onClick={onPreview}>查看完整参数与金额校验</button>
    </div>
  );
}

function ArtifactsPanel({ onPreview }: { onPreview: (kind: "word" | "excel") => void }) {
  return (
    <div className="dmpkInspectorList">
      <PanelIntro title="报价版本 v1" meta="刚刚生成 · 金额校验一致" />
      <ArtifactRow icon={FileText} title="中文 Word 报价单" meta="30% 管理费" onPreview={() => onPreview("word")} />
      <ArtifactRow icon={FileSpreadsheet} title="Excel 报价明细" meta="15% 管理费" onPreview={() => onPreview("excel")} />
    </div>
  );
}

function PanelIntro({ title, meta }: { title: string; meta: string }) {
  return <div className="dmpkInspectorIntro"><strong>{title}</strong><span>{meta}</span></div>;
}

function InspectorInfoRow({ icon: Icon, title, meta }: { icon: typeof FileText; title: string; meta: string }) {
  return <div className="dmpkInspectorInfoRow"><Icon size={16} /><div><strong>{title}</strong><small>{meta}</small></div></div>;
}

function ArtifactRow({ icon: Icon, title, meta, onPreview }: { icon: typeof FileText; title: string; meta: string; onPreview: () => void }) {
  return (
    <div className="dmpkInspectorArtifact">
      <Icon size={17} />
      <div><strong>{title}</strong><small>{meta}</small></div>
      <button type="button" aria-label={`预览${title}`} onClick={onPreview}><Eye size={14} /></button>
    </div>
  );
}
