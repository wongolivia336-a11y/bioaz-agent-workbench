"use client";

import {
  ArrowUpRight,
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
  CornerDownLeft,
  History,
  ListChecks,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useModalDismiss } from "../../components/ui/useModalDismiss";
import {
  resolveInspectorPanels,
  type InspectorContentState,
  type InspectorPanelRegistry,
  type ResolvedInspectorPanel,
} from "../../components/workbench-inspector/WorkbenchInspector";
import { AnnotatedQuote } from "../../components/workbench-shell/AnnotatedQuote";
import { noteAnchorToField } from "./noteFieldMap";
import { quoteAnchorLabel, type QuoteNote } from "../../lib/workbench/quoteData";

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
  /** 面板只负责说清楚：要改什么就把现成的话填进 composer，由对话完成修改 */
  onDraftMessage: (text: string) => void;
  /* 被退回的那一版带回来的批注。空数组＝这一单没被退回过，
     「退回批注」那个 tab 也就不存在。 */
  reworkNotes: QuoteNote[];
  reworkBy?: string;
  reworkAt?: string;
  reworkReason?: string;
  /** 画布铺开了没有。铺开才排三列，320px 的侧栏里排不下。 */
  expanded?: boolean;
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
    /* 进度已经在面板内容的标题行给了，tab 上不再重复一遍 */
    label: "参数收集",
    icon: SlidersHorizontal,
    primary: true,
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
    expandable: true,
    available: (context) => ["ready", "generating", "generated"].includes(context.stage),
    state: (context) => withError(context),
    errorMessage: "计算依据暂时不可用",
    render: (context) => <EvidencePanel onPreview={context.onPreviewQuotation} />,
  },
  {
    id: "artifacts",
    label: "报价结果",
    icon: FileCheck2,
    primary: true,
    expandable: true,
    available: (context) => context.stage === "generated",
    defaultWhen: (context) => context.stage === "generated",
    state: (context) => withError(context),
    errorMessage: "报价结果暂时不可用",
    render: (context) => <ArtifactsPanel onPreview={context.onPreviewArtifact} />,
  },
  {
    id: "rules",
    label: "报价规则",
    icon: ShieldCheck,
    primary: true,
    expandable: true,
    available: (context) => context.stage !== "idle",
    state: (context) => withError(context),
    errorMessage: "报价规则暂时不可用",
    render: (context) => <RulesPanel context={context} />,
  },
  {
    /* 退回批注。它不是「过程」也不是「结果」，是一份**要照着改的原件**。
       给它自己的 tab，并且默认铺开成画布——报价单、批注、参数三样并排，
       在 320px 的侧栏里读不了。 */
    id: "rework",
    label: "退回批注",
    icon: CornerDownLeft,
    primary: true,
    expandable: true,
    available: (context) => context.reworkNotes.length > 0,
    state: (context) => (context.reworkNotes.length ? withError(context) : "empty"),
    emptyMessage: "本版没有退回批注",
    errorMessage: "退回批注暂时不可用",
    render: (context) => <ReworkPanel context={context} />,
  },
  {
    id: "review",
    label: "审核记录",
    icon: History,
    expandable: true,
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

/**
 * 退回批注面板。
 *
 * 三样东西怎么摆
 * ----------------------------------------------------------------------
 * 赵敏要跑的这一圈是：**读批注 → 找到那一格 → 改 → 确认**。
 * 涉及三个面：批注与原文、参数收集、对话。它们不是三个平级的栏——
 *
 *   批注 + 原文   是**参照**，从头到尾都得看着
 *   参数收集       是**动手的地方**
 *   对话           是**落笔的地方**（确认发生在这里）
 *
 * 所以画布里排两栏：左边参照（原件 + 批注），右边动手（参数收集）；
 * 对话在画布模式下自动收成底部那颗浮动 dock，一直在，但不占列宽。
 * 三样同屏，谁也不用切走。
 *
 * 最要紧的一条：**批注和参数之间的对应关系要画出来，不能靠人记。**
 * 能映射到参数的批注，卡上直接给「去改这一项」；映射不到的（比如表述类），
 * 给「在对话里说明」，把话填进输入框。两套词表本来就不一一对应，
 * 与其假装对得上，不如把对不上的那几条明说。
 */
function ReworkPanel({ context }: { context: DmpkInspectorContext }) {
  const blocking = context.reworkNotes.filter((note) => note.severity === "blocking").length;
  return (
    <div className={`dmpkReworkPanel${context.expanded ? " isExpanded" : ""}`}>
      <PanelIntro
        title={`${context.reworkBy ?? "审批人"} 退回了这一版`}
        meta={`${context.reworkAt ?? ""} · 共 ${context.reworkNotes.length} 条批注${blocking ? `，其中 ${blocking} 条必须修订` : ""}`}
      />
      {context.reworkReason ? <p className="dmpkReworkReason">{context.reworkReason}</p> : null}

      {/* 一个平面：左边报价单，右边批注栏。跟 QA 审核台同一个形状。
          动作长在每张批注卡下面——原来另起了一份「待改清单」，那是把同一份
          东西列了两遍，中间还套了三层框。 */}
      <AnnotatedQuote
        notes={context.reworkNotes}
        className="isPanel"
        noteAction={(note) => <ReworkNoteAction note={note} context={context} />}
      />
    </div>
  );
}

/** 一条批注的出口：能落到参数上就去改那一格，落不到就把话筒递回对话。 */
function ReworkNoteAction({ note, context }: { note: QuoteNote; context: DmpkInspectorContext }) {
  const fieldId = noteAnchorToField[note.anchorId];
  const field = fieldId ? context.fields.find((item) => item.id === fieldId) : undefined;
  if (field) {
    return (
      <button type="button" onClick={() => context.onEditField(field.id)}>
        去改「{field.label}」
      </button>
    );
  }
  /* 这一条落不到任何一格参数上——报价单的条目和会话收的字段本来就不是
     一一对应。与其给个点了没反应的按钮，不如把话筒递回去。 */
  return (
    <button type="button" onClick={() => context.onDraftMessage(`关于「${quoteAnchorLabel(note.anchorId)}」：`)}>
      在对话里说明
    </button>
  );
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
  const pct = context.fields.length ? Math.round((completed / context.fields.length) * 100) : 0;
  return <div className="dmpkInspectorList paramCollectList"><div className="paramCollectProgress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>{(Object.keys(groupLabels) as DmpkInspectorGroup[]).map((group) => {
    const fields = context.fields.filter((field) => field.group === group);
    const open = context.openGroups[group];
    const groupCompleted = fields.filter((field) => field.value).length;
    const progressClass = groupCompleted === fields.length ? "isComplete" : groupCompleted ? "isPartial" : "isEmpty";
    const stateLabel = groupCompleted === fields.length ? "已完成" : groupCompleted ? "进行中" : "未开始";
    return <section className={`inspectorParameterGroup ${progressClass} ${open ? "isOpen" : ""}`} key={group}><button className="inspectorParameterGroupHeader" type="button" aria-expanded={open} onClick={() => context.onToggleGroup(group)}><i className="paramGroupDot" aria-hidden="true" /><strong>{groupLabels[group]}</strong><span className={progressClass}><em className="paramGroupState">{stateLabel}</em><ChevronDown size={14} /></span></button>{open ? <div className="inspectorParameterFields">{fields.map((field) => field.value ? <button className={`inspectorParameterField ${context.editingFieldId === field.id ? "isEditing" : ""}`} type="button" key={field.id} onClick={() => context.onEditField(field.id)}><span>{field.label}</span><strong>{field.value}</strong><Edit3 size={13} /></button> : <div className="inspectorParameterField isEmpty" key={field.id}><span>{field.label}</span><strong>待填写</strong><span aria-hidden="true" /></div>)}</div> : null}</section>;
  })}</div>;
}

