"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { effectiveValues, unmetDependencies, type ParamField } from "../../components/params";
import { PanelToggle, WorkbenchPanelBody } from "../../components/workbench-panel/WorkbenchPanel";
import { PriorSessionHistory } from "../../components/workbench-shell/BioAZHelper";
import { SessionMinimap } from "../../components/workbench-shell/SessionMinimap";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { AgentModuleSessionProps } from "../types";
import {
  initialTumorFields,
  parseTumorRequest,
  tumorGroups,
  type TumorDraftTab,
  type TumorField,
  type TumorGroupId,
  type TumorStage,
} from "./fields";
import { getTumorInspectorPanels, type TumorInspectorPanelId } from "./inspectorPanels";
import {
  TumorComposer,
  TumorConversation,
  TumorQuotationPreviewModal,
  tumorRunRecord,
  type TumorChatMessage,
} from "./views";

/**
 * 肿瘤报价会话。
 *
 * 跟 DMPK 报价是同一副骨架——同一条对话流、同一张参数补全卡、同一个 chips
 * 托盘、同一套右栏台账（都在 `components/params` 里），外壳类名也借的同一个
 * （见 `AgentModuleDefinition.shellVariant`）。这里只写这条业务线自己的部分：
 * 词表、识别、阶段推进。
 *
 * **没有的东西是有意没有的**：退回批注、交接工单、报价规则草稿、版本历史——
 * 那几样是 DMPK 走通了整条送审链路之后长出来的。肿瘤报价现在还没有那条链路，
 * 提前把壳摆上，等于给人四个永远是空态的 tab。
 *
 * 跟工程师 beta3 相比，两处行为是**故意改掉的**：
 *   1. 空表单上不再预先铺红字。没填不等于填错——一张还没动过的表单上先挂五条
 *      「缺少必选参数」，是在为尚未发生的错误问责。缺多少写在卡头的「还需填写
 *      N 项」上，红字留给真正的冲突。
 *   2. 台账里不再逐行标「未提交」。待发状态只在 composer 的 chips 上出现，
 *      因为「选了还没发」这件事天然属于输入框；两边都标，人得自己判断哪个是真的。
 */
