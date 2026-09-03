"use client";

import { ArrowRight, Check, ChevronDown, CircleDollarSign, CornerDownLeft, Edit3, Eye, FileSpreadsheet, FileText, Maximize2, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ComposerChipTray as SharedComposerChipTray, ParameterTaskCard } from "../../components/params";
import { PersonPicker } from "../../components/ui";
import { PreviewModal } from "../../components/ui/PreviewModal";
import { ScrollTopButton } from "../../components/ui/ScrollTopButton";
import { useModalDismiss } from "../../components/ui/useModalDismiss";
import { directory } from "../../lib/workbench/mockInbox";
import { AgentReply, PanelLink, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { CoworkerSelector } from "../../components/workbench-shell/CoworkerSelector";
import { ContextDivider, CoworkerSwitchCard } from "../../components/workbench-shell/BioAZHelper";
import { MessageAttachments, WorkbenchComposer } from "../../components/workbench-shell/WorkbenchComposer";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { CoworkerDefinition, SessionRework } from "../types";
import { ReworkCard, type ReworkNoteState } from "../../components/workbench-shell/ReworkCard";
import { ChangeConfirmCard, type QuoteChange } from "../../components/workbench-shell/ChangeConfirmCard";
import type { QuoteNote } from "../../lib/workbench/quoteData";
import { priceCatalog, scenarioShortLabels } from "../quotation-management/dmpk/catalog";
import {
  dmpkGroups,
  getDmpkGroupTitle,
  initialDmpkFields,
  type DmpkDraftTab,
  type DmpkField,
  type DmpkGroupId,
  type DmpkStage,
} from "./fields";

export type DmpkInspectorPanelId = "parameters" | "process" | "materials" | "gaps" | "evidence" | "artifacts" | "rules" | "rework" | "review";
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
  role: "user" | "agent" | "run" | "inbound" | "artifacts";
  text: string;
  attachments?: ComposerAttachment[];
  /** role === "run" 时这一次跑了哪几步。 */
  runSteps?: string[];
};

