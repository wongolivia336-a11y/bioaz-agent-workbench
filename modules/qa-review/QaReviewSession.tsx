"use client";

import { Check, ChevronLeft, ChevronRight, Download, FileText, Maximize2, Minimize2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingChatDock } from "../../components/workbench-panel/FloatingChatDock";
import { PanelToggle, WorkbenchPanelBody } from "../../components/workbench-panel/WorkbenchPanel";
import { InlineSelect } from "../../components/workbench-shell/InlineSelect";
import { Button, StatusChip, type StatusTone } from "../../components/ui";
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

/* 撰写人端与审批人端是同一个 Session 的两种角色渲染，不是两个页面。
   左边永远是原件，右边永远是那三栏；角色只决定谁能落笔、顶栏出现哪个主操作。

   这个模块没有对话列，这是布局判断不是遗漏：审阅的主角是原件，
   用户 80% 的动作（读纸、点批注跳页、采纳/忽略）都发生在原件与批注之间，
   而这两者必须同屏——点一条批注要能立刻在纸上看到第几页。一个 tab 容器
   装不下同屏，所以对话不占一整列，收成常驻药丸浮在纸上。
   分工：问「为什么/怎么办」走药丸，做「采纳/忽略」走右侧列表。 */

/** 进原件全屏时至少放到这个倍数——一个不让纸变大的「全屏」是假的 */
const VIEWER_FOCUS_ZOOM = 140;

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
  const [panelFocus, setPanelFocus] = useState(false);
  const [activePanelId, setActivePanelId] = useState("ai-review");
  const [visiblePanelIds, setVisiblePanelIds] = useState(["ai-review", "ai-diff", "notes"]);
  const [versionId, setVersionId] = useState(qaVersions[0].id);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [findingStates, setFindingStates] = useState<Record<string, QaFindingState>>({});
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<QaNote[]>(qaInitialNotes);
  const [noteDraft, setNoteDraft] = useState("");
  const [outcome, setOutcome] = useState<"submitted" | "approved" | "rejected" | null>(null);
  const [viewerFocus, setViewerFocus] = useState(false);
  const [chatMessages, setChatMessages] = useState<QaChatMessage[]>(qaChatOpening);
  const [chatText, setChatText] = useState("");
  /** 退出全屏要还原用户自己调过的倍数，不是粗暴地设回 100 */
  const zoomBeforeFocus = useRef(zoom);

  const version = qaVersions.find((item) => item.id === versionId) ?? qaVersions[0];
  const openFindings = qaFindings.filter((finding) => (findingStates[finding.id] ?? "open") === "open").length;

  /* 「全屏」在用户脑子里只有一个意思：让我正在看的那个东西变大。
     DMPK 里那个东西是产物，所以铺开的是面板；QA 里是原件，所以铺开的是原件、
     面板让位。同一个手势两个方向，不是两套机制。 */
  const enterViewerFocus = () => {
    zoomBeforeFocus.current = zoom;
    setZoom((value) => Math.max(value, VIEWER_FOCUS_ZOOM));
    setPanelOpen(false);
    setPanelFocus(false);
    setViewerFocus(true);
  };

  const exitViewerFocus = () => {
    setZoom(zoomBeforeFocus.current);
    setPanelOpen(true);
    setViewerFocus(false);
  };

  useEffect(() => {
    if (!viewerFocus) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      /* 药丸展开态在捕获阶段自己先吃掉一次 Esc，轮到这里就只剩「退全屏」这一层。
         内联而不是调 exitViewerFocus，是为了不让这个 effect 每次渲染都重挂。 */
      setZoom(zoomBeforeFocus.current);
      setPanelOpen(true);
      setViewerFocus(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerFocus]);

  /* 面板全屏只对「AI文件比对」开放。切走或面板收起时自动退出，
     否则会剩下一块盖住原件、自己又没有出口的全屏面板。 */
  useEffect(() => {
    if (panelFocus && (!panelOpen || activePanelId !== "ai-diff")) setPanelFocus(false);
  }, [activePanelId, panelFocus, panelOpen]);

  const sendChat = () => {
    const question = chatText.trim();
    if (!question) return;
    const stamp = Date.now();
    setChatMessages((current) => [
      ...current,
      { id: `qa-chat-user-${stamp}`, role: "user", text: question },
      { id: `qa-chat-agent-${stamp}`, role: "agent", text: resolveQaReply(question) },
    ]);
    setChatText("");
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

  const panels = useMemo(() => getQaReviewPanels({
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

  return (
    <section className={`dmpkWorkspace qaReviewWorkspace ${panelFocus ? "isPanelFocus" : ""} ${viewerFocus ? "isViewerFocus" : ""}`}>
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
          ) : role === "author" ? (
            <Button
              variant="primary"
              size="small"
              disabled={openFindings > 0}
              title={openFindings > 0 ? `还有 ${openFindings} 条 AI 批注未处置` : undefined}
              onClick={() => resolveWith("submitted", `已逐条处置 ${qaFindings.length} 条 AI 批注，提交${version.label}终审。`)}
            >
              提交审批
            </Button>
          ) : role === "approver" ? (
            <>
              <Button variant="secondary" size="small" leadingIcon={<Undo2 size={14} />} onClick={() => resolveWith("rejected", "驳回：仍有时间逻辑未修订，请修改后重新提交。")}>驳回</Button>
              <Button variant="primary" size="small" leadingIcon={<Check size={14} />} onClick={() => resolveWith("approved", "经最终审核，该文档内容严谨合规、信息准确无误，同意通过本次终审。")}>通过</Button>
            </>
          ) : (
            <StatusChip tone="neutral">只读</StatusChip>
          )}
          {/* 原件全屏时面板是收起的，所以这颗按钮同时是回来的路——
              否则用户要先找到原件工具栏上那颗才退得出去。 */}
          <PanelToggle open={panelOpen} onToggle={() => { if (viewerFocus) { exitViewerFocus(); return; } setPanelOpen((value) => !value); }} />
        </div>
      </header>

      <div className="qaViewer">
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
            {/* 放大原件的手势贴着原件自己的工具栏，不跟面板那颗抢同一个词 */}
            <button
              type="button"
              className={viewerFocus ? "isActive" : ""}
              aria-label={viewerFocus ? "退出原件全屏" : "原件全屏"}
              aria-pressed={viewerFocus}
              title={viewerFocus ? "退出全屏（Esc）" : "原件全屏"}
              onClick={() => (viewerFocus ? exitViewerFocus() : enterViewerFocus())}
            >
              {viewerFocus ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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
      </div>

      <WorkbenchPanelBody
        panels={panels}
        visibleIds={visiblePanelIds}
        onVisibleIdsChange={setVisiblePanelIds}
        activePanelId={activePanelId}
        open={panelOpen}
        focus={panelFocus}
        onFocusChange={setPanelFocus}
        onPanelChange={setActivePanelId}
      />

      {/* 药丸在 QA 是常驻的，不像 DMPK 只在全屏时冒出来——这里没有对话列，
          它是找 QA 审核同事说话的唯一入口，收起态只占一行，不跟原件抢宽度。
          不自动聚焦：会话一打开用户要读的是纸，不是打字。 */}
      <FloatingChatDock
        messages={chatMessages}
        text={chatText}
        onTextChange={setChatText}
        onSend={sendChat}
        autoFocus={false}
        placeholder="问 QA 审核同事，例如：第 8 页那条时间逻辑怎么判的"
      />
    </section>
  );
}
