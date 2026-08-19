"use client";

import { Check, ChevronLeft, ChevronRight, Columns2, Download, FileText, Highlighter, Maximize2, Minimize2, Send, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingChatDock } from "../../components/workbench-panel/FloatingChatDock";
import { PanelToggle, WorkbenchPanelBody } from "../../components/workbench-panel/WorkbenchPanel";
import { ActivityChain, AgentReply, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { CoworkerSelector } from "../../components/workbench-shell/CoworkerSelector";
import { InlineSelect } from "../../components/workbench-shell/InlineSelect";
import { SessionMinimap } from "../../components/workbench-shell/SessionMinimap";
import { WorkbenchComposer } from "../../components/workbench-shell/WorkbenchComposer";
import { Button, StatusChip, type StatusTone } from "../../components/ui";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { AgentModuleSessionProps } from "../types";
import { getQaReviewPanels, type QaViewerRole } from "./panels";
import {
  changedFields,
  diffBetween,
  formatPageRef,
  pageValues,
  qaChatOpening,
  qaCurrentVersionId,
  qaDocument,
  qaFindings,
  qaInitialNotes,
  qaPageFields,
  qaVersions,
  resolveQaReply,
  type QaChatMessage,
  type QaFinding,
  type QaFindingState,
  type QaNote,
} from "./reviewData";
import type { SessionOutcome } from "../types";

/* 人工批注默认落在纸面的哪个字段上。划词时没有真 PDF 的坐标，
   所以按当前页给一个锚点，让它跟 AI 那批一样能在纸上被标出来。 */
const humanAnchorByPage: Record<number, string> = {
  1: "样品名称",
  2: "页码标记",
  3: "样品名称",
  4: "检测依据",
  5: "页码标记",
  6: "留样说明",
  7: "盖章日期",
};

type QaPoppedPanelId = "document" | "ai-diff";

/** 邮件进来那一次跑批的消息 id。跑完要按 id 找回它把 running 关掉 */
const QA_MAIL_RUN_ID = "qa-mail-run";

const versionTone: Record<string, StatusTone> = {
  draft: "neutral",
  review: "running",
  rejected: "danger",
  approved: "success",
  archived: "neutral",
};

const versionStatusLabel: Record<string, string> = {
  draft: "草稿",
  review: "待审批",
  rejected: "已驳回",
  approved: "已通过",
  archived: "已归档",
};

const roleTitle: Record<QaViewerRole, string> = {
  author: "撰写人端",
  approver: "审批人端",
  owner: "负责人端",
};

export default function QaReviewSession({ projectName, taskTitle, initialRequest, viewerRole = "approver", coworkers, activeCoworkerId, onCoworkerChange, onComposeMail, sessionOutcome, onSessionOutcomeChange }: AgentModuleSessionProps) {
  const role = viewerRole as QaViewerRole;
  const [panelOpen, setPanelOpen] = useState(true);
  const [activePanelId, setActivePanelId] = useState("ai-review");
  const [visiblePanelIds, setVisiblePanelIds] = useState(["document", "ai-review", "ai-diff", "notes"]);
  /* 从收件箱进入默认把文档弹到主位；收回后主位恢复为标准 chatflow。 */
  const [poppedPanelId, setPoppedPanelId] = useState<QaPoppedPanelId | null>(initialRequest ? null : "document");
  const [versionId, setVersionId] = useState(qaVersions[0].id);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [findingStates, setFindingStates] = useState<Record<string, QaFindingState>>({});
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<QaNote[]>(qaInitialNotes);
  const [noteDraft, setNoteDraft] = useState("");
  /* 审批人划词写的批注。默认是「缺陷」——进问题清单、跟 AI 那批同一类对象，
     下一版要逐条验证改没改；勾成「仅记录」才落到审批备注里。
     两者不是一回事：备注是一条时间线，答不了"上一版提的那条解决了吗"。 */
  const [humanFindings, setHumanFindings] = useState<QaFinding[]>([]);
  const [annotation, setAnnotation] = useState<{ quote: string; top: number } | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [annotationKind, setAnnotationKind] = useState<"defect" | "note">("defect");
  /* 批注是一个**模式**，不是"选中就弹"。不分模式的话，想复制一段文字、
     想双击选个词，都会被一张卡打断——而读原件的时间远多于写批注的时间。
     进了模式光标变十字、纸面透出一层底色，你知道自己现在在批注。 */
  const [annotateMode, setAnnotateMode] = useState(false);
  /* 比对不是另一个 tab，是**文档多开了一栏**：版本既然是文档的属性，
     "跟哪一版比"就只能是文档自己的事。null = 单栏。 */
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [syncScroll, setSyncScroll] = useState(true);
  const baseVersionId = compareWith ?? qaVersions.find((item) => item.id === qaCurrentVersionId)?.comparedAgainst ?? "v2";
  /* 结论存在 shell 上，按任务保存。切走再切回时组件会重新挂载——
     结论留在本地 state 里等于点完就没了，而回到会话第一眼要看的
     恰恰是"这一版审完了没有"。 */
  const outcome = sessionOutcome ?? null;
  const setOutcome = (next: SessionOutcome) => onSessionOutcomeChange?.(next);
  /* 驳回必须写理由。GxP 场景下无理由驳回不该能提交——撰写人拿到一句
     「驳回」什么也做不了，下一版大概率还是错的。 */
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [chatMessages, setChatMessages] = useState<QaChatMessage[]>(initialRequest ? [{
    id: "qa-mail-upload",
    role: "user",
    text: "审批流转邮件已接收，请审核随附报告。",
    attachments: [{ id: "mail-report", kind: "file", label: qaDocument.title, meta: "来自收件箱 · 第一版", origin: "library" }],
  }] : qaChatOpening);
  const [mailReviewRunning, setMailReviewRunning] = useState(Boolean(initialRequest));
  const chatScrollerRef = useRef<HTMLDivElement>(null);
  const [chatText, setChatText] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ComposerAttachment[]>([]);

  const version = qaVersions.find((item) => item.id === versionId) ?? qaVersions[0];
  /* AI 的和人工的是同一个清单。合并在这里做一次，下面所有计数、面板、
     决策卡的门禁全部读它——分两处各算各的，迟早对不上。 */
  const allFindings = useMemo(() => [...qaFindings, ...humanFindings], [humanFindings]);
  const openFindings = allFindings.filter((finding) => (findingStates[finding.id] ?? "open") === "open").length;
  const businessCoworkers = coworkers.filter((coworker) => coworker.id !== "bioaz-helper");

  /* 不用 ref 做"只跑一次"的闸。ref 会活过 StrictMode 的二次挂载，而 timer 不会——
     第一遍排了 timer、cleanup 清掉、第二遍因为 ref 已是 true 直接返回，于是
     timer 永远不再排，跑批卡在"处理中"、结论那条消息永远不来。
     改成：状态更新按固定 id 幂等，timer 每次都重排。 */
  useEffect(() => {
    if (!initialRequest) return;
    /* 执行链作为一条消息进时间线，而不是渲染在列表外面。跑完它折叠、留下，
       不再整条消失——审批人要能回头看这一版当时是怎么跑的。 */
    setChatMessages((current) => current.some((message) => message.id === QA_MAIL_RUN_ID) ? current : [
      ...current,
      { id: "qa-mail-accepted", role: "agent", text: "已接收邮件上下文和报告原件。我会先校验版本与页码，再执行时间逻辑、内容一致性和版式检查。" },
      {
        id: QA_MAIL_RUN_ID,
        role: "run",
        text: "正在审核报告",
        running: true,
        steps: ["读取邮件要求与附件版本", "核对 7 页正文与页码", "校验时间逻辑与内容一致性", `生成 ${qaFindings.length} 条可定位审核意见`],
        doneTitle: `已完成${qaVersions[0].label}审核`,
      },
    ]);
    const timer = window.setTimeout(() => {
      setMailReviewRunning(false);
      setChatMessages((current) => {
        const settled = current.map((message) => (message.id === QA_MAIL_RUN_ID ? { ...message, running: false } : message));
        const summaryId = `mail-${qaChatOpening[0].id}`;
        if (settled.some((message) => message.id === summaryId)) return settled;
        return [...settled, ...qaChatOpening.map((message) => ({ ...message, id: `mail-${message.id}` }))];
      });
      setPoppedPanelId("document");
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [initialRequest]);

  /* Esc 先收卡片、再退模式。一次退两层会让人以为自己点错了。 */
  useEffect(() => {
    if (!annotateMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (annotation) { setAnnotation(null); window.getSelection()?.removeAllRanges(); return; }
      setAnnotateMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotateMode, annotation]);

  const sendChat = () => {
    const question = chatText.trim();
    if (!question) return;
    const stamp = Date.now();
    setChatMessages((current) => [
      ...current,
      { id: `qa-chat-user-${stamp}`, role: "user", text: question, attachments: chatAttachments },
      { id: `qa-chat-agent-${stamp}`, role: "agent", text: resolveQaReply(question) },
    ]);
    setChatText("");
    setChatAttachments([]);
  };

  const focusFinding = (finding: QaFinding) => {
    setActiveFindingId(finding.id);
    setPage(Math.min(finding.docPage, qaDocument.pageCount));
  };

  /* 划词就是批注的入口。不另做一个「进入批注模式」的开关——
     选中文字这个动作本身已经表达了"我要说这一处"，再要求先切模式
     等于让人把同一件事说两遍。 */
  const captureSelection = (event: React.MouseEvent<HTMLElement>) => {
    if (!annotateMode || outcome !== null || role === "owner") return;
    const selection = window.getSelection();
    const quote = selection?.toString().trim() ?? "";
    if (!quote) return;
    const stage = event.currentTarget.getBoundingClientRect();
    const range = selection?.getRangeAt(0).getBoundingClientRect();
    setAnnotation({
      quote: quote.length > 60 ? `${quote.slice(0, 60)}…` : quote,
      top: range ? range.bottom - stage.top + 8 : 24,
    });
    setAnnotationDraft("");
    setAnnotationKind("defect");
  };

  const submitAnnotation = () => {
    const text = annotationDraft.trim();
    if (!text || !annotation) return;
    const stamp = Date.now();

    if (annotationKind === "defect") {
      /* 缺陷进问题清单，带上引文和页码——下一版复核要靠这两样定位。 */
      const finding: QaFinding = {
        id: `h-${stamp}`,
        category: "content",
        raisedIn: versionId,
        source: "human",
        docPage: page,
        severity: "warning",
        recordId: "人工批注",
        anchorField: humanAnchorByPage[page] ?? "样品名称",
        text: `${text}（原文：「${annotation.quote}」）`,
      };
      setHumanFindings((current) => [...current, finding]);
      setActivePanelId("ai-review");
      setActiveFindingId(finding.id);
    } else {
      setNotes((current) => [...current, {
        id: `note-${stamp}`,
        source: "human",
        author: role === "author" ? "林一一" : "王林彬",
        time: "刚刚",
        text: `${formatPageRef(page)}：${text}（原文：「${annotation.quote}」）`,
      }]);
      setActivePanelId("notes");
    }

    setPanelOpen(true);
    setAnnotation(null);
    setAnnotationDraft("");
    window.getSelection()?.removeAllRanges();
  };

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes((current) => [...current, {
      id: `note-${Date.now()}`,
      source: "human",
      author: role === "author" ? "林一一" : "王林彬",
      time: "刚刚",
      text,
    }]);
    setNoteDraft("");
  };

  /* 结论跨重挂载活着，但备注是本地的。切走再回来会出现"顶栏说已通过、
     备注里却没有任何结论"的空档，所以缺的时候补一条通用的。
     本轮内落定的那条是原话（驳回理由是人打的字），补的这条只是兜底。 */
  const notesWithOutcome = useMemo(() => {
    if (!outcome || notes.some((note) => note.source === "human")) return notes;
    return [...notes, {
      id: "note-outcome-restored",
      source: "human" as const,
      author: role === "author" ? "林一一" : "王林彬",
      time: "本轮",
      text: outcome === "approved"
        ? "经最终审核，同意通过本次终审。"
        : outcome === "rejected"
          ? "本版已驳回，问题清单与理由已退回撰写人。"
          : "已提交审批，等待审批人处理。",
    }];
  }, [notes, outcome, role]);

  const reviewPanels = useMemo(() => getQaReviewPanels({
    role,
    locked: outcome !== null,
    findings: allFindings,
    findingStates,
    activeFindingId,
    notes: notesWithOutcome,
    noteDraft,
    baseVersionId,
    currentVersionId: versionId,
    onFindingState: (findingId, state) => setFindingStates((current) => ({ ...current, [findingId]: state })),
    onFocusFinding: focusFinding,
    onNoteDraftChange: setNoteDraft,
    onAddNote: addNote,
  // focusFinding / addNote 只读上面这些 state，跟着它们一起失效即可
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [role, outcome, allFindings, findingStates, activeFindingId, notesWithOutcome, noteDraft, baseVersionId, versionId]);

  /* 驳回把这一版的结论打包丢回撰写人。三件事一起做，缺一件逻辑就断：
       ① 版本状态置为已驳回，Session 进「等待撰写人修改」——这是机制
       ② 已确认的问题清单 + 理由，作为这次退回的载荷
       ③ 预填一封邮件草稿——这是通知，人过目再发，不替他发出去
     只改状态不通知，撰写人不知道轮到自己了；只发信不改状态，下一版回来时
     系统不知道它在回应哪一次退回，跨版本验证就断了。 */
  const rejectWithReason = () => {
    const reason = rejectReason.trim();
    if (!reason) return;
    const confirmed = allFindings.filter((finding) => (findingStates[finding.id] ?? "open") === "accepted");
    const lines = confirmed.map((finding) => `· ${formatPageRef(finding.docPage, finding.innerPage)}：${finding.text}`);
    resolveWith("rejected", `驳回${version.label}：${reason}${confirmed.length ? `\n随附已确认问题 ${confirmed.length} 条。` : ""}`);
    setRejectOpen(false);
    setRejectReason("");
    onComposeMail?.({
      to: version.author,
      subject: `退回修订：${taskTitle}（${version.label}）`,
      body: [
        `${version.author} 你好，`,
        "",
        `${version.label} 未通过本次审核，请修订后重新提交。`,
        "",
        `驳回理由：${reason}`,
        ...(lines.length ? ["", `需要处理的问题（${confirmed.length} 条）：`, ...lines] : []),
      ].join("\n"),
    });
  };

  const resolveWith = (next: "submitted" | "approved" | "rejected", noteText: string) => {
    setNotes((current) => [...current, {
      id: `note-${Date.now()}`,
      source: "human",
      author: role === "author" ? "林一一" : "王林彬",
      time: "刚刚",
      text: noteText,
    }]);
    setActivePanelId("notes");
    setOutcome(next);
  };

  /* 文档收进「更多」。常驻三个 tab 是三种**结论**：审核结果 / 文件比对 / 审批备注；
     文档是被审的那个东西，正常状态它占中间的画布，不该跟结论并列常驻。
     原来四个 panel 全是 primary，于是加号菜单里「更多」那组永远是空的。 */
  const documentPanel = {
    id: "document",
    label: "文档",
    icon: FileText,
    state: "populated" as const,
    isDefault: false,
    primary: false,
    expandable: true,
    content: <QaDocumentCompact page={page} versionId={versionId} onPageChange={setPage} />,
  };
  /* 「变更」只在真的开着比对时才注册。没有比对却留一个 tab，点进去只能
     解释"这里现在没东西"——空态解释永远不如不出现。 */
  const panels = [documentPanel, ...reviewPanels.filter((panel) => panel.id !== "ai-diff" || compareWith !== null)];
  const dockPanels = panels.filter((panel) => panel.id !== poppedPanelId);
  const dockVisibleIds = visiblePanelIds.filter((id) => id !== poppedPanelId);
  const poppedPanel = panels.find((panel) => panel.id === poppedPanelId);

  const popPanel = (panelId: string) => {
    if (panelId !== "document" && panelId !== "ai-diff") return;
    const returningPanelId = poppedPanelId;
    setPoppedPanelId(panelId);
    if (returningPanelId && returningPanelId !== panelId) {
      setActivePanelId(returningPanelId);
      return;
    }
    const fallback = panels.find((panel) => panel.id !== panelId && visiblePanelIds.includes(panel.id));
    if (fallback) setActivePanelId(fallback.id);
  };

  const returnPoppedPanel = () => {
    if (poppedPanelId) setActivePanelId(poppedPanelId);
    setPoppedPanelId(null);
  };

  /* 决策卡是一个入口：挡着你做决定的是「还有 N 条没处置」，
     所以点它直接进 Canvas——原件占中、问题清单在右，就地处置。
     入口指向那 N 条，而不是泛泛地预览文档：光看原件看不出哪几条没解决。 */
  const openFindingsForDecision = () => {
    setPanelOpen(true);
    setActivePanelId("ai-review");
    setPoppedPanelId("document");
  };

  return (
    <section className={`dmpkWorkspace qaReviewWorkspace ${poppedPanelId ? "hasPoppedCanvas" : "hasChatflow"}`}>
      <header className="topbar">
        <div className="breadcrumb">
          <span>{projectName}</span>
          <ChevronRight size={15} />
          <strong>{taskTitle}</strong>
          <em className="qaRoleBadge">{roleTitle[role]}</em>
        </div>
        <div className="qaTopbarTools">
          {/* 版本下拉已挪到文档工具栏。它回答的是"我在看哪一版"，那是文档的属性；
              而这个 Session 从 V1 一路跨到批准，顶栏挂一个版本号会让人以为
              它只管第三版。这里只留这一版的状态。 */}
          {/* 一个状态只能有一个说法。原来这里并排挂两颗——一颗是版本里存的
              「待审批」，一颗是本次落定的「已通过」，同屏说着互相矛盾的两句话。
              落了结论就以结论为准，它取代版本状态，不跟它并列。 */}
          {outcome ? (
            <StatusChip tone={outcome === "rejected" ? "danger" : "success"} dot>
              {outcome === "submitted" ? "已提交审批" : outcome === "approved" ? "已通过" : "已驳回"}
            </StatusChip>
          ) : (
            <StatusChip tone={versionTone[version.status]} dot>{versionStatusLabel[version.status]}</StatusChip>
          )}
          {role === "owner" && !outcome ? <StatusChip tone="neutral">只读</StatusChip> : null}
          <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} />
        </div>
      </header>

      {poppedPanelId === "document" ? <div className={`qaViewer qaDetachedCanvas ${compareWith ? "isComparing" : ""}`}>
        <header className="qaViewerBar">
          <span className="qaViewerTitle"><FileText size={14} />{qaDocument.title}</span>

          {/* 「我在看哪一版」跟页码、缩放同一排——它们回答的是同一个问题。 */}
          <InlineSelect label="选择版本" trigger={<span>{version.label}</span>}>
            {(close) => qaVersions.map((item) => (
              <button
                className={`toolMenuItem qaVersionOption ${item.id === versionId ? "active" : ""}`}
                type="button"
                key={item.id}
                onClick={() => { setVersionId(item.id); close(); }}
              >
                <span>
                  <b>{item.label}</b>
                  <small>{versionStatusLabel[item.status]} · {item.submittedAt}</small>
                </span>
                {item.id === versionId ? <Check size={14} /> : null}
              </button>
            ))}
          </InlineSelect>

          {/* 比对 = 多开一栏，不是另一个 tab。开着时这颗变成 ✕ 收回单栏。 */}
          {compareWith ? (
            <button
              className="qaCompareToggle isOn"
              type="button"
              onClick={() => { setCompareWith(null); setActivePanelId("ai-review"); }}
              aria-label="收起对比栏"
              title="收起对比栏"
            >
              <Columns2 size={14} />对比中<X size={12} />
            </button>
          ) : (
            <button
              className="qaCompareToggle"
              type="button"
              onClick={() => {
                const fallback = qaVersions.find((item) => item.id === version.comparedAgainst)?.id
                  ?? qaVersions.find((item) => item.id !== versionId)?.id
                  ?? versionId;
                setCompareWith(fallback);
                setActivePanelId("ai-diff");
              }}
              title="并排对比另一版"
            >
              <Columns2 size={14} />对比版本
            </button>
          )}

          <span className="qaViewerPager">
            <button type="button" aria-label="上一页" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={14} /></button>
            <b>{String(page).padStart(3, "0")}</b>
            <i>/</i>
            <span>{qaDocument.pageCount}</span>
            <button type="button" aria-label="下一页" disabled={page === qaDocument.pageCount} onClick={() => setPage((value) => Math.min(qaDocument.pageCount, value + 1))}><ChevronRight size={14} /></button>
          </span>
          {/* 批注模式开关。收起时只是一颗圈住的加号，开着时长出「正在注释」
              四个字——模式类控件必须一眼看出自己开着，光靠图标变色不够。 */}
          {outcome === null && role !== "owner" ? (
            <button
              type="button"
              className={`qaAnnotateToggle ${annotateMode ? "isOn" : ""}`}
              aria-pressed={annotateMode}
              aria-label={annotateMode ? "退出批注模式" : "进入批注模式"}
              title={annotateMode ? "退出批注模式（Esc）" : "批注模式：选中原文即可批注"}
              onClick={() => {
                setAnnotateMode((value) => !value);
                setAnnotation(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              {/* 荧光笔比"圈加号"具体：这个动作就是在纸上划一道再写句话。
                  没用气泡图标——那个在这套界面里已经代表"跟同事说话"。 */}
              <Highlighter size={15} />
              {annotateMode ? <span>正在注释</span> : null}
            </button>
          ) : null}

          <span className="qaViewerZoom">
            <button type="button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(60, value - 10))}><ZoomOut size={14} /></button>
            <b>{zoom}%</b>
            <button type="button" aria-label="放大" onClick={() => setZoom((value) => Math.min(160, value + 10))}><ZoomIn size={14} /></button>
            <button type="button" aria-label="下载"><Download size={14} /></button>
            <button
              type="button"
              className="qaReturnCanvasButton"
              aria-label="将文档收回右侧面板"
              title="收回到右侧面板"
              onClick={returnPoppedPanel}
            >
              <Minimize2 size={15} strokeWidth={2} />
            </button>
          </span>
        </header>

        <div className="qaViewerStage">
          <div className="qaThumbRail" role="tablist" aria-label="页面缩略图">
            {Array.from({ length: qaDocument.pageCount }, (_, index) => index + 1).map((number) => (
              <button
                className={`qaThumb ${page === number ? "isActive" : ""}`}
                type="button"
                role="tab"
                aria-selected={page === number}
                key={number}
                onClick={() => setPage(number)}
              >
                <span aria-hidden="true" />
                <small>{number}</small>
              </button>
            ))}
          </div>

          <div className={`qaPageScroll ${annotateMode ? "isAnnotating" : ""}`} onMouseUp={captureSelection}>
            {/* 原型不渲染真 PDF，只按版式给出一张可信的占位页，
                这样批注定位到第几页仍然说得通。 */}
            {annotation ? (
              <AnnotationCard
                quote={annotation.quote}
                top={annotation.top}
                draft={annotationDraft}
                kind={annotationKind}
                pageRef={formatPageRef(page)}
                onDraftChange={setAnnotationDraft}
                onKindChange={setAnnotationKind}
                onSubmit={submitAnnotation}
                onCancel={() => { setAnnotation(null); window.getSelection()?.removeAllRanges(); }}
              />
            ) : null}
            {/* 单栏：正在审的这一版，带批注标记。
                双栏：左边是拿来比的那一版，右边仍是正在审的这一版——
                批注只标在右边，左边那栏是参照物，不是工作面。 */}
            {compareWith ? (
              <div className="qaComparePair">
                <QaComparePane
                  side="base"
                  versionId={compareWith}
                  otherVersionId={versionId}
                  zoom={zoom}
                  syncScroll={syncScroll}
                  onVersionChange={setCompareWith}
                  onSyncScrollChange={setSyncScroll}
                />
                <QaComparePane
                  side="current"
                  versionId={versionId}
                  otherVersionId={compareWith}
                  zoom={zoom}
                  syncScroll={syncScroll}
                  onVersionChange={setVersionId}
                  onSyncScrollChange={setSyncScroll}
                />
              </div>
            ) : (
              <QaPageSheet
                versionId={versionId}
                width={(zoom / 100) * 560}
                findings={allFindings}
                findingStates={findingStates}
                activeFindingId={activeFindingId}
                onFocusFinding={(finding) => { focusFinding(finding); setActivePanelId("ai-review"); setPanelOpen(true); }}
                marker={activeFindingId ? (
                  <p className="qaPageMarker">
                    已定位到第 {page} 页 · {allFindings.find((finding) => finding.id === activeFindingId)?.text.slice(0, 24)}…
                  </p>
                ) : null}
              />
            )}
          </div>
        </div>
      </div> : (
        <section className="qaChatflow">
          <SessionMinimap scrollerRef={chatScrollerRef} />
          <div className="dmpkChatScroller" ref={chatScrollerRef}><div className="dmpkConversation">
            {chatMessages.map((message) => message.role === "run"
              ? <ActivityChain
                  key={message.id}
                  title={message.text}
                  steps={message.steps ?? []}
                  running={Boolean(message.running)}
                  doneTitle={message.doneTitle}
                  timedOut={message.timedOut}
                  onOpen={() => setActivePanelId("ai-review")}
                />
              : message.role === "agent"
                ? <AgentReply key={message.id}>{message.text}</AgentReply>
                : <UserBubble key={message.id} text={message.text} attachments={message.attachments} />)}
          </div></div>
          <footer className="qaChatComposerStack">
            {!outcome ? (
              <section className="warningDecision qaApprovalCard">
                <header className="warningDecisionHeader"><div><span>审批决策</span><strong>{role === "author" ? "处置完成后提交审批" : role === "approver" ? "确认本版审核结论" : "负责人视角为只读"}</strong><p>
                  {openFindings ? (
                    <>
                      <button className="qaApprovalJump" type="button" onClick={openFindingsForDecision}>
                        <Maximize2 size={12} />{openFindings} 条 AI 批注仍待处置
                      </button>
                      ，结论会写入审批记录。
                    </>
                  ) : (
                    <>
                      <button className="qaApprovalJump" type="button" onClick={openFindingsForDecision}>
                        <Maximize2 size={12} />{qaFindings.length} 条 AI 批注已全部处置
                      </button>
                      ，结论会写入审批记录。
                    </>
                  )}
                </p></div><small>{role === "owner" ? "只读" : "待确认"}</small></header>
                {role === "author" ? <div className="warningActions"><Button variant="primary" size="small" disabled={openFindings > 0} title={openFindings > 0 ? `还有 ${openFindings} 条 AI 批注未处置` : undefined} onClick={() => resolveWith("submitted", `已逐条处置 ${qaFindings.length} 条 AI 批注，提交${version.label}终审。`)}>提交审批</Button></div>
                  : role === "approver" ? <div className="warningActions"><Button variant="secondary" size="small" leadingIcon={<Undo2 size={14} />} onClick={() => setRejectOpen(true)}>驳回</Button><Button variant="primary" size="small" leadingIcon={<Check size={14} />} onClick={() => resolveWith("approved", "经最终审核，该文档内容严谨合规、信息准确无误，同意通过本次终审。")}>通过</Button></div> : null}
              </section>
            ) : null}
            <CoworkerSelector coworkers={businessCoworkers} activeCoworkerId={activeCoworkerId} locked={outcome === null} onChange={onCoworkerChange} />
            <WorkbenchComposer className="dmpkComposer qaChatComposer" attachments={chatAttachments} onAttachmentsChange={setChatAttachments} project={projectName} activeCoworkerId={activeCoworkerId} globalDrop>
              <div className="composerInputStack">
                <input value={chatText} placeholder="问 QA 审核同事，例如：第 8 页那条时间逻辑怎么判的" onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendChat(); } }} />
              </div>
              <button className="sendIconButton" type="button" aria-label="发送" disabled={!chatText.trim()} onClick={sendChat}><Send size={18} /></button>
            </WorkbenchComposer>
          </footer>
        </section>
      )}

      <WorkbenchPanelBody
        panels={dockPanels}
        visibleIds={dockVisibleIds}
        onVisibleIdsChange={(ids) => setVisiblePanelIds(poppedPanelId ? [...ids, poppedPanelId] : ids)}
        activePanelId={activePanelId}
        open={panelOpen}
        focus={false}
        onFocusChange={() => popPanel(activePanelId)}
        onPanelChange={setActivePanelId}
      />

      {/* 悬浮坞只放对话。执行链是时间线上的过程记录，收进药丸里既读不了也点不开，
          它留在展开的 chatflow 里等你回去看。 */}
      {poppedPanelId ? <FloatingChatDock
        messages={chatMessages.filter((message): message is QaChatMessage & { role: "user" | "agent" } => message.role !== "run")}
        text={chatText}
        onTextChange={setChatText}
        onSend={sendChat}
        autoFocus={false}
        placeholder="问 QA 审核同事，例如：第 8 页那条时间逻辑怎么判的"
      /> : null}

      {rejectOpen ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRejectOpen(false); }}>
          <section className="qaRejectDialog" role="dialog" aria-modal="true" aria-labelledby="qa-reject-title">
            <header>
              <h2 id="qa-reject-title">驳回{version.label}</h2>
              <p>会把已确认的问题连同理由一起退回撰写人，并生成一封邮件草稿供你过目。</p>
            </header>
            <label className="qaRejectField">
              <span>驳回理由<em>必填</em></span>
              <textarea
                autoFocus
                rows={4}
                value={rejectReason}
                placeholder="写明这一版为什么不能通过，例如：第 8 页盖章日期仍早于批准时间，流程顺序不成立。"
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </label>
            <p className="qaRejectSummary">
              随附已确认问题 <b>{allFindings.filter((finding) => (findingStates[finding.id] ?? "open") === "accepted").length}</b> 条
              {openFindings ? <em>· 还有 {openFindings} 条未处置，不会随附</em> : null}
            </p>
            <footer>
              <button type="button" onClick={() => setRejectOpen(false)}>取消</button>
              <Button variant="primary" size="small" disabled={!rejectReason.trim()} leadingIcon={<Undo2 size={14} />} onClick={rejectWithReason}>
                确认驳回并退回
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

/**
 * 那张纸。主视图和比对两栏共用同一个组件——并排比对必须是两份**文档**，
 * 用两套渲染的话，左右版式一有出入，看到的"差异"就分不清是改动还是渲染。
 *
 * highlight 传进来时按字段就地标色：这一栏是基线就标"改之前"，是当前就标"改之后"。
 */
function QaPageSheet({
  versionId,
  width,
  highlight,
  side,
  marker,
  findings,
  findingStates,
  activeFindingId,
  onFocusFinding,
}: {
  versionId: string;
  width?: number;
  highlight?: Map<string, string>;
  side?: "base" | "current";
  marker?: React.ReactNode;
  /* 传了问题就在纸面上标出来。比对两栏不传——那边要看的是版本之间的差异，
     再叠一层批注高亮会变成两套颜色在同一张纸上打架。 */
  findings?: QaFinding[];
  findingStates?: Record<string, QaFindingState>;
  activeFindingId?: string | null;
  onFocusFinding?: (finding: QaFinding) => void;
}) {
  const values = pageValues(versionId);
  const byField = new Map<string, QaFinding[]>();
  for (const finding of findings ?? []) {
    if (!finding.anchorField) continue;
    byField.set(finding.anchorField, [...(byField.get(finding.anchorField) ?? []), finding]);
  }

  /* 纸面上的一处标记。AI 提的和人工提的给两种颜色——审批人得一眼看出
     哪些是机器说的、哪些是人写的，这两者的可信度和责任归属完全不同。
     已处置的褪成中性并划掉，剩下的才继续吸引注意力。 */
  const mark = (field: string, children: React.ReactNode) => {
    const hits = byField.get(field);
    if (!hits?.length) return children;
    const hasHuman = hits.some((item) => item.source === "human");
    const allSettled = hits.every((item) => (findingStates?.[item.id] ?? "open") !== "open");
    const isActive = hits.some((item) => item.id === activeFindingId);
    return (
      <button
        type="button"
        className={`qaDocMark ${hasHuman ? "source-human" : "source-ai"} ${allSettled ? "isSettled" : ""} ${isActive ? "isActive" : ""}`}
        onClick={() => onFocusFinding?.(hits[0])}
        title={hits.map((item) => item.text).join("\n")}
      >
        {children}
        <em>{hits.length > 1 ? `${hits.length} 条` : hasHuman ? "人工" : "AI"}</em>
      </button>
    );
  };

  return (
    <article className="qaPage" style={width ? { width: `${width}px` } : undefined}>
      <p className="qaPageNo">报告编号(NO.)： <b>{values["报告编号"]}</b></p>
      <h1>检测报告<small>TEST REPORT</small></h1>
      <dl className="qaPageFields">
        {qaPageFields.map(({ field, en }) => {
          const kind = highlight?.get(field);
          return (
            <div key={field} className={kind ? `qaCompareField kind-${kind} side-${side ?? "current"}` : undefined}>
              <dt>{field}<small>{en}</small></dt>
              <dd>{mark(field, values[field] || "—")}</dd>
            </div>
          );
        })}
      </dl>
      {marker}
      <footer className="qaPageFooter">
        {qaDocument.issuer}
        <span className={highlight?.get("页码标记") ? "qaCompareField kind-changed" : undefined}>
          {mark("页码标记", values["页码标记"])}
        </span>
      </footer>
    </article>
  );
}

/**
 * 划词之后就地弹出的批注卡。
 *
 * 落点是个选择而不是两个入口：默认「要求修改」，因为审批人写下一段话
 * 十有八九是要对方改；勾成「仅记录」才当审批意见。两者去处不同——
 * 要求修改的进问题清单、跨版本被验证；仅记录的进审批备注、只留痕。
 */
function AnnotationCard({
  quote,
  top,
  draft,
  kind,
  pageRef,
  onDraftChange,
  onKindChange,
  onSubmit,
  onCancel,
}: {
  quote: string;
  top: number;
  draft: string;
  kind: "defect" | "note";
  pageRef: string;
  onDraftChange: (value: string) => void;
  onKindChange: (kind: "defect" | "note") => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  /* 一行式，跟评论气泡一个量级——批注多数是一句话，给一个三行文本域
     等于暗示"你得写一段"。输入框自己会随内容长高。 */
  return (
    <aside className="qaAnnotationCard" style={{ top }} aria-label="新增批注">
      <blockquote className="qaAnnotationQuote">{quote}<em>{pageRef}</em></blockquote>

      <div className="qaAnnotationRow">
        <textarea
          autoFocus
          rows={1}
          value={draft}
          placeholder="添加批注…"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter 直接提交，Shift+Enter 换行——跟 composer 一个手感
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); }
            if (event.key === "Escape") onCancel();
          }}
        />
        <button
          className="qaAnnotationSend"
          type="button"
          disabled={!draft.trim()}
          onClick={onSubmit}
          aria-label="提交批注"
          title="提交批注（Enter）"
        >
          <Check size={14} />
        </button>
      </div>

      {/* 去向留在卡里，但收成两个小字：它是个选择，不该占掉半张卡 */}
      <div className="qaAnnotationKind" role="radiogroup" aria-label="批注去向">
        <button type="button" role="radio" aria-checked={kind === "defect"} className={kind === "defect" ? "isOn" : ""} onClick={() => onKindChange("defect")}>
          要求修改
        </button>
        <button type="button" role="radio" aria-checked={kind === "note"} className={kind === "note" ? "isOn" : ""} onClick={() => onKindChange("note")}>
          仅记录
        </button>
        <small>{kind === "defect" ? "进审核结果，下一版验证" : "进审批备注，只留痕"}</small>
      </div>
    </aside>
  );
}

/**
 * 双栏比对。左基线、右当前，两边各自一个版本下拉——
 * 「跟哪一版比」本来就是审批人要自己决定的事，写死成"上一版"
 * 在连提两版、中间没审的情况下会漏掉一半改动。
 */
function QaComparePane({
  side,
  versionId,
  otherVersionId,
  zoom,
  syncScroll,
  onVersionChange,
  onSyncScrollChange,
}: {
  side: "base" | "current";
  versionId: string;
  otherVersionId: string;
  zoom: number;
  syncScroll: boolean;
  onVersionChange: (id: string) => void;
  onSyncScrollChange: (value: boolean) => void;
}) {
  /* 差异永远按「基线 → 当前」算，跟这一栏是哪边无关，否则左右两栏
     会各算一次、把新增说成删除。 */
  const from = side === "base" ? versionId : otherVersionId;
  const to = side === "base" ? otherVersionId : versionId;
  const highlight = changedFields(from, to);
  const rows = diffBetween(from, to);
  const version = qaVersions.find((item) => item.id === versionId);

  /* 同步滚动：两栏都挂 data-compare-pane，滚动时按比例推另一栏。
     用比例而不是像素——两栏内容高度不一定相等，按像素同步会在长的一边
     走到底时把短的一边甩在中间。 */
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll) return;
    const self = event.currentTarget;
    if (self.dataset.syncing === "1") return;
    const other = self.parentElement?.parentElement?.querySelector<HTMLDivElement>(
      `[data-compare-pane]:not([data-compare-side="${side}"])`,
    );
    if (!other) return;
    other.dataset.syncing = "1";
    const ratio = self.scrollTop / Math.max(1, self.scrollHeight - self.clientHeight);
    other.scrollTop = ratio * Math.max(0, other.scrollHeight - other.clientHeight);
    window.requestAnimationFrame(() => { delete other.dataset.syncing; });
  };

  return (
    <div className="qaComparePane">
      <header className="qaComparePaneBar">
        <em>{side === "base" ? "对比版本" : "正在审"}</em>
        <InlineSelect label={side === "base" ? "选择对比版本" : "选择正在审的版本"} trigger={<span>{version?.label ?? versionId}</span>}>
          {(close) => qaVersions.map((item) => (
            <button
              className={`toolMenuItem qaVersionOption ${item.id === versionId ? "active" : ""}`}
              type="button"
              key={item.id}
              onClick={() => { onVersionChange(item.id); close(); }}
            >
              <span>
                <b>{item.label}</b>
                <small>{versionStatusLabel[item.status]} · {item.submittedAt}</small>
              </span>
              {item.id === versionId ? <Check size={14} /> : null}
            </button>
          ))}
        </InlineSelect>
        {/* 同步滚动只在右栏出一次：两栏各挂一个开关会让人以为能分别控制 */}
        {side === "current" ? (
          <label className="qaCompareSync">
            <input type="checkbox" checked={syncScroll} onChange={(event) => onSyncScrollChange(event.target.checked)} />
            同步滚动
          </label>
        ) : (
          <span className="qaCompareCount">{rows.length} 处差异</span>
        )}
      </header>
      <div className="qaComparePaneScroll" data-compare-pane data-compare-side={side} onScroll={onScroll}>
        {/* 两栏都是完整的一张纸，不是差异字段表——审批人要看的是
            "这一版长什么样"，改动只是其中被标出来的那几处。 */}
        <QaPageSheet versionId={versionId} width={(zoom / 100) * 460} highlight={highlight} side={side} />
      </div>
    </div>
  );
}

/** 文档收回到 400px panel 后只保留页码和纸张，不再放缩略图轨与缩放工具。 */
function QaDocumentCompact({ page, versionId, onPageChange }: { page: number; versionId: string; onPageChange: (page: number) => void }) {
  return (
    <div className="qaCompactDocument">
      <header>
        <span><FileText size={14} />{qaDocument.title}</span>
        <span className="qaViewerPager">
          <button type="button" aria-label="上一页" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}><ChevronLeft size={14} /></button>
          <b>{String(page).padStart(3, "0")}</b><i>/</i><span>{qaDocument.pageCount}</span>
          <button type="button" aria-label="下一页" disabled={page === qaDocument.pageCount} onClick={() => onPageChange(Math.min(qaDocument.pageCount, page + 1))}><ChevronRight size={14} /></button>
        </span>
      </header>
      <div className="qaCompactDocumentScroll">
        {/* 跟主视图共用同一张纸，否则收进面板之后版本又对不上了 */}
        <QaPageSheet versionId={versionId} />
      </div>
    </div>
  );
}
