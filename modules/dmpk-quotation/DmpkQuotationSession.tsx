"use client";

import { ChevronRight, Minimize2, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingChatDock } from "../../components/workbench-panel/FloatingChatDock";
import { PanelToggle, WorkbenchPanelBody } from "../../components/workbench-panel/WorkbenchPanel";
import { AnnotatedQuote } from "../../components/workbench-shell/AnnotatedQuote";
import { PriorSessionHistory } from "../../components/workbench-shell/BioAZHelper";
import { SessionMinimap } from "../../components/workbench-shell/SessionMinimap";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { AgentModuleSessionProps } from "../types";
import { quoteAnchorLabel, quoteCurrentValue, type QuoteNote } from "../../lib/workbench/quoteData";
import { noteAnchorToField } from "./noteFieldMap";
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
import { QuotePreviewModal } from "../../components/workbench-shell/QuotePreviewModal";
import {
  DmpkComposer,
  DmpkConversation,
  dmpkRunRecord,
  DmpkEditProposalCard,
  ComposerChipTray,
  DmpkParameterTaskCard,
  DmpkQuotationPreviewModal,
  DmpkReworkNoticeCard,
  type DmpkChatMessage,
  type DmpkEditProposal,
  type DmpkInspectorPanelId,
} from "./views";

