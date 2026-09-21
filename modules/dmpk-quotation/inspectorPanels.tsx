"use client";

import {
  ArrowRight,
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
  LayoutList,
  ListChecks,
  Lock,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { ParameterLedger, type ParamField } from "../../components/params";
import { useModalDismiss } from "../../components/ui/useModalDismiss";
import { sourceKindLabels, sourceRoleLabels, type ParseResult } from "../../lib/workbench/sources";
import {
  effectiveStatus,
  formatCny,
  lineAmount,
  lineUnitPrice,
  quoteLineStatusLabels,
  summarizeLines,
  type ManualPrice,
  type QuoteLine,
} from "../../lib/workbench/quoteLines";
import { dmpkGroups, initialDmpkFields } from "./fields";
import {
  resolveInspectorPanels,
  type InspectorContentState,
  type InspectorPanelRegistry,
  type ResolvedInspectorPanel,
} from "../../components/workbench-inspector/WorkbenchInspector";
import { AnnotatedQuote } from "../../components/workbench-shell/AnnotatedQuote";
import { noteAnchorToField } from "./noteFieldMap";
import { quoteAnchorLabel, quoteCurrentValue, quoteNoteSeverityLabel, type QuoteNote } from "../../lib/workbench/quoteData";

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
  /* 这条会话读过的来源。「输入材料」列它们和读出来的事实，
     「报价规则」列其中没有价目的那几项。没传就是没传过文件。 */
  sources?: ParseResult[];
  /* 确认状态：文件认出来的（recognized）还是人点过头的（confirmed）。
     台账只标前者——多数行都是确认过的，每行挂「已确认」等于什么都没说。 */
  fieldStatus?: Record<string, "recognized" | "confirmed">;
  /* 报价行与手动单价。行从事实推出来的，手动价按行 id 记在会话里；
     「报价明细」按工作包列行、小计、总额，「费用明细」弹窗读同一份。 */
  quoteLines?: QuoteLine[];
  manualPrices?: Record<string, ManualPrice>;
  onSetManualPrice?: (lineId: string, price: number) => void;
  onClearManualPrice?: (lineId: string) => void;
  /* 出过的那版跟眼前的参数 / 单价对不上了。改单价不经过参数卡，
     「重新生成」的出口就在报价结果的版本卡上。 */
  quoteStale?: boolean;
  onRegenerate?: () => void;
  /* 「核对已有信息并重新计算」：人说「我说过了」时回去翻材料和对话。 */
  onRecheck?: () => void;
  /* 完整价目表那扇门（2026-09-21 会议共识 2：价目表不进对话，独立入口）。
     viewerRole 决定门是按钮还是一行说明——权限分级后置，这只是账号切换器上的演示。 */
  viewerRole?: "author" | "approver" | "owner";
  onOpenCatalog?: () => void;
  reworkBy?: string;
  reworkAt?: string;
  reworkReason?: string;
  /* 这一栏放不放得下报价单那张纸。
     **不等于「面板全屏了」**：并列之后，全屏时每一列还是三五百像素，
     纸摆进去照样读不了。放不下就只显示批注列表——列表窄了仍然读得了。 */
  expanded?: boolean;
  /* 这一单出过几版报价。返工场景里「出过第二版」本身就是要给人看的信息。 */
  quoteVersions: { id: string; label: string; at: string; origin: string }[];
};

