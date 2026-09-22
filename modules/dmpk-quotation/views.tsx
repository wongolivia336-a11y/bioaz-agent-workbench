"use client";

import { ArrowRight, Check, ChevronDown, CircleDollarSign, CornerDownLeft, Edit3, Eye, FileSpreadsheet, FileText, Maximize2, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ComposerChipTray as SharedComposerChipTray, ParameterTaskCard } from "../../components/params";
import { PersonPicker } from "../../components/ui";
import { PreviewModal } from "../../components/ui/PreviewModal";
import { ScrollTopButton } from "../../components/ui/ScrollTopButton";
import { directory } from "../../lib/workbench/mockInbox";
import { AgentReply, PanelLink, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { CoworkerSelector } from "../../components/workbench-shell/CoworkerSelector";
import { ContextDivider, CoworkerSwitchCard } from "../../components/workbench-shell/BioAZHelper";
import { MessageAttachments, WorkbenchComposer } from "../../components/workbench-shell/WorkbenchComposer";
import type { ComposerAttachment, ComposerSessionAction } from "../../lib/workbench/composerAttachments";
import type { ParseStep } from "../../lib/workbench/sources";
import type { CoworkerDefinition, SessionRework } from "../types";
import { ReworkCard, type ReworkNoteState } from "../../components/workbench-shell/ReworkCard";
import { ChangeConfirmCard, type QuoteChange } from "../../components/workbench-shell/ChangeConfirmCard";
import type { QuoteNote } from "../../lib/workbench/quoteData";
import { priceCatalog, scenarioShortLabels } from "../quotation-management/dmpk/catalog";
import { formatCny } from "../../lib/workbench/quoteLines";
import type { CatalogHit } from "./catalogHits";
import {
  dmpkGroups,
  dmpkGroupsFor,
  getDmpkGroupTitle,
  initialDmpkFields,
  type DmpkDraftTab,
  type DmpkField,
  type DmpkGroupId,
  type DmpkStage,
} from "./fields";

export type DmpkInspectorPanelId = "parameters" | "sections" | "process" | "materials" | "gaps" | "evidence" | "artifacts" | "rework" | "review";
/**
 * 会话里的一条记录。
 *
 * `run` 是「数字同事跑了一次」的那条痕迹。
 * ----------------------------------------------------------------------
 * 它原来不在消息流里——是照着 stage 渲染在所有消息**后面**的一条固定尾巴。
 * 于是一旦这一轮回完话，那条运行记录就留在了回复的下方：读下来是
 * 「我还没识别到参数」→「已更新报价参数」，先说结论后说过程，顺序是反的。
 * 再来一轮，它还会跳到更下面去——它根本不属于任何一轮。
 *
 * 运行发生在某个时刻，它就该钉在那个时刻。所以完成的运行进消息流；
 * 只有**正在跑**的那一条才留在最下面，因为它确实是此刻正在发生的事。
 *
 * `artifacts`（产物卡）栽在同一个坑里，晚了一轮才发现：它原本也是照着
 * `stage === "generated"` 渲染在所有消息**后面**的。于是生成完先交接、再回头看，
 * 产物卡跑到了「已交接给林一一」的下面——读起来像是交接完才生成的报价单。
 * 现在它也进消息流，钉在生成那一刻。
 */
export type DmpkChatMessage = {
  id: string;
  role: "user" | "agent" | "run" | "inbound" | "artifacts" | "summary";
  text: string;
  attachments?: ComposerAttachment[];
  /** role === "run" 时这一次跑了哪几步。
      字符串是原来那三种运行；对象是读文件的解析轨迹——每步多带
      「读出了什么」和「原文在哪」。两种混着放，旧的三种一个字不用改。 */
  runSteps?: DmpkRunStep[];
  /** role === "summary" 时的四段内容。 */
  summary?: DmpkSessionSummary;
  /** 首轮文件识别后，直接在回复正文里列出的缺失参数。 */
  missingFields?: { label: string; group: string }[];
  /** 人问「这单用了哪些价」时回的那张表：本单命中的价目，问的那一刻的快照。 */
  catalogHits?: CatalogHit[];
};

export type DmpkRunStep = string | ParseStep;

/**
 * 会话摘要：补了六七轮之后人会迷路，这一条把「现在到哪儿了」说清楚。
 * 四段是固定的：已确认、待确认、计价到哪儿、下一步。
 * 它是从当前状态推出来的，不是数字同事「想」出来的，所以生成不需要等。
 */
export type DmpkSessionSummary = {
  confirmed: string[];
  pending: string[];
  pricing: string;
  next: string;
};

/** 一次运行的标题与步骤。两处（进行中的尾巴、留档的那条）取自同一处，免得分叉。 */
export function dmpkRunRecord(
  kind: "params" | "quote" | "rework" | "parse",
  options: { running?: boolean; missingCount?: number; parse?: { label: string; steps: ParseStep[] } } = {},
): { text: string; runSteps: DmpkRunStep[] } {
  const { running = false, missingCount = 0, parse } = options;
  if (kind === "parse") {
    /* 读文件那一次。标题带文件名——同一条会话里可能传过不止一份，
       折叠之后光写「已读取文件」，人分不清折的是哪一份。 */
    return {
      text: running ? `正在读取「${parse?.label ?? "文件"}」` : `已读取「${parse?.label ?? "文件"}」`,
      runSteps: parse?.steps ?? [],
    };
  }
  if (kind === "rework") {
    /* 退回刚进来那一次跑的不是「更新参数」——那时什么都还没改。
       它读的是退回工单，所以标题和步骤都得说这件事，否则这条记录
       在时间线上会撒一个小谎。 */
    return {
      text: running ? "正在读取退回批注" : "已读取退回批注",
      runSteps: ["读取退回工单", "定位批注锚点到报价条目", "比对当前参数取值"],
    };
  }
  if (kind === "quote") {
    return {
      text: running ? "正在生成报价单" : "已完成报价生成过程",
      runSteps: ["检查计价关键字段", "匹配 PK 动物实验价格规则", "匹配生物分析价格规则", "生成 Word / Excel 报价单", "校验页面与文件金额一致"],
    };
  }
  return {
    text: running ? "正在处理报价参数" : "已更新报价参数",
    runSteps: ["读取用户输入", "识别 DMPK / PK 业务线", missingCount ? `还缺 ${missingCount} 项报价参数` : "当前阶段参数已齐全"],
  };
}
export type DmpkEditProposal =
  | { kind: "current-price"; request: string; previousPrice: number; nextPrice: number }
  | { kind: "global-rule"; request: string; minimumSamples: number };

export function DmpkEditProposalCard({ proposal, onConfirmCurrentPrice, onOpenRuleManagement }: { proposal: DmpkEditProposal; onConfirmCurrentPrice: () => void; onOpenRuleManagement: () => void }) {
  const isCurrentPrice = proposal.kind === "current-price";
  return <section className="dmpkEditProposalCard">
    <header><span>{isCurrentPrice ? <CircleDollarSign size={16} /> : <Sparkles size={16} />}</span><div><strong>{isCurrentPrice ? "调整本次报价" : "全局规则草稿"}</strong><small>{isCurrentPrice ? "仅影响当前项目" : "影响后续 PK 报价，发布前需验证"}</small></div></header>
    {isCurrentPrice ? <div className="dmpkPriceChange"><span>报告费</span><small>¥{proposal.previousPrice.toLocaleString()} → ¥{proposal.nextPrice.toLocaleString()}</small></div> : <div className="dmpkRuleSentencePreview"><span>PK 检测</span><b>样品数少于 {proposal.minimumSamples} 个</b><strong>按 {proposal.minimumSamples} 个计费</strong></div>}
    {!isCurrentPrice ? <RuleScopePreview /> : null}
    <footer><small>{isCurrentPrice ? "确认后保留本次调整记录" : "规则不会在前台直接生效"}</small><button type="button" onClick={isCurrentPrice ? onConfirmCurrentPrice : onOpenRuleManagement}>{isCurrentPrice ? "确认调整" : "前往规则管理"}{!isCurrentPrice ? <ArrowRight size={14} /> : null}</button></footer>
  </section>;
}

/**
 * 全局规则草稿的作用域预告。
 *
 * 「你正在离开这一单」这个信号，以前只由跳转那一下承担——跳完就没了。
 * 这里把它写成常驻文字：这条规则命中哪个费用项、那一项适用于哪几类。
 * 只读，作用域仍然只能在后台定；前台负责的是让人看见，不是让人拍板。
 */
function RuleScopePreview() {
  // 「PK 样品少于 N 个按 N 个收费」落在样品检测这一项上，取自后台同一份目录
  const target = priceCatalog.find((item) => item.id === "bio-plasma");
  if (!target) return null;
  return (
    <div className="dmpkRuleScopePreview">
      <p className="dmpkRuleScopeHit"><span>命中</span><strong>{target.name}</strong><b>{target.price} / {target.unit}</b></p>
      <p className="dmpkRuleScopeTags">
        <span>该项适用于</span>
        {target.appliesTo.map((scenario) => <i key={scenario}>{scenarioShortLabels[scenario]}</i>)}
      </p>
      <small><TriangleAlert size={13} />在后台改主值，这 {target.appliesTo.length} 类会同时生效；只改一类要在后台设为例外。</small>
    </div>
  );
}

export function DmpkConversation({ messages, stage, currentMissing, handoffNotice, liveRun: liveRunOverride, onOpenInspector, onArtifactPreview }: { messages: DmpkChatMessage[]; stage: DmpkStage; currentMissing: DmpkField[]; handoffNotice?: string; /** 正在读文件时由会话递进来：步骤是逐条揭开的，stage 本身推不出来。 */ liveRun?: { text: string; runSteps: DmpkRunStep[] } | null; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; onArtifactPreview: (kind: "word" | "excel") => void }) {
  const liveRun = liveRunOverride ?? (stage === "thinking" || stage === "generating"
    ? dmpkRunRecord(stage === "generating" ? "quote" : "params", { running: true, missingCount: currentMissing.length })
    : null);
  return (
    <div className="dmpkConversation">
      {handoffNotice ? <ContextDivider>{handoffNotice}</ContextDivider> : null}
      {messages.map((message) => {
        if (message.role === "run") return <DmpkActivityChain key={message.id} title={message.text} steps={message.runSteps ?? []} running={false} onOpenInspector={onOpenInspector} />;
        if (message.role === "inbound") return <DmpkInboundEvent key={message.id} text={message.text} attachments={message.attachments} />;
        if (message.role === "artifacts") return <DmpkArtifactCards key={message.id} onPreview={onArtifactPreview} onOpenInspector={onOpenInspector} />;
        if (message.role === "summary" && message.summary) return <DmpkSummaryCard key={message.id} summary={message.summary} />;
        if (message.role === "agent" && message.missingFields?.length) {
          return (
            <div className="agentReply" data-minimap="agent" key={message.id}>
              <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
              <div>
                <p>{message.text}</p>
                <table className="previewTable" style={{ marginTop: 10 }}>
                  <thead><tr><th>待补充参数</th><th>所属环节</th><th>状态</th></tr></thead>
                  <tbody>
                    {message.missingFields.map((field) => (
                      <tr key={field.label}><td>{field.label}</td><td>{field.group}</td><td>待填写</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        if (message.role === "agent" && message.catalogHits?.length) {
          /* 「这单用了哪些价」——回一张表，不回一段话。跟上面缺失参数那张表同一副骨架。 */
          return (
            <div className="agentReply" data-minimap="agent" key={message.id}>
              <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
              <div>
                <p>{message.text}</p>
                <table className="previewTable dmpkCatalogHits" style={{ marginTop: 10 }}>
                  <thead><tr><th>费用项目</th><th>板块</th><th>单价</th><th>本单用量</th><th>状态</th></tr></thead>
                  <tbody>
                    {message.catalogHits.map((hit) => (
                      <tr key={hit.key} data-status={hit.status}>
                        <td>{hit.name}</td>
                        <td>{hit.packages.join(" · ")}</td>
                        <td className="quoteNum">
                          {hit.status === "no-catalog" ? "—"
                            : hit.status === "pending" ? "待确认"
                            : hit.manualPrice !== undefined
                              ? <><b>{formatCny(hit.manualPrice)}</b> / {hit.unit}{hit.catalogPrice !== undefined ? <small>原 {formatCny(hit.catalogPrice)}</small> : null}</>
                              : <>{formatCny(hit.catalogPrice ?? 0)} / {hit.unit}</>}
                        </td>
                        <td className="quoteNum">{hit.qty ? `${hit.qty.toLocaleString("zh-CN")} ${hit.unit}` : "—"}{hit.lineCount > 1 ? <small>{hit.lineCount} 行</small> : null}</td>
                        <td>{hit.status === "manual" ? "临时价 · 仅本单" : hit.status === "priced" ? "价目表" : hit.status === "pending" ? "待确认" : "无价目 · 待补价"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        if (message.role === "agent") return <AgentReply key={message.id}>{message.text}</AgentReply>;
        return <UserBubble key={message.id} text={message.text} attachments={message.attachments} />;
      })}
      {/* 只有正在跑的那一条留在最下面——它确实是此刻正在发生的事。
          跑完就进消息流，钉在它发生的那个位置。 */}
      {liveRun ? <DmpkActivityChain title={liveRun.text} steps={liveRun.runSteps} running onOpenInspector={onOpenInspector} /> : null}

    </div>
  );
}

/**
 * 从会话外面进来的一件事：产物被退回、被通过、被转交。
 *
 * 为什么它既不是 user 气泡也不是 agent 回复
 * ----------------------------------------------------------------------
 * 之前这条根本不存在：对话里是「已交接给王林彬」紧接着「已读取退回批注」，
 * 中间那件真正发生的事——**东西被退回来了，附件也跟着回来了**——一点痕迹都没有。
 * 读下来像是数字同事凭空开始读一份不知从哪冒出来的批注。
 *
 * 做成 user 气泡是错的：那句话不是赵敏说的，把它画成她的气泡等于替她说话。
 * 做成 agent 回复也是错的：数字同事不是这件事的发起人，它只是随后读了一遍。
 * 所以给它自己的形态——一条带署名和附件的到达记录，靠左但不属于任何一方。
 */
function DmpkInboundEvent({ text, attachments }: { text: string; attachments?: ComposerAttachment[] }) {
  return (
    <div className="dmpkInboundEvent">
      <span className="dmpkInboundMark"><CornerDownLeft size={13} aria-hidden="true" /></span>
      <div>
        <strong>{text}</strong>
        {attachments?.length ? <MessageAttachments items={attachments} /> : null}
      </div>
    </div>
  );
}

/**
 * 与肿瘤报告的 ThinkingCard 同构：同一套 agentRun / runHeader / timeline 结构和 class，
 * 运行中蓝色 motionLogo、结束后折叠置灰。此前这里是 details/summary，
 * 外层 details、summary、activityChainPanel 各自带一圈边框，看起来是三层嵌套。
 */
/**
 * 一步长什么样，两种来源统一成一副：
 *   - 字符串（原来三种运行）：标题 + 按关键词配的说明 + 技术详情
 *   - ParseStep（读文件）：标题 + **读出了什么** + **原文在哪** + 技术详情
 *
 * 读文件的那条链跟「整理实验事实 × 30」的差别全在后两样上：
 * 每一步说自己产出了几样东西、从原文哪一节读的。人对着它能核——
 * 「7 组」对不对，翻表 2 就知道。
 */
function normalizeStep(step: DmpkRunStep): ParseStep & { detail: string } {
  if (typeof step === "string") return { id: step, title: step, detail: processStepDetail(step), tech: processStepTech(step) };
  return { ...step, detail: step.result ?? "" };
}

function DmpkActivityChain({ title, steps, running, onOpenInspector }: { title: string; steps: DmpkRunStep[]; running: boolean; onOpenInspector: (panelId: DmpkInspectorPanelId) => void }) {
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const open = running || expanded;
  const activeStepIndex = steps.length - 1;
  const items = steps.map(normalizeStep);

  return (
    <article className={`agentRun ${running ? "running" : "settled"} ${open ? "" : "collapsed"}`} data-minimap="activity" data-minimap-label={title}>
      <button
        className="runHeader"
        type="button"
        onClick={running ? () => onOpenInspector("process") : () => setExpanded((value) => !value)}
      >
        <span className={`motionLogo ${running ? "running" : ""}`} data-step={running ? activeStepIndex : undefined}>
          <img src="/logo/bioaz-logo.svg" alt="" />
          <span key={running ? activeStepIndex : "settled"} />
        </span>
        <strong>{open ? title : `${title} · 查看过程`}</strong>
        <small>{running ? "处理中" : items.some((item) => item.tech?.includes("parser=")) ? "约 6s" : "已完成"}</small>
      </button>
      {open ? (
        <div className="timeline">
          {items.map((step, index) => (
            <div className={`timelineItem ${running && index === activeStepIndex ? "active" : "done"}`} key={step.id}>
              <span className="timelineDot" />
              <div className="timelineContent">
                <div className="timelineTitle">
                  <strong>{step.title}</strong>
                  {running && index === activeStepIndex ? <span>进行中</span> : null}
                </div>
                {/* 读文件的步骤：产出是一行结论，来源是一枚小标。
                    产出没出来（还在跑）就不占位，免得一排空行。 */}
                {step.detail ? (
                  <p>
                    {step.detail}
                    {step.anchor ? <em className="timelineAnchor">{step.anchor}</em> : null}
                  </p>
                ) : null}
                <button
                  className="textButton"
                  type="button"
                  onClick={() => setExpandedTech(expandedTech === step.id ? null : step.id)}
                >
                  技术详情
                </button>
                {expandedTech === step.id ? (
                  <pre className="techBlock">
                    {step.tech ?? "step executed"}
                    {"\n"}job_id=job_dmpk_4c1f8a2e9b7d
                    {"\n"}trace_id=trc_quotation_58ad31
                  </pre>
                ) : null}
              </div>
              {index < items.length - 1 ? <span className="timelineLine" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * 会话摘要卡。钉在生成那一刻，跟运行记录同一个逻辑：它说的是「此刻到哪儿了」，
 * 再往下聊它就是历史，不该跟着往下跑。
 *
 * 形态上不是数字同事的气泡——它不是一句回复，是一张台账的快照。
 */
function DmpkSummaryCard({ summary }: { summary: DmpkSessionSummary }) {
  return (
    <section className="dmpkSessionSummary" data-minimap="activity" data-minimap-label="会话摘要">
      <header>
        <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
        <strong>对话已整理</strong>
        <small>已保留当前参数与进度</small>
      </header>
      <dl>
        <div>
          <dt>已确认 {summary.confirmed.length} 项</dt>
          <dd>{summary.confirmed.length ? summary.confirmed.join("、") : "还没有确认任何参数"}</dd>
        </div>
        <div>
          <dt>待确认 {summary.pending.length} 项</dt>
          <dd>{summary.pending.length ? summary.pending.join("、") : "没有待确认项"}</dd>
        </div>
        <div>
          <dt>计价</dt>
          <dd>{summary.pricing}</dd>
        </div>
        <div>
          <dt>下一步</dt>
          <dd>{summary.next}</dd>
        </div>
      </dl>
    </section>
  );
}

function processStepDetail(step: string) {
  if (step.includes("读取")) return "解析自然语言中的检测类型、动物信息、周期和采血点。";
  if (step.includes("识别")) return "匹配 DMPK / PK 业务线，并定位需要补齐的字段组。";
  if (step.includes("检查")) return "确认必填计价字段是否齐全，拦截缺字段出报价。";
  if (step.includes("匹配 PK")) return "根据动物种属、数量、周期和采样点匹配动物实验规则。";
  if (step.includes("匹配生物")) return "根据分析方法、样品类型和待测物数量匹配生物分析规则。";
  if (step.includes("生成")) return "生成 Word 报价单和 Excel 报价明细。";
  if (step.includes("校验")) return "校验页面、Word 和 Excel 的金额一致性。";
  return "同步结构化报价参数台账。";
}

export function DmpkComposer({ reworkNotice, unresolvedNotes, editProposal, onHandoff, viewerName, handoffDone, handoffNote, rework, reworkNotes = [], reworkStates = {}, reworkCurrentValue, onAcceptRework, onDeferRework, onResetRework, onRegenerateRework, changeConfirm, onConfirmChanges, onCancelChanges, onOpenQuote, onConfirmCurrentPrice, onOpenRuleManagement, attention, conversationEditing, stage, recognizedCount = 0, hasQuote = false, quoteStale = false, onRegenerate, text, setText, activeGroup, fields, allFields, mode, paramsOpen, onParamsOpenChange, draftTabs, onSelect, onRemove, onSend, onPreview, onGenerate, onOpenInspector, coworkers, coworkerLocked, activeCoworkerId, onCoworkerChange, pendingCoworkerId, onConfirmCoworkerChange, onCancelCoworkerChange, disabled, projectName, attachments, onAttachmentsChange, sessionActions }: { /** 「+ › 技能」列的会话动作：总结、列价目、核对、生成 */ sessionActions?: ComposerSessionAction[]; /** 落不到参数格上的批注，交接卡在送审时问一次 */ unresolvedNotes?: { anchorId: string; label: string }[]; /** 退回批注入口卡。它跟参数卡、交接卡同一个槽位：需要人当场做的事都在这儿 */ reworkNotice?: ReactNode; editProposal?: DmpkEditProposal | null; /** 报价生成后把这一单交给下一棒。不传就不显示交接卡 */ onHandoff?: (to: string, note: string) => void; /** 当前账号姓名,用于把自己从交接候选里去掉 */ viewerName?: string; /** 已经交出去了,收起交接卡 */ handoffDone?: boolean; /** 交接说明的预填：会话摘要生成过就用它 */ handoffNote?: string; /** 被退回的那一版:批注跟着回到会话,在这里逐条处理 */ rework?: SessionRework; reworkNotes?: QuoteNote[]; reworkStates?: Record<string, ReworkNoteState>; reworkCurrentValue?: (anchorId: string) => string; onAcceptRework?: (note: QuoteNote) => void; onDeferRework?: (note: QuoteNote) => void; onResetRework?: (note: QuoteNote) => void; onRegenerateRework?: () => void; /** 重新生成前的整体复核 */ changeConfirm?: QuoteChange[] | null; onConfirmChanges?: () => void; onCancelChanges?: () => void; onOpenQuote?: () => void; onConfirmCurrentPrice: () => void; onOpenRuleManagement: () => void; attention?: boolean; conversationEditing?: boolean; stage: DmpkStage; /** 还挂着「识别」、没被人点过头的参数有几项。报价前确认卡据此改口成「确认并生成」 */ recognizedCount?: number; /** 这一单出过版没有。出过的话再到 ready 是「重出」不是「生成」 */ hasQuote?: boolean; /** 出过的那版跟眼前的参数 / 单价对不上了 */ quoteStale?: boolean; onRegenerate?: () => void; text: string; setText: (value: string) => void; activeGroup: DmpkGroupId; fields: DmpkField[]; /** 全部 14 项,不只是还缺的——全屏面板要一次列全 */ allFields: DmpkField[]; mode: "collect" | "edit"; /** 参数卡展开没有。会话持有它，卡片在 thinking 时会卸载重挂 */ paramsOpen?: boolean; onParamsOpenChange?: (open: boolean) => void; draftTabs: DmpkDraftTab[]; onSelect: (field: DmpkField, value: string) => void; onRemove: (fieldId: string) => void; onSend: () => void; onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; coworkers: CoworkerDefinition[]; coworkerLocked: boolean; activeCoworkerId: string; onCoworkerChange: (coworkerId: string) => void; pendingCoworkerId: string | null; onConfirmCoworkerChange: () => void; onCancelCoworkerChange: () => void; disabled: boolean; projectName: string; attachments: ComposerAttachment[]; onAttachmentsChange: (next: ComposerAttachment[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!attention) return;
    wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    inputRef.current?.focus({ preventScroll: true });
  }, [attention]);
  const currentCoworker = coworkers.find((item) => item.id === activeCoworkerId);
  const pendingCoworker = coworkers.find((item) => item.id === pendingCoworkerId);
  return (
    <footer ref={wrapRef} className={`dmpkComposerWrap ${attention ? "needsAttention" : ""}`}>
      {reworkNotice}
      {editProposal ? <DmpkEditProposalCard proposal={editProposal} onConfirmCurrentPrice={onConfirmCurrentPrice} onOpenRuleManagement={onOpenRuleManagement} /> : null}
      {stage === "collecting" ? <DmpkParameterTaskCard activeGroup={activeGroup} fields={fields} allFields={allFields} draftTabs={draftTabs} mode={mode} open={paramsOpen} onOpenChange={onParamsOpenChange} onSelect={onSelect} /> : null}
      {stage === "ready" ? <DmpkFinalConfirmCard onPreview={onPreview} onGenerate={onGenerate} onOpenInspector={onOpenInspector} recognizedCount={recognizedCount} hasQuote={hasQuote} /> : null}
      {/* 报价出来了,下一步是把它交给谁。入口长在这儿而不是某个列表页顶栏:
          工单不是「新建」出来的,是干完活交出去那一下留下的凭据——所以它该
          出现在活刚干完的地方,而不是让人先想起去哪儿开一张单。 */}
      {/* 退回修订卡跟交接卡、参数卡同一个槽位:它们是同一类东西——
          需要人当场做一个决定的卡片,而决定做完紧接着就是打字,
          所以它该待在手指已经在的地方,并且与输入框同宽。 */}
      {rework && onAcceptRework && onDeferRework && onResetRework && !changeConfirm ? (
        <ReworkCard
          notes={reworkNotes}
          reason={rework.reason}
          by={rework.by}
          at={rework.at}
          states={reworkStates}
          currentValueOf={reworkCurrentValue}
          onAccept={onAcceptRework}
          onDefer={onDeferRework}
          onReset={onResetRework}
          onRegenerate={onRegenerateRework}
        />
      ) : null}
      {changeConfirm && onConfirmChanges && onCancelChanges ? (
        <ChangeConfirmCard changes={changeConfirm} onConfirm={onConfirmChanges} onCancel={onCancelChanges} />
      ) : null}
      {stage === "generated" && onHandoff && !handoffDone ? <DmpkHandoffCard onHandoff={onHandoff} viewerName={viewerName} unresolvedNotes={unresolvedNotes} defaultNote={handoffNote} stale={quoteStale} onRegenerate={onRegenerate} /> : null}
      {pendingCoworker && currentCoworker ? <CoworkerSwitchCard from={currentCoworker.name} to={pendingCoworker.name} endingCurrentFlow={coworkerLocked} onConfirm={onConfirmCoworkerChange} onCancel={onCancelCoworkerChange} /> : null}
      {/* 「DMPK报价同事 ∨」那颗切换器撤掉。走到这个工作台的路只有一条——
          从站内信进来，或者在项目里新建一个 DMPK 报价任务——两条路都已经
          决定了对面是谁。留一个几乎不会被点、点了还会把当前这一单切走的
          下拉框，只是在输入框上方多占一行。 */}
      <WorkbenchComposer
        className="dmpkComposer"
        attachments={attachments}
        onAttachmentsChange={onAttachmentsChange}
        activeCoworkerId={activeCoworkerId}
        project={projectName}
        globalDrop
        sessionActions={sessionActions}
      >
        <div className="composerInputStack">
          <ComposerChipTray tabs={draftTabs} onRemove={onRemove} />
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSend();
              // 光标在空输入框上按退格，删掉最后一个 chip——chip 多到要折叠时，
              // 逐个去点那个叉号是最烦的一件事
              if (event.key === "Backspace" && !text && draftTabs.length) {
                event.preventDefault();
                onRemove(draftTabs[draftTabs.length - 1].fieldId);
              }
            }}
            placeholder={draftTabs.length
              ? ""
              : conversationEditing
                ? "说出要修改的参数、价格或规则…"
                : stage === "idle"
                  ? "例如：PK小分子，SD大鼠，每组2只，2组，试验周期1周，周期内3个非加班时间点"
                  : stage === "collecting" && fields.length
                    ? `可直接补充：${fields.slice(0, 3).map((field) => field.label).join("、")}${fields.length > 3 ? "等" : ""}…`
                    : "继续描述报价要求…"}
          />
        </div>
        <button className="sendIconButton" type="button" onClick={onSend} disabled={disabled} aria-label="发送"><Send size={18} /></button>
      </WorkbenchComposer>
    </footer>
  );
}

/**
 * Composer 里的已选参数托盘。
 *
 * 演示只有 14 个参数，真实报价单的参数远不止，横着摆一排就溢出成一条横向
 * 滚动条——横向滚动看不出总量、找一个要来回拖，是最差的一种"装不下"。
 *
 * 收起态：chips 只占**一行**，多出来的直接裁掉，右侧一道渐隐提示还有更多，
 * 旁边一颗按钮报总数。这里刻意用 CSS 裁剪而不是算"能放几个"——chip 宽度
 * 差得远（「分子类型：小分子」vs「组数：2」），任何写死的个数都会在某个
 * 组合下露馅，而按钮上写总数就不需要知道露出了几个。
 *
 * 展开态：composer 向上膨胀，chips 按参数组分栏换行铺开。分组不是装饰——
 * 二十几个 chip 平铺就是一堵墙，按组分开才扫得动。高度封顶后内部滚动，
 * 保证输入框任何时候都还在屏幕上。
 */
/**
 * 退回批注的入口卡，长在 composer 上方。
 *
 * 为什么要有它：批注收进右侧一个 tab 之后就太安静了——那是这一屏最要紧的
 * 一件事，却跟「报价规则」并排躺着，谁也不会主动去点。跟 QA 那张「审批决策」
 * 卡同一个位置、同一个职责：**把当前这件事和它的出口摆在手边**。
 */
/**
 * 退回之后停在输入框上方的那张卡。
 *
 * 它不再是「画布的入口」。
 * ----------------------------------------------------------------------
 * 以前第一步是「摊开批注画布」，因为读批注和改参数分别在两个地方，
 * 得先把原件铺开才对得上。现在进会话时批注和参数已经并排在右侧，
 * 第一步直接就是改——**画布降级成「原文我要再核一眼」时才用的东西**。
 *
 * 也不再重复一遍「谁退回了这一版」。
 * ----------------------------------------------------------------------
 * 那句话上面已经说过两遍：站内信事件一条、agent 回复一条。
 * 卡片再说第三遍，占的是输入框正上方最贵的那块地方。
 * 所以这里只留它独有的那件事——**接下来要做什么**。
 * agent 那条负责报告发生了什么，这张卡负责待办，两者不重合。
 */
export function DmpkReworkNoticeCard({ total, blocking, onOpenCanvas }: {
  total: number;
  blocking: number;
  onOpenCanvas: () => void;
}) {
  return (
    <section className="dmpkReworkNotice" aria-label="退回处理">
      <header>
        <div>
          <span>退回处理</span>
          <strong>按 {total} 条批注修订</strong>
        </div>
        <i className={blocking ? "isBlocking" : ""}>{blocking ? `必须修订 ${blocking} 条` : "均为建议"}</i>
      </header>
      <p>批注和参数收集已并排在右侧，对照着改。改完在下方确认发送。</p>
      <footer>
        {/* 次要动作，不是主路。要核对原件的人自己会来找它；
            把它做成主按钮，等于每次都先让人绕一趟画布。 */}
        <button type="button" className="isGhost" onClick={onOpenCanvas}>
          <Maximize2 size={14} aria-hidden="true" />看原件
        </button>
      </footer>
    </section>
  );
}

export function ComposerChipTray({ tabs, onRemove }: { tabs: DmpkDraftTab[]; onRemove: (fieldId: string) => void }) {
  return <SharedComposerChipTray tabs={tabs} groups={dmpkGroups} fields={initialDmpkFields} onRemove={onRemove} />;
}

/* 卡片本体搬到了 components/params/ParameterTaskCard——DMPK 和肿瘤报价共用同一份。
   这里只剩把 DMPK 自己的分组绑上去：基础 ①②③ / 板块 ④–⑧（名字跟着检测类型走）/ 报告与交付，
   跟右栏台账读的是同一份分组，这就是"右栏和 composer 卡联动"。 */
export function DmpkParameterTaskCard({ activeGroup, fields, allFields, draftTabs, mode, open, onOpenChange, onSelect }: { activeGroup: DmpkGroupId; fields: DmpkField[]; allFields: DmpkField[]; draftTabs: DmpkDraftTab[]; mode: "collect" | "edit"; open?: boolean; onOpenChange?: (open: boolean) => void; onSelect: (field: DmpkField, value: string) => void }) {
  return (
    <ParameterTaskCard
      groups={dmpkGroupsFor(allFields)}
      fields={fields}
      allFields={allFields}
      activeGroup={activeGroup}
      draftTabs={draftTabs}
      mode={mode}
      eyebrow="补充报价"
      collectTitle="补齐缺失参数"
      open={open}
      onOpenChange={onOpenChange}
      onSelect={(field, value) => onSelect(field as DmpkField, value)}
    />
  );
}

/** 报价生成之后的交接卡。审核这一棒是人做的,所以这里只问「交给谁」。 */
function DmpkHandoffCard({ onHandoff, viewerName, unresolvedNotes = [], defaultNote = "", stale = false, onRegenerate }: {
  onHandoff: (to: string, note: string) => void;
  viewerName?: string;
  /* 落不到任何一格参数上的批注。报价单的条目和会话收的字段本来就不是
     一一对应——Discount 这类只存在于报价单口径里，参数面板里没有它的格子，
     所以它永远不会显示成「已处理」。 */
  unresolvedNotes?: { anchorId: string; label: string }[];
  /** 生成过会话摘要的话，说明栏预填它——接手的人要的正是这几句。 */
  defaultNote?: string;
  /* 出过的那版跟眼前的参数 / 单价对不上了。不拦（P0-3 不单设门槛），
     但要说在交接的地方：送出去的是旧的，接手的人不知道。 */
  stale?: boolean;
  onRegenerate?: () => void;
}) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState(defaultNote);
  /* 摘要可能在这张卡挂出来之后才生成。只在说明栏还空着时填进去——
     人已经打了字，就不该被一段自动文本盖掉。 */
  useEffect(() => { setNote((current) => current || defaultNote); }, [defaultNote]);
  /* 有落不到参数上的批注时，说明栏从选填变必填——否则那几条就这么静悄悄地
     跟着报价单又送回审批人手里，而他上一轮正是为它们退的。 */
  const ready = Boolean(to.trim()) && (!unresolvedNotes.length || Boolean(note.trim()));
  return (
    <section className="warningDecision dmpkHandoffCard">
      <header className="warningDecisionHeader">
        <div>
          <span>交接</span>
          <strong>报价单已生成，交给下一个人审核</strong>
          <p>交接后这件事会出现在对方的站内信里，随行带上本次的报价产物。</p>
        </div>
      </header>

      {/* 未落到参数上的那几条，在**送审这一刻**问一次。
          ----------------------------------------------------------------
          替代方案是给每条批注挂一个勾选框。那样做有两个问题：批注是审批人的
          原话，撰写人在上面留标记读起来像改了他的记录；而且「改到哪儿了」
          参数面板已经在说了，再加一套就有两个真相来源。
          所以只在这里问一次——它是这一轮唯一一个「不说清楚就出不去」的关口。 */}
      {stale ? (
        <div className="dmpkHandoffStale">
          <TriangleAlert size={14} aria-hidden="true" />
          <span>参数或单价已改动，报价单还是旧的。可以照样交接，但接手的人拿到的不是最新的数。</span>
          {onRegenerate ? <button type="button" onClick={onRegenerate}>先重新生成</button> : null}
        </div>
      ) : null}
      {unresolvedNotes.length ? (
        <div className="dmpkHandoffUnresolved">
          <strong>以下 {unresolvedNotes.length} 条批注没有对应的参数格</strong>
          <ul>
            {unresolvedNotes.map((item) => <li key={item.anchorId}>{item.label}</li>)}
          </ul>
          <span>它们只作用于报价单口径。请在下面的说明里写清楚怎么处理的，审批人才看得到。</span>
        </div>
      ) : null}
      <div className="dmpkHandoffFields">
        <label htmlFor="dmpk-handoff-to">
          <span>交给</span>
          {/* 从裸 input 换成选人控件:自由文本打错了没有任何反馈——
              你把活交给了一个不存在的人,而系统看起来一切正常。 */}
          <PersonPicker
            id="dmpk-handoff-to"
            people={directory}
            value={to}
            onChange={setTo}
            excludeName={viewerName}
            placeholder="选择接手的同事"
          />
        </label>
        <label>
          <span>说明{unresolvedNotes.length ? <em className="dmpkHandoffRequired">必填</em> : null}</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={unresolvedNotes.length ? `例如：${unresolvedNotes[0].label} 已按 15% 口径重算` : "选填，例如：管理费按 30% 口径，请复核"}
            aria-label="交接说明"
          />
        </label>
      </div>
      <div className="warningActions">
        <button className="primaryButton compact" type="button" disabled={!ready} onClick={() => { if (ready) { onHandoff(to.trim(), note.trim()); setTo(""); setNote(""); } }}>交接</button>
      </div>
    </section>
  );
}

/**
 * 报价前确认。
 * 还有文件认出来、人没点过头的参数时，不拦（P0-3 不单设门槛），但话要说在按钮上：
 * 「确认并生成」——点下去等于把那 N 项一起确认了。悄悄确认和拦住不让走，
 * 都不如把这件事写在手指要按的地方。
 */
function DmpkFinalConfirmCard({ onPreview, onGenerate, onOpenInspector, recognizedCount = 0, hasQuote = false }: { onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; recognizedCount?: number; /** 出过版了：这一下是重出，标题和按钮都得说「重新」 */ hasQuote?: boolean }) {
  const verb = hasQuote ? "重新生成" : "生成";
  return <section className="warningDecision"><header className="warningDecisionHeader"><div><span>报价前确认</span><strong>{hasQuote ? "参数已更新，重新生成报价单" : "参数已齐全，可以生成正式报价单"}</strong><p>{hasQuote ? "已出的那版报价单按的是旧参数。" : ""}请先预览完整参数和计价规则，也可以<PanelLink panelId="evidence" onOpen={onOpenInspector}>查看报价明细</PanelLink>。{recognizedCount ? <>其中 <b>{recognizedCount} 项来自文件识别</b>，尚未逐项确认，生成即视为确认。</> : null}确认后将{verb} Word 报价单与 Excel 报价明细。</p></div><small>{hasQuote ? "待重出" : "待确认"}</small></header><div className="warningActions"><button className="previewIconOnlyButton" type="button" onClick={onPreview} aria-label="预览全部参数"><Eye size={16} /></button><button className="primaryButton compact" type="button" onClick={onGenerate}>{recognizedCount ? `确认并${verb}报价单` : `${verb}报价单`}</button></div></section>;
}

function DmpkArtifactCards({ onPreview, onOpenInspector }: { onPreview: (kind: "word" | "excel") => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void }) {
  return <section className="artifactCards" data-minimap="artifact" data-minimap-label="报价单产物"><div className="agentReply artifactReply"><span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span><p>报价单已生成。你可以<PanelLink panelId="artifacts" onOpen={onOpenInspector}>查看产物列表</PanelLink>，或直接预览下方文件。</p></div>{(["word", "excel"] as const).map((kind) => <article className="artifactCard" key={kind}><span className="artifactFileIcon">{kind === "word" ? <FileText size={24} /> : <FileSpreadsheet size={24} />}</span><div><strong>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</strong><p>{kind === "word" ? "DMPK PK 检测正式报价单，包含项目范围、报价条目、管理费和交付说明。" : "报价明细表，包含计价项、数量、单价、管理费和金额一致性校验。"}</p><span>{kind === "word" ? "Document · DOCX · 管理费 30%" : "Spreadsheet · XLSX · 管理费 15%"}</span></div><button className="artifactActionButton" type="button" onClick={() => onPreview(kind)} aria-label="预览"><Eye size={16} /><span>预览</span></button></article>)}</section>;
}

export function DmpkParameterPanel({ fields, activeGroup, openGroups, completedCount, totalRequired, stage, onToggle, onEdit }: { fields: DmpkField[]; activeGroup: DmpkGroupId; openGroups: Record<DmpkGroupId, boolean>; completedCount: number; totalRequired: number; stage: DmpkStage; onToggle: (id: DmpkGroupId) => void; onEdit: (id: string) => void }) {
  const hasArtifacts = stage === "generated";
  return <section className="rightPanelCard pinnedParamCard"><header><div><FileSpreadsheet size={20} /><strong>报价参数收集</strong></div><span>{completedCount}/{totalRequired}</span></header><div className={hasArtifacts ? "paramGroups compact" : "paramGroups"}>{dmpkGroups.map((group) => { const groupFields = fields.filter((field) => field.group === group.id); const done = groupFields.every((field) => field.value); const shouldOpen = !hasArtifacts && openGroups[group.id]; return <section className="paramGroup" key={group.id}><button className="paramGroupHeader" type="button" onClick={() => onToggle(group.id)}><i className={done ? "done" : group.id === activeGroup ? "active" : ""} /><strong>{group.title}</strong><span>{done ? "已完成" : group.id === activeGroup ? "进行中" : "未开始"}</span><ChevronDown size={16} /></button>{shouldOpen ? <div className="paramRows">{groupFields.map((field) => <div className="paramRow" key={field.id}><span>{field.label}</span><strong className={field.value ? "" : "empty"}>{field.value || "待填写"}</strong><button type="button" onClick={() => onEdit(field.id)} aria-label={`修改${field.label}`}><Edit3 size={15} /></button></div>)}</div> : null}</section>; })}</div></section>;
}

export function DmpkQuotationPreviewModal({ fields, onClose }: { fields: DmpkField[]; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  /* 遮罩、层级、Esc、关闭键都归 PreviewModal——这层皮原本在三处各手写一遍。 */
  return <PreviewModal eyebrow="报价前确认" title="完整参数与计价规则预览" onClose={onClose}><div className="previewBody"><div className="previewContent" ref={scrollRef}><PreviewTable title="报价参数" rows={fields.map((field) => [getDmpkGroupTitle(field.group, fields), field.label, field.value])} /><div className="previewNotice"><Check size={17} /><span>计价关键字段已齐全。Word 报价单使用 30% 管理费，Excel 报价明细使用 15% 管理费，生成后将进行金额一致性校验。</span></div></div></div><ScrollTopButton targetRef={scrollRef} /></PreviewModal>;
}
/* DmpkArtifactPreviewModal 已删除：它渲染的是一张四行摘要表，既不是 Word 也不是
   Excel，撰写人对着它核对不了任何一行。产物预览统一走 QuotePreviewModal。 */

function PreviewTable({ title, rows }: { title: string; rows: string[][] }) {
  return <div className="previewTableWrap"><h3>{title}</h3><table className="previewTable"><thead><tr><th>类别</th><th>项目</th><th>说明</th></tr></thead><tbody>{rows.map((row) => <tr key={row.join("-")}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div>;
}

function processStepTech(step: string) {
  if (step.includes("读取")) return "parser=nlp-slot-filler/v3  fields_matched=6  confidence=0.91";
  if (step.includes("识别")) return "router=business-line-classifier  matched=DMPK/PK  score=0.88";
  if (step.includes("检查")) return "validator=required-fields  checked=14  missing=0";
  if (step.includes("匹配 PK")) return "rule_set=animal-experiment/v8  hit=3  price_table=pt_sd_rat_2026";
  if (step.includes("匹配生物")) return "rule_set=bioanalysis/v5  hit=2  method=LC-MS/MS";
  if (step.includes("生成")) return "renderer=docx+xlsx  template=dmpk_quote_v8  pages=4";
  if (step.includes("校验")) return "checker=amount-consistency  page=xlsx=docx  delta=0.00";
  return "step executed";
}
