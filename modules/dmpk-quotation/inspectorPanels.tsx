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
  ShieldCheck,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
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
  editingFieldId?: string | null;
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
  const [dialog, setDialog] = useState<"basis" | "adjust" | "suggest" | null>(null);
  const [adjustmentRequest, setAdjustmentRequest] = useState("");
  const [showAdjustmentPreview, setShowAdjustmentPreview] = useState(false);
  const [adjustmentApplied, setAdjustmentApplied] = useState(false);
  const [reason, setReason] = useState("");
  const [ruleSuggestion, setRuleSuggestion] = useState("以后 SD 大鼠超过 30 只时，动物使用费按 85 折计算");
  const goToRuleDraft = () => {
    const params = new URLSearchParams({ view: "quotation-management", business: "dmpk", tab: "rules", draft: ruleSuggestion });
    window.location.href = `/?${params.toString()}`;
  };
  const hasQuoteDraft = ["ready", "generating", "generated"].includes(context.stage);
  return <div className="dmpkInspectorList"><PanelIntro title={`${completed}/${context.fields.length} 项已确认`} meta="计价参数会随对话实时更新" />{hasQuoteDraft ? <section className="dmpkStrategySummary"><header><span><ShieldCheck size={15} /></span><div><strong>报价草稿</strong><small>DMPK 标准价格 · v1.0.13</small></div><em>{adjustmentApplied ? "已调整" : "已计算"}</em></header><p>已按当前参数计算 · 命中 5 项规则</p><footer><button type="button" onClick={() => setDialog("basis")}>查看费用明细</button><button type="button" onClick={() => { setShowAdjustmentPreview(false); setDialog("adjust"); }}>调整本次报价</button></footer></section> : null}{(Object.keys(groupLabels) as DmpkInspectorGroup[]).map((group) => {
    const fields = context.fields.filter((field) => field.group === group);
    const open = context.openGroups[group];
    const groupCompleted = fields.filter((field) => field.value).length;
    const progressClass = groupCompleted === fields.length ? "isComplete" : groupCompleted ? "isPartial" : "isEmpty";
    return <section className={`inspectorParameterGroup ${open ? "isOpen" : ""}`} key={group}><button className="inspectorParameterGroupHeader" type="button" aria-expanded={open} onClick={() => context.onToggleGroup(group)}><strong>{groupLabels[group]}</strong><span className={progressClass}>{groupCompleted}/{fields.length}<ChevronDown size={14} /></span></button>{open ? <div className="inspectorParameterFields">{fields.map((field) => field.value ? <button className={`inspectorParameterField ${context.editingFieldId === field.id ? "isEditing" : ""}`} type="button" key={field.id} onClick={() => context.onEditField(field.id)}><span>{field.label}</span><strong>{field.value}</strong><Edit3 size={13} /></button> : <div className="inspectorParameterField isEmpty" key={field.id}><span>{field.label}</span><strong>待填写</strong><span aria-hidden="true" /></div>)}</div> : null}</section>;
  })}{dialog === "basis" ? <StrategyDialog title="费用明细" onClose={() => setDialog(null)}><div className="strategyCostList"><div><span>动物使用费<small>36 × ¥120</small></span><strong>¥4,320</strong></div><div><span>方法开发费<small>1 × ¥6,000</small></span><strong>¥6,000</strong></div><div><span>样品检测费<small>216 × ¥180</small></span><strong>¥38,880</strong></div><div><span>报告费<small>1 × ¥3,000</small></span><strong>¥3,000</strong></div>{adjustmentApplied ? <div className="isOverride"><span>本次报价调整<small>报告费调整 · {reason || "长期合作项目"}</small></span><strong>−¥500</strong></div> : null}</div><section className="strategyMatchedRules"><strong>本次计算使用</strong><span>SD 大鼠标准价格</span><span>国内报价区域</span><span>PK 报价模板 v8</span></section></StrategyDialog> : null}{dialog === "adjust" ? <StrategyDrawer title="调整本次报价" onClose={() => setDialog(null)}><div className="strategyAssistantIntro"><span><Sparkles size={15} /></span><div><strong>DMPK 报价同事</strong><small>告诉我这次报价需要怎么调整</small></div></div><label className="strategyDialogField">调整要求<textarea rows={4} value={adjustmentRequest} onChange={(event) => { setAdjustmentRequest(event.target.value); setShowAdjustmentPreview(false); }} placeholder="例如：报告费改为 2,500 元，增加 1,200 元加急处理费，原因是长期合作项目" /></label><button className="strategyParseButton" type="button" disabled={!adjustmentRequest.trim()} onClick={() => { setShowAdjustmentPreview(true); setReason(adjustmentRequest.includes("原因") ? "长期合作项目" : "负责人本次调整"); }}><Sparkles size={14} />生成调整预览</button>{showAdjustmentPreview ? <section className="strategyAdjustmentPreview"><header><strong>请确认调整内容</strong><span>仅当前报价</span></header><div><span>报告费<small>¥3,000 → ¥2,500</small></span><strong>−¥500</strong></div><div><span><Plus size={13} /> 加急处理费<small>临时费用</small></span><strong>+¥1,200</strong></div><footer><span>报价总额</span><strong>¥52,200 → ¥52,900</strong></footer><p>调整原因：{reason}</p></section> : null}<p className="strategyScopeNote">确认后只修改当前报价草稿，并保留调整记录。</p><div className="strategyDialogActions"><button type="button" onClick={() => setDialog("suggest")}>希望以后都这样计算？</button><button className="primary" type="button" disabled={!showAdjustmentPreview} onClick={() => { setAdjustmentApplied(true); setDialog(null); }}>确认调整</button></div></StrategyDrawer> : null}{dialog === "suggest" ? <StrategyDialog title="建议更新全局规则" onClose={() => setDialog(null)}><label className="strategyDialogField">你希望以后如何计算？<textarea rows={4} value={ruleSuggestion} onChange={(event) => setRuleSuggestion(event.target.value)} /></label><p className="strategyScopeNote">AI 会结合当前报价生成规则草稿。全局规则仍需在报价管理中试算并发布。</p><div className="strategyDialogActions"><button type="button" onClick={() => setDialog(null)}>取消</button><button className="primary" type="button" onClick={goToRuleDraft}>生成并前往规则管理</button></div></StrategyDialog> : null}</div>;
}

function StrategyDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="strategyDialogBackdrop" role="dialog" aria-modal="true"><section className="strategyDialog"><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></header>{children}</section></div>;
}

function StrategyDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="strategyDrawerBackdrop" role="dialog" aria-modal="true"><section className="strategyDrawer"><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></header>{children}</section></div>;
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