/** 价目表当前发布版本。改价时要把它写在原价旁边——人得知道自己改的是哪一版的价。 */
const CATALOG_VERSION = "v1.0.13";

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
    /* 2026-09-21 会议定的右栏正主：按板块列「待测物 / 检测方法 / 数量 / 单价」，
       单价旁就是改价——临时调价的唯一路径。来源、公式、规则一概不在这儿，
       要看去「报价明细」和「报价规则」。有行就有它，行从字段推，填一项亮一行。 */
    id: "sections",
    label: "报价板块",
    icon: LayoutList,
    primary: true,
    expandable: true,
    available: (context) => Boolean(context.quoteLines?.length),
    defaultWhen: (context) => Boolean(context.quoteLines?.length) && context.stage !== "generated",
    state: (context) => withError(context),
    errorMessage: "报价板块暂时不可用",
    render: (context) => <QuoteSectionsPanel context={context} />,
  },
  {
    /* 原来叫「计算依据」，只在参数齐了之后才有。现在它是一张账：
       读完方案条件齐的行就先计价，所以有行就开，不等参数齐。
       没读过方案的会话没有行，还是原来那三行规则摘要。 */
    id: "evidence",
    label: "报价明细",
    icon: Calculator,
    expandable: true,
    available: (context) => Boolean(context.quoteLines?.length) || ["ready", "generating", "generated"].includes(context.stage),
    state: (context) => withError(context),
    errorMessage: "报价明细暂时不可用",
    render: (context) => context.quoteLines?.length
      ? <QuoteLinesPanel context={context} />
      : <EvidencePanel onPreview={context.onPreviewQuotation} />,
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
    render: (context) => <ArtifactsPanel context={context} onPreview={context.onPreviewArtifact} />,
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
    /* 退回批注。它不是「过程」也不是「结果」，是一份**要照着改的参照**。
       给它自己的 tab，并且在退回场景里默认和参数收集并排成两列——
       读批注和改参数要同时在眼前，来回切标签等于让人拿脑子记。 */
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
 * 所以右侧面板并成两列：左列参照（批注列表），右列动手（参数收集）；
 * 对话和输入框始终在中间那一路，落笔就在那儿。三样同屏，谁也不用切走。
 *
 * 原件那张纸不在这里——它太宽，320 到 400 的一列摆不下。
 * 要核对原文时把它铺成中间的画布（只读），核完收起来接着改。
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

          **这一栏是说明书，不是操作台。** 批注上没有任何动作按钮——
          它的全部职责是让人看清「哪一行、错在哪、该是多少」，
          改这件事发生在右侧参数收集里，由人自己点。
          在这儿再放一颗「去改」，等于给了第二条改的路径，
          而两条路径迟早会对不上。 */}
      <AnnotatedQuote notes={context.reworkNotes} className="isPanel" />

      {/* 一列放不下报价单那张纸，但**批注本身放得下**。
          原来这儿只剩标题和驳回理由，等于告诉人「有 3 条批注」却不给看，
          还得先摊开画布才知道是哪 3 条——而现在并列之后，
          这份列表就是左列的正文，是这一屏最常看的东西。 */}
      <ul className="dmpkReworkList">
        {context.reworkNotes.map((note) => (
          <li key={note.anchorId} className={`is-${note.severity}`}>
            <span className="dmpkReworkListHead">
              <i className={`quoteNoteSev is-${note.severity}`}>{quoteNoteSeverityLabel[note.severity]}</i>
              <strong>{quoteAnchorLabel(note.anchorId)}</strong>
            </span>
            {note.suggested ? (
              <span className="quoteNoteDiff">
                <s>{quoteCurrentValue(note.anchorId) || "—"}</s>
                <ArrowRight size={11} aria-hidden="true" />
                <b>{note.suggested}</b>
              </span>
            ) : null}
            <p>{note.text}</p>
            <span className="quoteNoteBy">{note.author} · {note.authorRole} · {note.at}</span>
          </li>
        ))}
      </ul>
    </div>
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

/* 台账搬到了 components/params/ParameterLedger——跟肿瘤报价共用同一份。
   DMPK 十四项全是必填，所以按必填算进度和原来按全量算是同一个数。 */
