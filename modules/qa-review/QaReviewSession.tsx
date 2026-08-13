"use client";

import { Check, ChevronLeft, ChevronRight, Download, FileText, GitCompare, Minimize2, Send, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { FloatingChatDock } from "../../components/workbench-panel/FloatingChatDock";
import { PanelToggle, WorkbenchPanelBody } from "../../components/workbench-panel/WorkbenchPanel";
import { AgentReply, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { InlineSelect } from "../../components/workbench-shell/InlineSelect";
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

export default function QaReviewSession({ projectName, taskTitle, viewerRole = "approver" }: AgentModuleSessionProps) {
  const role = viewerRole as QaViewerRole;
  const [panelOpen, setPanelOpen] = useState(true);
  const [activePanelId, setActivePanelId] = useState("ai-review");
  const [visiblePanelIds, setVisiblePanelIds] = useState(["document", "ai-review", "ai-diff", "notes"]);
  /* 从收件箱进入默认把文档弹到主位；收回后主位恢复为标准 chatflow。 */
  const [poppedPanelId, setPoppedPanelId] = useState<QaPoppedPanelId | null>("document");
  const [versionId, setVersionId] = useState(qaVersions[0].id);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [findingStates, setFindingStates] = useState<Record<string, QaFindingState>>({});
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<QaNote[]>(qaInitialNotes);
  const [noteDraft, setNoteDraft] = useState("");
  const [outcome, setOutcome] = useState<"submitted" | "approved" | "rejected" | null>(null);
  const [chatMessages, setChatMessages] = useState<QaChatMessage[]>(qaChatOpening);
  const [chatText, setChatText] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ComposerAttachment[]>([]);

  const version = qaVersions.find((item) => item.id === versionId) ?? qaVersions[0];
  const openFindings = qaFindings.filter((finding) => (findingStates[finding.id] ?? "open") === "open").length;

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
          <div className="dmpkChatScroller"><div className="dmpkConversation">
            {chatMessages.map((message) => message.role === "agent"
              ? <AgentReply key={message.id}>{message.text}</AgentReply>
              : <UserBubble key={message.id} text={message.text} attachments={message.attachments} />)}
          </div></div>
          <footer className="qaChatComposerStack">
            {!outcome ? (
              <section className="warningDecision qaApprovalCard">
                <header className="warningDecisionHeader"><div><span>审批决策</span><strong>{role === "author" ? "处置完成后提交审批" : role === "approver" ? "确认本版审核结论" : "负责人视角为只读"}</strong><p>{openFindings} 条 AI 批注仍待处置，结论会写入审批记录。</p></div><small>{role === "owner" ? "只读" : "待确认"}</small></header>
                {role === "author" ? <div className="warningActions"><Button variant="primary" size="small" disabled={openFindings > 0} title={openFindings > 0 ? `还有 ${openFindings} 条 AI 批注未处置` : undefined} onClick={() => resolveWith("submitted", `已逐条处置 ${qaFindings.length} 条 AI 批注，提交${version.label}终审。`)}>提交审批</Button></div>
                  : role === "approver" ? <div className="warningActions"><Button variant="secondary" size="small" leadingIcon={<Undo2 size={14} />} onClick={() => resolveWith("rejected", "驳回：仍有时间逻辑未修订，请修改后重新提交。")}>驳回</Button><Button variant="primary" size="small" leadingIcon={<Check size={14} />} onClick={() => resolveWith("approved", "经最终审核，该文档内容严谨合规、信息准确无误，同意通过本次终审。")}>通过</Button></div> : null}
              </section>
            ) : null}
            <WorkbenchComposer className="qaChatComposer" attachments={chatAttachments} onAttachmentsChange={setChatAttachments} project={projectName} activeCoworkerId="qa-review" globalDrop>
              <textarea rows={1} value={chatText} placeholder="问 QA 审核同事，例如：第 8 页那条时间逻辑怎么判的" onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendChat(); } }} />
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

      {poppedPanelId ? <FloatingChatDock
        messages={chatMessages}
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
