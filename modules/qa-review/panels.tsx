"use client";

import { Bot, GitCompare, ListChecks, MessageSquarePlus, Sparkles, User } from "lucide-react";
import type { ResolvedInspectorPanel } from "../../components/workbench-inspector/WorkbenchInspector";
import { Button, StatusChip } from "../../components/ui";
import {
  qaDiffRows,
  qaFindingCategoryLabel,
  qaFindingStateLabel,
  qaFindings,
  type QaFinding,
  type QaFindingCategory,
  type QaFindingState,
  type QaNote,
} from "./reviewData";

/* 右侧三个面板，对应撰写人端与审批人端共有的那三栏。
   同一套面板按角色换的是「能不能落笔」，不是换一整个页面——
   角色是数据，不是路由。 */

export type QaViewerRole = "author" | "approver" | "owner";

type PanelContext = {
  role: QaViewerRole;
  /* 文档一旦有了结论（提交 / 通过 / 驳回），批注与备注就冻结。
     结论属于文档版本而不是某个查看者，所以换账号也解冻不了。 */
  locked: boolean;
  findingStates: Record<string, QaFindingState>;
  activeFindingId: string | null;
  notes: QaNote[];
  noteDraft: string;
  onFindingState: (findingId: string, state: QaFindingState) => void;
  onFocusFinding: (finding: QaFinding) => void;
  onNoteDraftChange: (value: string) => void;
  onAddNote: () => void;
};

/* expandable 在这里被收窄到只剩「AI文件比对」一栏，这是刻意的。
   「全屏」在用户脑子里的意思是「让我正在看的那个东西变大」——QA 里那个东西
   是原件，所以放大原件的手势留在原件工具栏上；面板全屏只在放宽真能多看到
   东西的时候才给。批注和备注都是窄条目列表，撑到全屏只是每行变长；
   只有 qaDiffPair 是左右并排两列，400px 里两边都被挤成竖条。
   剩下两栏的按钮不会消失，只置灰并给出理由（见 WorkbenchPanelBody）。 */
export function getQaReviewPanels(context: PanelContext): ResolvedInspectorPanel[] {
  return [
    {
      id: "ai-review",
      label: "AI文件审核",
      icon: Sparkles,
      state: "populated",
      isDefault: true,
      primary: true,
      expandable: false,
      content: <AiReviewPanel {...context} />,
    },
    {
      id: "ai-diff",
      label: "AI文件比对",
      icon: GitCompare,
      state: "populated",
      isDefault: false,
      primary: true,
      expandable: true,
      content: <AiDiffPanel />,
    },
    {
      id: "notes",
      label: "审批备注",
      icon: ListChecks,
      state: "populated",
      isDefault: false,
      primary: true,
      expandable: false,
      content: <NotesPanel {...context} />,
    },
  ];
}