export default function TumorQuotationSession({
  projectName, taskTitle, initialRequest, initialAttachments, activeCoworkerId,
  onRunStatusChange, initialHistory, initialFields, priorSessionSnapshots, onSessionSnapshotChange,
}: AgentModuleSessionProps) {
  const openingMessage = "你好，我是肿瘤报价数字同事。请直接描述模型与动物品系、接种方式、分组与给药方案、实验周期和检测指标；我会先识别已知参数，再逐项补齐报价所需信息。";
  const [fields, setFields] = useState<TumorField[]>(() =>
    initialTumorFields.map((field) => ({ ...field, value: initialFields?.[field.id] ?? field.value })));
  const [activeGroup, setActiveGroup] = useState<TumorGroupId>("model");
  const [openGroups, setOpenGroups] = useState<Record<TumorGroupId, boolean>>({ model: true, design: false, dosing: false, readout: false });
  const [draftTabs, setDraftTabs] = useState<TumorDraftTab[]>([]);
  const [messages, setMessages] = useState<TumorChatMessage[]>(() => {
    if (initialHistory?.length) {
      return initialHistory
        .filter((entry) => entry.role !== "process")
        .map((entry) => ({ id: entry.id, role: entry.role as TumorChatMessage["role"], text: entry.text }));
    }
    /* 开场白在前、被带进来的那句请求在后。反过来读是这样的：用户先说了一整段
       需求，数字同事接着自我介绍并请他「描述模型与动物品系……」——而那些他刚说完。 */
    return initialRequest
      ? [{ id: "context", role: "agent", text: openingMessage }, { id: "initial-request", role: "user", text: initialRequest, attachments: initialAttachments }]
      : [{ id: "context", role: "agent", text: openingMessage }];
  });
  const [composerText, setComposerText] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [stage, setStage] = useState<TumorStage>("idle");
  const [preview, setPreview] = useState<null | "params" | "artifact">(null);
  const [visiblePanelIds, setVisiblePanelIds] = useState<string[]>(["parameters", "process", "artifacts"]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelFocus, setPanelFocus] = useState(false);
  const [inspectorPanelId, setInspectorPanelId] = useState<TumorInspectorPanelId>("parameters");
  const [tabPinnedByUser, setTabPinnedByUser] = useState(false);
  const [panelHintIds, setPanelHintIds] = useState<string[]>([]);
  const [columnPanelIds, setColumnPanelIds] = useState<string[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [composerAttention, setComposerAttention] = useState(false);
  const visiblePanelIdsRef = useRef(visiblePanelIds);
  visiblePanelIdsRef.current = visiblePanelIds;
  const initialRequestHandledRef = useRef(false);
  const chatScrollerRef = useRef<HTMLDivElement>(null);

  const missingFields = useMemo(() => fields.filter((field) => field.required && !field.value), [fields]);
  const values = useMemo(() => effectiveValues(fields, draftTabs), [fields, draftTabs]);
  /* 卡里列出来的：还缺的、且还没进 chips 的。
     **依赖没满足的也要列**——它仍然是缺的，把它藏起来人会以为参数已经齐了，
     而卡头的计数又说还差三项，对不上。列出来配一句「请先选择模型」就够了。 */
  const visibleCardFields = missingFields.filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id));
  const editingField = fields.find((field) => field.id === editingFieldId) ?? null;
  const composerFields = editingField
    ? [editingField].filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id))
    : visibleCardFields;

  // 一组参数收齐后自动折叠，把注意力交给还缺的那组
  useEffect(() => {
    setOpenGroups((current) => {
      let changed = false;
      const next = { ...current };
      for (const group of tumorGroups) {
        const groupFields = fields.filter((field) => field.group === group.id && field.required);
        const filled = groupFields.length > 0 && groupFields.every((field) => field.value);
        if (filled && next[group.id]) {
          next[group.id] = false;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [fields]);

  useEffect(() => {
    onSessionSnapshotChange?.({
      moduleId: "tumor-quotation",
      coworkerName: "肿瘤报价同事",
      stageLabel: stage === "generated" ? "报价已生成" : stage === "ready" ? "参数已齐全" : stage === "collecting" ? "参数补全中" : "报价处理中",
      entries: messages.filter((message) => message.role === "user" || message.role === "agent").map((message) => ({ id: message.id, role: message.role as "user" | "agent", text: message.text })),
      facts: fields.filter((field) => field.value).map((field) => ({ label: field.label, value: field.value })),
    });
  }, [fields, messages, onSessionSnapshotChange, stage]);

  useEffect(() => {
    onRunStatusChange(stage === "generated" ? "completed" : "active");
  }, [onRunStatusChange, stage]);

  const appendMessage = (role: TumorChatMessage["role"], text: string, messageAttachments?: ComposerAttachment[]) => {
    setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text, attachments: messageAttachments }]);
  };

  /* 跑完一轮就把这条运行记录钉进消息流，紧挨着它自己那条回复的上方。
     一定要在 appendMessage("agent", …) 之前调用——过程在前，结论在后。 */
  const appendRun = (kind: "params" | "quote", missingCount = 0) => {
    const record = tumorRunRecord(kind, { missingCount });
    setMessages((items) => [...items, { id: `run-${Date.now()}-${items.length}`, role: "run", ...record }]);
  };

  const suggestPanel = (panelId: TumorInspectorPanelId) => {
    // 用 ref 读当前可见集：suggestPanel 常在 setTimeout 里调用，闭包里的值可能是旧的
    if (!visiblePanelIdsRef.current.includes(panelId)) return;
    if (tabPinnedByUser) {
      setPanelHintIds((hints) => hints.includes(panelId) ? hints : [...hints, panelId]);
      return;
    }
    setInspectorPanelId(panelId);
  };

  const openInspector = (panelId: TumorInspectorPanelId) => {
    setPanelOpen(true);
    setVisiblePanelIds((ids) => ids.includes(panelId) ? ids : [...ids, panelId]);
    setInspectorPanelId(panelId);
    setPanelHintIds((ids) => ids.filter((id) => id !== panelId));
  };

  const consumeAttachments = () => {
    if (!attachments.length) return undefined;
    setAttachments([]);
    return attachments;
  };

  /** 还缺的必填项里，第一个「现在就能填」的那组。锁着的组不该被推到人脸上。 */
  const nextGroupOf = (remaining: TumorField[], all: TumorField[]) => {
    const currentValues = effectiveValues(all, []);
    const fillable = remaining.filter((field) => unmetDependencies(field, all, currentValues).length === 0);
    return (fillable[0] ?? remaining[0])?.group;
  };

  const focusGroup = (group: TumorGroupId | undefined) => {
    if (!group) return;
    setActiveGroup(group);
    setOpenGroups({ model: group === "model", design: group === "design", dosing: group === "dosing", readout: group === "readout" });
  };

  const handleRequest = (text: string, skipUserMessage = false) => {
    if (!skipUserMessage) appendMessage("user", text, consumeAttachments());
    setComposerText("");
    setStage("thinking");
    suggestPanel("process");
    window.setTimeout(() => {
      const patch = parseTumorRequest(text);
      const nextFields = fields.map((field) => patch[field.id] ? { ...field, value: patch[field.id] } : field);
      const recognized = nextFields.filter((field) => patch[field.id]);
      const remaining = nextFields.filter((field) => field.required && !field.value);
      setFields(nextFields);
      suggestPanel("parameters");
      focusGroup(nextGroupOf(remaining, nextFields));
      setStage(remaining.length ? "collecting" : "ready");
      appendRun("params", remaining.length);
      appendMessage("agent", recognized.length
        ? `已识别：${recognized.map((field) => `${field.label}：${field.value}`).join("、")}。${remaining.length ? `还需要补充 ${remaining.length} 项报价参数，请从下方当前参数页继续填写。` : "计价关键字段已齐全，请进行报价前确认。"}`
        : "我还没有识别到可用于报价的具体参数。请先描述模型与动物品系、接种方式、分组与给药方案、实验周期和检测指标，我会继续追问缺失项。");
    }, 900);
  };

  useEffect(() => {
    if (!initialRequest || initialRequestHandledRef.current) return;
    initialRequestHandledRef.current = true;
    handleRequest(initialRequest, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRequest]);

  const addDraft = (field: ParamField, value: string) => {
    setDraftTabs((items) => {
      const rest = items.filter((item) => item.fieldId !== field.id);
      /* 值被清空（多选全部取消、重复行删光）就把 chip 一起撤掉——
         留一个「检测指标：」的空 chip，发出去等于把这一项清成空白，
         而人以为自己只是取消了一个勾。 */
      return value ? [...rest, { fieldId: field.id, label: field.label, value }] : rest;
    });
  };

  const requestFieldEdit = (fieldId: string) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    const invalidatesQuotation = stage === "generated";
    openInspector("parameters");
    setEditingFieldId(field.id);
    setDraftTabs((items) => items.filter((item) => item.fieldId !== field.id));
    focusGroup(field.group);
    setStage("collecting");
    setComposerAttention(false);
    window.requestAnimationFrame(() => setComposerAttention(true));
    window.setTimeout(() => setComposerAttention(false), 720);
    appendMessage("agent", invalidatesQuotation
      ? `正在修改已确认参数“${field.label}”。提交新值后，当前报价将标记为待重新生成。`
      : `请问您希望将${field.label}修改为什么？请在下方选择一个新值，发送后我会更新右侧参数。`);
  };

  const sendDraft = () => {
    if (!draftTabs.length) return;
    const sentTabs = draftTabs;
    appendMessage("user", `补充报价参数：\n${sentTabs.map((tab) => `${tab.label}：${tab.value}`).join("\n")}`, consumeAttachments());
    setStage("thinking");
    suggestPanel("process");
    window.setTimeout(() => {
      const nextFields = fields.map((field) => {
        const draft = sentTabs.find((tab) => tab.fieldId === field.id);
        return draft ? { ...field, value: draft.value } : field;
      });
      /* 改了上游参数，下游那些已经填好的值可能已经不成立了——
         换了模型，原来选的品系在新模型下根本不存在。悄悄留着比清掉更糟：
         报价会按一个下拉里已经没有的取值算出来。 */
      const invalidated: TumorField[] = [];
      const reconciled = nextFields.map((field) => {
        if (!field.value || !field.dependsOn?.length) return field;
        const options = field.optionsBy?.[nextFields.find((item) => item.id === field.dependsOn![0])?.value ?? ""] ?? field.options ?? [];
        if (!options.length || options.includes(field.value)) return field;
        invalidated.push(field);
        return { ...field, value: "" };
      });
      const remaining = reconciled.filter((field) => field.required && !field.value);
      setFields(reconciled);
      setDraftTabs([]);
      setEditingFieldId(null);
      focusGroup(nextGroupOf(remaining, reconciled));
      appendRun("params", remaining.length);
      if (remaining.length) {
        setStage("collecting");
        appendMessage("agent", invalidated.length
          ? `已更新报价参数。${invalidated.map((field) => field.label).join("、")}在新的模型下已不适用，已清空待重选。还需补充 ${remaining.length} 项参数。`
          : `已更新报价参数。还需补充 ${remaining.length} 项参数，请继续在下方补全卡中选择。`);
      } else {
        setStage("ready");
        appendMessage("agent", "计价关键字段已齐全。请进行报价前确认，确认后生成 Word 报价单和 Excel 报价明细。");
      }
    }, 700);
  };

  const submitComposer = () => {
    const text = composerText.trim();
    /* 只有「没打字」的时候才走草稿分支。参数卡还没填完就直接 return——
       但如果人另外打了字，那句话不能被吞掉。 */
    if (draftTabs.length && !text) {
      if (stage === "collecting" && composerFields.length) return;
      sendDraft();
      return;
    }
    if (!text || stage === "thinking" || stage === "generating") return;
    handleRequest(text);
  };

  const startGeneration = () => {
    setPreview(null);
    setStage("generating");
    suggestPanel("process");
    appendMessage("user", "确认参数，生成正式报价单。");
    window.setTimeout(() => {
      setStage("generated");
      suggestPanel("artifacts");
      appendRun("quote");
      appendMessage("agent", "报价单已生成。Word 与 Excel 金额校验一致。");
      appendMessage("artifacts", "");
    }, 1800);
  };

  const inspectorPanels = getTumorInspectorPanels({
    stage,
    fields,
    projectName,
    taskTitle,
    openGroups,
    onToggleGroup: (group) => setOpenGroups((current) => ({
      model: false, design: false, dosing: false, readout: false,
      [group]: !current[group],
    })),
    onEditField: requestFieldEdit,
    editingFieldId,
    onPreviewArtifact: () => setPreview("artifact"),
  });

  const completedRequired = fields.filter((field) => field.required && field.value).length;
  const totalRequired = fields.filter((field) => field.required).length;
  const railPanels = inspectorPanels.map((panel) => panel.id !== "parameters" ? panel : {
    ...panel,
    content: (
      <>
        <div className="paramPanelToolbar">
          <span>
            <strong>{stage === "generating" || stage === "generated" ? "报价参数 · 已确认" : "参数台账"}</strong>
            <em>{completedRequired}/{totalRequired}</em>
          </span>
        </div>
        {panel.content}
      </>
    ),
  });

  /* 全屏只对「放宽了才好读」的面板成立。切到台账这类表单面板、或者干脆把面板
     收起来，就自动落回 dock，不留一个空的全屏壳。 */
  const activePanelExpandable = inspectorPanels.find((panel) => panel.id === inspectorPanelId)?.expandable ?? false;
  useEffect(() => {
    if (panelFocus && (!panelOpen || !activePanelExpandable)) setPanelFocus(false);
  }, [activePanelExpandable, panelFocus, panelOpen]);

  return (
    <>
      <section className="dmpkWorkspace">
        <header className="topbar">
          <div className="breadcrumb"><span>{projectName}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></div>
          <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} />
        </header>
        <SessionMinimap scrollerRef={chatScrollerRef} />
        <div className="dmpkChatScroller" ref={chatScrollerRef}>
          <PriorSessionHistory snapshots={priorSessionSnapshots} />
          <TumorConversation
            messages={messages}
            stage={stage}
            missingCount={missingFields.length}
            onOpenInspector={openInspector}
            onArtifactPreview={() => setPreview("artifact")}
          />
        </div>
        <TumorComposer
          attention={composerAttention}
          stage={stage}
          text={composerText}
          setText={setComposerText}
          activeGroup={activeGroup}
          fields={composerFields}
          allFields={fields}
          mode={editingField ? "edit" : "collect"}
          draftTabs={draftTabs}
          onSelect={addDraft}
          onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))}
          onSend={submitComposer}
          onPreview={() => setPreview("params")}
          onGenerate={startGeneration}
          projectName={projectName}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          activeCoworkerId={activeCoworkerId}
          disabled={stage === "thinking" || stage === "generating" || (stage === "collecting" && composerFields.length > 0 && !composerText.trim()) || (!draftTabs.length && !composerText.trim())}
        />
        <WorkbenchPanelBody
          panels={railPanels}
          visibleIds={visiblePanelIds}
          onVisibleIdsChange={setVisiblePanelIds}
          activePanelId={inspectorPanelId}
          hintIds={panelHintIds}
          open={panelOpen}
          focus={panelFocus}
          onFocusChange={setPanelFocus}
          columnIds={columnPanelIds}
          onColumnIdsChange={setColumnPanelIds}
          onPanelChange={(panelId) => {
            setTabPinnedByUser(true);
            setPanelHintIds((ids) => ids.filter((id) => id !== panelId));
            setInspectorPanelId(panelId as TumorInspectorPanelId);
          }}
        />
      </section>
      {preview ? (
        <TumorQuotationPreviewModal
          fields={fields}
          title={preview === "artifact" ? "报价明细预览" : "完整参数与计价条目预览"}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