/** 一次运行的标题与步骤。两处（进行中的尾巴、留档的那条）取自同一处，免得分叉。 */
export function dmpkRunRecord(kind: "params" | "quote" | "rework", options: { running?: boolean; missingCount?: number } = {}) {
  const { running = false, missingCount = 0 } = options;
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

export function DmpkConversation({ messages, stage, currentMissing, handoffNotice, onOpenInspector, onArtifactPreview }: { messages: DmpkChatMessage[]; stage: DmpkStage; currentMissing: DmpkField[]; handoffNotice?: string; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; onArtifactPreview: (kind: "word" | "excel") => void }) {
  const liveRun = stage === "thinking" || stage === "generating"
    ? dmpkRunRecord(stage === "generating" ? "quote" : "params", { running: true, missingCount: currentMissing.length })
    : null;
  return (
    <div className="dmpkConversation">
      {handoffNotice ? <ContextDivider>{handoffNotice}</ContextDivider> : null}
      {messages.map((message) => {
        if (message.role === "run") return <DmpkActivityChain key={message.id} title={message.text} steps={message.runSteps ?? []} running={false} onOpenInspector={onOpenInspector} />;
        if (message.role === "inbound") return <DmpkInboundEvent key={message.id} text={message.text} attachments={message.attachments} />;
        if (message.role === "artifacts") return <DmpkArtifactCards key={message.id} onPreview={onArtifactPreview} onOpenInspector={onOpenInspector} />;
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
function DmpkActivityChain({ title, steps, running, onOpenInspector }: { title: string; steps: string[]; running: boolean; onOpenInspector: (panelId: DmpkInspectorPanelId) => void }) {
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const open = running || expanded;
  const activeStepIndex = steps.length - 1;

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
        <small>{running ? "处理中" : "4s"}</small>
      </button>
      {open ? (
        <div className="timeline">
          {steps.map((step, index) => (
            <div className={`timelineItem ${running && index === activeStepIndex ? "active" : "done"}`} key={step}>
              <span className="timelineDot" />
              <div className="timelineContent">
                <div className="timelineTitle">
                  <strong>{step}</strong>
                  {running && index === activeStepIndex ? <span>进行中</span> : null}
                </div>
                <p>{processStepDetail(step)}</p>
                <button
                  className="textButton"
                  type="button"
                  onClick={() => setExpandedTech(expandedTech === step ? null : step)}
                >
                  技术详情
                </button>
                {expandedTech === step ? (
                  <pre className="techBlock">
                    {processStepTech(step)}
                    {"\n"}job_id=job_dmpk_4c1f8a2e9b7d
                    {"\n"}trace_id=trc_quotation_58ad31
                  </pre>
                ) : null}
              </div>
              {index < steps.length - 1 ? <span className="timelineLine" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
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

export function DmpkComposer({ reworkNotice, unresolvedNotes, editProposal, onHandoff, viewerName, handoffDone, rework, reworkNotes = [], reworkStates = {}, reworkCurrentValue, onAcceptRework, onDeferRework, onResetRework, onRegenerateRework, changeConfirm, onConfirmChanges, onCancelChanges, onOpenQuote, onConfirmCurrentPrice, onOpenRuleManagement, attention, conversationEditing, stage, text, setText, activeGroup, fields, allFields, mode, draftTabs, onSelect, onRemove, onSend, onPreview, onGenerate, onOpenInspector, coworkers, coworkerLocked, activeCoworkerId, onCoworkerChange, pendingCoworkerId, onConfirmCoworkerChange, onCancelCoworkerChange, disabled, projectName, attachments, onAttachmentsChange }: { /** 落不到参数格上的批注，交接卡在送审时问一次 */ unresolvedNotes?: { anchorId: string; label: string }[]; /** 退回批注入口卡。它跟参数卡、交接卡同一个槽位：需要人当场做的事都在这儿 */ reworkNotice?: ReactNode; editProposal?: DmpkEditProposal | null; /** 报价生成后把这一单交给下一棒。不传就不显示交接卡 */ onHandoff?: (to: string, note: string) => void; /** 当前账号姓名,用于把自己从交接候选里去掉 */ viewerName?: string; /** 已经交出去了,收起交接卡 */ handoffDone?: boolean; /** 被退回的那一版:批注跟着回到会话,在这里逐条处理 */ rework?: SessionRework; reworkNotes?: QuoteNote[]; reworkStates?: Record<string, ReworkNoteState>; reworkCurrentValue?: (anchorId: string) => string; onAcceptRework?: (note: QuoteNote) => void; onDeferRework?: (note: QuoteNote) => void; onResetRework?: (note: QuoteNote) => void; onRegenerateRework?: () => void; /** 重新生成前的整体复核 */ changeConfirm?: QuoteChange[] | null; onConfirmChanges?: () => void; onCancelChanges?: () => void; onOpenQuote?: () => void; onConfirmCurrentPrice: () => void; onOpenRuleManagement: () => void; attention?: boolean; conversationEditing?: boolean; stage: DmpkStage; text: string; setText: (value: string) => void; activeGroup: DmpkGroupId; fields: DmpkField[]; /** 全部 14 项,不只是还缺的——全屏面板要一次列全 */ allFields: DmpkField[]; mode: "collect" | "edit"; draftTabs: DmpkDraftTab[]; onSelect: (field: DmpkField, value: string) => void; onRemove: (fieldId: string) => void; onSend: () => void; onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; coworkers: CoworkerDefinition[]; coworkerLocked: boolean; activeCoworkerId: string; onCoworkerChange: (coworkerId: string) => void; pendingCoworkerId: string | null; onConfirmCoworkerChange: () => void; onCancelCoworkerChange: () => void; disabled: boolean; projectName: string; attachments: ComposerAttachment[]; onAttachmentsChange: (next: ComposerAttachment[]) => void }) {
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
      {stage === "collecting" ? <DmpkParameterTaskCard activeGroup={activeGroup} fields={fields} allFields={allFields} draftTabs={draftTabs} mode={mode} onSelect={onSelect} /> : null}
      {stage === "ready" ? <DmpkFinalConfirmCard onPreview={onPreview} onGenerate={onGenerate} onOpenInspector={onOpenInspector} /> : null}
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
      {stage === "generated" && onHandoff && !handoffDone ? <DmpkHandoffCard onHandoff={onHandoff} viewerName={viewerName} unresolvedNotes={unresolvedNotes} /> : null}
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
            placeholder={draftTabs.length ? "" : conversationEditing ? "说出要修改的参数、价格或规则…" : stage === "idle" ? "例如：PK小分子，SD大鼠，每组2只，2组，试验周期1周，周期内3个非加班时间点" : ""}
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
   这里只剩把 DMPK 自己的四个分组绑上去。 */
export function DmpkParameterTaskCard({ activeGroup, fields, allFields, draftTabs, mode, onSelect }: { activeGroup: DmpkGroupId; fields: DmpkField[]; allFields: DmpkField[]; draftTabs: DmpkDraftTab[]; mode: "collect" | "edit"; onSelect: (field: DmpkField, value: string) => void }) {
  return (
    <ParameterTaskCard
      groups={dmpkGroups}
      fields={fields}
      allFields={allFields}
      activeGroup={activeGroup}
      draftTabs={draftTabs}
      mode={mode}
      onSelect={(field, value) => onSelect(field as DmpkField, value)}
    />
  );
}

/** 报价生成之后的交接卡。审核这一棒是人做的,所以这里只问「交给谁」。 */
function DmpkHandoffCard({ onHandoff, viewerName, unresolvedNotes = [] }: {
  onHandoff: (to: string, note: string) => void;
  viewerName?: string;
  /* 落不到任何一格参数上的批注。报价单的条目和会话收的字段本来就不是
     一一对应——Discount 这类只存在于报价单口径里，参数面板里没有它的格子，
     所以它永远不会显示成「已处理」。 */
  unresolvedNotes?: { anchorId: string; label: string }[];
}) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
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

function DmpkFinalConfirmCard({ onPreview, onGenerate, onOpenInspector }: { onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void }) {
  return <section className="warningDecision"><header className="warningDecisionHeader"><div><span>报价前确认</span><strong>参数已齐全，可以生成正式报价单</strong><p>请先预览完整参数和计价规则，也可以<PanelLink panelId="evidence" onOpen={onOpenInspector}>查看规则证据</PanelLink>。确认后将生成 Word 报价单与 Excel 报价明细。</p></div><small>待确认</small></header><div className="warningActions"><button className="previewIconOnlyButton" type="button" onClick={onPreview} aria-label="预览全部参数"><Eye size={16} /></button><button className="primaryButton compact" type="button" onClick={onGenerate}>生成报价单</button></div></section>;
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
  return <PreviewModal eyebrow="报价前确认" title="完整参数与计价规则预览" onClose={onClose}><div className="previewBody"><div className="previewContent" ref={scrollRef}><PreviewTable title="报价参数" rows={fields.map((field) => [getDmpkGroupTitle(field.group), field.label, field.value])} /><div className="previewNotice"><Check size={17} /><span>计价关键字段已齐全。Word 报价单使用 30% 管理费，Excel 报价明细使用 15% 管理费，生成后将进行金额一致性校验。</span></div></div></div><ScrollTopButton targetRef={scrollRef} /></PreviewModal>;
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
