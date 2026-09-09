"use client";

import { ArrowUpRight, Calculator, Edit3, Eye, FileCheck2, FileSpreadsheet, FileText, ListChecks, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { ParameterLedger } from "../../components/params";
import {
  resolveInspectorPanels,
  type InspectorPanelRegistry,
  type ResolvedInspectorPanel,
} from "../../components/workbench-inspector/WorkbenchInspector";
import { tumorGroups, type TumorField, type TumorGroupId, type TumorStage } from "./fields";
import { tumorPriceLines } from "./views";

export type TumorInspectorPanelId = "parameters" | "rules" | "process" | "artifacts";

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
  /** 面板里的「改这条」把现成的话填进 composer 并聚焦，真正的修改交给对话流。 */
  onDraftMessage: (text: string) => void;
  /** 打开计价条目预览（费用明细）。它是个弹窗，不是常驻 tab。 */
  onPreviewCost: () => void;
};

const stageLabels: Record<TumorStage, string> = {
  idle: "等待任务描述",
  thinking: "识别报价意图",
  collecting: "补全报价参数",
  ready: "等待报价确认",
  generating: "生成报价产物",
  generated: "报价已生成",
};

/* 四个 tab，跟 DMPK 同一套：参数收集 / 报价规则 / 处理过程 / 报价结果。
   DMPK 还有的「输入材料 / 缺失项 / 计算依据 / 审核记录」是它送审链路上
   长出来的，肿瘤报价现在没有那几步——先摆上一个永远空态的 tab，
   只会让人每次都去点一下确认它还是空的。

   这里**没有**「当前报价表」和「修改日志」两个 tab，是有意的：
   - 金额怎么算出来的，属于「本次命中了哪些规则」，看规则面板；
     要看逐条金额，规则面板上那颗「查看费用明细」开弹窗——
     它是随手一看的东西，不值得长期占一个 tab。
   - 参数改动本身在对话流里就是一条条消息，滚上去就能看到谁在哪一步改了什么。
     再开一个 tab 抄一遍，等于同一件事记两处，而两处迟早对不上。 */
