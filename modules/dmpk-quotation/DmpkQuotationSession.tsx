"use client";

import { ChevronDown, ChevronRight, FileSpreadsheet, SlidersHorizontal, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { WorkbenchInspector } from "../../components/workbench-inspector/WorkbenchInspector";
import { PriorSessionHistory } from "../../components/workbench-shell/BioAZHelper";
import type { AgentModuleSessionProps } from "../types";
import {
  dmpkGroups,
  initialDmpkFields,
  parseDmpkRequest,
  type DmpkDraftTab,
  type DmpkField,
  type DmpkGroupId,
  type DmpkStage,
} from "./fields";
import { getDmpkInspectorPanels } from "./inspectorPanels";
import {
  DmpkArtifactPreviewModal,
  DmpkComposer,
  DmpkConversation,
  DmpkEditProposalCard,
  DmpkQuotationPreviewModal,
  type DmpkChatMessage,
  type DmpkEditProposal,
  type DmpkInspectorPanelId,
} from "./views";

export default function DmpkQuotationSession({ projectName, taskTitle, initialRequest, coworkers, activeCoworkerId, onCoworkerChange, onRunStatusChange, handoffNotice, priorSessionSnapshots, onSessionSnapshotChange }: AgentModuleSessionProps) {
  const openingMessage = "你好，我是 DMPK 报价数字同事。请直接描述检测类型、分子类型、动物种属与数量、试验周期和采血点；我会先识别已知参数，再逐项补齐报价所需信息。";
  const [fields, setFields] = useState<DmpkField[]>(() => initialDmpkFields.map((field) => ({ ...field })));
  const [activeGroup, setActiveGroup] = useState<DmpkGroupId>("assay");
  const [openGroups, setOpenGroups] = useState<Record<DmpkGroupId, boolean>>({ assay: true, animal: false, analysis: false, delivery: false });
  const [draftTabs, setDraftTabs] = useState<DmpkDraftTab[]>([]);
  const [messages, setMessages] = useState<DmpkChatMessage[]>(() => initialRequest
    ? [{ id: "initial-request", role: "user", text: initialRequest }, { id: "context", role: "agent", text: openingMessage }]
    : [{ id: "context", role: "agent", text: openingMessage }]);
  const [composerText, setComposerText] = useState("");
  const [stage, setStage] = useState<DmpkStage>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<"word" | "excel" | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(false);
  const [inspectorPanelId, setInspectorPanelId] = useState<DmpkInspectorPanelId>("process");
  const [parametersExpanded, setParametersExpanded] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [conversationEditing, setConversationEditing] = useState(false);
  const [editProposal, setEditProposal] = useState<DmpkEditProposal | null>(null);
  const [composerAttention, setComposerAttention] = useState(false);
  const [pendingCoworkerId, setPendingCoworkerId] = useState<string | null>(null);
  const [secondaryInspectorTop, setSecondaryInspectorTop] = useState(142);
  const parameterCardRef = useRef<HTMLElement>(null);

  const missingFields = useMemo(() => fields.filter((field) => field.required && !field.value), [fields]);
  const visibleCardFields = missingFields.filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id));
  const editingField = fields.find((field) => field.id === editingFieldId) ?? null;
  const composerFields = editingField ? [editingField].filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id)) : visibleCardFields;
  const completedCount = fields.filter((field) => field.value).length;
  const totalRequired = fields.filter((field) => field.required).length;
  const identifiedAssayType = fields.find((field) => field.id === "assayType")?.value ?? "";
  const businessCoworkers = coworkers.filter((coworker) => coworker.id !== "bioaz-helper");
  const activeCoworker = businessCoworkers.find((coworker) => coworker.id === activeCoworkerId) ?? businessCoworkers[0];
  const ActiveCoworkerIcon = activeCoworker?.icon ?? FileSpreadsheet;

  useEffect(() => {
    onSessionSnapshotChange?.({
      moduleId: "dmpk-quotation",
      coworkerName: activeCoworker?.name ?? "DMPK报价同事",
      stageLabel: stage === "generated" ? "报价已生成" : stage === "ready" ? "参数已齐全" : stage === "collecting" ? "参数补全中" : "报价处理中",
      entries: messages.map((message) => ({ id: message.id, role: message.role, text: message.text })),
      facts: fields.filter((field) => field.value).map((field) => ({ label: field.label, value: field.value })),
    });
  }, [activeCoworker?.name, fields, messages, onSessionSnapshotChange, stage]);

  const appendMessage = (role: DmpkChatMessage["role"], text: string) => {
    setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text }]);
  };

  const handleInitialRequest = (text: string, skipUserMessage = false) => {
    if (!skipUserMessage) appendMessage("user", text);
    setComposerText("");
    setStage("thinking");
    setInspectorPanelId("process");
    window.setTimeout(() => {
      const patch = parseDmpkRequest(text);
      const nextFields = fields.map((field) => patch[field.id] ? { ...field, value: patch[field.id] } : field);
      const recognized = nextFields.filter((field) => patch[field.id]);
      const remaining = nextFields.filter((field) => field.required && !field.value);
      const nextGroup = dmpkGroups.find((group) => remaining.some((field) => field.group === group.id))?.id ?? "assay";
      setFields(nextFields);
      setParametersExpanded(Boolean(patch.assayType));
      setActiveGroup(nextGroup);
      setOpenGroups({ assay: nextGroup === "assay", animal: nextGroup === "animal", analysis: nextGroup === "analysis", delivery: nextGroup === "delivery" });
      setStage("collecting");
      appendMessage("agent", recognized.length
        ? `已识别：${recognized.map((field) => `${field.label}：${field.value}`).join("、")}。还需要补充 ${remaining.length} 项报价参数，请从下方当前参数页继续填写。`
        : "我还没有识别到可用于报价的具体参数。请先描述检测类型、分子类型、动物种属与数量、试验周期和采血点，我会继续追问缺失项。");
    }, 900);
  };

  useEffect(() => {
    onRunStatusChange(stage === "generated" ? "completed" : "active");
  }, [onRunStatusChange, stage]);

  useEffect(() => {
    if (stage === "generating" || stage === "generated") setParametersExpanded(false);
  }, [stage]);

  useEffect(() => {
    const parameterCard = parameterCardRef.current;
    if (!parameterCard) return;

    const updateInspectorTop = () => {
      setSecondaryInspectorTop(Math.ceil(parameterCard.getBoundingClientRect().bottom + 12));
    };
    updateInspectorTop();

    const observer = new ResizeObserver(updateInspectorTop);
    observer.observe(parameterCard);
    window.addEventListener("resize", updateInspectorTop);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateInspectorTop);
    };
  }, []);

  const addDraft = (field: DmpkField, value: string) => {
    setDraftTabs((items) => [...items.filter((item) => item.fieldId !== field.id), { fieldId: field.id, label: field.label, value }]);
  };

  const requestFieldEdit = (fieldId: string) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    const invalidatesQuotation = stage === "generated";
    setParametersExpanded(true);
    setConversationEditing(false);
    setEditingFieldId(field.id);
    setDraftTabs((items) => items.filter((item) => item.fieldId !== field.id));
    setActiveGroup(field.group);
    setOpenGroups({ assay: field.group === "assay", animal: field.group === "animal", analysis: field.group === "analysis", delivery: field.group === "delivery" });
    setStage("collecting");
    setComposerAttention(false);
    window.requestAnimationFrame(() => setComposerAttention(true));
    window.setTimeout(() => setComposerAttention(false), 720);
    appendMessage("agent", invalidatesQuotation
      ? `正在修改已确认参数“${field.label}”。提交新值后，当前报价将标记为待重新生成。`
      : `请问您希望将${field.label}修改为什么？请在下方选择一个新值，发送后我会更新右侧参数。`);
  };

  const startConversationEdit = () => {
    setParametersExpanded(Boolean(identifiedAssayType));
    setEditingFieldId(null);
    setConversationEditing(true);
    setComposerAttention(false);
    window.requestAnimationFrame(() => setComposerAttention(true));
    window.setTimeout(() => setComposerAttention(false), 720);
  };

  const sendDraft = () => {
    if (!draftTabs.length) return;
    const sentTabs = draftTabs;
    appendMessage("user", `补充报价参数：\n${sentTabs.map((tab) => `${tab.label}：${tab.value}`).join("\n")}`);
    setStage("thinking");
    setInspectorPanelId("process");
    window.setTimeout(() => {
      setFields((items) => items.map((field) => {
        const draft = sentTabs.find((tab) => tab.fieldId === field.id);
        return draft ? { ...field, value: draft.value } : field;
      }));
      const remaining = fields.filter((field) => field.required && !field.value && !sentTabs.some((tab) => tab.fieldId === field.id));
      const nextGroup = dmpkGroups.find((group) => remaining.some((field) => field.group === group.id))?.id;
      setDraftTabs([]);
      setEditingFieldId(null);
      if (nextGroup) {
        setActiveGroup(nextGroup);
        setOpenGroups({ assay: nextGroup === "assay", animal: nextGroup === "animal", analysis: nextGroup === "analysis", delivery: nextGroup === "delivery" });
        setStage("collecting");
        appendMessage("agent", `已更新报价参数。还需补充 ${remaining.length} 项参数，请继续在下方补全卡中选择。`);
      } else {
        setStage("ready");
        appendMessage("agent", "计价关键字段已齐全。请进行报价前确认，确认后生成 Word 报价单和 Excel 报价明细。");
      }
    }, 700);
  };

  const submitComposer = () => {
    const text = composerText.trim();
    if (draftTabs.length) {
      if (stage === "collecting" && composerFields.length) return;
      sendDraft();
      return;
    }
    if (!text || stage === "thinking" || stage === "generating") return;
    const reportFeeMatch = text.match(/(?:这次|本次)?.*报告费.*?(\d[\d,]*)\s*元?/);
    const minimumSampleMatch = text.match(/以后.*?PK.*?样品.*?少于\s*(\d+)\s*个?.*?按\s*(\d+)\s*个?.*?收费/i);
    if (reportFeeMatch) {
      appendMessage("user", text);
      setComposerText("");
      setEditProposal({ kind: "current-price", request: text, previousPrice: 3000, nextPrice: Number(reportFeeMatch[1].replaceAll(",", "")) });
      setConversationEditing(false);
      return;
    }
    if (minimumSampleMatch) {
      appendMessage("user", text);
      setComposerText("");
      setEditProposal({ kind: "global-rule", request: text, minimumSamples: Number(minimumSampleMatch[2]) });
      setConversationEditing(false);
      return;
    }
    setConversationEditing(false);
    handleInitialRequest(text);
  };

  const startGeneration = () => {
    setPreviewOpen(false);
    setParametersExpanded(false);
    setStage("generating");
    setInspectorPanelId("process");
    appendMessage("user", "确认参数，生成正式报价单。");
    window.setTimeout(() => {
      setStage("generated");
      setInspectorPanelId("artifacts");
      setInspectorOpen(true);
      appendMessage("agent", "报价单已生成。Word 与 Excel 金额校验一致。");
    }, 1800);
  };

  const openInspector = (panelId: DmpkInspectorPanelId) => {
    setInspectorPanelId(panelId);
    setInspectorOpen(true);
  };

  const inspectorPanels = getDmpkInspectorPanels({
    stage,
    fields,
    activeGroup,
    projectName,
    taskTitle,
    requestText: messages.find((message) => message.role === "user")?.text ?? "",
    openGroups,
    onToggleGroup: (group) => setOpenGroups((current) => ({
      assay: false,
      animal: false,
      analysis: false,
      delivery: false,
      [group]: !current[group],
    })),
    onEditField: requestFieldEdit,
    editingFieldId,
    onPreviewArtifact: setArtifactPreview,
    onPreviewQuotation: () => setPreviewOpen(true),
  });
  const parameterPanel = inspectorPanels.find((panel) => panel.id === "parameters");
  const secondaryInspectorPanels = inspectorPanels.filter((panel) => panel.id !== "parameters");

  return (
    <>
      <section className="dmpkWorkspace">
        <header className="topbar"><div className="breadcrumb"><span>{projectName}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></div></header>
        <header className="agentHeader"><div className="agentTitle"><span className="agentIcon pending"><ActiveCoworkerIcon size={18} /></span><span>{activeCoworker?.name ?? "DMPK报价同事"}</span></div></header>
        <div className="dmpkChatScroller"><PriorSessionHistory snapshots={priorSessionSnapshots} /><DmpkConversation messages={messages} stage={stage} currentMissing={missingFields} handoffNotice={handoffNotice} onOpenInspector={openInspector} onArtifactPreview={setArtifactPreview} /></div>
        <DmpkComposer editProposal={editProposal} onConfirmCurrentPrice={() => { appendMessage("agent", `已将本次报价的报告费调整为 ¥${editProposal?.kind === "current-price" ? editProposal.nextPrice.toLocaleString() : "2,500"}，仅对当前项目生效，并已保留调整记录。`); setEditProposal(null); }} onOpenRuleManagement={() => { if (editProposal?.kind === "global-rule") window.location.href = `/?${new URLSearchParams({ view: "quotation-management", business: "dmpk", tab: "rules", draft: editProposal.request }).toString()}`; }} attention={composerAttention} conversationEditing={conversationEditing} stage={stage} text={composerText} setText={setComposerText} activeGroup={activeGroup} fields={composerFields} mode={editingField ? "edit" : "collect"} draftTabs={draftTabs} onSelect={addDraft} onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))} onSend={submitComposer} onPreview={() => setPreviewOpen(true)} onGenerate={startGeneration} onOpenInspector={openInspector} coworkers={businessCoworkers} coworkerLocked={stage !== "generated"} activeCoworkerId={activeCoworkerId} onCoworkerChange={(id) => id !== activeCoworkerId && setPendingCoworkerId(id)} pendingCoworkerId={pendingCoworkerId} onConfirmCoworkerChange={() => { if (pendingCoworkerId) onCoworkerChange(pendingCoworkerId); setPendingCoworkerId(null); }} onCancelCoworkerChange={() => setPendingCoworkerId(null)} disabled={stage === "thinking" || stage === "generating" || (stage === "collecting" && composerFields.length > 0) || (!draftTabs.length && !composerText.trim())} />
      </section>
      <aside
        className={`dmpkPanel dmpkInspectorRail ${inspectorPinned ? "hasPinnedInspector" : ""}`}
        style={{ "--dmpk-secondary-top": `${secondaryInspectorTop}px` } as CSSProperties}
      >
        <section ref={parameterCardRef} className={`persistentParameterCard ${parametersExpanded ? "isExpanded" : ""} ${conversationEditing ? "isConversationEditing" : ""} ${stage === "generating" || stage === "generated" ? "isConfirmed" : ""}`}>
          <div className="persistentParameterHeader">
          <button className="persistentParameterToggle" type="button" aria-expanded={parametersExpanded} disabled={!identifiedAssayType} onClick={() => setParametersExpanded((current) => !current)}>
            <span><SlidersHorizontal size={16} /><strong>{stage === "generating" || stage === "generated" ? "报价参数 · 已确认" : "参数收集"}</strong></span>
            <span>{identifiedAssayType ? `${completedCount}/${totalRequired}` : null}<ChevronDown size={15} /></span>
          </button>
          <button className="parameterConversationEdit" type="button" aria-pressed={conversationEditing} aria-label="通过对话修改" title="通过对话修改" onClick={startConversationEdit}>
            <WandSparkles size={15} /><span>对话编辑</span>
          </button>
          </div>
          {parametersExpanded ? <div className="persistentParameterBody">{parameterPanel?.content}</div> : null}
        </section>
        <div className="secondaryInspectorSlot">
          <WorkbenchInspector panels={secondaryInspectorPanels} activePanelId={inspectorPanelId} open={inspectorOpen} pinned={inspectorPinned} onOpenChange={setInspectorOpen} onPinnedChange={setInspectorPinned} onPanelChange={(panelId) => setInspectorPanelId(panelId as DmpkInspectorPanelId)} />
        </div>
      </aside>
      {previewOpen ? <DmpkQuotationPreviewModal fields={fields} onClose={() => setPreviewOpen(false)} /> : null}
      {artifactPreview ? <DmpkArtifactPreviewModal kind={artifactPreview} onClose={() => setArtifactPreview(null)} /> : null}
    </>
  );
}
