"use client";

import { ArrowRight, Eye, FileCheck2, FileSpreadsheet, FileText, History, ListChecks, SlidersHorizontal, Table2 } from "lucide-react";
import { ParameterLedger } from "../../components/params";
import {
  resolveInspectorPanels,
  type InspectorPanelRegistry,
  type ResolvedInspectorPanel,
} from "../../components/workbench-inspector/WorkbenchInspector";
import { tumorGroups, type TumorField, type TumorGroupId, type TumorStage } from "./fields";
import { tumorPriceLines } from "./views";

export type TumorInspectorPanelId = "parameters" | "quote" | "changelog" | "process" | "artifacts";

export type TumorChangeEntry = { id: string; at: string; label: string; from: string; to: string };

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
  /* 参数改动流水。空数组＝这一单还没改过任何参数，那个 tab 就显示空态而不是消失——
     「改过没有」本身是要看的信息，tab 一会儿在一会儿不在，人会以为自己记错了。 */
  changeLog: TumorChangeEntry[];
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
    /* 「当前报价表」。参数怎么变成钱，不该只有点开弹窗那一条路——
       改一个参数想立刻看金额动没动，弹窗开一次关一次太重。 */
    id: "quote",
    label: "当前报价表",
    icon: Table2,
    expandable: true,
    state: (context) => (context.fields.some((field) => field.required && !field.value) ? "empty" : "populated"),
    emptyMessage: "参数补全后这里出现计价条目",
    render: (context) => <QuoteTablePanel fields={context.fields} />,
  },
  {
    /* 「修改日志」。报价改过几轮、动过哪些参数，一个月后回来还得查得到。 */
    id: "changelog",
    label: "修改日志",
    icon: History,
    state: (context) => (context.changeLog.length ? "populated" : "empty"),
    emptyMessage: "参数还没有改动记录",
    render: (context) => <ChangeLogPanel entries={context.changeLog} />,
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
 * 当前报价表。
 *
 * 金额是**从参数算出来的**，不是一张静态表——改了组数回来看金额没动，
 * 人就再也不会信右边那个台账。计算口径跟报价前预览共用 `tumorPriceLines`，
 * 两处不能各算各的。
 */
function QuoteTablePanel({ fields }: { fields: TumorField[] }) {
  const { lines, subtotal, management, total } = tumorPriceLines(fields);
  const money = (value: number) => `¥${value.toLocaleString()}`;
  return (
    <div className="dmpkInspectorList tumorQuoteTable">
      <div className="dmpkInspectorIntro"><strong>计价条目</strong><span>演示单价，随参数变化</span></div>
      {lines.map((line) => (
        <div className="tumorQuoteLine" key={line.id}>
          <div><strong>{line.item}</strong><small>{line.detail}</small></div>
          <span>{line.qty}</span>
          <b>{money(line.amount)}</b>
        </div>
      ))}
      <div className="tumorQuoteSum">
        <div><span>小计</span><b>{money(subtotal)}</b></div>
        <div><span>管理费 · Word 口径 30%</span><b>{money(management)}</b></div>
        <div className="isTotal"><span>合计</span><b>{money(total)}</b></div>
      </div>
    </div>
  );
}

/**
 * 修改日志。
 *
 * 记的是**事件**，不是当前值——「品系从 BALB/c nude 变成 CB-17 SCID」这件事，
 * 从最终状态里反推不出来。级联清空也算一次改动，否则日志里会出现一个
 * 凭空消失的取值。
 */
function ChangeLogPanel({ entries }: { entries: TumorChangeEntry[] }) {
  return (
    <div className="dmpkInspectorList tumorChangeLog">
      <div className="dmpkInspectorIntro"><strong>参数改动</strong><span>共 {entries.length} 条</span></div>
      {/* 新的在上。翻日志的人找的多半是「最近一次改了什么」。 */}
      {[...entries].reverse().map((entry) => (
        <div className="tumorChangeRow" key={entry.id}>
          <div className="tumorChangeHead"><strong>{entry.label}</strong><small>{entry.at}</small></div>
          <div className="tumorChangeDiff">
            <s>{entry.from || "空"}</s>
            <ArrowRight size={11} aria-hidden="true" />
            <b>{entry.to || "已清空"}</b>
          </div>
        </div>
      ))}
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
