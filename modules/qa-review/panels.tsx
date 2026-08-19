"use client";

import { Bot, GitCompare, ListChecks, MessageSquarePlus, Sparkles, User } from "lucide-react";
import type { ResolvedInspectorPanel } from "../../components/workbench-inspector/WorkbenchInspector";
import { Button, StatusChip } from "../../components/ui";
import {
  diffBetween,
  formatPageRef,
  qaFindingCategoryLabel,
  qaFindingStateLabel,
  qaVersions,
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
  /* 问题清单由会话传进来，不再从模块直接 import——审批人划词加的那条
     是 source: "human" 的 QaFinding，和 AI 提的进同一个清单、同一套状态。
     直接 import 静态数组的话，新加的那条永远进不来。 */
  findings: QaFinding[];
  findingStates: Record<string, QaFindingState>;
  activeFindingId: string | null;
  notes: QaNote[];
  noteDraft: string;
  /** 比对基线。可改，所以「变更」面板的标题和取数都跟着它走 */
  baseVersionId: string;
  currentVersionId: string;
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
      content: <AiDiffPanel {...context} />,
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

function AiReviewPanel({ role, locked, findings, findingStates, activeFindingId, onFindingState, onFocusFinding }: PanelContext) {
  const groups = (Object.keys(qaFindingCategoryLabel) as QaFindingCategory[])
    .map((category) => ({ category, items: findings.filter((finding) => finding.category === category) }))
    .filter((group) => group.items.length);
  const open = findings.filter((finding) => (findingStates[finding.id] ?? "open") === "open").length;
  const human = findings.filter((finding) => finding.source === "human").length;

  return (
    <div className="qaPanel">
      <header className="qaPanelHead">
        <div>
          <strong>审核结果</strong>
          <small>{findings.length} 条 · {open} 条待处置{human ? ` · 人工 ${human} 条` : ""}</small>
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
                    {/* 标签取 category，不再按 severity 二选一——
                        原来是「error → 逻辑错误 / 其余 → 页码问题」，
                        于是内容一致性和人工批注全被标成"页码问题"。 */}
                    <em className={`qaFindingTag tone-${finding.severity}`}>
                      {qaFindingCategoryLabel[finding.category]}
                    </em>
                    {/* 人工提的要看得出来：审批人事后要知道哪条是自己写的 */}
                    {finding.source === "human" ? <em className="qaFindingTag tone-human">人工</em> : null}
                    <small>{formatPageRef(finding.docPage, finding.innerPage)}</small>
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

function AiDiffPanel({ baseVersionId, currentVersionId }: PanelContext) {
  const rows = diffBetween(baseVersionId, currentVersionId);
  const base = qaVersions.find((item) => item.id === baseVersionId);
  const current = qaVersions.find((item) => item.id === currentVersionId);
  const summary = {
    added: rows.filter((row) => row.kind === "added").length,
    removed: rows.filter((row) => row.kind === "removed").length,
    changed: rows.filter((row) => row.kind === "changed").length,
  };

  return (
    <div className="qaPanel">
      <header className="qaPanelHead">
        <div>
          {/* 标题由版本对推出来，不再写死「第二版 → 第三版」——基线是可改的 */}
          <strong>{base?.label ?? baseVersionId} → {current?.label ?? currentVersionId}</strong>
          <small>{rows.length} 处差异</small>
        </div>
      </header>

      {rows.length ? (
        <>
          <div className="qaDiffSummary">
            <span className="kind-added">新增 {summary.added}</span>
            <span className="kind-changed">修改 {summary.changed}</span>
            <span className="kind-removed">删除 {summary.removed}</span>
          </div>
          <div className="qaDiffList">
            {rows.map((row) => (
              <article className={`qaDiffRow kind-${row.kind}`} key={row.id}>
                <header>
                  <strong>{row.field}</strong>
                  <small>{formatPageRef(row.page, row.innerPage)}</small>
                </header>
                <div className="qaDiffPair">
                  <span className="qaDiffBefore">{row.before}</span>
                  <span className="qaDiffAfter">{row.after}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        /* 老实说没有，不拿别的版本对的数据凑 */
        <p className="qaPanelHint">这两版之间没有记录在案的差异。换一个基线版本再看。</p>
      )}
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
