"use client";

import { ArrowRight, Check, ChevronDown, CircleDollarSign, Edit3, Eye, FileSpreadsheet, FileText, Maximize2, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ScrollTopButton } from "../../components/ui/ScrollTopButton";
import { useModalDismiss } from "../../components/ui/useModalDismiss";
import { AgentReply, PanelLink, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { CoworkerSelector } from "../../components/workbench-shell/CoworkerSelector";
import { ContextDivider, CoworkerSwitchCard } from "../../components/workbench-shell/BioAZHelper";
import { WorkbenchComposer } from "../../components/workbench-shell/WorkbenchComposer";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { CoworkerDefinition } from "../types";
import { priceCatalog, scenarioShortLabels } from "../quotation-management/dmpk/catalog";
import {
  dmpkFieldOptions,
  dmpkGroups,
  getDmpkGroupTitle,
  initialDmpkFields,
  type DmpkDraftTab,
  type DmpkField,
  type DmpkGroupId,
  type DmpkStage,
} from "./fields";

export type DmpkInspectorPanelId = "parameters" | "process" | "materials" | "gaps" | "evidence" | "artifacts" | "review";
export type DmpkChatMessage = { id: string; role: "user" | "agent"; text: string; attachments?: ComposerAttachment[] };
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
  return (
    <div className="dmpkConversation">
      {handoffNotice ? <ContextDivider>{handoffNotice}</ContextDivider> : null}
      {messages.map((message) => message.role === "agent" ? <AgentReply key={message.id}>{message.text}</AgentReply> : <UserBubble key={message.id} text={message.text} attachments={message.attachments} />)}
      {stage !== "idle" ? (
        <DmpkActivityChain
          title={stage === "generated" ? "已完成报价生成过程" : stage === "thinking" ? "正在处理报价参数" : "已更新报价参数"}
          steps={stage === "generating" || stage === "generated" ? ["检查计价关键字段", "匹配 PK 动物实验价格规则", "匹配生物分析价格规则", "生成 Word / Excel 报价单", "校验页面与文件金额一致"] : ["读取用户输入", "识别 DMPK / PK 业务线", currentMissing.length ? `还缺 ${currentMissing.length} 项报价参数` : "当前阶段参数已齐全"]}
          running={stage === "thinking" || stage === "generating"}
          onOpenInspector={onOpenInspector}
        />
      ) : null}
      {stage === "generated" ? <DmpkArtifactCards onPreview={onArtifactPreview} onOpenInspector={onOpenInspector} /> : null}
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

export function DmpkComposer({ editProposal, onHandoff, onConfirmCurrentPrice, onOpenRuleManagement, attention, conversationEditing, stage, text, setText, activeGroup, fields, allFields, mode, draftTabs, onSelect, onRemove, onSend, onPreview, onGenerate, onOpenInspector, coworkers, coworkerLocked, activeCoworkerId, onCoworkerChange, pendingCoworkerId, onConfirmCoworkerChange, onCancelCoworkerChange, disabled, projectName, attachments, onAttachmentsChange }: { editProposal?: DmpkEditProposal | null; /** 报价生成后把这一单交给下一棒。不传就不显示交接卡 */ onHandoff?: (to: string, note: string) => void; onConfirmCurrentPrice: () => void; onOpenRuleManagement: () => void; attention?: boolean; conversationEditing?: boolean; stage: DmpkStage; text: string; setText: (value: string) => void; activeGroup: DmpkGroupId; fields: DmpkField[]; /** 全部 14 项,不只是还缺的——全屏面板要一次列全 */ allFields: DmpkField[]; mode: "collect" | "edit"; draftTabs: DmpkDraftTab[]; onSelect: (field: DmpkField, value: string) => void; onRemove: (fieldId: string) => void; onSend: () => void; onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; coworkers: CoworkerDefinition[]; coworkerLocked: boolean; activeCoworkerId: string; onCoworkerChange: (coworkerId: string) => void; pendingCoworkerId: string | null; onConfirmCoworkerChange: () => void; onCancelCoworkerChange: () => void; disabled: boolean; projectName: string; attachments: ComposerAttachment[]; onAttachmentsChange: (next: ComposerAttachment[]) => void }) {
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
      {editProposal ? <DmpkEditProposalCard proposal={editProposal} onConfirmCurrentPrice={onConfirmCurrentPrice} onOpenRuleManagement={onOpenRuleManagement} /> : null}
      {stage === "collecting" ? <DmpkParameterTaskCard activeGroup={activeGroup} fields={fields} allFields={allFields} draftTabs={draftTabs} mode={mode} onSelect={onSelect} /> : null}
      {stage === "ready" ? <DmpkFinalConfirmCard onPreview={onPreview} onGenerate={onGenerate} onOpenInspector={onOpenInspector} /> : null}
      {/* 报价出来了,下一步是把它交给谁。入口长在这儿而不是某个列表页顶栏:
          工单不是「新建」出来的,是干完活交出去那一下留下的凭据——所以它该
          出现在活刚干完的地方,而不是让人先想起去哪儿开一张单。 */}
      {stage === "generated" && onHandoff ? <DmpkHandoffCard onHandoff={onHandoff} /> : null}
      {pendingCoworker && currentCoworker ? <CoworkerSwitchCard from={currentCoworker.name} to={pendingCoworker.name} endingCurrentFlow={coworkerLocked} onConfirm={onConfirmCoworkerChange} onCancel={onCancelCoworkerChange} /> : null}
      {stage !== "collecting" && stage !== "ready" ? <CoworkerSelector coworkers={coworkers} activeCoworkerId={activeCoworkerId} locked={coworkerLocked} onChange={onCoworkerChange} /> : null}
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

const draftGroupById = new Map(initialDmpkFields.map((field) => [field.id, field.group]));

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
function ComposerChipTray({ tabs, onRemove }: { tabs: DmpkDraftTab[]; onRemove: (fieldId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  // chips 被清空后（发送完一轮）自动回到收起态，否则下次进来是个空的大盒子
  useEffect(() => { if (!tabs.length) setExpanded(false); }, [tabs.length]);
  if (!tabs.length) return null;

  const grouped = dmpkGroups
    .map((group) => ({ group, items: tabs.filter((tab) => draftGroupById.get(tab.fieldId) === group.id) }))
    .filter((entry) => entry.items.length);
  const ungrouped = tabs.filter((tab) => !draftGroupById.has(tab.fieldId));

  const chip = (tab: DmpkDraftTab) => (
    <button type="button" key={tab.fieldId} onClick={() => onRemove(tab.fieldId)} aria-label={`移除 ${tab.label}`}>
      <span>{tab.label}：{tab.value}</span>
      <X size={13} />
    </button>
  );

  const toggle = (
    <button className="composerChipToggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      {/* 报的是总数不是隐藏数——没测量就不知道露出了几个，写「+4」会骗人。
          「4 项 ˅」在任何数量下都成立：已选这么多，点开看全部。 */}
      {expanded ? <>收起<ChevronDown size={12} className="isOpen" /></> : <>{tabs.length} 项<ChevronDown size={12} /></>}
    </button>
  );

  if (!expanded) {
    // 收起态就一行：chips 裁到头渐隐，计数紧跟在断口后面——
    // 内容在哪儿断的，「还有更多」就出现在哪儿。
    return (
      <div className="composerChipTray">
        <div className="draftTabs composerChipStrip">{tabs.map(chip)}</div>
        {toggle}
      </div>
    );
  }

  return (
    <div className="composerChipTray isExpanded">
      <div className="composerChipTrayHead">
        <span className="composerChipCount">已选 {tabs.length} 项参数</span>
        {toggle}
      </div>
      <div className="composerChipGroups">
        {grouped.map((entry) => (
          <section key={entry.group.id}>
            <h5>{entry.group.title}<i>{entry.items.length}</i></h5>
            <div className="draftTabs">{entry.items.map(chip)}</div>
          </section>
        ))}
        {ungrouped.length ? (
          <section>
            <h5>其他<i>{ungrouped.length}</i></h5>
            <div className="draftTabs">{ungrouped.map(chip)}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** 一项参数的选项行。行内卡和全屏弹窗共用一份——两套实现迟早会分叉。 */
function ParameterOptionRow({ field, index, selectedValue, editingCustom, customValue, onPick, onCustomOpen, onCustomChange, onCustomCommit, onCustomCancel }: {
  field: DmpkField;
  index: number;
  selectedValue: string;
  editingCustom: boolean;
  customValue: string;
  onPick: (value: string) => void;
  onCustomOpen: () => void;
  onCustomChange: (value: string) => void;
  onCustomCommit: () => void;
  onCustomCancel: () => void;
}) {
  return (
    <article className={`decisionRow ${selectedValue ? "done" : ""}`}>
      <div className="decisionCopy">
        <div className="decisionTitleRow">
          <span className="decisionIndex">{selectedValue ? <Check size={15} /> : index}</span>
          <strong>{field.label}</strong>
          <span className="requiredTag">{field.required ? "必填" : "可选"}</span>
        </div>
        <div className="optionGrid">
          {(dmpkFieldOptions[field.id] ?? ["1", "2", "3"]).map((option) => option === "自定义" && editingCustom ? (
            <input
              autoFocus
              className="customOptionInput"
              key={option}
              value={customValue}
              placeholder="输入"
              onBlur={onCustomCommit}
              onChange={(event) => onCustomChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onCustomCommit();
                if (event.key === "Escape") {
                  /* 全屏时 Esc 是关弹窗的。这里必须拦住,否则想取消一个自定义输入,
                     会连整张弹窗一起关掉——把人填到一半的东西收走。 */
                  event.stopPropagation();
                  onCustomCancel();
                }
              }}
            />
          ) : (
            <button className={selectedValue === option ? "selected" : ""} type="button" key={option} onClick={() => option === "自定义" ? onCustomOpen() : onPick(option)}>{option}</button>
          ))}
        </div>
      </div>
    </article>
  );
}

function DmpkParameterTaskCard({ activeGroup, fields, allFields, draftTabs, mode, onSelect }: { activeGroup: DmpkGroupId; fields: DmpkField[]; allFields: DmpkField[]; draftTabs: DmpkDraftTab[]; mode: "collect" | "edit"; onSelect: (field: DmpkField, value: string) => void }) {
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [page, setPage] = useState(() => Math.max(0, dmpkGroups.findIndex((group) => group.id === activeGroup)));
  const safePage = Math.min(page, dmpkGroups.length - 1);
  const pageGroup = dmpkGroups[safePage];
  const pageFields = mode === "edit" ? fields : fields.filter((field) => field.group === pageGroup.id);
  useEffect(() => {
    const activePage = dmpkGroups.findIndex((group) => group.id === activeGroup);
    if (activePage >= 0) setPage(activePage);
  }, [activeGroup]);
  const selectValue = (field: DmpkField, value: string) => {
    onSelect(field, value);
    if (mode !== "collect" || pageFields.length !== 1 || pageFields[0]?.id !== field.id) return;
    const nextPage = dmpkGroups.findIndex((group, index) => index > safePage && fields.some((item) => item.id !== field.id && item.group === group.id));
    if (nextPage >= 0) window.requestAnimationFrame(() => setPage(nextPage));
  };
  const commitCustom = (field: DmpkField) => {
    const value = customValues[field.id]?.trim();
    if (value) selectValue(field, value);
    setEditingCustom(null);
  };
  /* 待发草稿优先于已落库的值:同一项被改过,行内要显示的是那个改动,不是旧值。 */
  const valueOf = (field: DmpkField) => draftTabs.find((tab) => tab.fieldId === field.id)?.value ?? field.value ?? "";

  const row = (field: DmpkField, index: number, onPick: (value: string) => void) => (
    <ParameterOptionRow
      key={field.id}
      field={field}
      index={index}
      selectedValue={valueOf(field)}
      editingCustom={editingCustom === field.id}
      customValue={customValues[field.id] ?? ""}
      onPick={onPick}
      onCustomOpen={() => setEditingCustom(field.id)}
      onCustomChange={(value) => setCustomValues((current) => ({ ...current, [field.id]: value }))}
      onCustomCommit={() => commitCustom(field)}
      onCustomCancel={() => setEditingCustom(null)}
    />
  );

  const modal = fullscreen ? (
    <DmpkParameterFullscreenModal
      allFields={allFields}
      draftTabs={draftTabs}
      renderRow={row}
      onSelect={onSelect}
      onClose={() => { setEditingCustom(null); setFullscreen(false); }}
    />
  ) : null;

  /* 行内卡在没有待填项时收起,但**弹窗开着的时候不能跟着消失**——在全屏里填完
     最后一项,整个面板凭空蒸发会让人以为出错了。让它留到你自己点关闭。 */
  if (!fields.length) return modal;

  return (
    <>
      <section
        className={`warningDecision parameterTaskCard ${mode === "collect" ? "canExpand" : ""}`}
        /* 整张卡的空白处都能展开,不只是那颗图标——参数一多,人会先去点卡片
           本身。选项、分页 tab、上一页这些自己有事做的元素要放行,否则选一个
           值会顺手把弹窗也开了。 */
        onClick={mode === "collect" ? (event) => {
          if ((event.target as HTMLElement).closest("button, input, a, label")) return;
          setFullscreen(true);
        } : undefined}
      >
        <header className="warningDecisionHeader">
          <div><span>参数补全</span><strong>{mode === "edit" ? `修改${fields[0]?.label ?? "参数"}` : "请补全报价参数"}</strong>{mode === "edit" ? <p>选择新值后发送，即可更新右侧参数。</p> : null}</div>
          {/* 计数和入口平排一行,图标在右端。上下堆两行会在卡片右上角叠出
              一块比标题还高的方块,把「参数补全 / 请补全报价参数」压偏。 */}
          <div className="parameterCardHeadActions">
            <small>还需填写 {fields.length} 项</small>
            {/* 分页是为了在这个高度里放得下,不是因为这些参数该被分批问。
                参数一多,「先填后面那组」在行内卡里是做不到的——后面的页在你
                填完前是禁用的。全屏的价值就在这儿:一屏看全,哪项都能先填。 */}
            {mode === "collect" ? <button className="parameterExpandButton" type="button" onClick={() => setFullscreen(true)} aria-label="全屏填写全部参数" title="全屏填写全部参数"><Maximize2 size={15} /></button> : null}
          </div>
        </header>
        {mode === "collect" ? <div className="parameterPages">{dmpkGroups.map((group, index) => <button className={index === safePage ? "active" : ""} type="button" key={group.id} disabled={index > safePage} onClick={() => setPage(index)}>{group.title}</button>)}</div> : null}
        <div className="warningDecisionList">
          {pageFields.length
            ? pageFields.map((field, index) => row(field, index + 1, (value) => selectValue(field, value)))
            : <p className="emptyPageNote">{pageGroup.title}参数已齐全，可切换下一页继续补全。</p>}
        </div>
        <div className="parameterPager"><p className="responsibilityNote">还需填写 {fields.length} 项</p>{mode === "collect" && safePage > 0 ? <div><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))}>上一页</button></div> : null}</div>
      </section>
      {modal}
    </>
  );
}

/** 全屏参数面板。取消分页,四组一次列全,哪一项都能先填。 */
function DmpkParameterFullscreenModal({ allFields, draftTabs, renderRow, onSelect, onClose }: {
  allFields: DmpkField[];
  draftTabs: DmpkDraftTab[];
  renderRow: (field: DmpkField, index: number, onPick: (value: string) => void) => ReactNode;
  onSelect: (field: DmpkField, value: string) => void;
  onClose: () => void;
}) {
  const dismiss = useModalDismiss(onClose);
  const scrollRef = useRef<HTMLDivElement>(null);
  const remaining = allFields.filter((field) => field.required && !field.value && !draftTabs.some((tab) => tab.fieldId === field.id)).length;

  /* 挂到 body 上,不留在参数卡子树里——review.css 有一条
     `.parameterTaskCard *` 把 transition / transform 全清零,留在里面
     回顶按钮的进出动画会被那条一起清掉。 */
  return createPortal(
    <div className="modalBackdrop" role="presentation" {...dismiss}>
      <section className="previewModal dmpkParamModal" role="dialog" aria-modal="true" aria-label="报价参数">
        <header>
          <div><span>参数补全</span><h2>报价参数</h2></div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="dmpkParamModalBody" ref={scrollRef}>
          {dmpkGroups.map((group) => {
            const groupFields = allFields.filter((field) => field.group === group.id);
            if (!groupFields.length) return null;
            const groupLeft = groupFields.filter((field) => field.required && !field.value && !draftTabs.some((tab) => tab.fieldId === field.id)).length;
            return (
              <section className="dmpkParamModalGroup" key={group.id}>
                <h3>{group.title}<em>{groupLeft ? `还需 ${groupLeft} 项` : "已齐全"}</em></h3>
                {groupFields.map((field, index) => renderRow(field, index + 1, (value) => onSelect(field, value)))}
              </section>
            );
          })}
        </div>
        <footer className="dmpkParamModalFoot">
          <p>{remaining ? `还需填写 ${remaining} 项` : "参数已齐全，关闭后发送即可"}</p>
          <button className="primaryButton compact" type="button" onClick={onClose}>完成</button>
        </footer>
        <ScrollTopButton targetRef={scrollRef} />
      </section>
    </div>,
    document.body,
  );
}

/** 报价生成之后的交接卡。审核这一棒是人做的,所以这里只问「交给谁」。 */
function DmpkHandoffCard({ onHandoff }: { onHandoff: (to: string, note: string) => void }) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const ready = Boolean(to.trim());
  return (
    <section className="warningDecision dmpkHandoffCard">
      <header className="warningDecisionHeader">
        <div>
          <span>交接</span>
          <strong>报价单已生成，交给下一个人审核</strong>
          <p>交接后这张工单会出现在对方的站内信里，随单带上本次的报价产物。</p>
        </div>
      </header>
      <div className="dmpkHandoffFields">
        <label>
          <span>交给</span>
          <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="姓名，例如 王林彬" aria-label="交给谁" />
        </label>
        <label>
          <span>说明</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="选填，例如：管理费按 30% 口径，请复核" aria-label="交接说明" />
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
  const dismiss = useModalDismiss(onClose);
  const scrollRef = useRef<HTMLDivElement>(null);
  /* role="dialog" 归面板，遮罩是 presentation——原来两个都挂在遮罩上，
     读屏软件会把整个背景层当成对话框。 */
  return <div className="modalBackdrop" role="presentation" {...dismiss}><section className="previewModal" role="dialog" aria-modal="true" aria-label="完整参数与计价规则预览"><header><div><span>报价前确认</span><h2>完整参数与计价规则预览</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><div className="previewBody"><div className="previewContent" ref={scrollRef}><PreviewTable title="报价参数" rows={fields.map((field) => [getDmpkGroupTitle(field.group), field.label, field.value])} /><div className="previewNotice"><Check size={17} /><span>计价关键字段已齐全。Word 报价单使用 30% 管理费，Excel 报价明细使用 15% 管理费，生成后将进行金额一致性校验。</span></div></div></div><ScrollTopButton targetRef={scrollRef} /></section></div>;
}

export function DmpkArtifactPreviewModal({ kind, onClose }: { kind: "word" | "excel"; onClose: () => void }) {
  const dismiss = useModalDismiss(onClose);
  const scrollRef = useRef<HTMLDivElement>(null);
  const title = kind === "word" ? "中文 Word 报价单" : "Excel 报价明细";
  return <div className="modalBackdrop" role="presentation" {...dismiss}><section className="previewModal artifactPreviewModal" role="dialog" aria-modal="true" aria-label={title}><header><div><span>产物预览</span><h2>{title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><div className="previewContent" ref={scrollRef}><PreviewTable title={kind === "word" ? "Word 报价单预览" : "Excel 报价明细预览"} rows={[["检测类型", "PK检测", "DMPK 业务线已确认"], ["动物实验", "SD大鼠 · 2组 · 每组2只 · 1周", "已匹配动物实验计价规则"], ["生物分析", "LC-MS/MS · 血浆 · 3点 · 1个待测物", "已匹配生物分析计价规则"], ["金额校验", "页面 / Word / Excel 一致", kind === "word" ? "中文编码与表格边框已校验" : "管理费 15% 已应用"]]} /></div><ScrollTopButton targetRef={scrollRef} /></section></div>;
}

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
