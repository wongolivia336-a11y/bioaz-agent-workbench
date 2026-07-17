"use client";

import { Check, ChevronDown, Edit3, Eye, FileSpreadsheet, FileText, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentReply, PanelLink, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { CoworkerSelector } from "../../components/workbench-shell/CoworkerSelector";
import { ContextDivider, CoworkerSwitchCard } from "../../components/workbench-shell/BioAZHelper";
import type { CoworkerDefinition } from "../types";
import {
  dmpkFieldOptions,
  dmpkGroups,
  getDmpkGroupTitle,
  type DmpkDraftTab,
  type DmpkField,
  type DmpkGroupId,
  type DmpkStage,
} from "./fields";

export type DmpkInspectorPanelId = "parameters" | "process" | "materials" | "gaps" | "evidence" | "artifacts" | "review";
export type DmpkChatMessage = { id: string; role: "user" | "agent"; text: string };

export function DmpkConversation({ messages, stage, currentMissing, handoffNotice, onOpenInspector, onArtifactPreview }: { messages: DmpkChatMessage[]; stage: DmpkStage; currentMissing: DmpkField[]; handoffNotice?: string; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; onArtifactPreview: (kind: "word" | "excel") => void }) {
  return (
    <div className="dmpkConversation">
      {handoffNotice ? <ContextDivider>{handoffNotice}</ContextDivider> : null}
      {messages.map((message) => message.role === "agent" ? <AgentReply key={message.id}>{message.text}</AgentReply> : <UserBubble key={message.id} text={message.text} />)}
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

function DmpkActivityChain({ title, steps, running, onOpenInspector }: { title: string; steps: string[]; running: boolean; onOpenInspector: (panelId: DmpkInspectorPanelId) => void }) {
  return (
    <details className="activityChain" open={running}>
      <summary>
        <span className={running ? "agentLogoMark isThinking" : "agentLogoMark isMuted"}><img src="/logo/bioaz-logo.svg" alt="" /></span>
        <strong>{title}</strong><span>·</span>
        <PanelLink panelId="process" onOpen={onOpenInspector}>查看过程</PanelLink>
        <em>{running ? "处理中" : "4s"}</em>
      </summary>
      <div className="activityChainPanel">
        <header><span className={running ? "agentLogoMark isThinking" : "agentLogoMark"}><img src="/logo/bioaz-logo.svg" alt="" /></span><strong>{title.replace("已完成", "")}</strong><em>{running ? "处理中" : "4s"}</em></header>
        <div className="activitySteps">
          {steps.map((step, index) => <p key={step} style={{ animationDelay: `${index * 70}ms` }}><i /><span><strong>{step}</strong><small>{processStepDetail(step)}</small></span></p>)}
        </div>
      </div>
    </details>
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

export function DmpkComposer({ attention, stage, text, setText, activeGroup, fields, mode, draftTabs, onSelect, onRemove, onSend, onPreview, onGenerate, onOpenInspector, coworkers, coworkerLocked, activeCoworkerId, onCoworkerChange, pendingCoworkerId, onConfirmCoworkerChange, onCancelCoworkerChange, disabled }: { attention?: boolean; stage: DmpkStage; text: string; setText: (value: string) => void; activeGroup: DmpkGroupId; fields: DmpkField[]; mode: "collect" | "edit"; draftTabs: DmpkDraftTab[]; onSelect: (field: DmpkField, value: string) => void; onRemove: (fieldId: string) => void; onSend: () => void; onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void; coworkers: CoworkerDefinition[]; coworkerLocked: boolean; activeCoworkerId: string; onCoworkerChange: (coworkerId: string) => void; pendingCoworkerId: string | null; onConfirmCoworkerChange: () => void; onCancelCoworkerChange: () => void; disabled: boolean }) {
  const [attachments, setAttachments] = useState<string[]>([]);
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
      {stage === "collecting" ? <DmpkParameterTaskCard activeGroup={activeGroup} fields={fields} draftTabs={draftTabs} mode={mode} onSelect={onSelect} /> : null}
      {stage === "ready" ? <DmpkFinalConfirmCard onPreview={onPreview} onGenerate={onGenerate} onOpenInspector={onOpenInspector} /> : null}
      {pendingCoworker && currentCoworker ? <CoworkerSwitchCard from={currentCoworker.name} to={pendingCoworker.name} endingCurrentFlow={coworkerLocked} onConfirm={onConfirmCoworkerChange} onCancel={onCancelCoworkerChange} /> : null}
      {stage !== "collecting" && stage !== "ready" ? <CoworkerSelector coworkers={coworkers} activeCoworkerId={activeCoworkerId} locked={coworkerLocked} onChange={onCoworkerChange} /> : null}
      <div className="dmpkComposer workbenchComposer">
        <label className="composerAddButton" aria-label="上传文件"><Plus size={18} /><input type="file" multiple onChange={(event) => { setAttachments(Array.from(event.target.files ?? []).map((file) => file.name)); event.target.value = ""; }} /></label>
        <div className="composerInputStack">
          {attachments.length ? <div className="draftTabs">{attachments.map((name) => <button type="button" key={name} onClick={() => setAttachments((items) => items.filter((item) => item !== name))}>{name}<X size={13} /></button>)}</div> : null}
          {draftTabs.length ? <div className="draftTabs">{draftTabs.map((tab) => <button type="button" key={tab.fieldId} onClick={() => onRemove(tab.fieldId)}>{tab.label}：{tab.value}<X size={13} /></button>)}</div> : null}
          <input ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSend(); }} placeholder={draftTabs.length ? "" : stage === "idle" ? "例如：PK小分子，SD大鼠，每组2只，2组，试验周期1周，周期内3个非加班时间点" : ""} />
        </div>
        <button className="sendIconButton" type="button" onClick={onSend} disabled={disabled} aria-label="发送"><Send size={18} /></button>
      </div>
    </footer>
  );
}

function DmpkParameterTaskCard({ activeGroup, fields, draftTabs, mode, onSelect }: { activeGroup: DmpkGroupId; fields: DmpkField[]; draftTabs: DmpkDraftTab[]; mode: "collect" | "edit"; onSelect: (field: DmpkField, value: string) => void }) {
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(() => Math.max(0, dmpkGroups.findIndex((group) => group.id === activeGroup)));
  const safePage = Math.min(page, dmpkGroups.length - 1);
  const pageGroup = dmpkGroups[safePage];
  const pageFields = mode === "edit" ? fields : fields.filter((field) => field.group === pageGroup.id);
  const commitCustom = (field: DmpkField) => {
    const value = customValues[field.id]?.trim();
    if (value) onSelect(field, value);
    setEditingCustom(null);
  };
  if (!fields.length) return null;
  return (
    <section className="warningDecision parameterTaskCard">
      <header className="warningDecisionHeader"><div><span>参数补全</span><strong>{mode === "edit" ? `修改${fields[0]?.label ?? "参数"}` : "请补全报价参数"}</strong>{mode === "edit" ? <p>选择新值后发送，即可更新右侧参数。</p> : null}</div><small>还需填写 {fields.length} 项</small></header>
      {mode === "collect" ? <div className="parameterPages">{dmpkGroups.map((group, index) => <button className={index === safePage ? "active" : ""} type="button" key={group.id} onClick={() => setPage(index)}>{group.title}</button>)}</div> : null}
      <div className="warningDecisionList">
        {pageFields.length ? pageFields.map((field, index) => {
          const selected = draftTabs.find((tab) => tab.fieldId === field.id);
          return <article className={`decisionRow ${selected ? "done" : ""}`} key={field.id}><div className="decisionCopy"><div className="decisionTitleRow"><span className="decisionIndex">{selected ? <Check size={15} /> : index + 1}</span><strong>{field.label}</strong><span className="requiredTag">{field.required ? "必填" : "可选"}</span></div><div className="optionGrid">{(dmpkFieldOptions[field.id] ?? ["1", "2", "3"]).map((option) => option === "自定义" && editingCustom === field.id ? <input autoFocus className="customOptionInput" key={option} onBlur={() => commitCustom(field)} onChange={(event) => setCustomValues((current) => ({ ...current, [field.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") commitCustom(field); if (event.key === "Escape") setEditingCustom(null); }} placeholder="输入" value={customValues[field.id] ?? ""} /> : <button className={selected?.value === option ? "selected" : ""} type="button" key={option} onClick={() => { if (option === "自定义") setEditingCustom(field.id); else onSelect(field, option); }}>{option}</button>)}</div></div></article>;
        }) : <p className="emptyPageNote">{pageGroup.title}参数已齐全，可切换下一页继续补全。</p>}
      </div>
      <div className="parameterPager"><p className="responsibilityNote">还需填写 {fields.length} 项</p>{mode === "collect" ? <div><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={safePage === 0}>上一页</button><button type="button" onClick={() => setPage((current) => Math.min(dmpkGroups.length - 1, current + 1))} disabled={safePage >= dmpkGroups.length - 1}>下一页</button></div> : null}</div>
    </section>
  );
}

function DmpkFinalConfirmCard({ onPreview, onGenerate, onOpenInspector }: { onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void }) {
  return <section className="warningDecision"><header className="warningDecisionHeader"><div><span>报价前确认</span><strong>参数已齐全，可以生成正式报价单</strong><p>请先预览完整参数和计价规则，也可以<PanelLink panelId="evidence" onOpen={onOpenInspector}>查看规则证据</PanelLink>。确认后将生成 Word 报价单与 Excel 报价明细。</p></div><small>待确认</small></header><div className="warningActions"><button className="previewIconOnlyButton" type="button" onClick={onPreview} aria-label="预览全部参数"><Eye size={16} /></button><button className="primaryButton compact" type="button" onClick={onGenerate}>生成报价单</button></div></section>;
}

function DmpkArtifactCards({ onPreview, onOpenInspector }: { onPreview: (kind: "word" | "excel") => void; onOpenInspector: (panelId: DmpkInspectorPanelId) => void }) {
  return <section className="artifactCards"><div className="agentReply artifactReply"><span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span><p>报价单已生成。你可以<PanelLink panelId="artifacts" onOpen={onOpenInspector}>查看产物列表</PanelLink>，或直接预览下方文件。</p></div>{(["word", "excel"] as const).map((kind) => <article className="artifactCard" key={kind}><span className="artifactFileIcon">{kind === "word" ? <FileText size={24} /> : <FileSpreadsheet size={24} />}</span><div><strong>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</strong><p>{kind === "word" ? "DMPK PK 检测正式报价单，包含项目范围、报价条目、管理费和交付说明。" : "报价明细表，包含计价项、数量、单价、管理费和金额一致性校验。"}</p><span>{kind === "word" ? "Document · DOCX · 管理费 30%" : "Spreadsheet · XLSX · 管理费 15%"}</span></div><button className="artifactActionButton" type="button" onClick={() => onPreview(kind)} aria-label="预览"><Eye size={16} /><span>预览</span></button></article>)}</section>;
}

export function DmpkParameterPanel({ fields, activeGroup, openGroups, completedCount, totalRequired, stage, onToggle, onEdit }: { fields: DmpkField[]; activeGroup: DmpkGroupId; openGroups: Record<DmpkGroupId, boolean>; completedCount: number; totalRequired: number; stage: DmpkStage; onToggle: (id: DmpkGroupId) => void; onEdit: (id: string) => void }) {
  const hasArtifacts = stage === "generated";
  return <section className="rightPanelCard pinnedParamCard"><header><div><FileSpreadsheet size={20} /><strong>报价参数收集</strong></div><span>{completedCount}/{totalRequired}</span></header><div className={hasArtifacts ? "paramGroups compact" : "paramGroups"}>{dmpkGroups.map((group) => { const groupFields = fields.filter((field) => field.group === group.id); const done = groupFields.every((field) => field.value); const shouldOpen = !hasArtifacts && openGroups[group.id]; return <section className="paramGroup" key={group.id}><button className="paramGroupHeader" type="button" onClick={() => onToggle(group.id)}><i className={done ? "done" : group.id === activeGroup ? "active" : ""} /><strong>{group.title}</strong><span>{done ? "已完成" : group.id === activeGroup ? "进行中" : "未开始"}</span><ChevronDown size={16} /></button>{shouldOpen ? <div className="paramRows">{groupFields.map((field) => <div className="paramRow" key={field.id}><span>{field.label}</span><strong className={field.value ? "" : "empty"}>{field.value || "待填写"}</strong><button type="button" onClick={() => onEdit(field.id)} aria-label={`修改${field.label}`}><Edit3 size={15} /></button></div>)}</div> : null}</section>; })}</div></section>;
}

export function DmpkQuotationPreviewModal({ fields, onClose }: { fields: DmpkField[]; onClose: () => void }) {
  return <div className="modalBackdrop" role="dialog" aria-modal="true"><section className="previewModal"><header><div><span>报价前确认</span><h2>完整参数与计价规则预览</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><div className="previewBody"><div className="previewContent"><PreviewTable title="报价参数" rows={fields.map((field) => [getDmpkGroupTitle(field.group), field.label, field.value])} /><div className="previewNotice"><Check size={17} /><span>计价关键字段已齐全。Word 报价单使用 30% 管理费，Excel 报价明细使用 15% 管理费，生成后将进行金额一致性校验。</span></div></div></div></section></div>;
}

export function DmpkArtifactPreviewModal({ kind, onClose }: { kind: "word" | "excel"; onClose: () => void }) {
  return <div className="modalBackdrop" role="dialog" aria-modal="true"><section className="previewModal artifactPreviewModal"><header><div><span>产物预览</span><h2>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><div className="previewContent"><PreviewTable title={kind === "word" ? "Word 报价单预览" : "Excel 报价明细预览"} rows={[["检测类型", "PK检测", "DMPK 业务线已确认"], ["动物实验", "SD大鼠 · 2组 · 每组2只 · 1周", "已匹配动物实验计价规则"], ["生物分析", "LC-MS/MS · 血浆 · 3点 · 1个待测物", "已匹配生物分析计价规则"], ["金额校验", "页面 / Word / Excel 一致", kind === "word" ? "中文编码与表格边框已校验" : "管理费 15% 已应用"]]} /></div></section></div>;
}

function PreviewTable({ title, rows }: { title: string; rows: string[][] }) {
  return <div className="previewTableWrap"><h3>{title}</h3><table className="previewTable"><thead><tr><th>类别</th><th>项目</th><th>说明</th></tr></thead><tbody>{rows.map((row) => <tr key={row.join("-")}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div>;
}