const tumorInspectorPanelRegistry: InspectorPanelRegistry<TumorInspectorContext> = [
  {
    id: "parameters",
    /* 跟 DMPK 同名。同一件事在两条业务线上叫两个名字（「参数收集」/「参数台账」），
       人会以为它们是两个东西。 */
    label: "参数收集",
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
    /* 「报价规则」。跟 DMPK 是同一张面板、同一套分层：
       上半段「本次命中的规则」有实体、可改，改动走对话流；
       下半段「全局规则」是素文本行，只提供去后台的路径。 */
    id: "rules",
    label: "报价规则",
    icon: ShieldCheck,
    primary: true,
    expandable: true,
    available: (context) => context.stage !== "idle",
    state: () => "populated",
    render: (context) => <RulesPanel context={context} />,
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

/**
 * 本次命中的规则。
 *
 * **从参数算出来，不是一张静态表**——摆一张跟参数无关的规则清单，
 * 等于把「参数决定价格」这套说法自己拆了：人改了品系回来一看规则没动，
 * 就再也不会信这一栏。计价口径跟报价前预览共用 `tumorPriceLines`，
 * 两处不能各算各的。
 *
 * `draft` 是点「改这条」时填进 composer 的现成句子——面板不直接改值，
 * 它把话递到手边，真正的修改仍然走对话流已有的确认路径。这条跟 DMPK 一致：
 * 右栏是「看」和「起个头」，不是第二个编辑器。
 */
function matchedTumorRules(fields: TumorField[]) {
  const valueOf = (id: string) => fields.find((field) => field.id === id)?.value ?? "";
  const { lines } = tumorPriceLines(fields);
  const amountOf = (id: string) => lines.find((line) => line.id === id)?.amount ?? 0;
  const money = (value: number) => `¥${value.toLocaleString()}`;

  return [
    {
      id: "animal",
      label: "动物与饲养单价",
      meta: `${valueOf("strain") || "待定品系"} · ${money(amountOf("animal"))}`,
      draft: "把本次报价的动物使用费改为 ",
    },
    {
      id: "model",
      label: "模型建立与接种",
      meta: `${valueOf("model") || "待定模型"} · ${money(amountOf("model"))}`,
      draft: "把本次报价的模型建立费改为 ",
    },
    {
      id: "dosing",
      label: "给药与在体监测",
      meta: `${valueOf("cycle") || "待定周期"} · ${money(amountOf("dosing"))}`,
      draft: "把本次报价的给药与监测费改为 ",
    },
    {
      id: "readout",
      label: "检测指标单价",
      meta: `¥2,800 / 项 · ${money(amountOf("readout"))}`,
      draft: "把本次报价的检测指标单价改为 ",
    },
    {
      id: "template",
      label: "肿瘤报价模板",
      meta: "Word 30% · Excel 15% 管理费",
      draft: "把本次报价的管理费比例改为 ",
    },
  ];
}

/* 与后台报价管理里的配置一一对应。肿瘤线的规则集还没在后台建档，
   所以这几行指向的是同一个入口——**不为一个还不存在的页面编一个链接**。 */
const tumorGlobalRuleSources = [
  { label: "标准价格", meta: "动物、模型、检测指标单价" },
  { label: "计价规则", meta: "分组数、周期与组合折算" },
  { label: "报价字段", meta: "参数字典 · 模型与品系词表" },
  { label: "报价模板", meta: "肿瘤药效报价模板" },
];

/**
 * 报价规则面板。跟 DMPK 同一张，分两段：
 *
 * 上半段「本次命中的规则」**有实体**——卡片、边框、按钮，因为它可改；
 * 下半段「全局规则」**没有实体**——素文本行，因为它在这儿只能看，改要去后台。
 * 两段长得不一样，是为了让「哪些能在这儿改」不用读文字就看得出来。
 */
function RulesPanel({ context }: { context: TumorInspectorContext }) {
  const hasQuoteDraft = ["ready", "generating", "generated"].includes(context.stage);
  const rules = matchedTumorRules(context.fields);

  const goToBackOffice = () => {
    window.location.href = "/?view=quotation-management";
  };

  return (
    <div className="dmpkInspectorList ruleDisclosure">
      <div className="dmpkInspectorIntro">
        <strong>本次报价</strong>
        <span>{hasQuoteDraft ? "以下规则只作用于这一份报价" : "参数补齐后开始匹配"}</span>
      </div>

      <section className="ruleScopeCard">
        <header>
          <strong>本次命中的规则</strong>
          <small>仅影响这份报价</small>
        </header>
        {rules.map((rule) => (
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
          {/* 费用明细是弹窗不是 tab：它是「算出来多少」的一次核对，
              看完就关。常驻一个 tab 的代价是每次切标签都要跨过它。 */}
          <button type="button" disabled={!hasQuoteDraft} onClick={context.onPreviewCost}>
            <Calculator size={14} />查看费用明细
          </button>
          <button className="primary" type="button" disabled={!hasQuoteDraft} onClick={() => context.onDraftMessage("我想调整本次报价：")}>
            <Sparkles size={14} />对话编辑
          </button>
        </div>
        <p className="ruleScopeNote">改动以对话形式提交，确认后只作用于当前报价并保留记录。</p>
      </section>

      <div className="ruleDisclosureDivider" />

      <div className="dmpkInspectorIntro">
        <strong>全局规则</strong>
        <span>只读 · 影响后续所有肿瘤药效报价</span>
      </div>
      <div className="ruleGlobalList">
        {tumorGlobalRuleSources.map((source) => (
          <button type="button" className="ruleGlobalRow" key={source.label} onClick={goToBackOffice}>
            <span>
              <strong>{source.label}</strong>
              <small>{source.meta}</small>
            </span>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      <p className="ruleGlobalNote">全局规则需要在报价管理后台试算并发布，前台不提供直接修改。</p>
    </div>
  );
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
