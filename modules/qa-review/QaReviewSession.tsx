"use client";

import { Check, ChevronLeft, ChevronRight, Download, FileText, GitCompare, Maximize2, Minimize2, Send, Undo2, ZoomIn, ZoomOut } from "lucide-react";
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
  qaChatOpening,
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
  const openFindings = qaFindings.filter((finding) => (findingStates[finding.id] ?? "open") === "open").length;
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
    findingStates,
    activeFindingId,
    notes,
    noteDraft,
    onFindingState: (findingId, state) => setFindingStates((current) => ({ ...current, [findingId]: state })),
    onFocusFinding: focusFinding,
    onNoteDraftChange: setNoteDraft,
    onAddNote: addNote,
  // focusFinding / addNote 只读上面这些 state，跟着它们一起失效即可
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [role, outcome, findingStates, activeFindingId, notes, noteDraft]);

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

          <div className="qaPageScroll">
            {/* 原型不渲染真 PDF，只按版式给出一张可信的占位页，
                这样批注定位到第几页仍然说得通。 */}
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
        <section className="qaDetachedCanvas qaDetachedPanelCanvas">
          <header className="qaDetachedPanelBar">
            <span><GitCompare size={14} />AI 文件比对</span>
            <button type="button" aria-label="将 AI 文件比对收回右侧面板" title="收回到右侧面板" onClick={returnPoppedPanel}><Minimize2 size={15} /></button>
          </header>
          <div className="qaDetachedPanelBody">{poppedPanel?.content}</div>
        </section>
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