export default function DmpkQuotationSession({ projectName, taskTitle, initialRequest, initialAttachments, coworkers, activeCoworkerId, onCoworkerChange, onRunStatusChange, onHandoff, viewerName, rework, onReworkResolved, initialHistory, initialFields, handoffNotice, priorSessionSnapshots, onSessionSnapshotChange, onOpenQuotationManagement }: AgentModuleSessionProps) {
  const openingMessage = "你好，我是 DMPK 报价数字同事。请直接描述检测类型、分子类型、动物种属与数量、试验周期和采血点；我会先识别已知参数，再逐项补齐报价所需信息。";
  /* 回到旧会话时把参数一起还原。不还原的话,右侧面板停在「未开始」,
     而对话里写着「参数已齐全、报价单已生成」——一屏之内自相矛盾。 */
  const [fields, setFields] = useState<DmpkField[]>(() =>
    initialDmpkFields.map((field) => ({ ...field, value: initialFields?.[field.id] ?? field.value })));
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
  /* 回到一条已经聊过的会话时，先把它自己的历史还原成消息——滚上去就看得到
     当初怎么描述的、报价怎么生成的。没有历史才从开场白开始。 */
  const [messages, setMessages] = useState<DmpkChatMessage[]>(() => {
    if (initialHistory?.length) {
      return initialHistory
        .filter((entry) => entry.role !== "process")
        .map((entry) => ({ id: entry.id, role: entry.role as DmpkChatMessage["role"], text: entry.text }));
    }
    /* 开场白在前、被带进来的那句请求在后。反过来读是这样的：
       用户先说了一整段需求，数字同事接着自我介绍并请他「描述检测类型、
       分子类型……」——而那些他刚刚说完。 */
    return initialRequest
      ? [{ id: "context", role: "agent", text: openingMessage }, { id: "initial-request", role: "user", text: initialRequest, attachments: initialAttachments }]
      : [{ id: "context", role: "agent", text: openingMessage }];
  });
  /* 这一单交出去了没有。交接是一次性动作,不该留一张还能再点一次的卡在那儿。 */
  const [handedOff, setHandedOff] = useState(false);
  const reworkNotes = (rework?.notes ?? []) as QuoteNote[];
  const reworkGreetedRef = useRef(false);
  /* 退回批注铺成中间那块画布了没有。
     ----------------------------------------------------------------------
     它跟 panelFocus 不是一回事。panelFocus 是「面板铺满整个工作区」，
     对话和右侧栏一起消失；而这里要的是 QA 审核台那个形状——
     **中间是要看的东西，右边仍然是那 320px 的面板，底部一颗药丸**。
     读在中间，改在右边，确认在药丸，三样同屏。

     所以展开退回批注不是 setPanelFocus(true)，是把它搬到中间去当画布，
     面板顺势切回参数收集。收起来的时候，对话回到中间，
     退回批注变回面板里的一个 tab。 */
  const [reworkCanvas, setReworkCanvas] = useState(false);
  /* 这一轮返工做完了没有。做完就把「退回批注」那个 tab 收掉——
     一份已经照着改完的原件留在 tab 栏里,只会让人反复确认自己是不是漏了什么。 */
  const [reworkSettled, setReworkSettled] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [stage, setStage] = useState<DmpkStage>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<"word" | "excel" | null>(null);
  /* tab 栏只放三个主面板；处理过程、输入材料、缺失项、计算依据、审核记录
     一律收在加号菜单里，系统永远不会自己把它们加回来。 */
  const [visiblePanelIds, setVisiblePanelIds] = useState<string[]>(["parameters", "artifacts", "rules"]);
  // DMPK 的参数收集是主工作面，右侧默认就展开；肿瘤报告那边是事件驱动的
  const [panelOpen, setPanelOpen] = useState(true);
  /** 面板铺满工作区：只吃对话列，topbar 与左侧任务栏保留 */
  const [panelFocus, setPanelFocus] = useState(false);
  const [inspectorPanelId, setInspectorPanelId] = useState<DmpkInspectorPanelId>("parameters");
  /** 用户自己点过 tab 之后，阶段推进不再抢视图，只在 tab 上打点 */
  const [tabPinnedByUser, setTabPinnedByUser] = useState(false);
  const [panelHintIds, setPanelHintIds] = useState<string[]>([]);
  const visiblePanelIdsRef = useRef(visiblePanelIds);
  visiblePanelIdsRef.current = visiblePanelIds;
  const [parametersExpanded, setParametersExpanded] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [conversationEditing, setConversationEditing] = useState(false);
  const [editProposal, setEditProposal] = useState<DmpkEditProposal | null>(null);
  const [composerAttention, setComposerAttention] = useState(false);
  const [pendingCoworkerId, setPendingCoworkerId] = useState<string | null>(null);
  const initialRequestHandledRef = useRef(false);
  const chatScrollerRef = useRef<HTMLDivElement>(null);

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
      /* 运行记录不进快照:上下文摘要要的是「说了什么」,不是「跑了几步」。 */
      entries: messages.filter((message) => message.role === "user" || message.role === "agent").map((message) => ({ id: message.id, role: message.role as "user" | "agent", text: message.text })),
      facts: fields.filter((field) => field.value).map((field) => ({ label: field.label, value: field.value })),
    });
  }, [activeCoworker?.name, fields, messages, onSessionSnapshotChange, stage]);

  const appendMessage = (role: DmpkChatMessage["role"], text: string, attachments?: ComposerAttachment[]) => {
    setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text, attachments }]);
  };

  /* 跑完一轮就把这条运行记录钉进消息流,紧挨着它自己那条回复的上方。
     一定要在 appendMessage("agent", …) 之前调用——过程在前,结论在后。 */
  const appendRun = (kind: "params" | "quote" | "rework", missingCount = 0) => {
    const record = dmpkRunRecord(kind, { missingCount });
    setMessages((items) => [...items, { id: `run-${Date.now()}-${items.length}`, role: "run", ...record }]);
  };

  /* 交接完成之后卡片就收起,内容沉淀成会话里的一条记录。
     交接卡是一个**临时的录入界面**,它的产物属于对话——把一张已提交、
     再也点不动的表单留在原地,等于让人反复看见一个不能操作的控件,
     而会话的价值恰恰是「从上往下读就知道发生过什么」。 */
  const handOff = (to: string, note: string) => {
    setHandedOff(true);
    appendMessage("user", note ? `交接给 ${to}：${note}` : `交接给 ${to}`);
    appendMessage("agent", `已交接给 ${to}，本次的 Word 报价单与 Excel 报价明细已随行。对方将在站内信中收到。`);
  };

  /* 从站内信进来时：先跑一次，再把原件摊开。
     ----------------------------------------------------------------------
     数字同事在这一步只做三件事——读、说清楚、把东西摊到你面前。
     **它不替你决定要改成什么**：上一版给的是一张「逐条采纳」的方案卡，
     等于让它替人做主，改动也就绕过了参数收集。现在改回来：
     它把批注和原件摊开在右侧画布里，改由人在参数卡上动手。

     顺序是有意的，而且这三步都在对话里留了痕：
       1. 跑一次「读取退回批注」——run 记录，能展开看它读了什么
       2. 说一句话，讲清楚有几条、去哪儿看、在哪儿改
       3. 把「退回批注」这个 tab 打开
     画布**不自动铺开**：那是一屏很重的东西，凭空盖住对话会让人不知道
     它是哪来的。由 composer 上那张入口卡领进去，人点了才铺。 */
  useEffect(() => {
    if (!rework || reworkGreetedRef.current) return;
    reworkGreetedRef.current = true;
    const blocking = reworkNotes.filter((note) => note.severity === "blocking").length;
    /* 先记下「东西回来了」这件事本身，再让数字同事去读它。
       附件挂在这一条上——被退回的是一份产物，不是一句话。 */
    setMessages((items) => [...items, {
      id: `inbound-${Date.now()}`,
      role: "inbound",
      text: `${rework.by} 退回了这一版`,
      attachments: rework.attachmentName
        ? [{ id: "rework-file", kind: "file" as const, label: rework.attachmentName, meta: "随退回一起返还", origin: "library" as const }]
        : undefined,
    }]);
    setStage("thinking");
    /* 不给这个 effect 写 cleanup 去 clearTimeout。
       严格模式下 effect 会跑两遍(挂载 → 清理 → 再挂载)：第一遍把 ref 置真并
       排上定时器，清理把它取消，第二遍又被 ref 挡回去——于是这一段永远不发生。
       ref 已经保证了只排一次，一次性的定时器不需要再被撤销。 */
    window.setTimeout(() => {
      setStage("collecting");
      appendRun("rework");
      appendMessage("agent", `收到 ${rework.by} 的退回，共 ${reworkNotes.length} 条批注${blocking ? `，其中 ${blocking} 条必须修订` : ""}。批注已收在右侧「退回批注」，要对照原件看就摊开成画布；改在参数收集里改，改完在下方确认发送。`);
      openInspector("rework");
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rework]);

  /* 展开「退回批注」＝ 把它搬到中间当画布，而不是让面板铺满整屏。
     铺满会把「改」（右侧参数收集）和「确认」（底部输入）一起赶走，
     而这一屏的活恰恰要三样同时在。所以这里把 panelFocus 接管掉：
     一旦是退回批注要全屏，就转成画布模式，面板顺势切回参数收集。 */
  useEffect(() => {
    if (!panelFocus || inspectorPanelId !== "rework") return;
    setPanelFocus(false);
    setReworkCanvas(true);
    openInspector("parameters");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelFocus, inspectorPanelId]);

  /* 现值：能映射到会话参数的走会话字段，其余走报价单。
     两套词表不一一对应，取错一边，显示的现值就跟人眼前的面板对不上。 */
  const reworkCurrentValue = (anchorId: string) => {
    const fieldId = noteAnchorToField[anchorId];
    if (!fieldId) return quoteCurrentValue(anchorId);
    return fields.find((field) => field.id === fieldId)?.value ?? quoteCurrentValue(anchorId);
  };

  /* 「逐条采纳 / 另行说明 / 撤销 / 确认本轮改动」这一整套已经删掉。
     ----------------------------------------------------------------------
     那是让数字同事替人做决定：它读完批注给出方案，人只是点头。代价有两个——
     改动绕过了参数收集（右侧面板成了旁观者），而且人对着的是它的转述，
     不是审批人的原话。

     现在的分工：它只负责把原件和批注摊开；改由人在参数收集里动手，
     经 composer 发送确认。所以这里不需要任何中间状态。 */

  const confirmChanges = () => {
    /* 参数已经由人在参数收集里改过了，这一步只是重出一版。 */
    setReworkSettled(true);
    /* 也告诉壳层这一单不再是「被退回着」的状态,否则切走再回来面板又长回来。 */
    onReworkResolved?.();
    setStage("generating");
    suggestPanel("parameters");
    window.setTimeout(() => {
      setStage("generated");
      appendRun("quote");
      appendMessage("agent", "已按修改后的参数重新生成报价单，Word 与 Excel 金额校验一致，可再次送审。");
    }, 1200);
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
      appendRun("params", remaining.length);
      appendMessage("agent", recognized.length
        ? `已识别：${recognized.map((field) => `${field.label}：${field.value}`).join("、")}。还需要补充 ${remaining.length} 项报价参数，请从下方当前参数页继续填写。`
        : "我还没有识别到可用于报价的具体参数。请先描述检测类型、分子类型、动物种属与数量、试验周期和采血点，我会继续追问缺失项。");
    }, 900);
  };

  /* 从新建任务分派进来时，initialRequest 不只是历史消息，也应真正启动识别流程。
     ref 保证 React 严格模式或父组件重渲染时不会重复处理同一条首轮请求。 */
  useEffect(() => {
    if (!initialRequest || initialRequestHandledRef.current) return;
    initialRequestHandledRef.current = true;
    handleInitialRequest(initialRequest, true);
  }, [initialRequest]);

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
        appendRun("params", remaining.length);
        appendMessage("agent", `已更新报价参数。还需补充 ${remaining.length} 项参数，请继续在下方补全卡中选择。`);
      } else {
        setStage("ready");
        appendRun("params");
        appendMessage("agent", "计价关键字段已齐全。请进行报价前确认，确认后生成 Word 报价单和 Excel 报价明细。");
      }
    }, 700);
  };

  const submitComposer = () => {
    const text = composerText.trim();
    /* 只有「没打字」的时候才走草稿分支。以前不管有没有打字都走这儿，
       撞上参数卡还没填完就直接 return——全屏胶囊里打的字会一声不吭地消失，
       而那个待发草稿正躲在淡出的 composer 里，用户根本看不见。 */
    if (draftTabs.length && !text) {
      if (stage === "collecting" && composerFields.length) return;
      sendDraft();
      return;
    }
    if (!text || stage === "thinking" || stage === "generating") return;
    const reportFeeMatch = text.match(/(?:这次|本次)?.*报告费.*?(\d[\d,]*)\s*元?/);
    // 放宽句式：以前必须原样说出「以后…PK…样品…少于…按…收费」，换个说法就掉进兜底文案
    const minimumSampleMatch = text.match(/(?:样品|样本).*?(?:少于|低于|不足|不到)\s*(\d+)\s*个?.*?(?:按|以)\s*(\d+)\s*个?.*?(?:收费|计费|计价)/i);
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
      appendRun("quote");
      appendMessage("agent", "报价单已生成。Word 与 Excel 金额校验一致。");
    }, 1800);
  };

  /**
   * 阶段推进时的建议切换。只在已经显示的 tab 之间起作用——
   * 不在 tab 栏里的面板一律跳过，否则「三个主 tab」会被系统自己撑长。
   * 用户自己点过 tab 之后，连切换也降级成打点提示。
   */
  const suggestPanel = (panelId: DmpkInspectorPanelId) => {
    // 用 ref 读当前可见集：suggestPanel 常在 setTimeout 里调用，闭包里的值可能是旧的
    if (!visiblePanelIdsRef.current.includes(panelId)) return;
    if (tabPinnedByUser) {
      setPanelHintIds((hints) => hints.includes(panelId) ? hints : [...hints, panelId]);
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
    /* 面板里的「改这条」把现成的话填进 composer 并聚焦，
       真正的修改交给对话流既有的确认路径。 */
    onDraftMessage: (text: string) => {
      setConversationEditing(true);
      setComposerText(text);
      setComposerAttention(false);
      window.requestAnimationFrame(() => setComposerAttention(true));
      window.setTimeout(() => setComposerAttention(false), 720);
    },
    /* 退回批注。铺成中间画布的时候，面板里那个 tab 就该消失——
       同一份东西不该同时占着中间和右边。settled 之后同理。 */
    reworkNotes: reworkSettled || reworkCanvas ? [] : reworkNotes,
    reworkBy: rework?.by,
    reworkAt: rework?.at,
    reworkReason: rework?.reason,
    expanded: panelFocus,
  });
  /* 参数面板只负责改「参数的值」——逐项点编辑图标即可。
     改规则不属于这里，「对话编辑」已经移到报价规则面板。 */
  const railPanels = inspectorPanels.map((panel) => panel.id !== "parameters" ? panel : {
    ...panel,
    content: (
      <>
        <div className="paramPanelToolbar">
          <span>
            <strong>{stage === "generating" || stage === "generated" ? "报价参数 · 已确认" : "参数收集"}</strong>
            {identifiedAssayType ? <em>{completedCount}/{totalRequired}</em> : null}
          </span>
        </div>
        {panel.content}
      </>
    ),
  });

  /* 全屏只对「放宽了才好读」的面板成立。切到参数收集这类表单面板、
     或者干脆把面板收起来，就自动落回 dock，不留一个空的全屏壳。 */
  const activePanelExpandable = inspectorPanels.find((panel) => panel.id === inspectorPanelId)?.expandable ?? false;
  useEffect(() => {
    if (panelFocus && (!panelOpen || !activePanelExpandable)) setPanelFocus(false);
  }, [activePanelExpandable, panelFocus, panelOpen]);

  /* 调价/建规则的确认卡挂在 composer 上，全屏时它被藏起来了。
     这类决定本来也需要完整上下文，所以直接落回 dock，而不是把卡搬进药丸。 */
  useEffect(() => {
    if (editProposal && panelFocus) setPanelFocus(false);
  }, [editProposal, panelFocus]);

  useEffect(() => {
    if (!panelFocus) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // 画布里的预览弹窗自己吃 Esc，它没关掉之前不轮到全屏退出
      if (event.key !== "Escape" || previewOpen || artifactPreview) return;
      setPanelFocus(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [artifactPreview, panelFocus, previewOpen]);

  return (
    <>
      <section className={`dmpkWorkspace ${panelFocus ? "isPanelFocus" : ""} ${reworkCanvas ? "isReworkCanvas" : ""}`}>
        <header className="topbar">
          <div className="breadcrumb"><span>{projectName}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></div>
          <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} />
        </header>
        {!reworkCanvas ? <SessionMinimap scrollerRef={chatScrollerRef} /> : null}
        {reworkCanvas && rework ? (
          /* 中间这块画布 = 要照着改的原件。右侧那 320px 面板照旧在，
             底部是药丸——读、改、确认三样同屏，谁也不用切走。 */
          <section className="dmpkReworkCanvas" aria-label="退回批注">
            <header>
              <div>
                <strong>{rework.by} 退回了这一版</strong>
                <small>{rework.at} · 共 {reworkNotes.length} 条批注{reworkNotes.filter((note) => note.severity === "blocking").length ? `，其中 ${reworkNotes.filter((note) => note.severity === "blocking").length} 条必须修订` : ""}</small>
              </div>
              {/* 收起来：对话回到中间，退回批注变回面板里的一个 tab。 */}
              <button type="button" onClick={() => { setReworkCanvas(false); openInspector("rework"); }} aria-label="收起画布，回到对话" title="收起画布，回到对话">
                <Minimize2 size={15} />
              </button>
            </header>
            {rework.reason ? <p className="dmpkReworkReason">{rework.reason}</p> : null}
            <AnnotatedQuote notes={reworkNotes} className="isPanel" />
          </section>
        ) : (
          <div className="dmpkChatScroller" ref={chatScrollerRef}><PriorSessionHistory snapshots={priorSessionSnapshots} /><DmpkConversation messages={messages} stage={stage} currentMissing={missingFields} handoffNotice={handoffNotice} onOpenInspector={openInspector} onArtifactPreview={setArtifactPreview} /></div>
        )}
        <DmpkComposer unresolvedNotes={reworkNotes
          .filter((note) => !noteAnchorToField[note.anchorId])
          .map((note) => ({ anchorId: note.anchorId, label: quoteAnchorLabel(note.anchorId) }))} reworkNotice={rework && !reworkSettled && !reworkCanvas ? (
          <DmpkReworkNoticeCard
            by={rework.by}
            at={rework.at}
            total={reworkNotes.length}
            blocking={reworkNotes.filter((note) => note.severity === "blocking").length}
            onOpenCanvas={() => setReworkCanvas(true)}
          />
        ) : null} editProposal={editProposal} viewerName={viewerName} handoffDone={handedOff} onHandoff={(to, note) => { handOff(to, note); onHandoff?.({ to, kind: "dmpk-quotation", title: `请复核：${taskTitle}`, note, attachments: [
          { id: "quote-word", name: `${taskTitle}_报价单.docx`, meta: "Word · 管理费 30%" },
          { id: "quote-excel", name: `${taskTitle}_报价明细.xlsx`, meta: "Excel · 管理费 15%" },
        ] }); }} onConfirmCurrentPrice={() => { appendMessage("agent", `已将本次报价的报告费调整为 ¥${editProposal?.kind === "current-price" ? editProposal.nextPrice.toLocaleString() : "2,500"}，仅对当前项目生效，并已保留调整记录。`); setEditProposal(null); }} onOpenRuleManagement={() => { if (editProposal?.kind === "global-rule") onOpenQuotationManagement?.({ business: "dmpk", tab: "rules", draft: editProposal.request }); }} attention={composerAttention} conversationEditing={conversationEditing} stage={stage} text={composerText} setText={setComposerText} activeGroup={activeGroup} fields={composerFields} allFields={fields} mode={editingField ? "edit" : "collect"} draftTabs={draftTabs} onSelect={addDraft} onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))} onSend={submitComposer} onPreview={() => setPreviewOpen(true)} onGenerate={startGeneration} onOpenInspector={openInspector} coworkers={businessCoworkers} coworkerLocked={stage !== "generated"} activeCoworkerId={activeCoworkerId} onCoworkerChange={(id) => id !== activeCoworkerId && setPendingCoworkerId(id)} pendingCoworkerId={pendingCoworkerId} onConfirmCoworkerChange={() => { if (pendingCoworkerId) onCoworkerChange(pendingCoworkerId); setPendingCoworkerId(null); }} onCancelCoworkerChange={() => setPendingCoworkerId(null)} projectName={projectName} attachments={attachments} onAttachmentsChange={setAttachments} disabled={stage === "thinking" || stage === "generating" || (stage === "collecting" && composerFields.length > 0 && !composerText.trim()) || (!draftTabs.length && !composerText.trim())} />
        <WorkbenchPanelBody
          panels={railPanels}
          visibleIds={visiblePanelIds}
          onVisibleIdsChange={setVisiblePanelIds}
          activePanelId={inspectorPanelId}
          hintIds={panelHintIds}
          open={panelOpen}
          focus={panelFocus}
          onFocusChange={setPanelFocus}
          onPanelChange={(panelId) => {
            setTabPinnedByUser(true);
            setPanelHintIds((ids) => ids.filter((id) => id !== panelId));
            setInspectorPanelId(panelId as DmpkInspectorPanelId);
          }}
        />
        {panelFocus || reworkCanvas ? (
          <FloatingChatDock
            /* 画布铺满时，要当场做的那个决定跟着输入框走。
               用户在右侧参数收集里点了「改这一项」，卡片本来长在 composer 上，
               而 composer 此刻被画布盖住——点了等于没反应。
               画布一收起，同一张卡自然回到 composer 上方。 */
            chips={draftTabs.length ? <ComposerChipTray tabs={draftTabs} onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))} /> : null}
            card={composerFields.length ? (
              <DmpkParameterTaskCard
                activeGroup={activeGroup}
                fields={composerFields}
                allFields={fields}
                draftTabs={draftTabs}
                mode={editingField ? "edit" : "collect"}
                onSelect={addDraft}
              />
            ) : null}
            /* 浮动对话只放人和数字同事说的话:那个小窗是用来接着聊的,
               把运行记录也塞进去只会把仅有的几行挤掉。 */
            messages={messages.filter((message) => message.role === "user" || message.role === "agent") as { id: string; role: "user" | "agent"; text: string }[]}
            text={composerText}
            onTextChange={setComposerText}
            /* 发送那一下把画布收起来。
               这是这一轮读与改的分界：在此之前要看的是原件，在此之后要看的是
               「我改了什么、系统怎么答的」——那些都在对话里。
               不做成「改一下就自动收」，那是抢控制权；由用户自己的发送动作触发，
               时机是他给的。 */
            onSend={() => { submitComposer(); if (reworkCanvas) setReworkCanvas(false); }}
            disabled={stage === "thinking" || stage === "generating"}
          />
        ) : null}
      </section>
      {previewOpen ? <DmpkQuotationPreviewModal fields={fields} onClose={() => setPreviewOpen(false)} /> : null}
      {/* 会话里点开产物，看到的要跟站内信里、审批人那儿看到的是同一份纸。
          原来这里渲染的是一张四行的摘要表——它既不是 Word 也不是 Excel，
          撰写人对着它没法核对任何一行。 */}
      {artifactPreview ? (
        <QuotePreviewModal
          title={artifactPreview === "word" ? `${taskTitle}_报价单.docx` : `${taskTitle}_报价明细.xlsx`}
          description={artifactPreview === "word" ? "Word · 客户版报价书" : "Excel · 内部计算表"}
          initialForm={artifactPreview === "word" ? "doc" : "sheet"}
          /* 重出一版之后不再带旧批注：那些行已经改过了，还标着「必须修订」
             等于让人对着自己刚改完的数再确认一遍。 */
          notes={reworkSettled ? [] : reworkNotes}
          onClose={() => setArtifactPreview(null)}
        />
      ) : null}
    </>
  );
}
