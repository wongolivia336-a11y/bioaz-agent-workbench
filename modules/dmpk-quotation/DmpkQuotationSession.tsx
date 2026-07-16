"use client";

import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkbenchInspector } from "../../components/workbench-inspector/WorkbenchInspector";
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
  DmpkQuotationPreviewModal,
  type DmpkChatMessage,
  type DmpkInspectorPanelId,
} from "./views";

export default function DmpkQuotationSession({ projectName, taskTitle, initialRequest, coworkers, activeCoworkerId, onCoworkerChange, handoffNotice }: AgentModuleSessionProps) {
  const [fields, setFields] = useState<DmpkField[]>(() => initialDmpkFields.map((field) => ({ ...field })));
  const [activeGroup, setActiveGroup] = useState<DmpkGroupId>("assay");
  const [openGroups, setOpenGroups] = useState<Record<DmpkGroupId, boolean>>({ assay: true, animal: false, analysis: false, delivery: false });
  const [draftTabs, setDraftTabs] = useState<DmpkDraftTab[]>([]);
  const [messages, setMessages] = useState<DmpkChatMessage[]>(() => initialRequest ? [{ id: "initial-request", role: "user", text: initialRequest }] : [{ id: "context", role: "agent", text: `已打开“${taskTitle}”。可以继续补充要求或查看相关项目文件。` }]);
  const [composerText, setComposerText] = useState("");
  const [stage, setStage] = useState<DmpkStage>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<"word" | "excel" | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(true);
  const [inspectorPanelId, setInspectorPanelId] = useState<DmpkInspectorPanelId>("parameters");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [pendingCoworkerId, setPendingCoworkerId] = useState<string | null>(null);
  const startedInitialRequest = useRef(false);

  const missingFields = useMemo(() => fields.filter((field) => field.required && !field.value), [fields]);
  const visibleCardFields = missingFields.filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id));
  const editingField = fields.find((field) => field.id === editingFieldId) ?? null;
  const composerFields = editingField ? [editingField].filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id)) : visibleCardFields;
  const completedCount = fields.filter((field) => field.value).length;
  const totalRequired = fields.filter((field) => field.required).length;
  const activeCoworker = coworkers.find((coworker) => coworker.id === activeCoworkerId) ?? coworkers[0];
  const ActiveCoworkerIcon = activeCoworker?.icon ?? FileSpreadsheet;

  const appendMessage = (role: DmpkChatMessage["role"], text: string) => {
    setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text }]);
  };

  const patchFields = (patch: Record<string, string>) => {
    setFields((items) => items.map((field) => patch[field.id] ? { ...field, value: patch[field.id] } : field));
  };

  const handleInitialRequest = (text: string, skipUserMessage = false) => {
    if (!skipUserMessage) appendMessage("user", text);
    setComposerText("");
    setStage("thinking");
    setInspectorPanelId("process");
    window.setTimeout(() => {
      patchFields(parseDmpkRequest(text));
      setActiveGroup("analysis");
      setOpenGroups({ assay: false, animal: false, analysis: true, delivery: false });
      setStage("collecting");
      appendMessage("agent", "已识别 DMPK / PK 检测、小分子、SD 大鼠、每组 2 只、2 组、试验周期 1 周和 3 个非加班采血点。还需要补充生物分析和报告与报价参数。");
    }, 900);
  };

  useEffect(() => {
    if (!initialRequest || startedInitialRequest.current) return;
    startedInitialRequest.current = true;
    handleInitialRequest(initialRequest, true);
  }, [initialRequest]);

  const addDraft = (field: DmpkField, value: string) => {
    setDraftTabs((items) => [...items.filter((item) => item.fieldId !== field.id), { fieldId: field.id, label: field.label, value }]);
  };

  const requestFieldEdit = (fieldId: string) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    setEditingFieldId(field.id);
    setDraftTabs((items) => items.filter((item) => item.fieldId !== field.id));
    setActiveGroup(field.group);
    setOpenGroups((current) => ({ ...current, [field.group]: true }));
    setStage("collecting");
    appendMessage("agent", `请问您希望将${field.label}修改为什么？请在下方选择一个新值，发送后我会更新右侧参数。`);
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
        setOpenGroups((current) => ({ ...current, [nextGroup]: true }));
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
    handleInitialRequest(text);
  };

  const startGeneration = () => {
    setPreviewOpen(false);
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
    onEditField: requestFieldEdit,
    onPreviewArtifact: setArtifactPreview,
    onPreviewQuotation: () => setPreviewOpen(true),
  });

  return (
    <>
      <section className="dmpkWorkspace">
        <header className="topbar"><div className="breadcrumb"><span>{projectName}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></div></header>
        <header className="agentHeader"><div className="agentTitle"><span className="agentIcon pending"><ActiveCoworkerIcon size={18} /></span><span>{activeCoworker?.name ?? "DMPK报价同事"}</span></div></header>
        <div className="dmpkChatScroller"><DmpkConversation messages={messages} stage={stage} currentMissing={missingFields} handoffNotice={handoffNotice} onOpenInspector={openInspector} onArtifactPreview={setArtifactPreview} /></div>
        <DmpkComposer stage={stage} text={composerText} setText={setComposerText} activeGroup={activeGroup} fields={composerFields} mode={editingField ? "edit" : "collect"} draftTabs={draftTabs} onSelect={addDraft} onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))} onSend={submitComposer} onPreview={() => setPreviewOpen(true)} onGenerate={startGeneration} onOpenInspector={openInspector} coworkers={coworkers} activeCoworkerId={activeCoworkerId} onCoworkerChange={(id) => id !== activeCoworkerId && setPendingCoworkerId(id)} pendingCoworkerId={pendingCoworkerId} onConfirmCoworkerChange={() => { if (pendingCoworkerId) onCoworkerChange(pendingCoworkerId); setPendingCoworkerId(null); }} onCancelCoworkerChange={() => setPendingCoworkerId(null)} disabled={stage === "thinking" || stage === "generating" || (stage === "collecting" && composerFields.length > 0) || (!draftTabs.length && !composerText.trim())} />
      </section>
      <aside className={`dmpkPanel moduleInspectorRail ${inspectorPinned ? "hasPinnedInspector" : ""}`}>
        <WorkbenchInspector panels={inspectorPanels} activePanelId={inspectorPanelId} open={inspectorOpen} pinned={inspectorPinned} onOpenChange={setInspectorOpen} onPinnedChange={setInspectorPinned} onPanelChange={(panelId) => setInspectorPanelId(panelId as DmpkInspectorPanelId)} />
      </aside>
      {previewOpen ? <DmpkQuotationPreviewModal fields={fields} onClose={() => setPreviewOpen(false)} /> : null}
      {artifactPreview ? <DmpkArtifactPreviewModal kind={artifactPreview} onClose={() => setArtifactPreview(null)} /> : null}
    </>
  );
}
