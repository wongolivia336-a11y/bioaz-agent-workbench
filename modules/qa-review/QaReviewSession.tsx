"use client";

import { Check, ChevronLeft, ChevronRight, Download, FileText, GitCompare, Maximize2, Minimize2, Send, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
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
  diffBetween,
  formatPageRef,
  qaChatOpening,
  qaCurrentVersionId,
  qaDocument,
  qaFindings,
  qaInitialNotes,
  qaVersions,
  resolveQaReply,
  type QaChatMessage,
  type QaFinding,
  type QaFindingState,
  type QaNote,
} from "./reviewData";

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

export default function QaReviewSession({ projectName, taskTitle, initialRequest, viewerRole = "approver", coworkers, activeCoworkerId, onCoworkerChange }: AgentModuleSessionProps) {
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
  /** 比对基线。默认取这一版该跟谁比，但审批人可以改成任意一版 */
  const [baseVersionId, setBaseVersionId] = useState(qaVersions.find((item) => item.id === qaCurrentVersionId)?.comparedAgainst ?? "v2");
  const [syncScroll, setSyncScroll] = useState(true);
  const [outcome, setOutcome] = useState<"submitted" | "approved" | "rejected" | null>(null);
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
    if (outcome !== null || role === "owner") return;
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

  const reviewPanels = useMemo(() => getQaReviewPanels({
    role,
    locked: outcome !== null,
    findings: allFindings,
    findingStates,
    activeFindingId,
    notes,
    noteDraft,
    baseVersionId,
    currentVersionId: versionId,
    onFindingState: (findingId, state) => setFindingStates((current) => ({ ...current, [findingId]: state })),
    onFocusFinding: focusFinding,
    onNoteDraftChange: setNoteDraft,
    onAddNote: addNote,
  // focusFinding / addNote 只读上面这些 state，跟着它们一起失效即可
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [role, outcome, allFindings, findingStates, activeFindingId, notes, noteDraft, baseVersionId, versionId]);

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

  const documentPanel = {
    id: "document",
    label: "文档",
    icon: FileText,
    state: "populated" as const,
    isDefault: false,
    primary: true,
    expandable: true,
    content: <QaDocumentCompact page={page} onPageChange={setPage} />,
  };
  const panels = [documentPanel, ...reviewPanels];
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
          <InlineSelect label="版本选择" trigger={<span>{version.label}</span>} align="end">
            {(close) => qaVersions.map((item) => (
              <button type="button" key={item.id} onClick={() => { setVersionId(item.id); close(); }}>
                {item.label}
                <small>{versionStatusLabel[item.status]} · {item.submittedAt}</small>
              </button>
            ))}
          </InlineSelect>
          <StatusChip tone={versionTone[version.status]} dot>{versionStatusLabel[version.status]}</StatusChip>
          {outcome ? (
            <StatusChip tone={outcome === "rejected" ? "danger" : "success"}>
              {outcome === "submitted" ? "已提交审批" : outcome === "approved" ? "已通过" : "已驳回"}
            </StatusChip>
          ) : role === "owner" ? <StatusChip tone="neutral">只读</StatusChip> : null}
          <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} />
        </div>
      </header>

      {poppedPanelId === "document" ? <div className="qaViewer qaDetachedCanvas">
        <header className="qaViewerBar">
          <span className="qaViewerTitle"><FileText size={14} />{qaDocument.title}</span>
          <span className="qaViewerPager">
            <button type="button" aria-label="上一页" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={14} /></button>
            <b>{String(page).padStart(3, "0")}</b>
            <i>/</i>
            <span>{qaDocument.pageCount}</span>
            <button type="button" aria-label="下一页" disabled={page === qaDocument.pageCount} onClick={() => setPage((value) => Math.min(qaDocument.pageCount, value + 1))}><ChevronRight size={14} /></button>
          </span>
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

          <div className="qaPageScroll" onMouseUp={captureSelection}>
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
            <article className="qaPage" style={{ width: `${(zoom / 100) * 560}px` }}>
              <p className="qaPageNo">报告编号(NO.)： <b>{qaDocument.reportNo}</b></p>
              <h1>检测报告<small>TEST REPORT</small></h1>
              <dl className="qaPageFields">
                <div><dt>样品名称<small>SAMPLE NAME</small></dt><dd>{qaDocument.sampleName}</dd></div>
                <div><dt>报告编号<small>REPORT NO.</small></dt><dd>{qaDocument.reportNo}</dd></div>
                <div><dt>检测类别<small>TEST TYPE</small></dt><dd>{qaDocument.testType}</dd></div>
                <div><dt>委托单位<small>APPLICANT</small></dt><dd>{qaDocument.applicant}</dd></div>
              </dl>
              {activeFindingId ? (
                <p className="qaPageMarker">
                  已定位到第 {page} 页 · {qaFindings.find((finding) => finding.id === activeFindingId)?.text.slice(0, 24)}…
                </p>
              ) : null}
              <footer className="qaPageFooter">{qaDocument.issuer}<span>第 {page} 页 / 共 {qaDocument.pageCount} 页</span></footer>
            </article>
          </div>
        </div>
      </div> : poppedPanelId === "ai-diff" ? (
        <QaCompareCanvas
          baseVersionId={baseVersionId}
          currentVersionId={versionId}
          syncScroll={syncScroll}
          onBaseChange={setBaseVersionId}
          onCurrentChange={setVersionId}
          onSyncScrollChange={setSyncScroll}
          onReturn={returnPoppedPanel}
        />
      ) : (
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
                  : role === "approver" ? <div className="warningActions"><Button variant="secondary" size="small" leadingIcon={<Undo2 size={14} />} onClick={() => resolveWith("rejected", "驳回：仍有时间逻辑未修订，请修改后重新提交。")}>驳回</Button><Button variant="primary" size="small" leadingIcon={<Check size={14} />} onClick={() => resolveWith("approved", "经最终审核，该文档内容严谨合规、信息准确无误，同意通过本次终审。")}>通过</Button></div> : null}
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
    </section>
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
  return (
    <aside className="qaAnnotationCard" style={{ top }} aria-label="新增批注">
      <header>
        <strong>新增批注</strong>
        <small>{pageRef}</small>
        <button type="button" onClick={onCancel} aria-label="取消"><X size={13} /></button>
      </header>
      <blockquote className="qaAnnotationQuote">{quote}</blockquote>
      <div className="qaAnnotationKind" role="radiogroup" aria-label="批注去向">
        <button type="button" role="radio" aria-checked={kind === "defect"} className={kind === "defect" ? "isOn" : ""} onClick={() => onKindChange("defect")}>
          要求修改
        </button>
        <button type="button" role="radio" aria-checked={kind === "note"} className={kind === "note" ? "isOn" : ""} onClick={() => onKindChange("note")}>
          仅记录
        </button>
      </div>
      <p className="qaAnnotationWhere">
        {kind === "defect" ? "进「审核结果」清单，下一版会逐条验证改没改。" : "进「审批备注」，只写入审计轨迹，不要求对方修改。"}
      </p>
      <textarea
        autoFocus
        rows={3}
        value={draft}
        placeholder={kind === "defect" ? "写明要改什么，例如：盖章日期早于批准时间，请修订为批准之后。" : "写明你的判断依据。"}
        onChange={(event) => onDraftChange(event.target.value)}
      />
      <div className="qaAnnotationActions">
        <button type="button" onClick={onCancel}>取消</button>
        <Button variant="primary" size="small" disabled={!draft.trim()} onClick={onSubmit}>提交批注</Button>
      </div>
    </aside>
  );
}

/**
 * 双栏比对。左基线、右当前，两边各自一个版本下拉——
 * 「跟哪一版比」本来就是审批人要自己决定的事，写死成"上一版"
 * 在连提两版、中间没审的情况下会漏掉一半改动。
 */
function QaCompareCanvas({
  baseVersionId,
  currentVersionId,
  syncScroll,
  onBaseChange,
  onCurrentChange,
  onSyncScrollChange,
  onReturn,
}: {
  baseVersionId: string;
  currentVersionId: string;
  syncScroll: boolean;
  onBaseChange: (id: string) => void;
  onCurrentChange: (id: string) => void;
  onSyncScrollChange: (value: boolean) => void;
  onReturn: () => void;
}) {
  const rows = diffBetween(baseVersionId, currentVersionId);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  /* 同步滚动用比例而不是像素：两栏内容高度不一定相等，
     按像素同步会在长的一边走到底时把短的一边甩在中间。 */
  const linkScroll = (from: HTMLDivElement | null, to: HTMLDivElement | null) => () => {
    if (!syncScroll || !from || !to || syncingRef.current) return;
    syncingRef.current = true;
    const ratio = from.scrollTop / Math.max(1, from.scrollHeight - from.clientHeight);
    to.scrollTop = ratio * Math.max(0, to.scrollHeight - to.clientHeight);
    window.requestAnimationFrame(() => { syncingRef.current = false; });
  };

  const pane = (side: "base" | "current") => {
    const versionId = side === "base" ? baseVersionId : currentVersionId;
    const onChange = side === "base" ? onBaseChange : onCurrentChange;
    const version = qaVersions.find((item) => item.id === versionId);
    return (
      <div className="qaComparePane">
        <header className="qaComparePaneBar">
          <em>{side === "base" ? "基线版本" : "当前版本"}</em>
          <InlineSelect label={side === "base" ? "选择基线版本" : "选择当前版本"} trigger={<span>{version?.label ?? versionId}</span>}>
            {(close) => qaVersions.map((item) => (
              <button type="button" key={item.id} onClick={() => { onChange(item.id); close(); }}>
                {item.label}
                <small>{versionStatusLabel[item.status]} · {item.submittedAt}</small>
              </button>
            ))}
          </InlineSelect>
        </header>
        <div
          className="qaComparePaneScroll"
          ref={side === "base" ? leftRef : rightRef}
          onScroll={side === "base" ? linkScroll(leftRef.current, rightRef.current) : linkScroll(rightRef.current, leftRef.current)}
        >
          <article className="qaPage qaComparePage">
            <p className="qaPageNo">报告编号(NO.)： <b>{qaDocument.reportNo}</b></p>
            <h1>检测报告<small>TEST REPORT</small></h1>
            {/* 差异就地标出来。原型没有真 PDF，所以按字段列——
                位置是假的，但"哪个字段变了、变成什么"是真的。 */}
            <dl className="qaPageFields">
              {rows.length ? rows.map((row) => (
                <div className={`qaCompareField kind-${row.kind}`} key={row.id}>
                  <dt>{row.field}<small>{formatPageRef(row.page, row.innerPage)}</small></dt>
                  <dd>{side === "base" ? row.before : row.after}</dd>
                </div>
              )) : (
                <div><dt>样品名称<small>SAMPLE NAME</small></dt><dd>{qaDocument.sampleName}</dd></div>
              )}
            </dl>
            <footer className="qaPageFooter">{qaDocument.issuer}<span>{version?.label}</span></footer>
          </article>
        </div>
      </div>
    );
  };

  return (
    <section className="qaDetachedCanvas qaCompareCanvas">
      <header className="qaDetachedPanelBar">
        <span><GitCompare size={14} />文件比对</span>
        <span className="qaCompareCount">{rows.length} 处差异</span>
        <label className="qaCompareSync">
          <input type="checkbox" checked={syncScroll} onChange={(event) => onSyncScrollChange(event.target.checked)} />
          同步滚动
        </label>
        <button type="button" aria-label="将文件比对收回右侧面板" title="收回到右侧面板" onClick={onReturn}><Minimize2 size={15} /></button>
      </header>
      {rows.length ? null : (
        <p className="qaPanelHint qaCompareEmpty">这两版之间没有记录在案的差异。换一个基线版本再看。</p>
      )}
      <div className="qaCompareStage">
        {pane("base")}
        {pane("current")}
      </div>
    </section>
  );
}

/** 文档收回到 400px panel 后只保留页码和纸张，不再放缩略图轨与缩放工具。 */
function QaDocumentCompact({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
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
        <article className="qaPage">
          <p className="qaPageNo">报告编号(NO.)： <b>{qaDocument.reportNo}</b></p>
          <h1>检测报告<small>TEST REPORT</small></h1>
          <dl className="qaPageFields">
            <div><dt>样品名称<small>SAMPLE NAME</small></dt><dd>{qaDocument.sampleName}</dd></div>
            <div><dt>报告编号<small>REPORT NO.</small></dt><dd>{qaDocument.reportNo}</dd></div>
            <div><dt>检测类别<small>TEST TYPE</small></dt><dd>{qaDocument.testType}</dd></div>
            <div><dt>委托单位<small>APPLICANT</small></dt><dd>{qaDocument.applicant}</dd></div>
          </dl>
          <footer className="qaPageFooter">{qaDocument.issuer}<span>第 {page} 页 / 共 {qaDocument.pageCount} 页</span></footer>
        </article>
      </div>
    </div>
  );
}