function ParametersPanel({ context }: { context: DmpkInspectorContext }) {
  return (
    <ParameterLedger
      groups={dmpkGroups}
      fields={context.fields as ParamField[]}
      openGroups={context.openGroups}
      editingFieldId={context.editingFieldId}
      statusOf={context.fieldStatus ? (fieldId) => context.fieldStatus?.[fieldId] : undefined}
      onToggleGroup={(groupId) => context.onToggleGroup(groupId as DmpkInspectorGroup)}
      onEditField={context.onEditField}
    />
  );
}

/**
 * 报价规则：把后台的计价配置在前台做轻量披露。
 * 边界与既有的 DmpkEditProposalCard 一致——本次报价级可改，全局规则只读并深链到后台。
 */
function RulesPanel({ context }: { context: DmpkInspectorContext }) {
  const [costOpen, setCostOpen] = useState(false);
  const hasQuoteDraft = ["ready", "generating", "generated"].includes(context.stage);
  /* 读文件读出来的「没有价目」。
     它们不是人能在前台填的：后台没维护这一项的价目或公式，填一个临时价等于
     绕过规则。所以不进参数卡，在这儿列出来，出口是后台的标准价格。 */
  const catalogGaps = (context.sources ?? [])
    .flatMap((source) => source.pending)
    .filter((item) => item.kind === "catalog")
    /* 同一项委托在两份来源里都没价目，是同一件事，列一次。 */
    .filter((item, index, items) => items.findIndex((other) => other.label === item.label) === index);
  const costSummary = context.quoteLines?.length ? summarizeLines(context.quoteLines, context.manualPrices) : null;

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

      {catalogGaps.length ? (
        <section className="dmpkCatalogGaps" aria-label="没有价目的委托项">
          <header>
            <CircleAlert size={14} aria-hidden="true" />
            <strong>{catalogGaps.length} 项没有价目</strong>
            <small>本次未计价，不代表免费</small>
          </header>
          <ul>
            {catalogGaps.map((item) => (
              <li key={item.id}>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => goToBackOffice("prices")}>
            去标准价格补价目<ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </section>
      ) : null}

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
          {/* 有账就读账——跟「报价明细」是同一份行，按工作包给小计；
              没账（没传过方案）才是原来那四行示意。两处不能各有一套数。 */}
          {costSummary ? (
            <div className="strategyCostList">
              {costSummary.packages.map((pkg) => (
                <div key={pkg.id}><span>{pkg.label}<small>{pkg.lines.length} 行{pkg.unpriced ? ` · ${pkg.unpriced} 行未计价` : ""}</small></span><strong>{formatCny(pkg.subtotal)}</strong></div>
              ))}
              <div><span>已计价合计<small>{costSummary.unpricedCount ? "不含未计价行" : "全部行"}</small></span><strong>{formatCny(costSummary.total)}</strong></div>
            </div>
          ) : (
            <div className="strategyCostList">
              <div><span>动物使用费<small>36 × ¥120</small></span><strong>¥4,320</strong></div>
              <div><span>方法开发费<small>1 × ¥6,000</small></span><strong>¥6,000</strong></div>
              <div><span>样品检测费<small>216 × ¥180</small></span><strong>¥38,880</strong></div>
              <div><span>报告费<small>1 × ¥3,000</small></span><strong>¥3,000</strong></div>
            </div>
          )}
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
  { tab: "prices" as const, label: "标准价格", meta: `当前发布版本 ${CATALOG_VERSION}` },
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

/**
 * 输入材料：读过什么，读出了什么。
 *
 * 读到但没格子放的东西落在这里
 * ----------------------------------------------------------------------
 * 一份真实方案里有 7 个动物组、37 个采样事件、7 个分析方法——比十四项参数
 * 大得多。它们不进字段（模型不动），但人核对时得看得见：「它说 7 组，
 * 是哪 7 组」。所以每份来源下面挂它读出来的事实，只读，能展开。
 * 数量写在标题上，展开才是明细；37 行采样事件平铺在 320px 的一栏里
 * 是一堵墙，折成一行「37 项 · 479 份」才扫得动。
 */
function MaterialsPanel({ context }: { context: DmpkInspectorContext }) {
  const sources = context.sources ?? [];
  return (
    <div className="dmpkInspectorList">
      <PanelIntro title="当前任务上下文" meta={context.projectName} />
      {sources.map((source) => <SourceCard key={source.sourceId} source={source} />)}
      {context.requestText ? <InspectorInfoRow icon={FileText} title="用户需求" meta={context.requestText} /> : null}
      {!sources.length && !context.requestText ? <InspectorInfoRow icon={FileText} title="用户需求" meta="等待用户补充任务要求" /> : null}
      <InspectorInfoRow icon={FileSpreadsheet} title="项目资料" meta="当前项目文件 · 可调用" />
      <InspectorInfoRow icon={FileCheck2} title="报价规则" meta="组织规则 · 已发布版本" />
    </div>
  );
}

function SourceCard({ source }: { source: ParseResult }) {
  const [openFactId, setOpenFactId] = useState<string | null>(null);
  const readable = source.role !== "unknown";
  return (
    <section className={`dmpkSourceCard${readable ? "" : " isUnread"}`}>
      <header>
        <FileInput size={16} aria-hidden="true" />
        <div>
          <strong>{source.sourceLabel}</strong>
          <small>{sourceKindLabels[source.kind]} · {readable ? sourceRoleLabels[source.role] : "尚未接入解析"}</small>
        </div>
      </header>
      {readable ? <p className="dmpkSourceTitle">{source.title}</p> : null}
      {/* 这份材料喂了哪几项参数、各从哪儿读的——「展示提取信息」那一半。
          值不在这儿改（改在台账），这儿只说来处。 */}
      {Object.keys(source.patch).length ? (
        <ul className="dmpkSourcePatchList">
          {Object.entries(source.patch).map(([fieldId, value]) => (
            <li key={fieldId}>
              <span>{initialDmpkFields.find((field) => field.id === fieldId)?.label ?? fieldId}</span>
              <strong>{value}</strong>
              {source.patchSources?.[fieldId] ? <em>{source.patchSources[fieldId].anchor}</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {source.facts.length ? (
        <ul className="dmpkFactList">
          {source.facts.map((fact) => {
            const expandable = Boolean(fact.items?.length);
            const open = openFactId === fact.id;
            return (
              <li key={fact.id}>
                <button
                  type="button"
                  disabled={!expandable}
                  aria-expanded={expandable ? open : undefined}
                  onClick={() => setOpenFactId(open ? null : fact.id)}
                >
                  <span className="dmpkFactHead">
                    <strong>{fact.label}</strong>
                    {fact.anchor ? <em>{fact.anchor}</em> : null}
                  </span>
                  <small>{fact.summary}</small>
                  {expandable ? <ChevronDown size={13} className="dmpkFactChevron" aria-hidden="true" /> : null}
                </button>
                {open && fact.items ? (
                  <ol>{fact.items.map((item) => <li key={item}>{item}</li>)}</ol>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
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
      {/* 「这些我已经给过了」——让系统回去翻材料和对话，而不是让人再说一遍。
          找不回的它会明说，不假装找到。 */}
      {context.onRecheck ? (
        <button className="dmpkInspectorTextAction" type="button" onClick={() => context.onRecheck?.()}>这些信息已经提供过？核对已有信息并重新计算</button>
      ) : null}
    </div>
  );
}

/**
 * 报价板块（2026-09-21 会议定的右栏正主）。
 *
 * 右栏只做两件事：已收集参数的状态展示，和对应的单价
 * ----------------------------------------------------------------------
 * 按板块（PK / TOX / BA / ADA，配套的动物与报告排最后）分段，一段里一行一项服务，
 * 每行只放会上点名的四要素：**待测物 / 检测方法 / 数量 / 单价**。剂量组、核心 / 卫星
 * 这类描述性细节全部折进「数量」那一格的小字；来源、公式、规则一概不进这儿——
 * 要看去「报价明细」和「报价规则」，那两个 tab 都还在。
 *
 * 改价是临时调价的唯一路径
 * ----------------------------------------------------------------------
 * 单价旁一颗「改价」，就地展开：先把原价和价目版本写出来，再让人填新价，**点确认才落**
 * （不像报价明细那边失焦就落——会上要的是「告知原价 → 输入新价 → 确认」这个闭环）。
 * 落下之后单价换成临时价，旁边挂「临时价 · 原 ¥X」，一键恢复。只作用于这一单。
 *
 * 完整价目表不进对话
 * ----------------------------------------------------------------------
 * 底部一扇门去报价管理的标准价格。权限分级后置，这里只是账号切换器上的演示：
 * 审批人 / 负责人看到按钮，撰写人看到一行说明。
 */
function QuoteSectionsPanel({ context }: { context: DmpkInspectorContext }) {
  const lines = context.quoteLines ?? [];
  const manualPrices = context.manualPrices ?? {};
  const summary = summarizeLines(lines, manualPrices);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const canEdit = Boolean(context.onSetManualPrice);
  const canOpenCatalog = Boolean(context.viewerRole && context.viewerRole !== "author");

  const beginEdit = (line: QuoteLine) => {
    setEditingLineId(line.id);
    setDraftPrice("");
  };
  const confirmEdit = (line: QuoteLine) => {
    const price = Number(draftPrice);
    if (!draftPrice.trim() || !Number.isFinite(price) || price < 0) return;
    context.onSetManualPrice?.(line.id, price);
    setEditingLineId(null);
  };

  return (
    <div className="dmpkInspectorList dmpkQuoteSections">
      <PanelIntro
        title={`${summary.packages.length} 个板块 · 已计价 ${summary.pricedCount} 项`}
        meta={summary.unpricedCount ? `${summary.unpricedCount} 项还算不出来；数量已按组别折算` : "数量已按组别折算；只列本单涉及的板块"}
      />
      {summary.packages.map((pkg) => (
        <section className="dmpkSection" key={pkg.id}>
          <header>
            <strong>{pkg.label}</strong>
            <span>{pkg.lines.length} 项{pkg.unpriced ? <em> · {pkg.unpriced} 项待定</em> : null} · {formatCny(pkg.subtotal)}</span>
          </header>
          <ul>
            {pkg.lines.map((line) => {
              const manual = manualPrices[line.id];
              const status = effectiveStatus(line, manual);
              const unit = lineUnitPrice(line, manual);
              const editing = editingLineId === line.id;
              const hasQty = line.qty > 0;
              return (
                <li key={line.id} className={`dmpkSectionRow is-${status}${manual ? " isManual" : ""}${editing ? " isEditing" : ""}`}>
                  <strong className="dmpkSectionRowName">{line.service}</strong>
                  <dl className="dmpkSectionFacts">
                    <div><dt>待测物</dt><dd>{line.analyte ?? <i>—</i>}</dd></div>
                    <div><dt>检测方法</dt><dd>{line.method ?? <i>—</i>}</dd></div>
                    <div>
                      <dt>数量</dt>
                      <dd>{hasQty ? <><b>{line.qty.toLocaleString("zh-CN")}</b> {line.unit}{line.scope && line.scope !== "本单" ? <small>{line.scope}</small> : null}</> : <i>—</i>}</dd>
                    </div>
                    <div className="dmpkSectionPrice">
                      <dt>单价</dt>
                      <dd>
                        {editing ? (
                          /* 告知原价 → 输入新价 → 确认。回车也算确认，Esc 取消；失焦不落。 */
                          <span className="dmpkPriceEditor">
                            <small>{line.catalogPrice !== undefined ? `原价 ${formatCny(line.catalogPrice)} / ${line.unit} · 价目 ${CATALOG_VERSION}` : "系统无价目 · 本单补价"}</small>
                            <span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={draftPrice}
                                autoFocus
                                placeholder={`新价 ¥ / ${line.unit}`}
                                aria-label={`${line.service} 新单价`}
                                onChange={(event) => setDraftPrice(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") confirmEdit(line);
                                  if (event.key === "Escape") setEditingLineId(null);
                                }}
                              />
                              <button type="button" className="isConfirm" disabled={!draftPrice.trim()} onClick={() => confirmEdit(line)}>确认</button>
                              <button type="button" onClick={() => setEditingLineId(null)}>取消</button>
                            </span>
                          </span>
                        ) : status === "priced" ? (
                          <>
                            <b>{formatCny(unit ?? 0)}</b> <span>/ {line.unit}</span>
                            {manual ? <em className="dmpkTempPrice">临时价{line.catalogPrice !== undefined ? ` · 原 ${formatCny(line.catalogPrice)}` : " · 本单补价"}</em> : null}
                            {canEdit ? (
                              <span className="dmpkPriceActions">
                                <button type="button" onClick={() => beginEdit(line)}><Edit3 size={11} aria-hidden="true" />改价</button>
                                {manual && context.onClearManualPrice ? <button type="button" onClick={() => context.onClearManualPrice?.(line.id)}>恢复</button> : null}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <i className={`dmpkQuoteLineStatus is-${status}`}>{status === "no-catalog" ? "待补价" : quoteLineStatusLabels[status]}</i>
                            {line.dependsOn ? (
                              <button type="button" className="dmpkQuoteLineGo" onClick={() => context.onEditField(line.dependsOn!)}>去填这一项<ArrowRight size={11} aria-hidden="true" /></button>
                            ) : status === "no-catalog" && canEdit ? (
                              <button type="button" className="dmpkQuoteLineGo" onClick={() => beginEdit(line)}>补价</button>
                            ) : null}
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <footer className="dmpkQuoteTotal">
        <span>已计价合计{summary.manualCount ? <em>含 {summary.manualCount} 项临时价 · 仅本次报价</em> : null}</span>
        <strong>{formatCny(summary.total)}</strong>
      </footer>
      {context.onOpenCatalog ? (
        canOpenCatalog ? (
          <button className="dmpkInspectorTextAction" type="button" onClick={context.onOpenCatalog}>查看完整价目表<ArrowUpRight size={12} aria-hidden="true" /></button>
        ) : (
          <p className="dmpkCatalogGate"><Lock size={11} aria-hidden="true" />完整价目表只对审批人 / 负责人开放；这里只标本单涉及的单价。</p>
        )
      ) : null}
    </div>
  );
}

/**
 * 报价明细：按工作包列行，小计，总额。
 *
 * 算不出的行也留在账上
 * ----------------------------------------------------------------------
 * 缺参数、待确认、无价目——三种「还算不出来」各带原因，摆在它本该在的位置。
 * 只列算得出的，总额看着像整单，其实少了一截，人不知道少的是哪几行。
 * 能带到那一格的（缺参数 / 待确认）点原因就去改；无价目的出口在「报价规则」。
 *
 * 临时调价就在行上
 * ----------------------------------------------------------------------
 * 「改单价」展开一个输入，回车落下。改过的行并排显示「SD 手动 ¥X」和划掉的
 * 价目价——两边都在，人才知道自己改的是哪一档、改了多少。价目表本身一个字不动。
 */
function QuoteLinesPanel({ context }: { context: DmpkInspectorContext }) {
  const lines = context.quoteLines ?? [];
  const manualPrices = context.manualPrices ?? {};
  const summary = summarizeLines(lines, manualPrices);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState("");

  const beginEdit = (line: QuoteLine) => {
    setEditingLineId(line.id);
    setDraftPrice(String(lineUnitPrice(line, manualPrices[line.id]) ?? ""));
  };
  const commitEdit = (line: QuoteLine) => {
    const price = Number(draftPrice);
    if (draftPrice.trim() && Number.isFinite(price) && price >= 0) context.onSetManualPrice?.(line.id, price);
    setEditingLineId(null);
  };

  return (
    <div className="dmpkInspectorList dmpkQuoteLines">
      <PanelIntro
        title={`已计价 ${summary.pricedCount} 项 · ${formatCny(summary.total)}`}
        meta={summary.unpricedCount ? `${summary.unpricedCount} 项未计价；总额不含这些行` : "全部行已计价"}
      />
      {summary.packages.map((pkg) => (
        <section className="dmpkQuotePackage" key={pkg.id}>
          <header>
            <strong>{pkg.label}</strong>
            <span>{pkg.unpriced ? <em>{pkg.unpriced} 项未计价 · </em> : null}小计 {formatCny(pkg.subtotal)}</span>
          </header>
          <ul>
            {pkg.lines.map((line) => {
              const manual = manualPrices[line.id];
              const status = effectiveStatus(line, manual);
              const amount = lineAmount(line, manual);
              const unit = lineUnitPrice(line, manual);
              const editing = editingLineId === line.id;
              return (
                <li key={line.id} className={`dmpkQuoteLine is-${status}${manual ? " isManual" : ""}`}>
                  <div className="dmpkQuoteLineHead">
                    <div>
                      <strong>{line.service}</strong>
                      <small>{line.scope}{line.formula ? ` · ${line.formula}` : ""}</small>
                    </div>
                    {status === "priced" && amount !== undefined ? (
                      <b>{formatCny(amount)}</b>
                    ) : (
                      <i className={`dmpkQuoteLineStatus is-${status}`}>{quoteLineStatusLabels[status]}</i>
                    )}
                  </div>
                  {status === "priced" ? (
                    <div className="dmpkQuoteLineMath">
                      <span>{line.qty.toLocaleString("zh-CN")} {line.unit} × </span>
                      {editing ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draftPrice}
                          autoFocus
                          aria-label={`${line.service} 单价`}
                          onChange={(event) => setDraftPrice(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitEdit(line);
                            if (event.key === "Escape") setEditingLineId(null);
                          }}
                          onBlur={() => commitEdit(line)}
                        />
                      ) : (
                        <span className="dmpkQuoteLinePrice">
                          {manual ? <><b>{formatCny(manual.price)}</b><em>{manual.by} 临时价</em>{line.catalogPrice !== undefined ? <s>{formatCny(line.catalogPrice)}</s> : null}</> : <b>{formatCny(unit ?? 0)}</b>}
                          <span> / {line.unit}</span>
                        </span>
                      )}
                      {!editing && context.onSetManualPrice ? (
                        <span className="dmpkQuoteLineActions">
                          <button type="button" onClick={() => beginEdit(line)}><Edit3 size={12} aria-hidden="true" />改单价</button>
                          {manual && context.onClearManualPrice ? <button type="button" onClick={() => context.onClearManualPrice?.(line.id)}>恢复价目表价</button> : null}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="dmpkQuoteLineMath">
                      <span>{line.qty.toLocaleString("zh-CN")} {line.unit}</span>
                      {line.reason ? <small>{line.reason}</small> : null}
                      {line.dependsOn ? (
                        <button type="button" className="dmpkQuoteLineGo" onClick={() => context.onEditField(line.dependsOn!)}>去填这一项<ArrowRight size={11} aria-hidden="true" /></button>
                      ) : status === "no-catalog" && context.onSetManualPrice && !editing ? (
                        <button type="button" className="dmpkQuoteLineGo" onClick={() => { setEditingLineId(line.id); setDraftPrice(""); }}>本单补一个单价</button>
                      ) : null}
                      {editing ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draftPrice}
                          autoFocus
                          placeholder={`¥ / ${line.unit}`}
                          aria-label={`${line.service} 单价`}
                          onChange={(event) => setDraftPrice(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitEdit(line);
                            if (event.key === "Escape") setEditingLineId(null);
                          }}
                          onBlur={() => commitEdit(line)}
                        />
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <footer className="dmpkQuoteTotal">
        <span>已计价合计{summary.manualCount ? <em>含 {summary.manualCount} 项临时价</em> : null}</span>
        <strong>{formatCny(summary.total)}</strong>
      </footer>
      <button className="dmpkInspectorTextAction" type="button" onClick={context.onPreviewQuotation}>查看完整参数与金额校验</button>
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

/**
 * 报价产物，按版本列。
 *
 * 为什么是一列历史，不是一个版本下拉
 * ----------------------------------------------------------------------
 * 下拉的默认状态只显示一个值，于是「这一单出过几版」这件事被藏在了点开之后。
 * 而返工场景里，「出过第二版」本身就是要给人看的信息——审批人退了，你改了，
 * 又出了一版，这条线索比任何一份文件都重要。
 *
 * 所以摊成一列，最新那版展开（多数时候要拿的就是它），旧版收成一行，
 * 点开才露出文件。旧版不删也不藏：报价被退过一次这件事，
 * 一个月后回来看还得能查到。
 */
function ArtifactsPanel({ context, onPreview }: { context: DmpkInspectorContext; onPreview: (kind: "word" | "excel") => void }) {
  const versions = context.quoteVersions.length
    ? context.quoteVersions
    : [{ id: "v1", label: "v1", at: "刚刚生成", origin: "首次生成" }];
  return (
    <div className="dmpkQuoteVersions">
      {[...versions].reverse().map((version, index) => (
        <QuoteVersionCard
          key={version.id}
          version={version}
          current={index === 0}
          total={versions.length}
          stale={index === 0 && Boolean(context.quoteStale)}
          onRegenerate={context.onRegenerate}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

function QuoteVersionCard({ version, current, total, stale, onRegenerate, onPreview }: {
  version: { id: string; label: string; at: string; origin: string };
  current: boolean;
  total: number;
  /** 这一版按的参数 / 单价已经不是眼前这份了。 */
  stale?: boolean;
  onRegenerate?: () => void;
  onPreview: (kind: "word" | "excel") => void;
}) {
  /* 最新那版默认展开——多数时候要拿的就是它。旧版收起来但留在原地。 */
  const [open, setOpen] = useState(current);
  return (
    <section className={`dmpkQuoteVersion${current ? " isCurrent" : ""}${stale ? " isStale" : ""}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="dmpkQuoteVersionTag">{version.label}</span>
        <span className="dmpkQuoteVersionMeta">
          <strong>{version.origin}</strong>
          <small>{version.at}</small>
        </span>
        {stale ? <i className="dmpkQuoteVersionStale">待重出</i> : current && total > 1 ? <i className="dmpkQuoteVersionNow">当前</i> : null}
        <ChevronDown size={14} className="dmpkQuoteVersionChevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="dmpkQuoteVersionFiles">
          {/* 旧的两份文件照样能看——人要对比改前改后。但先说清楚它们是旧的。 */}
          {stale ? (
            <p className="dmpkQuoteVersionStaleNote">
              <span>参数或单价已改动，这两份文件按的还是旧的。</span>
              {onRegenerate ? <button type="button" onClick={onRegenerate}>重新生成 <ArrowRight size={12} aria-hidden="true" /></button> : null}
            </p>
          ) : null}
          <ArtifactRow icon={FileText} title="中文 Word 报价单" meta="30% 管理费" onPreview={() => onPreview("word")} />
          <ArtifactRow icon={FileSpreadsheet} title="Excel 报价明细" meta="15% 管理费" onPreview={() => onPreview("excel")} />
        </div>
      ) : null}
    </section>
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
