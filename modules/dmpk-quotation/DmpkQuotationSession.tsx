"use client";

import { ChevronRight, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PanelToggle, WorkbenchPanel } from "../../components/workbench-panel/WorkbenchPanel";
import { PriorSessionHistory } from "../../components/workbench-shell/BioAZHelper";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
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
  // 一组参数收齐后自动折叠，把注意力交给还缺的那组
  useEffect(() => {
    setOpenGroups((current) => {
      let changed = false;
      const next = { ...current };
      for (const group of dmpkGroups) {
        const groupFields = fields.filter((field) => field.group === group.id);
        const filled = groupFields.length > 0 && groupFields.every((field) => field.value);
        if (filled && next[group.id]) {
          next[group.id] = false;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [fields]);
  const [draftTabs, setDraftTabs] = useState<DmpkDraftTab[]>([]);
  const [messages, setMessages] = useState<DmpkChatMessage[]>(() => initialRequest
    ? [{ id: "initial-request", role: "user", text: initialRequest }, { id: "context", role: "agent", text: openingMessage }]
    : [{ id: "context", role: "agent", text: openingMessage }]);
  const [composerText, setComposerText] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [stage, setStage] = useState<DmpkStage>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<"word" | "excel" | null>(null);
  // 右侧是常驻面板：默认显示这三个 tab，其余通过 tab 栏的加号自行加回来
  const [visiblePanelIds, setVisiblePanelIds] = useState<string[]>(["parameters", "process", "artifacts"]);
  // DMPK 的参数收集是主工作面，右侧默认就展开；肿瘤报告那边是事件驱动的
  const [panelOpen, setPanelOpen] = useState(true);
  const [inspectorPanelId, setInspectorPanelId] = useState<DmpkInspectorPanelId>("parameters");
  /** 用户自己点过 tab 之后，阶段推进不再抢视图，只在 tab 上打点 */
  const [tabPinnedByUser, setTabPinnedByUser] = useState(false);
  const [panelHintIds, setPanelHintIds] = useState<string[]>([]);
  const [parametersExpanded, setParametersExpanded] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [conversationEditing, setConversationEditing] = useState(false);
  const [editProposal, setEditProposal] = useState<DmpkEditProposal | null>(null);
  const [composerAttention, setComposerAttention] = useState(false);
  const [pendingCoworkerId, setPendingCoworkerId] = useState<string | null>(null);

  const missingFields = useMemo(() => fields.filter((field) => field.required && !field.value), [fields]);
  const visibleCardFields = missingFields.filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id));
  const editingField = fields.find((field) => field.id === editingFieldId) ?? null;
  const composerFields = editingField ? [editingField].filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id)) : visibleCardFields;
  const completedCount = fields.filter((field) => field.value).length;
  const totalRequired = fields.filter((field) => field.required).length;
  const identifiedAssayType = fields.find((field) => field.id === "assayType")?.value ?? "";
  const businessCoworkers = coworkers.filter((coworker) => coworker.id !== "bioaz-helper");
  const activeCoworker = businessCoworkers.find((coworker) => coworker.id === activeCoworkerId) ?? businessCoworkers[0];

  useEffect(() => {
    onSessionSnapshotChange?.({
      moduleId: "dmpk-quotation",
      coworkerName: activeCoworker?.name ?? "DMPK报价同事",
      stageLabel: stage === "generated" ? "报价已生成" : stage === "ready" ? "参数已齐全" : stage === "collecting" ? "参数补全中" : "报价处理中",
      entries: messages.map((message) => ({ id: message.id, role: message.role, text: message.text })),
      facts: fields.filter((field) => field.value).map((field) => ({ label: field.label, value: field.value })),
    });
  }, [activeCoworker?.name, fields, messages, onSessionSnapshotChange, stage]);

  const appendMessage = (role: DmpkChatMessage["role"], text: string, attachments?: ComposerAttachment[]) => {
    setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text, attachments }]);
  };

  /** 发送时把 chip 里的内容固化到这条用户消息上，composer 随即清空 */
  const consumeAttachments = () => {
    if (!attachments.length) return undefined;
    setAttachments([]);
    return attachments;
  };

  const handleInitialRequest = (text: string, skipUserMessage = false) => {
    if (!skipUserMessage) appendMessage("user", text, consumeAttachments());
    setComposerText("");
    setStage("thinking");
    suggestPanel("process");
    window.setTimeout(() => {
      const patch = parseDmpkRequest(text);
      const nextFields = fields.map((field) => patch[field.id] ? { ...field, value: patch[field.id] } : field);
      const recognized = nextFields.filter((field) => patch[field.id]);
      const remaining = nextFields.filter((field) => field.required && !field.value);
      const nextGroup = dmpkGroups.find((group) => remaining.some((field) => field.group === group.id))?.id ?? "assay";
      setFields(nextFields);
      suggestPanel("parameters");
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

  const addDraft = (field: DmpkField, value: string) => {
    setDraftTabs((items) => [...items.filter((item) => item.fieldId !== field.id), { fieldId: field.id, label: field.label, value }]);
  };

  const requestFieldEdit = (fieldId: string) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    const invalidatesQuotation = stage === "generated";
    openInspector("parameters");
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
    openInspector("parameters");
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
    appendMessage("user", `补充报价参数：\n${sentTabs.map((tab) => `${tab.label}：${tab.value}`).join("\n")}`, consumeAttachments());
    setStage("thinking");
    suggestPanel("process");
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
      appendMessage("user", text, consumeAttachments());
      setComposerText("");
      setEditProposal({ kind: "current-price", request: text, previousPrice: 3000, nextPrice: Number(reportFeeMatch[1].replaceAll(",", "")) });
      setConversationEditing(false);
      return;
    }
    if (minimumSampleMatch) {
      appendMessage("user", text, consumeAttachments());
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
    suggestPanel("process");
    appendMessage("user", "确认参数，生成正式报价单。");
    window.setTimeout(() => {
      setStage("generated");
      suggestPanel("artifacts");
      appendMessage("agent", "报价单已生成。Word 与 Excel 金额校验一致。");
    }, 1800);
  };

  /** 阶段推进时的建议切换：用户没自己点过 tab 才真的切，否则只打点提示 */
  const suggestPanel = (panelId: DmpkInspectorPanelId) => {
    setVisiblePanelIds((ids) => ids.includes(panelId) ? ids : [...ids, panelId]);
    if (tabPinnedByUser) {
      setPanelHintIds((ids) => ids.includes(panelId) ? ids : [...ids, panelId]);
      return;
    }
    setInspectorPanelId(panelId);
  };

  /** 用户显式要求看某个面板（点对话里的卡片、点 tab），一定切过去 */
  const openInspector = (panelId: DmpkInspectorPanelId) => {
    setPanelOpen(true);
    setVisiblePanelIds((ids) => ids.includes(panelId) ? ids : [...ids, panelId]);
    setInspectorPanelId(panelId);
    setPanelHintIds((ids) => ids.filter((id) => id !== panelId));
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
  /* 参数面板顶部保留「对话编辑」入口——它原本挂在浮层头上，浮层撤掉后跟着参数进 tab */
  const railPanels = inspectorPanels.map((panel) => panel.id !== "parameters" ? panel : {
    ...panel,
    content: (
      <>
        <div className="paramPanelToolbar">
          <span>
            <strong>{stage === "generating" || stage === "generated" ? "报价参数 · 已确认" : "参数收集"}</strong>
            {identifiedAssayType ? <em>{completedCount}/{totalRequired}</em> : null}
          </span>
          <button className="parameterConversationEdit" type="button" aria-pressed={conversationEditing} title="通过对话修改" onClick={startConversationEdit}>
            <WandSparkles size={15} /><span>对话编辑</span>
          </button>
        </div>
        {panel.content}
      </>
    ),
  });

  return (
    <>
      <section className="dmpkWorkspace">
        <header className="topbar">
          <div className="breadcrumb"><span>{projectName}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></div>
          <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} />
        </header>
        <div className="dmpkChatScroller"><PriorSessionHistory snapshots={priorSessionSnapshots} /><DmpkConversation messages={messages} stage={stage} currentMissing={missingFields} handoffNotice={handoffNotice} onOpenInspector={openInspector} onArtifactPreview={setArtifactPreview} /></div>
        <DmpkComposer editProposal={editProposal} onConfirmCurrentPrice={() => { appendMessage("agent", `已将本次报价的报告费调整为 ¥${editProposal?.kind === "current-price" ? editProposal.nextPrice.toLocaleString() : "2,500"}，仅对当前项目生效，并已保留调整记录。`); setEditProposal(null); }} onOpenRuleManagement={() => { if (editProposal?.kind === "global-rule") window.location.href = `/?${new URLSearchParams({ view: "quotation-management", business: "dmpk", tab: "rules", draft: editProposal.request }).toString()}`; }} attention={composerAttention} conversationEditing={conversationEditing} stage={stage} text={composerText} setText={setComposerText} activeGroup={activeGroup} fields={composerFields} mode={editingField ? "edit" : "collect"} draftTabs={draftTabs} onSelect={addDraft} onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))} onSend={submitComposer} onPreview={() => setPreviewOpen(true)} onGenerate={startGeneration} onOpenInspector={openInspector} coworkers={businessCoworkers} coworkerLocked={stage !== "generated"} activeCoworkerId={activeCoworkerId} onCoworkerChange={(id) => id !== activeCoworkerId && setPendingCoworkerId(id)} pendingCoworkerId={pendingCoworkerId} onConfirmCoworkerChange={() => { if (pendingCoworkerId) onCoworkerChange(pendingCoworkerId); setPendingCoworkerId(null); }} onCancelCoworkerChange={() => setPendingCoworkerId(null)} projectName={projectName} attachments={attachments} onAttachmentsChange={setAttachments} disabled={stage === "thinking" || stage === "generating" || (stage === "collecting" && composerFields.length > 0) || (!draftTabs.length && !composerText.trim())} />
      </section>
      <WorkbenchPanel
        panels={railPanels}
        visibleIds={visiblePanelIds}
        onVisibleIdsChange={setVisiblePanelIds}
        activePanelId={inspectorPanelId}
        hintIds={panelHintIds}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onPanelChange={(panelId) => {
          setTabPinnedByUser(true);
          setPanelHintIds((ids) => ids.filter((id) => id !== panelId));
          setInspectorPanelId(panelId as DmpkInspectorPanelId);
        }}
      />
      {previewOpen ? <DmpkQuotationPreviewModal fields={fields} onClose={() => setPreviewOpen(false)} /> : null}
      {artifactPreview ? <DmpkArtifactPreviewModal kind={artifactPreview} onClose={() => setArtifactPreview(null)} /> : null}
    </>
  );
}