function AiReviewPanel({ role, locked, findingStates, activeFindingId, onFindingState, onFocusFinding }: PanelContext) {
  const groups = (Object.keys(qaFindingCategoryLabel) as QaFindingCategory[])
    .map((category) => ({ category, items: qaFindings.filter((finding) => finding.category === category) }))
    .filter((group) => group.items.length);
  const open = qaFindings.filter((finding) => (findingStates[finding.id] ?? "open") === "open").length;

  return (
    <div className="qaPanel">
      <header className="qaPanelHead">
        <div>
          <strong>AI 智能审核结果</strong>
          <small>{qaFindings.length} 条批注 · {open} 条待处置</small>
        </div>
        <StatusChip tone={open ? "warning" : "success"} dot>{open ? "待处置" : "全部处置完"}</StatusChip>
      </header>

      {locked ? (
        <p className="qaPanelHint">本版已有审批结论，批注冻结为只读。要再改就得提交新版本。</p>
      ) : role === "author" ? (
        <p className="qaPanelHint">逐条处置后才能提交审批。忽略也算处置，但要在审批备注里说明理由。</p>
      ) : (
        <p className="qaPanelHint">撰写人的处置结论在每条右侧。你可以采纳，也可以驳回整份。</p>
      )}

      {groups.map((group, index) => (
        <section className="qaFindingGroup" key={group.category}>
          <h4>{index + 1}. {qaFindingCategoryLabel[group.category]}</h4>
          {group.items.map((finding) => {
            const state = findingStates[finding.id] ?? "open";
            return (
              <article
                className={`qaFinding state-${state} ${activeFindingId === finding.id ? "isActive" : ""}`}
                key={finding.id}
              >
                <button className="qaFindingBody" type="button" onClick={() => onFocusFinding(finding)}>
                  <span className="qaFindingTop">
                    <em className={`qaFindingTag tone-${finding.severity}`}>
                      {finding.severity === "error" ? "逻辑错误" : "页码问题"}
                    </em>
                    <small>
                      文档第 {finding.docPage} 页{finding.innerPage ? ` / 内部 ${finding.innerPage}` : ""}
                    </small>
                  </span>
                  <p>[{finding.recordId}] {finding.text}</p>
                </button>
                <footer className="qaFindingActions">
                  <span className={`qaFindingState state-${state}`}>{qaFindingStateLabel[state]}</span>
                  {role === "author" && !locked ? (
                    <span className="qaFindingButtons">
                      <button type="button" className={state === "accepted" ? "isOn" : ""} onClick={() => onFindingState(finding.id, state === "accepted" ? "open" : "accepted")}>采纳</button>
                      <button type="button" className={state === "dismissed" ? "isOn" : ""} onClick={() => onFindingState(finding.id, state === "dismissed" ? "open" : "dismissed")}>忽略</button>
                    </span>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function AiDiffPanel() {
  return (
    <div className="qaPanel">
      <header className="qaPanelHead">
        <div>
          <strong>与上一版的差异</strong>
          <small>第二版 → 第三版 · {qaDiffRows.length} 处</small>
        </div>
      </header>
      <p className="qaPanelHint">审批人只需要看改了什么，不必重读全文。整段新增用绿色，修改左右并排。</p>
      <div className="qaDiffList">
        {qaDiffRows.map((row) => (
          <article className={`qaDiffRow kind-${row.kind}`} key={`${row.page}-${row.field}`}>
            <header>
              <strong>{row.field}</strong>
              <small>第 {row.page} 页</small>
            </header>
            <div className="qaDiffPair">
              <span className="qaDiffBefore">{row.before}</span>
              <span className="qaDiffAfter">{row.after}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function NotesPanel({ role, locked, notes, noteDraft, onNoteDraftChange, onAddNote }: PanelContext) {
  const canWrite = role !== "owner" && !locked;
  return (
    <div className="qaPanel qaNotesPanel">
      <header className="qaPanelHead">
        <div>
          <strong>审批结果</strong>
          <small>{notes.length} 条备注 · 全部写入审计轨迹</small>
        </div>
      </header>

      <div className="qaNoteList">
        {notes.map((note) => (
          <article className={`qaNote source-${note.source}`} key={note.id}>
            <span className="qaNoteAvatar" aria-hidden="true">
              {note.source === "ai" ? <Bot size={13} /> : <User size={13} />}
            </span>
            <div>
              <header>
                <em>{note.source === "ai" ? "AI" : "人工"}</em>
                <strong>{note.author}</strong>
                <small>{note.time}</small>
              </header>
              <p>{note.text}</p>
            </div>
          </article>
        ))}
      </div>

      {canWrite ? (
        <div className="qaNoteComposer">
          <label htmlFor="qa-note-draft" className="qaNoteComposerLabel">
            <em>人工</em>手动新增备注
          </label>
          <textarea
            id="qa-note-draft"
            rows={3}
            value={noteDraft}
            placeholder={role === "approver" ? "写明结论与依据，例如：第 8 页盖章日期已修订，符合流程顺序，同意通过。" : "写明你对某条 AI 批注的处置理由。"}
            onChange={(event) => onNoteDraftChange(event.target.value)}
          />
          <Button variant="primary" leadingIcon={<MessageSquarePlus size={16} />} disabled={!noteDraft.trim()} onClick={onAddNote}>
            提交备注
          </Button>
        </div>
      ) : (
        <p className="qaPanelHint">
          {locked ? "本版已有审批结论，备注冻结为只读。" : "负责人视角只读。备注由撰写人与审批人落笔，你看到的是最终轨迹。"}
        </p>
      )}
    </div>
  );
}
