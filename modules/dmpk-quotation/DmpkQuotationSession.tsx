"use client";

import { ChevronRight, Minimize2, ScrollText, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingChatDock } from "../../components/workbench-panel/FloatingChatDock";
import { PanelToggle, WorkbenchPanelBody } from "../../components/workbench-panel/WorkbenchPanel";
import { AnnotatedQuote } from "../../components/workbench-shell/AnnotatedQuote";
import { PriorSessionHistory } from "../../components/workbench-shell/BioAZHelper";
import { SessionMinimap } from "../../components/workbench-shell/SessionMinimap";
import { useStickToBottom } from "../../components/workbench-shell/useStickToBottom";
import type { ComposerAttachment, ComposerSessionAction } from "../../lib/workbench/composerAttachments";
import { mergeParsePatches, parseSources, type ParseResult } from "../../lib/workbench/sources";
import type { ParamSource } from "../../components/params";
import { formatCny, impactSentence, MANUAL_PRICE_BY, pricingSentence, summarizeLines, type ManualPrice, type QuoteAdjustments } from "../../lib/workbench/quoteLines";
import { quotePaperFromLines } from "../../lib/workbench/quotePaperFromLines";
import { fullQuotePermissions } from "../../lib/workbench/permissions";
import type { AgentModuleSessionProps } from "../types";
import { quoteAnchorLabel, quoteCurrentValue, type QuoteNote } from "../../lib/workbench/quoteData";
import { catalogHitsFor } from "./catalogHits";
import { noteAnchorToField } from "./noteFieldMap";
import { applyPendingToFields, dmpkSourceParsers } from "./parseFixtures";
import { buildDmpkQuoteLines } from "./quoteLineFixtures";
import {
  applyDmpkApplicability,
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
  type DmpkRunStep,
  type DmpkSessionSummary,
} from "./views";

function missingFieldHint(items: DmpkField[]) {
  if (!items.length) return "计价关键字段已齐全。";
  const labels = items.slice(0, 4).map((field) => field.label).join("、");
  const suffix = items.length > 4 ? "等" : "";
  return `还需补充 ${items.length} 项：${labels}${suffix}。可直接在输入框用一句话补充，也可以展开下方参数卡逐项填写。`;
}