/**
 * 报价规则：把后台的计价配置在前台做轻量披露。
 * 边界与既有的 DmpkEditProposalCard 一致——本次报价级可改，全局规则只读并深链到后台。
 */
function RulesPanel({ context }: { context: DmpkInspectorContext }) {
  const [costOpen, setCostOpen] = useState(false);
  const hasQuoteDraft = ["ready", "generating", "generated"].includes(context.stage);

  const goToBackOffice = (tab: "prices" | "rules" | "parameters" | "templates") => {
    const params = new URLSearchParams({ view: "quotation-management", business: "dmpk", tab });
    window.location.href = `/?${params.toString()}`;
  };

  return (
    <div className="dmpkInspectorList ruleDisclosure">
      <PanelIntro title="本次报价" meta={hasQuoteDraft ? "以下规则只作用于这一份报价" : "参数补齐后开始匹配"} />

      {/* 可改的一段有实体：卡片、边框、按钮 */}
      <section className="ruleScopeCard">
        <header>
          <strong>本次命中的规则</strong>
          <small>仅影响这份报价</small>
        </header>
        {matchedRules.map((rule) => (
          <div className="ruleScopeRow" key={rule.id}>
            <div>
              <strong>{rule.label}</strong>
              <small>{rule.meta}</small>
            </div>
            <button type="button" disabled={!hasQuoteDraft} onClick={() => context.onDraftMessage(rule.draft)}>
              <Edit3 size={13} />改这条
            </button>
          </div>
        ))}
        <div className="ruleScopeActions">
          <button type="button" disabled={!hasQuoteDraft} onClick={() => setCostOpen(true)}>
            <Calculator size={14} />查看费用明细
          </button>
          <button className="primary" type="button" disabled={!hasQuoteDraft} onClick={() => context.onDraftMessage("我想调整本次报价：")}>
            <Sparkles size={14} />对话编辑
          </button>
        </div>
        <p className="ruleScopeNote">改动以对话形式提交，确认后只作用于当前报价并保留记录。</p>
      </section>

      <div className="ruleDisclosureDivider" />

      {/* 只读的一段没实体：素文本行，只提供去后台的路径 */}
      <PanelIntro title="全局规则" meta="只读 · 影响后续所有 PK 报价" />
      <div className="ruleGlobalList">
        {globalRuleSources.map((source) => (
          <button type="button" className="ruleGlobalRow" key={source.tab} onClick={() => goToBackOffice(source.tab)}>
            <span>
              <strong>{source.label}</strong>
              <small>{source.meta}</small>
            </span>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      <p className="ruleGlobalNote">全局规则需要在报价管理后台试算并发布，前台不提供直接修改。</p>

      {costOpen ? (
        <StrategyDialog title="费用明细" onClose={() => setCostOpen(false)}>
          <div className="strategyCostList">
            <div><span>动物使用费<small>36 × ¥120</small></span><strong>¥4,320</strong></div>
            <div><span>方法开发费<small>1 × ¥6,000</small></span><strong>¥6,000</strong></div>
            <div><span>样品检测费<small>216 × ¥180</small></span><strong>¥38,880</strong></div>
            <div><span>报告费<small>1 × ¥3,000</small></span><strong>¥3,000</strong></div>
          </div>
          <section className="strategyMatchedRules">
            <strong>本次计算使用</strong>
            {matchedRules.map((rule) => <span key={rule.id}>{rule.label}</span>)}
          </section>
        </StrategyDialog>
      ) : null}
    </div>
  );
}

/** 本次命中的规则。draft 是点「改这条」时填进 composer 的现成句子。 */
const matchedRules = [
  { id: "animal-price", label: "SD 大鼠标准价格", meta: "动物使用费 ¥120 / 只", draft: "把本次报价的动物使用费改为 " },
  { id: "region", label: "国内报价区域", meta: "不含跨境与加急附加", draft: "本次报价改用欧美区域计价" },
  { id: "template", label: "PK 报价模板 v8", meta: "Word 30% · Excel 15% 管理费", draft: "把本次报价的管理费比例改为 " },
  { id: "report-fee", label: "报告费", meta: "¥3,000 / 份", draft: "把本次报价的报告费改为 " },
];

/** 与后台四个配置页一一对应，点哪一行就跳到哪一页 */
const globalRuleSources = [
  { tab: "prices" as const, label: "标准价格", meta: "当前发布版本 v1.0.13" },
  { tab: "rules" as const, label: "计价规则", meta: "已发布 · 6月28日" },
  { tab: "parameters" as const, label: "报价字段", meta: "参数字典 · 7月8日" },
  { tab: "templates" as const, label: "报价模板", meta: "PK 报价模板 v8" },
];

function StrategyDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dismiss = useModalDismiss(onClose);
  return <div className="strategyDialogBackdrop" role="presentation" {...dismiss}><section className="strategyDialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></header>{children}</section></div>;
}

function StrategyDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dismiss = useModalDismiss(onClose);
  return <div className="strategyDrawerBackdrop" role="presentation" {...dismiss}><section className="strategyDrawer" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></header>{children}</section></div>;
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