export default function DmpkQuotationSession({ projectName, taskTitle, initialRequest, initialAttachments, coworkers, activeCoworkerId, onCoworkerChange, onRunStatusChange, onHandoff, viewerName, viewerPermissions, rework, onReworkResolved, initialHistory, initialFields, handoffNotice, priorSessionSnapshots, onSessionSnapshotChange, onOpenQuotationManagement }: AgentModuleSessionProps) {
  /* 壳层按账号级别推的权限；单独渲染没有壳层时按全开。 */
  const permissions = viewerPermissions ?? fullQuotePermissions;
  const openingMessage = "你好，我是 DMPK 报价数字同事。请直接描述检测类型、分子类型、动物种属与数量、试验周期和采血点；我会先识别已知参数，再逐项补齐报价所需信息。";
  /* 回到旧会话时把参数一起还原。不还原的话,右侧面板停在「未开始」,
     而对话里写着「参数已齐全、报价单已生成」——一屏之内自相矛盾。 */
  const [fields, setRawFields] = useState<DmpkField[]>(() =>
    applyDmpkApplicability(initialDmpkFields.map((field) => ({ ...field, value: initialFields?.[field.id] ?? field.value }))));
  /* 每次落字段都过一遍「不适用」：BA Only 一选上，动物那一组当场退出必填。 */
  const setFields = (next: DmpkField[] | ((items: DmpkField[]) => DmpkField[])) =>
    setRawFields((items) => applyDmpkApplicability(typeof next === "function" ? next(items) : next));
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
    return initialRequest || initialAttachments?.length
      ? [{ id: "context", role: "agent", text: openingMessage }, { id: "initial-request", role: "user", text: initialRequest ?? "", attachments: initialAttachments }]
      : [{ id: "context", role: "agent", text: openingMessage }];
  });
  /* 这一单交出去了没有。交接是一次性动作,不该留一张还能再点一次的卡在那儿。 */
  const [handedOff, setHandedOff] = useState(false);
  const reworkNotes = (rework?.notes ?? []) as QuoteNote[];
  const reworkGreetedRef = useRef(false);
  /* 原件画布铺开了没有。
     ----------------------------------------------------------------------
     它跟 panelFocus 不是一回事：panelFocus 是面板铺满整个工作区，
     这里是把原件搬到**中间那一列**去看，右侧面板照旧在。

     它现在是**纯阅读态，没有任何输入控件**——要改就先收起来
     （点参数的「编辑」会自动收）。读和改分开之后，
     原来那套「画布里放胶囊输入框、参数卡跟着走」的联动整个不需要了。

     它也不再是这一屏的第一步：进会话时批注和参数已经并排在右侧，
     第一步直接是改，画布只在「原文我要再核一眼」时才用。 */
  const [reworkCanvas, setReworkCanvas] = useState(false);
  /* 这一单出过几版报价。每生成一次追加一条，旧版不删——
     报价被退过一次这件事，一个月后回来看还得能查到。 */
  const [quoteVersions, setQuoteVersions] = useState<{ id: string; label: string; at: string; origin: string }[]>(() =>
    /* 带着退回进来时，被退回的那一版**已经存在**——它就是 v1。
       不种这一条的话，改完重出会标成「v1 首次生成」，而屏幕上明明写着
       这是第二次：审批人退过一次，你才在这儿。 */
    rework ? [{ id: "v1", label: "v1", at: rework.at, origin: "送审后被退回" }] : []);
  const pushQuoteVersion = (origin: string) => setQuoteVersions((items) => [
    ...items,
    { id: `v${items.length + 1}`, label: `v${items.length + 1}`, at: "刚刚生成 · 金额校验一致", origin },
  ]);
  /* 这一轮返工做完了没有。做完就把「退回批注」那个 tab 收掉——
     一份已经照着改完的原件留在 tab 栏里,只会让人反复确认自己是不是漏了什么。 */
  const [reworkSettled, setReworkSettled] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [stage, setStage] = useState<DmpkStage>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<"word" | "excel" | null>(null);
  /* tab 栏只放主面板；处理过程、输入材料、缺失项、报价明细、审核记录
     一律收在加号菜单里，系统永远不会自己把它们加回来。
     「报价板块」是 2026-09-21 会议定的右栏正主（参数状态 + 单价），常驻。
     「报价规则」tab 撤了（用户 09-21 晚定的）：它剩下的两条规则折进板块底部，全局去处就是价目表那扇门。 */
  const [visiblePanelIds, setVisiblePanelIds] = useState<string[]>(["parameters", "sections", "artifacts"]);
  // DMPK 的参数收集是主工作面，右侧默认就展开；肿瘤报告那边是事件驱动的
  const [panelOpen, setPanelOpen] = useState(true);
  /** 面板铺满工作区：只吃对话列，topbar 与左侧任务栏保留 */
  const [panelFocus, setPanelFocus] = useState(false);
  const [inspectorPanelId, setInspectorPanelId] = useState<DmpkInspectorPanelId>("parameters");
  /** 用户自己点过 tab 之后，阶段推进不再抢视图，只在 tab 上打点 */
  const [tabPinnedByUser, setTabPinnedByUser] = useState(false);
  const [panelHintIds, setPanelHintIds] = useState<string[]>([]);
  /* 哪几个面板摊成自己的一列。退回到达时自动填上，用户也能自己并/收。 */
  const [columnPanelIds, setColumnPanelIds] = useState<string[]>([]);
  const visiblePanelIdsRef = useRef(visiblePanelIds);
  visiblePanelIdsRef.current = visiblePanelIds;
  const [parametersExpanded, setParametersExpanded] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  /* 参数卡展开没有。**必须由会话持有**：卡片只在 collecting 时渲染，
     而每发一轮参数都要经过 thinking，卡会卸载再挂载——状态放卡里的话，
     每一轮都被重新折起来，人得反复点开同一张卡。
     默认折叠：这张卡是数字同事说「还缺 N 项」时自己弹出来的，不是人要求的。 */
  const [paramsOpen, setParamsOpen] = useState(false);
  const [conversationEditing, setConversationEditing] = useState(false);
  const [editProposal, setEditProposal] = useState<DmpkEditProposal | null>(null);
  const [composerAttention, setComposerAttention] = useState(false);
  const [pendingCoworkerId, setPendingCoworkerId] = useState<string | null>(null);
  /* 这条会话读过的来源。轨迹钉在消息流里，这里留的是**读出来的东西**——
     「输入材料」面板列来源和事实，「报价规则」面板列无价目的那几项。 */
  const [sources, setSources] = useState<ParseResult[]>([]);
  /* 正在读文件时逐步揭开的那条链。跑完置空，完整的一条进消息流。 */
  const [liveParse, setLiveParse] = useState<{ text: string; runSteps: DmpkRunStep[] } | null>(null);
  /* 会话摘要生成过的话，交接卡的说明栏预填它。 */
  const [handoffNote, setHandoffNote] = useState("");
  /* 确认状态（甲方 P0-2「转换确认模块」）。
     ----------------------------------------------------------------------
     文件里认出来的值和人确认过的值，在台账上原来长得一样——而这正是
     「转换确认」要区分的：机器读出来的是**提议**，人点过头的才是**参数**。
     两态就够：recognized（文件认的）/ confirmed（人经参数卡、铅笔或「确认」动作
     落过的）。一句话里打出来的值是人自己说的，直接算 confirmed，不进这张表。 */
  const [fieldStatus, setFieldStatus] = useState<Record<string, "recognized" | "confirmed">>({});
  /* 临时调价（P0-2）：SD 手动单价按行 id 记在这里，压过价目表；价目表本身不动，
     别的报价也看不见。行是从事实推出来的，重算就没了，所以手动价不能写在行上。 */
  const [manualPrices, setManualPrices] = useState<Record<string, ManualPrice>>({});
  /* 人工调整项（P0 第五层）：折扣、其他费用。作用在合计上，不属于任何一行，跟 manualPrices 一样只在本单。 */
  const [adjustments, setAdjustments] = useState<QuoteAdjustments>({});
  const initialRequestHandledRef = useRef(false);
  const chatScrollerRef = useRef<HTMLDivElement>(null);

  const missingFields = useMemo(() => fields.filter((field) => field.required && !field.value), [fields]);
  const recognizedFields = useMemo(() => fields.filter((field) => field.value && fieldStatus[field.id] === "recognized"), [fields, fieldStatus]);
  /* 报价行从字段 + 来源推，每次渲染重算——它是账，不是状态。 */
  /* 退回会话不要账：它的纸面是批注锚着的固定件（见 quoteLineFixtures 末尾）。 */
  const lineOptions = useMemo(() => ({ fieldsOnly: !rework }), [rework]);
  const quoteLines = useMemo(() => buildDmpkQuoteLines(fields, sources, lineOptions), [fields, sources, lineOptions]);
  const quoteSummary = useMemo(() => summarizeLines(quoteLines, manualPrices), [quoteLines, manualPrices]);
  /* 有账就把账折成纸；没账（退回会话）不传，纸面用固定件。 */
  const paperTitle = sources.find((source) => source.role === "protocol")?.title ?? taskTitle;
  const quotePaper = useMemo(
    () => quoteLines.length ? quotePaperFromLines(quoteLines, manualPrices, fields, paperTitle, adjustments) : undefined,
    [quoteLines, manualPrices, fields, paperTitle, adjustments],
  );
  /* 报价单是不是旧的。
     ----------------------------------------------------------------------
     生成那一刻记一份「字段值 + 手动单价」的快照；之后任一处变了，出过的那版
     就跟眼前的账对不上。stage 记不住这件事：改参数会退回 collecting，改单价
     连 stage 都不动。所以单独算，而不是往 stage 里再塞一个值。 */
  const [generatedSnapshot, setGeneratedSnapshot] = useState<string | null>(null);
  const snapshotOf = (nextFields: DmpkField[], nextManual: Record<string, ManualPrice>, nextAdjustments: QuoteAdjustments = adjustments) =>
    JSON.stringify({ values: nextFields.map((field) => [field.id, field.value]), manual: nextManual, adjustments: nextAdjustments });
  const quoteStale = generatedSnapshot !== null && generatedSnapshot !== snapshotOf(fields, manualPrices, adjustments);
  const visibleCardFields = missingFields.filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id));
  const editingField = fields.find((field) => field.id === editingFieldId) ?? null;
  const composerFields = editingField ? [editingField].filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id)) : visibleCardFields;
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

  /**
   * 给一格写新值，顺手维护它的原文依据。
   * ----------------------------------------------------------------------
   * 文件读出来的值带 document 来源；人改的值没有来源可带——但如果它**盖掉的是
   * 一个原文来源**，原句留在 original 里，小标换成「人填」，浮层写「原文为 X，已改为 Y」。
   * 原来就是人填的格子，改了还是人填，不长小标。改回跟原文一样的值也不恢复
   * document——它是人拍的板，不是读出来的。
   */
  const withValue = (field: DmpkField, value: string, documentSource?: Extract<ParamSource, { kind: "document" }>): DmpkField => {
    if (documentSource) return { ...field, value, source: documentSource };
    if (value === field.value) return field;
    if (field.source?.kind === "document") {
      return { ...field, value, source: { kind: "manual", original: { sourceLabel: field.source.sourceLabel, anchor: field.source.anchor, quote: field.source.quote, value: field.value } } };
    }
    return { ...field, value };
  };

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

  /* 从站内信进来时：先跑一次，再把要用的两块并排铺好。
     ----------------------------------------------------------------------
     数字同事在这一步只做三件事——读、说清楚、把东西摆到你面前。
     **它不替你决定要改成什么**：上一版给的是一张「逐条采纳」的方案卡，
     等于让它替人做主，改动也就绕过了参数收集。现在改回来：
     它只负责把批注和参数摆好，改由人在参数卡上动手。

     顺序是有意的，而且都在对话里留了痕：
       1. 跑一次「读取退回批注」——run 记录，能展开看它读了什么
       2. 说一句话，只报告有几条、几条必须改（该做什么交给输入框上那张卡）
       3. 把「退回批注」和「参数收集」并排铺开

     并排是自动的，**画布仍然不自动铺开**：这一单是被退回的、有批注要读、
     有参数要改，这件事系统已经知道，再让人去菜单里勾一遍是明知故问；
     而画布是一屏很重的东西，凭空盖住对话会让人不知道它是哪来的。 */
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
      /* 这条只报告发生了什么。「接下来做什么」交给输入框上方那张卡——
         同一句话说三遍（站内信事件、这条、卡片）是之前那版的毛病。 */
      appendMessage("agent", `收到 ${rework.by} 的退回，共 ${reworkNotes.length} 条批注${blocking ? `，其中 ${blocking} 条必须修订` : ""}。`);
      /* 从站内信进来处理退回，要干的事是确定的：读批注、改参数。
         那就直接把这两块并排铺好，而不是让人先去菜单里勾一遍——
         系统已经知道这一单是被退回的，还要用户再说一次，是在明知故问。

         顺序是「批注在左、参数在右」：从左到右正好是这件事的次序，
         对话说发生了什么、批注说哪里不对、参数是动手的地方。

         排不排得下仍由宽度说了算，窄屏上它会自动退回标签，不会硬挤。

         两句都要：openInspector 负责把「退回批注」加进可见标签集，
         columnIds 只是从**已经可见**的那些里挑谁摊开——
         少了前一句，后一句挑不到任何东西。 */
      openInspector("rework");
      setColumnPanelIds(["rework"]);
      openInspector("parameters");
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
    const snapshot = snapshotOf(fields, manualPrices);
    window.setTimeout(() => {
      setStage("generated");
      setGeneratedSnapshot(snapshot);
      pushQuoteVersion(`按 ${reworkNotes.length} 条批注重出`);
      appendRun("quote");
      appendMessage("agent", "已按修改后的参数重新生成报价单，Word 与 Excel 金额校验一致，可再次送审。");
      /* 产物卡钉在生成这一刻，不再挂在对话末尾——挂末尾的话，
         生成完先交接、产物卡就跑到「已交接给某某」下面去了。 */
      appendMessage("artifacts", "");
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
      const nextFields = applyDmpkApplicability(fields.map((field) => patch[field.id] ? withValue(field, patch[field.id]) : field));
      const recognized = nextFields.filter((field) => patch[field.id]);
      const remaining = nextFields.filter((field) => field.required && !field.value);
      const nextGroup = dmpkGroups.find((group) => remaining.some((field) => field.group === group.id))?.id ?? "assay";
      setFields(nextFields);
      /* 一句话认出了检测类型，账就有行了，右栏切到「报价板块」（会议定的正主）；
         什么都没认出来才停在参数收集。传文件那条路不走这儿——文件认出来的要人逐项确认，留在参数收集。 */
      suggestPanel(buildDmpkQuoteLines(nextFields, sources, lineOptions).length ? "sections" : "parameters");
      setParametersExpanded(Boolean(patch.assayType));
      setActiveGroup(nextGroup);
      setOpenGroups({ assay: nextGroup === "assay", animal: nextGroup === "animal", analysis: nextGroup === "analysis", delivery: nextGroup === "delivery" });
      /* 一句话把最后几项补齐了，就跟从参数卡里补齐一样，进「报价前确认」；
         以前这条路一律停在 collecting，嘴上说「已齐全」，确认卡却不出来。 */
      setStage(remaining.length ? "collecting" : "ready");
      appendRun("params", remaining.length);
      /* 账已经有行了再来一句话补参数，就是在改账：说清动了哪几行、合计从多少到多少（P0 的影响提示）。
         第一句话之前没有账，没什么可比，只报识别结果。 */
      const before = summarizeLines(buildDmpkQuoteLines(fields, sources, lineOptions), manualPrices);
      const after = summarizeLines(buildDmpkQuoteLines(nextFields, sources, lineOptions), manualPrices);
      const impact = before.packages.length ? `${impactSentence(before, after, manualPrices)}${after.packages.length ? `${pricingSentence(after)}。` : ""}` : "";
      appendMessage("agent", recognized.length
        ? `已识别：${recognized.map((field) => `${field.label}：${field.value}`).join("、")}。${impact}${missingFieldHint(remaining)}${remaining.length ? "" : "请进行报价前确认，确认后生成 Word 报价单和 Excel 报价明细。"}`
        : "我还没有识别到可用于报价的具体参数。请先描述检测类型、分子类型、动物种属与数量、试验周期和采血点，我会继续追问缺失项。");
    }, 900);
  };

  /**
   * 读文件。
   * ----------------------------------------------------------------------
   * 跟一句话识别走的是**同一条落库路**：读出来的取值也是一份 patch，
   * 也是 setFields 合进去、也是照旧弹参数卡补缺的。差别只在前面多了一条
   * 逐步揭开的轨迹——每一步说读出了什么、从原文哪儿读的。
   *
   * 文字和文件同发时，**文件为准，文字只补文件没写的**。
   * 跟着一份方案一起发的那句话多半是指令（「按这份方案出 DMPK 报价」），
   * 不是数据——一句话识别会把里面的「DMPK」认成检测类型 PK，盖掉方案里
   * 写明的 TOX。真要纠正文件，下一句话或参数卡都走正常路径，照样能盖。
   */
  const handleSources = (items: ComposerAttachment[], text = "", skipUserMessage = false) => {
    if (!skipUserMessage) appendMessage("user", text, items);
    setComposerText("");
    const results = parseSources(items, dmpkSourceParsers);
    if (!results.length) {
      /* 没有一份是文件（只挂了技能/连接器）——照旧当一句话处理。 */
      if (text) handleInitialRequest(text, true);
      return;
    }
    const steps = results.flatMap((result) => result.steps);
    const label = results.length === 1 ? results[0].sourceLabel : `${results.length} 份文件`;
    setStage("thinking");
    suggestPanel("process");
    /* 一步一步揭开，而不是一次亮全。看的人跟着它读：先是判类型，再是
       翻目录，再是一节一节读——这个节奏本身就在说「它是怎么读的」。 */
    /* 8 步约 6 秒：演示时看得清每一步，又不让人误以为页面卡住。 */
    const STEP_MS = 700;
    steps.forEach((_, index) => {
      window.setTimeout(() => {
        setLiveParse({ text: dmpkRunRecord("parse", { running: true, parse: { label, steps } }).text, runSteps: steps.slice(0, index + 1) });
      }, STEP_MS * index);
    });
    window.setTimeout(() => {
      const filePatch = mergeParsePatches(results);
      const patch = { ...parseDmpkRequest(text), ...filePatch };
      const pending = results.flatMap((result) => result.pending);
      const nextFields = applyDmpkApplicability(applyPendingToFields(
        fields.map((field) => {
          if (!patch[field.id]) return field;
          /* 后传的盖前传的，来源也指向真正提供这个值的那份。 */
          const provider = [...results].reverse().find((result) => result.patch[field.id] !== undefined);
          const quoteRef = provider?.patchSources?.[field.id];
          const documentSource = provider && quoteRef
            ? { kind: "document" as const, sourceId: provider.sourceId, sourceLabel: provider.sourceLabel, anchor: quoteRef.anchor, quote: quoteRef.quote }
            : undefined;
          return withValue(field, patch[field.id], documentSource);
        }),
        pending,
      ));
      const recognized = nextFields.filter((field) => patch[field.id]);
      const remaining = nextFields.filter((field) => field.required && !field.value);
      const confirmCount = pending.filter((item) => item.kind === "confirm").length;
      const nextGroup = dmpkGroups.find((group) => remaining.some((field) => field.group === group.id))?.id ?? "assay";
      const nextSources = [...sources, ...results];
      setSources(nextSources);
      setLiveParse(null);
      setFields(nextFields);
      /* 文件认出来的记「识别」；人已经确认过的那格不退回去——
         第二份材料读到同一项，不该把人点过头的东西又变成提议。 */
      setFieldStatus((current) => {
        const next = { ...current };
        for (const id of Object.keys(filePatch)) if (next[id] !== "confirmed") next[id] = "recognized";
        return next;
      });
      suggestPanel("parameters");
      setParametersExpanded(Boolean(patch.assayType));
      setActiveGroup(nextGroup);
      setOpenGroups({ assay: nextGroup === "assay", animal: nextGroup === "animal", analysis: nextGroup === "analysis", delivery: nextGroup === "delivery" });
      setStage("collecting");
      setMessages((current) => [...current, { id: `run-${Date.now()}-${current.length}`, role: "run", ...dmpkRunRecord("parse", { parse: { label, steps } }) }]);
      const readable = results.filter((result) => result.role !== "unknown");
      if (!readable.length) {
        appendMessage("agent", `「${label}」的格式还读不了。请换成 Word / PDF / PPT / Excel、图片或聊天记录导出，或者直接在下方描述检测类型、动物种属与数量、试验周期和采血点。`);
        return;
      }
      /* 一句话只报几个数：读到了什么、认出几项、几项要你拍板、账算到哪。
         细节各归各处——事实在「输入材料」，缺项在参数卡，没价目的行在「报价板块」里带着原因（规则面板已并入板块）。 */
      const facts = readable[0].facts.map((fact) => fact.brief).filter(Boolean).join("、");
      /* 账当场就算：条件齐的行先计价，算不出的带原因。一句话只报数，明细在「报价板块」。 */
      const pricing = summarizeLines(buildDmpkQuoteLines(nextFields, nextSources, lineOptions), manualPrices);
      const reply = `已读取「${label}」：${readable[0].title}。${facts ? `读到 ${facts}。` : ""}已识别 ${recognized.length} 项报价参数${confirmCount ? `，其中 ${confirmCount} 项原文有歧义需你确认` : ""}${remaining.length - confirmCount > 0 ? `，${remaining.length - confirmCount} 项原文没写` : ""}。${pricing.packages.length ? `${pricingSentence(pricing)}${pricing.unpricedByStatus["no-catalog"] ? "，没价目的行在报价板块里带着原因" : ""}。` : ""}${remaining.length ? "下面列出了还需要补充的参数。你可以直接在输入框用一句话补充，也可以展开参数卡逐项填写。" : "计价关键字段已齐全。"}`;
      setMessages((current) => [...current, {
        id: `agent-${Date.now()}-${current.length}`,
        role: "agent",
        text: reply,
        missingFields: remaining.map((field) => ({
          label: field.label,
          group: dmpkGroups.find((group) => group.id === field.group)?.title ?? "报价参数",
        })),
      }]);
      if (!remaining.length) setStage("ready");
    }, STEP_MS * steps.length + 200);
  };

  /* 从新建任务分派进来时，initialRequest 不只是历史消息，也应真正启动识别流程。
     ref 保证 React 严格模式或父组件重渲染时不会重复处理同一条首轮请求。
     带着文件进来的（首页传了方案、站内信带了附件）先读文件，文字只做补充。 */
  useEffect(() => {
    if ((!initialRequest && !initialAttachments?.length) || initialRequestHandledRef.current) return;
    initialRequestHandledRef.current = true;
    /* 只读人**自己传上来**的文件（origin local）。工单带进来的（library）是在人之间
       流转的产物——被退回的那份报价单挂在会话上是给人看的，不是给数字同事读的。
       读了的后果实测过：退回会话一进来就把那份 xlsx 当方案解析，参数全被盖成
       另一单的。退回场景一律不读，它的首轮上下文是批注。 */
    const materials = rework ? [] : (initialAttachments ?? []).filter((item) => item.kind === "file" && item.origin === "local");
    if (materials.length) handleSources(materials, initialRequest ?? "", true);
    else if (initialRequest) handleInitialRequest(initialRequest, true);
  }, [initialRequest, initialAttachments]);

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
    /* 画布开着就先收起来。
       画布是纯阅读态，没有输入框；这张参数卡本该落在 composer 上方，
       画布不收，卡片就没有落点——点了等于没反应。

       这一下不算抢控制权：点「编辑」是毫不含糊的意图声明，他要改这一项。
       收起画布、把输入框交还给他，是顺着他的意思做。
       （区别于「改一下就自动收」——那种才是替用户决定他看够了没有。） */
    setReworkCanvas(false);
    openInspector("parameters");
    setParametersExpanded(true);
    setConversationEditing(false);
    setEditingFieldId(field.id);
    /* 单项修改那张卡一出来就是展开的——他刚点了「去填」，不用再点一下才看得见。
       但它跟收集卡一样能折：点卡头、点别处都收（见 ParameterTaskCard）。 */
    setParamsOpen(true);
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
      const nextFields = applyDmpkApplicability(fields.map((field) => {
        const draft = sentTabs.find((tab) => tab.fieldId === field.id);
        return draft ? withValue(field, draft.value) : field;
      }));
      setFields(nextFields);
      /* 人亲手选过发过的，就是确认过的。 */
      setFieldStatus((current) => ({ ...current, ...Object.fromEntries(sentTabs.map((tab) => [tab.fieldId, "confirmed" as const])) }));
      const remaining = nextFields.filter((field) => field.required && !field.value);
      const nextGroup = dmpkGroups.find((group) => remaining.some((field) => field.group === group.id))?.id;
      const before = summarizeLines(buildDmpkQuoteLines(fields, sources, lineOptions), manualPrices);
      const pricing = summarizeLines(buildDmpkQuoteLines(nextFields, sources, lineOptions), manualPrices);
      const pricingNote = pricing.packages.length ? `${pricingSentence(pricing)}。` : "";
      /* 影响提示（P0 转换确认模块首期必须展示的一项）：这一改动了哪些板块、几行、合计从多少到多少。
         账前后各算一遍比一比就有，不用另存"依赖图"。 */
      const impact = impactSentence(before, pricing, manualPrices);
      setDraftTabs([]);
      setEditingFieldId(null);
      if (nextGroup) {
        setActiveGroup(nextGroup);
        setOpenGroups({ assay: nextGroup === "assay", animal: nextGroup === "animal", analysis: nextGroup === "analysis", delivery: nextGroup === "delivery" });
        setStage("collecting");
        appendRun("params", remaining.length);
        appendMessage("agent", `已更新报价参数。${impact}${pricingNote}${missingFieldHint(remaining)}`);
      } else {
        setStage("ready");
        appendRun("params");
        appendMessage("agent", `计价关键字段已齐全。${impact}${pricingNote}请进行报价前确认，确认后生成 Word 报价单和 Excel 报价明细。`);
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
    if (stage === "thinking" || stage === "generating") return;
    /* 挂了文件就先读文件。不打字也能发——传一份方案本身就是完整的一句话。
       原来这里 !text 直接 return，附件挂着按发送等于没按。 */
    if (attachments.some((item) => item.kind === "file")) {
      setConversationEditing(false);
      handleSources(consumeAttachments() ?? [], text);
      return;
    }
    if (!text) return;
    /* 「列一下这单用的价目 / 命中了哪些价 / 用了哪几档单价」——回一张表。
       只认「本单 / 这单 / 命中 / 用到」+「价目 / 单价 / 价格」这种组合，
       免得「报告费改成 3500」这种改价的话也被截走。 */
    if (/(?:本单|这单|当前|命中|用到|用了|列)[^。]*(?:价目|单价|价格)|(?:价目|单价|价格)[^。]*(?:命中|用到|用了|列)/.test(text) && !/改|调|换成|变成/.test(text)) {
      setComposerText("");
      setConversationEditing(false);
      listCatalogHits(text);
      return;
    }
    /* 「我说过了 / 已经提供过 / 核对一下」——回去翻，不再问一遍。 */
    if (/(?:提供|说|给|发|传)过|核对(?:一下)?(?:已有|信息)?|重新计算/.test(text)) {
      appendMessage("user", text, consumeAttachments());
      setComposerText("");
      setConversationEditing(false);
      recheckSources(text);
      return;
    }
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

  /**
   * 会话摘要：从当前状态推出来的四段话，钉进消息流。
   * ----------------------------------------------------------------------
   * 不是问数字同事「你总结一下」——它没有比台账更多的信息。所以不等、不转圈，
   * 点了就有。它的价值在两处：补了六七轮之后回头看「现在到哪儿了」；
   * 以及交接时说明栏有现成的话，接手的人要的正是这几句。
   */
  const summarizeSession = () => {
    const confirmed = fields.filter((field) => field.value).map((field) => `${field.label} ${field.value}`);
    const pending = missingFields.map((field) => field.label);
    const catalogGaps = sources.flatMap((source) => source.pending).filter((item) => item.kind === "catalog").length;
    const latestVersion = quoteVersions[quoteVersions.length - 1]?.label ?? "v1";
    /* 有账就报账：已计价多少、多少没算出来。没账（没传过方案）才退回阶段描述。 */
    const ledgerLine = quoteSummary.packages.length ? pricingSentence(quoteSummary) + (quoteSummary.manualCount ? `；${quoteSummary.manualCount} 项临时价` : "") : "";
    const pricing = stage === "generated"
      ? `报价单 ${latestVersion} 已生成，Word 与 Excel 金额校验一致${ledgerLine ? `；${ledgerLine}` : ""}`
      : ledgerLine
        ? ledgerLine
        : stage === "ready"
          ? "参数已齐全，等待确认后生成报价单"
          : `尚未计价：还缺 ${pending.length} 项参数${catalogGaps ? `，另有 ${catalogGaps} 项没有价目` : ""}`;
    const next = handedOff
      ? "已交接，等待对方复核"
      : stage === "generated"
        ? "交给下一个人审核"
        : stage === "ready"
          ? "预览参数后生成报价单"
          : pending.length
            ? `补齐 ${pending.slice(0, 3).join("、")}${pending.length > 3 ? " 等" : ""}`
            : "确认参数";
    const summary: DmpkSessionSummary = { confirmed, pending, pricing, next };
    setMessages((items) => [...items, { id: `summary-${Date.now()}-${items.length}`, role: "summary", text: "会话摘要", summary }]);
    /* 有账时「无价目」的数已经在 pricing 那句里（按行数）；再按待处理项数说一遍，
       同一件事会出现两个不同的数——4 组免疫分型采血是 4 个待处理项、1 行账。 */
    setHandoffNote(`已确认 ${confirmed.length} 项参数；${pricing}。${!ledgerLine && catalogGaps ? `${catalogGaps} 项无价目未计入，请复核。` : quoteSummary.unpricedCount ? "未计价行请复核。" : ""}`.trim());
  };

  /**
   * 「这单用了哪些价」——在对话里回一张表。
   * ----------------------------------------------------------------------
   * 会议共识 2 是**完整**价目表不进对话；这里回的是本单命中的那一小截，跟去后台翻整表是两件事，
   * 所以 SD 助理也能问。板块底部有一颗按钮，对话里说「列一下本单用的价目」也走这儿。
   * 跟会话摘要一样是从账上推的，不等、不转圈。
   */
  const listCatalogHits = (userText?: string) => {
    appendMessage("user", userText ?? "列出本单命中的价目");
    const hits = catalogHitsFor(quoteLines, manualPrices);
    if (!hits.length) {
      appendMessage("agent", "这单还没有账——先说一下检测类型和动物、周期，或者传一份方案，我再把用到的价目列出来。");
      return;
    }
    const manual = hits.filter((hit) => hit.status === "manual").length;
    const missing = hits.filter((hit) => hit.status === "no-catalog").length;
    const text = `本单命中 ${hits.length - missing} 档价目（价目表 v1.0.13）${manual ? `，其中 ${manual} 档用了临时价、仅作用于本单` : ""}${missing ? `；另有 ${missing} 项系统没有价目，待补价` : ""}。完整价目表在报价管理里${permissions.canViewCatalog ? "，右栏板块底部可以直接进" : "（SD 入口）"}。`;
    setMessages((items) => [...items, { id: `agent-${Date.now()}-${items.length}`, role: "agent", text, catalogHits: hits }]);
  };

  /**
   * 把文件认出来的那些一次性点头。
   * 逐项确认的路也在——铅笔改一项、参数卡发一轮，都算确认；这颗是给
   * 「我核过了，没问题」的人用的，不用为了确认而把十一项各点一遍。
   */
  const confirmRecognized = () => {
    if (!recognizedFields.length) return;
    const count = recognizedFields.length;
    setFieldStatus((current) => {
      const next = { ...current };
      for (const field of recognizedFields) next[field.id] = "confirmed";
      return next;
    });
    appendMessage("user", `确认文件识别的 ${count} 项参数：${recognizedFields.map((field) => `${field.label} ${field.value}`).join("、")}。`);
    appendMessage("agent", `已确认 ${count} 项识别结果。${missingFieldHint(missingFields)}`);
  };

  /**
   * 核对已有信息并重新计算。
   * ----------------------------------------------------------------------
   * 人说「我说过了」的时候，系统该做的是回去翻，而不是再问一遍。翻两处：
   * 传过的材料（按来源，能找回的带原句）、说过的话（一句话识别再跑一遍）。
   * 找得回的补上；找不回的**明说**「材料和对话里都没有」——承认识别器会漏，
   * 但不假装找到了。整个过程是一条运行记录，翻了什么、找回几项都留痕。
   */
  const recheckSources = (triggerText?: string) => {
    /* 从对话触发时，触发它的那句还没进 messages（闭包里是旧的）——它本身也可能带信息
       （「报价区域国内，其他的我说过了，核对一下」），一并读。 */
    const userTexts = [...messages.filter((message) => message.role === "user" && message.text.trim()).map((message) => message.text), ...(triggerText ? [triggerText] : [])];
    const textPatch = userTexts.reduce<Record<string, string>>((acc, text) => ({ ...acc, ...parseDmpkRequest(text) }), {});
    const missing = fields.filter((field) => field.required && !field.value);
    const found = missing.flatMap((field) => {
      const provider = [...sources].reverse().find((source) => source.patch[field.id] !== undefined);
      if (provider) {
        const quoteRef = provider.patchSources?.[field.id];
        return [{
          field,
          value: provider.patch[field.id],
          from: `${provider.sourceLabel}${quoteRef ? ` · ${quoteRef.anchor}` : ""}`,
          documentSource: quoteRef ? { kind: "document" as const, sourceId: provider.sourceId, sourceLabel: provider.sourceLabel, anchor: quoteRef.anchor, quote: quoteRef.quote } : undefined,
        }];
      }
      if (textPatch[field.id]) return [{ field, value: textPatch[field.id], from: "对话", documentSource: undefined }];
      return [];
    });
    const stillMissing = missing.filter((field) => !found.some((hit) => hit.field.id === field.id));
    const readable = sources.filter((source) => source.role !== "unknown");
    const steps = [
      { id: "sources", title: "重扫材料", result: sources.length ? `${sources.length} 份 · ${readable.length} 份可读` : "没有传过材料", anchor: readable.map((source) => source.sourceLabel).join("、") || undefined, tech: `sources=${sources.length}  readable=${readable.length}` },
      { id: "chat", title: "回读对话", result: `${userTexts.length} 条`, tech: `messages=${userTexts.length}  parser=nlp-slot-filler/v3` },
      { id: "compare", title: "逐项比对", result: missing.length ? `缺 ${missing.length} 项 · 找回 ${found.length} 项 · 仍缺 ${stillMissing.length} 项` : "14 项都有值，没有要补的", tech: `missing=${missing.length}  recovered=${found.length}` },
    ];
    setStage("thinking");
    steps.forEach((_, index) => {
      window.setTimeout(() => setLiveParse({ text: "正在核对已有信息", runSteps: steps.slice(0, index + 1) }), 320 * index);
    });
    window.setTimeout(() => {
      setLiveParse(null);
      if (found.length) {
        setFields((items) => items.map((field) => {
          const hit = found.find((entry) => entry.field.id === field.id);
          return hit ? withValue(field, hit.value, hit.documentSource) : field;
        }));
        setFieldStatus((current) => ({
          ...current,
          ...Object.fromEntries(found.filter((hit) => hit.documentSource).map((hit) => [hit.field.id, "recognized" as const])),
        }));
      }
      setMessages((items) => [...items, { id: `run-${Date.now()}-${items.length}`, role: "run", text: "已核对已有信息", runSteps: steps }]);
      const scanned = `核对了 ${sources.length} 份材料和 ${userTexts.length} 条对话`;
      if (!missing.length) {
        appendMessage("agent", `${scanned}：参数都齐了，没有需要补的。`);
        setStage("ready");
        return;
      }
      const recovered = found.length ? `补上 ${found.map((hit) => `${hit.field.label} ${hit.value}（来自 ${hit.from}）`).join("、")}。` : "";
      const remainder = stillMissing.length ? `${found.length ? "仍缺" : "这几项材料和对话里都没有"}：${stillMissing.map((field) => field.label).join("、")}，请直接补充。` : "参数已齐全。";
      appendMessage("agent", `${scanned}。${recovered}${remainder}`);
      setStage(stillMissing.length ? "collecting" : "ready");
    }, 320 * steps.length + 200);
  };

  /**
   * 临时调价。只作用于这一单：写进会话自己的 manualPrices，价目表不动。
   * 每一次改动都进对话——报价复核是算术，改过哪一档单价必须能翻到。
   */
  const setManualPrice = (lineId: string, price: number) => {
    const line = quoteLines.find((item) => item.id === lineId);
    if (!line || !Number.isFinite(price) || price < 0) return;
    /* 2026-09-21 会议：改价是临时调价的唯一路径，权限分级后置——谁改就记谁。 */
    setManualPrices((current) => ({ ...current, [lineId]: { price, by: viewerName ?? MANUAL_PRICE_BY, at: "刚刚" } }));
    appendMessage("agent", line.catalogPrice !== undefined
      ? `已按临时价 ${formatCny(price)} / ${line.unit} 记「${line.service}」（原价 ${formatCny(line.catalogPrice)}），仅本次报价，价目表不动。`
      : `已按你补的 ${formatCny(price)} / ${line.unit} 记「${line.service}」（系统无价目），仅本次报价。`);
  };
  const clearManualPrice = (lineId: string) => {
    const line = quoteLines.find((item) => item.id === lineId);
    setManualPrices((current) => {
      const next = { ...current };
      delete next[lineId];
      return next;
    });
    if (line) appendMessage("agent", `「${line.service}」已恢复价目表单价${line.catalogPrice !== undefined ? ` ${formatCny(line.catalogPrice)}` : ""}。`);
  };

  /**
   * 人工调整项：折扣、其他费用（P0 第五层）。作用在合计上，只在本单。
   * value 为 null = 清掉。每一次也进对话——它跟临时价一样是复核时要翻到的数。
   */
  const setAdjustment = (kind: keyof QuoteAdjustments, value: number | null) => {
    setAdjustments((current) => {
      const next = { ...current };
      if (value === null || !Number.isFinite(value)) delete next[kind];
      else next[kind] = value;
      return next;
    });
    const label = kind === "discount" ? "折扣" : "其他费用";
    appendMessage("agent", value === null
      ? `已去掉本单的${label}。`
      : kind === "discount"
        ? `已按 ${value} 折记本单折扣（人工调整项，作用于合计，仅本次报价）。`
        : `已记本单其他费用 ${formatCny(value)}（人工调整项，仅本次报价）。`);
  };

  /**
   * 生成 / 重出。同一条路：第一次叫「首次生成」，改过参数或单价之后再来叫「重出」。
   * 版本记录上写清楚是哪种——返工场景里「出过第二版」本身就是要给人看的信息，
   * 改单价重出也一样。
   */
  const runGeneration = (origin: string, userText: string) => {
    setPreviewOpen(false);
    setParametersExpanded(false);
    setStage("generating");
    suggestPanel("process");
    /* 「确认并生成」：还挂着「识别」的这一下全部算确认。不另设门槛（P0-3），
       但按钮上写明了，所以这不是静默确认。 */
    if (recognizedFields.length) {
      setFieldStatus((current) => {
        const next = { ...current };
        for (const field of recognizedFields) next[field.id] = "confirmed";
        return next;
      });
    }
    appendMessage("user", userText);
    const snapshot = snapshotOf(fields, manualPrices);
    window.setTimeout(() => {
      setStage("generated");
      setGeneratedSnapshot(snapshot);
      suggestPanel("artifacts");
      /* 带着退回进来时 v1 已经种下（就是被退回的那一版），
         所以这里追加的自然是 v2；从零开始的会话则是 v1。 */
      pushQuoteVersion(origin);
      appendRun("quote");
      appendMessage("agent", `报价单已${origin === "首次生成" ? "生成" : "重新生成"}。Word 与 Excel 金额校验一致${quoteSummary.packages.length ? `，${pricingSentence(quoteSummary)}` : ""}。`);
      appendMessage("artifacts", "");
    }, 1800);
  };

  const startGeneration = () => {
    const origin = rework ? `按 ${reworkNotes.length} 条批注重出` : quoteVersions.length ? "改参数后重出" : "首次生成";
    runGeneration(origin, recognizedFields.length ? `确认参数（含 ${recognizedFields.length} 项文件识别结果），生成正式报价单。` : quoteVersions.length ? "参数已更新，重新生成报价单。" : "确认参数，生成正式报价单。");
  };

  /** 改了单价但没改参数：stage 还停在 generated，参数卡不会再弹，出口就是这颗。 */
  const regenerateQuote = () => {
    if (stage === "generating" || stage === "thinking") return;
    runGeneration("改动后重出", "按最新参数和单价重新生成报价单。");
  };

  /**
   * 「+ › 技能」里那一列：让数字同事现在就做的事。
   * 每一条都是对话里一句话能触发的（「总结一下」「列出本单价目」「我说过了」），
   * 这一列只是把它们摆出来给人看——不知道能说什么的人，从这儿挑。
   * 做不了的不藏，灰掉并写原因：没账就列不出价目，没到 ready 就生成不了。
   */
  const busy = stage === "thinking" || stage === "generating";
  const sessionActions: ComposerSessionAction[] = [
    { id: "summarize", label: "总结当前会话", meta: "已确认 · 待补 · 计价到哪儿 · 下一步", run: summarizeSession, disabled: busy },
    { id: "catalog-hits", label: "列出本单命中的价目", meta: "回一张表：费用项目 · 单价 · 用量", run: () => listCatalogHits(), disabled: busy || !quoteLines.length, disabledReason: "这单还没有账" },
    { id: "recheck", label: "核对已有信息并重新计算", meta: "回去翻材料和对话，不再问一遍", run: () => recheckSources(), disabled: busy || stage === "idle", disabledReason: "还没开始收参数" },
    { id: "preview", label: "预览完整参数与计价规则", run: () => setPreviewOpen(true), disabled: stage === "idle", disabledReason: "还没开始收参数" },
    quoteVersions.length
      ? { id: "regenerate", label: "重新生成报价单", meta: quoteStale ? "参数或单价改过，出的那版已经旧了" : "眼前的账和出的那版一致", run: regenerateQuote, disabled: busy || !quoteStale, disabledReason: "没有改动，不用重出" }
      : { id: "generate", label: "生成报价单", meta: "Word 报价单 + Excel 报价明细", run: startGeneration, disabled: stage !== "ready", disabledReason: "参数还没齐" },
  ];

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

  /* 账一有行，右栏就切到「报价板块」——会议定的右栏正主是它。只切第一次，
     之后人点了别的 tab 就不再抢（suggestPanel 自己会看 tabPinnedByUser）。 */
  const hadLinesRef = useRef(false);
  useEffect(() => {
    const hasLines = quoteLines.length > 0;
    if (hasLines && !hadLinesRef.current) suggestPanel("sections");
    hadLinesRef.current = hasLines;
    // suggestPanel 每次渲染都是新函数，但它只读 ref 和一个 state，不需要进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteLines.length]);

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
    sources,
    fieldStatus,
    quoteLines,
    manualPrices,
    onSetManualPrice: setManualPrice,
    onClearManualPrice: clearManualPrice,
    adjustments,
    onSetAdjustment: setAdjustment,
    quoteStale,
    onRegenerate: regenerateQuote,
    onRecheck: recheckSources,
    /* 权限（演示级，壳层按账号级别推）：板块里能不能改价，完整价目表那扇门给不给。
       SD 助理看到的是一行灰字说明，不是按钮。 */
    permissions,
    onOpenCatalog: onOpenQuotationManagement ? () => onOpenQuotationManagement({ business: "dmpk", tab: "prices" }) : undefined,
    onOpenBackOffice: onOpenQuotationManagement ? (tab) => onOpenQuotationManagement({ business: "dmpk", tab }) : undefined,
    reworkBy: rework?.by,
    reworkAt: rework?.at,
    reworkReason: rework?.reason,
    /* expanded 的意思是「这一栏放得下报价单那张纸」，不是「面板全屏了」。
       并列之前两者等价，现在不了：全屏 + 并列时每一列还是三五百像素，
       纸摆进去照样读不了。

       实测过的后果是**反的**：批注列在全屏并列时会去显示那张读不了的纸，
       同时把真正读得了的批注列表藏起来。

       所以只要摊了列就一律按窄的算——列宽由外壳按可用宽度分配，
       这里拿不到也不该拿具体像素，「有没有并列」是够用的判据。 */
    expanded: panelFocus && columnPanelIds.length === 0,
    quoteVersions,
  });
  /* 参数面板只负责改「参数的值」——逐项点编辑图标即可。
     改规则不属于这里，「对话编辑」已经移到报价规则面板。 */
  const railPanels = inspectorPanels.map((panel) => panel.id !== "parameters" ? panel : {
    ...panel,
    content: (
      <>
        <div className="paramPanelToolbar">
          <span>
            <strong>报价参数</strong>
            <em>{quoteStale
              ? "待重新生成"
              : recognizedFields.length
                ? `${recognizedFields.length} 项待确认`
                : missingFields.length
                  ? `${missingFields.length} 项待补充`
                  : stage === "generating" ? "生成中" : "已齐全"}</em>
          </span>
          {recognizedFields.length && stage !== "generating" && stage !== "generated" ? (
            <button type="button" className="paramConfirmAllButton" onClick={confirmRecognized}>
              确认全部识别项
            </button>
          ) : null}
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

  /* 新消息要能看见。这条一直缺着——会话短的时候看不出来，超过一屏之后
     新消息全落在折叠线以下，而屏幕上什么都没变。 */
  useStickToBottom(chatScrollerRef, [messages, stage]);

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
          {/* 摘要入口在这儿，不在 composer 那一排：那一排是「你要发什么」，
              摘要是「我想看看到哪儿了」。跟面板开关同一副长相、同一档尺寸。 */}
          <div className="dmpkTopbarTools">
            <button
              type="button"
              className="tumorInspectorToggle"
              title="总结当前会话"
              aria-label="总结当前会话"
              disabled={stage === "thinking" || stage === "generating"}
              onClick={summarizeSession}
            >
              <ScrollText size={16} />
            </button>
            <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} />
          </div>
        </header>
        {!reworkCanvas ? <SessionMinimap scrollerRef={chatScrollerRef} /> : null}
        {reworkCanvas && rework ? (
          /* 中间这块画布 = 要核对的原件，**只读**。
             右侧面板照旧在，但底部没有输入框——要改就收起画布，
             改和确认都回到主对话那一路。 */
          <section className="dmpkReworkCanvas" aria-label="退回批注">
            {/* 驳回理由收进标题块里，不再单开一条通栏。
                原来是「标题 / 理由条 / 形态切换」三段各占一行，纸面被压到 225px
                才开始——而纸面才是这一屏要看的东西。 */}
            <header>
              <div>
                <strong>{rework.by} 退回了这一版</strong>
                <small>{rework.at} · 共 {reworkNotes.length} 条批注{reworkNotes.filter((note) => note.severity === "blocking").length ? `，其中 ${reworkNotes.filter((note) => note.severity === "blocking").length} 条必须修订` : ""}</small>
                {rework.reason ? <p className="dmpkReworkReason">{rework.reason}</p> : null}
              </div>
              {/* 收起来：对话回到中间，退回批注变回面板里的一个 tab。 */}
              <button type="button" onClick={() => { setReworkCanvas(false); openInspector("rework"); }} aria-label="收起画布，回到对话" title="收起画布，回到对话">
                <Minimize2 size={15} />
              </button>
            </header>
            <AnnotatedQuote notes={reworkNotes} className="isPanel" />
          </section>
        ) : (
          <div className="dmpkChatScroller" ref={chatScrollerRef}><PriorSessionHistory snapshots={priorSessionSnapshots} /><DmpkConversation messages={messages} stage={stage} currentMissing={missingFields} handoffNotice={handoffNotice} liveRun={liveParse} onOpenInspector={openInspector} onArtifactPreview={setArtifactPreview} /></div>
        )}
        <DmpkComposer paramsOpen={paramsOpen} onParamsOpenChange={setParamsOpen} unresolvedNotes={reworkNotes
          .filter((note) => !noteAnchorToField[note.anchorId])
          .map((note) => ({ anchorId: note.anchorId, label: quoteAnchorLabel(note.anchorId) }))} /* 这张卡在「这一轮改完」之前一直在。
             以前条件里还有 !reworkCanvasSeen：画布看过一次它就永久退场，
             因为那时它只是画布的入口，领完路就该让开。
             现在它承载的是「按 N 条批注修订」这件待办——
             人瞄了一眼原件，待办并没有完成，不该跟着消失。

             但**动手的时候它得让开**：输入框上方只有一个槽位，
             两件事叠在那儿，人不知道先做哪个。两种「正在动手」都要挡——
               composerFields.length  参数卡正开着，在选值
               draftTabs.length       值已经选进 chips，等着一起发
             漏掉后一条的后果是：选完一个值，这张卡又压回 chips 上面。 */
        reworkNotice={rework && !reworkSettled && !reworkCanvas && !composerFields.length && !draftTabs.length ? (
          <DmpkReworkNoticeCard
            total={reworkNotes.length}
            blocking={reworkNotes.filter((note) => note.severity === "blocking").length}
            onOpenCanvas={() => setReworkCanvas(true)}
          />
        ) : null} editProposal={editProposal} viewerName={viewerName} handoffDone={handedOff} handoffNote={handoffNote} onHandoff={(to, note) => { handOff(to, note); onHandoff?.({ to, kind: "dmpk-quotation", title: `请复核：${taskTitle}`, note, attachments: [
          { id: "quote-word", name: `${taskTitle}_报价单.docx`, meta: "Word · 管理费 30%" },
          { id: "quote-excel", name: `${taskTitle}_报价明细.xlsx`, meta: "Excel · 管理费 15%" },
        ] }); }} onConfirmCurrentPrice={() => {
          /* 对话里改报告费，和明细里改单价是**同一件事**，写进同一张 manualPrices——
             有账的时候走那条路，账上的报告行跟着变；没账（没传过方案）才只说一句话。 */
          const nextPrice = editProposal?.kind === "current-price" ? editProposal.nextPrice : 2500;
          if (quoteLines.some((line) => line.id === "report")) setManualPrice("report", nextPrice);
          else appendMessage("agent", `已将本次报价的报告费调整为 ¥${nextPrice.toLocaleString()}，仅对当前项目生效，并已保留调整记录。`);
          setEditProposal(null);
        }} onOpenRuleManagement={() => { if (editProposal?.kind === "global-rule") onOpenQuotationManagement?.({ business: "dmpk", tab: "rules", draft: editProposal.request }); }} attention={composerAttention} conversationEditing={conversationEditing} stage={stage} recognizedCount={recognizedFields.length} hasQuote={quoteVersions.length > 0} quoteStale={quoteStale} onRegenerate={regenerateQuote} text={composerText} setText={setComposerText} activeGroup={activeGroup} fields={composerFields} allFields={fields} mode={editingField ? "edit" : "collect"} draftTabs={draftTabs} onSelect={addDraft} onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))} onSend={submitComposer} onPreview={() => setPreviewOpen(true)} onGenerate={startGeneration} onOpenInspector={openInspector} coworkers={businessCoworkers} coworkerLocked={stage !== "generated"} activeCoworkerId={activeCoworkerId} onCoworkerChange={(id) => id !== activeCoworkerId && setPendingCoworkerId(id)} pendingCoworkerId={pendingCoworkerId} onConfirmCoworkerChange={() => { if (pendingCoworkerId) onCoworkerChange(pendingCoworkerId); setPendingCoworkerId(null); }} onCancelCoworkerChange={() => setPendingCoworkerId(null)} projectName={projectName} attachments={attachments} onAttachmentsChange={setAttachments} sessionActions={sessionActions} disabled={stage === "thinking" || stage === "generating" || (stage === "collecting" && composerFields.length > 0 && !composerText.trim() && !attachments.some((item) => item.kind === "file")) || (!draftTabs.length && !composerText.trim() && !attachments.some((item) => item.kind === "file"))} />
        <WorkbenchPanelBody
          panels={railPanels}
          visibleIds={visiblePanelIds}
          onVisibleIdsChange={setVisiblePanelIds}
          activePanelId={inspectorPanelId}
          hintIds={panelHintIds}
          open={panelOpen}
          focus={panelFocus}
          onFocusChange={setPanelFocus}
          /* 退回处理这一屏要「边看批注边改参数」，所以允许并列。
             排不排得下由量出来的宽度说了算，不是这里说了算。 */
          columnIds={columnPanelIds}
          onColumnIdsChange={setColumnPanelIds}
          onPanelChange={(panelId) => {
            setTabPinnedByUser(true);
            setPanelHintIds((ids) => ids.filter((id) => id !== panelId));
            setInspectorPanelId(panelId as DmpkInspectorPanelId);
          }}
        />
        {/* 画布态**不再有输入框**。
            原来这里是 `panelFocus || reworkCanvas`：画布铺满时把对话收成药丸，
            再把参数卡和 chips 塞进药丸，好让「读原件 / 改参数 / 确认」三样同屏。
            那一套联动做得起来但很脆，而且它把三件性质不同的活压在了一屏里。

            现在改成读改分离：画布只负责读，要改就先收起画布——
            点参数的「编辑」会自动收起（见 startEditingField）。
            面板全屏那条路仍然需要药丸：那时中间列整个让给了面板，
            对话没有别的落脚点。 */}
        {panelFocus ? (
          <FloatingChatDock
            /* 面板全屏时，要当场做的那个决定跟着输入框走：
               用户在右侧参数收集里点了「改这一项」，卡片本来长在 composer 上，
               而 composer 此刻被面板盖住——点了等于没反应。 */
            chips={draftTabs.length ? <ComposerChipTray tabs={draftTabs} onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))} /> : null}
            card={composerFields.length ? (
              <DmpkParameterTaskCard
                activeGroup={activeGroup}
                fields={composerFields}
                allFields={fields}
                draftTabs={draftTabs}
                mode={editingField ? "edit" : "collect"}
                open={paramsOpen}
                onOpenChange={setParamsOpen}
                onSelect={addDraft}
              />
            ) : null}
            /* 浮动对话只放人和数字同事说的话:那个小窗是用来接着聊的,
               把运行记录也塞进去只会把仅有的几行挤掉。 */
            messages={messages.filter((message) => message.role === "user" || message.role === "agent") as { id: string; role: "user" | "agent"; text: string }[]}
            text={composerText}
            onTextChange={setComposerText}
            onSend={submitComposer}
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
          /* 有账的会话看到的是自己的账折成的纸；退回会话没有账，纸面是批注锚着的固定件。 */
          paper={quotePaper}
          onClose={() => setArtifactPreview(null)}
        />
      ) : null}
    </>
  );
}
