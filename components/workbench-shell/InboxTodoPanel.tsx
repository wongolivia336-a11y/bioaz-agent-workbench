"use client";

import { Bot, Check, CornerUpRight, FileText, Inbox, Sparkles, Undo2, User } from "lucide-react";
import { useState } from "react";
import {
  inboxActionLabel,
  inboxItems,
  inboxKindLabel,
  inboxRoleLabel,
  type InboxAccount,
  type InboxAction,
  type InboxItem,
} from "../../lib/workbench/mockInbox";
import { Button, EmptyState, StatusChip, type StatusTone } from "../ui";

/**
 * 「待我处理」——项目中枢的第一个 tab。
 *
 * 它跟「动态」的生命周期不同，这是把两者分开的全部理由：这里的条目只有在
 * 你**落了动作**（通过 / 驳回 / 去修订）之后才消失，点开看过一百次都还在，
 * 侧栏徽标数就是这里的条数。动态那边看过即褪，且永远不进徽标。
 *
 * 它只消费 InboxItem[]，不认识任何 module；module 往事件流里投递状态迁移，
 * 也不认识这个面板。收件人是岗位不是人。
 */

type Props = {
  account: InboxAccount;
  /** 跟着项目中枢的项目筛选器走。null = 全部项目，这就是"跨项目"的实现方式 */
  projectFilter: string | null;
  resolved: Record<string, string>;
  onResolve: (itemId: string, note: string) => void;
  /** 只喊「把这份文件的审阅台打开」，由 shell 决定落到哪个 module */
  onOpenReview: (docTitle: string, project: string) => void;
};

const kindTone: Record<string, StatusTone> = {
  submit: "running",
  aiReview: "warning",
  reject: "danger",
  approve: "success",
  archive: "neutral",
  handoff: "warning",
};

const priorityLabel = { high: "高优先级", medium: "中优先级", low: "低优先级" } as const;

export function InboxTodoPanel({ account, projectFilter, resolved, onResolve, onOpenReview }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectDraft, setRejectDraft] = useState<string | null>(null);

  const items = inboxItems.filter((item) => (
    item.lane === "todo"
    && item.audienceRole === account.role
    && !resolved[item.id]
    && (!projectFilter || item.project === projectFilter)
  ));
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const resolve = (item: InboxItem, action: InboxAction, note?: string) => {
    onResolve(item.id, note ? `${inboxActionLabel[action]}：${note}` : inboxActionLabel[action]);
    setRejectDraft(null);
    setSelectedId(null);
  };

  /* 顶上原来有一句「以审批人岗位收件 · 全部项目。做出动作后条目才会消失…」，
     已删。左下角写着你是审批人、顶栏筛选器写着全部项目，这句话一个新信息都
     没有；剩下半句是教学，用户看一次就够，之后天天占一行。 */
  return (
    <section className="projectTabPanel inboxTodoPanel">
      <div className="inboxBody">
        <div className="inboxList" role="list">
          {items.length ? items.map((item) => (
            <button
              className={`inboxRow ${selected?.id === item.id ? "isActive" : ""}`}
              type="button"
              role="listitem"
              key={item.id}
              onClick={() => { setSelectedId(item.id); setRejectDraft(null); }}
            >
              <span className={`inboxRowAvatar ${item.agent ? "isAgent" : ""}`} aria-hidden="true">
                {item.agent ? <Bot size={14} /> : <User size={14} />}
              </span>
              <span className="inboxRowMain">
                <span className="inboxRowTop">
                  <StatusChip tone={kindTone[item.kind]} dot>{inboxKindLabel[item.kind]}</StatusChip>
                  <strong>{item.docTitle}</strong>
                </span>
                <span className="inboxRowMeta">{item.actorName} · {item.actorRole} · {item.project}</span>
              </span>
              <span className="inboxRowSide">
                <small>{item.time}</small>
                {item.priority === "high" ? <em className="inboxRowPriority">高优</em> : null}
              </span>
            </button>
          )) : (
            <EmptyState
              icon={<Inbox size={20} />}
              title="没有待你处理的事项"
              description={projectFilter ? "换成「全部项目」看看其他项目里的队列。" : `当前以「${account.roleLabel}」岗位收件，换个账号可以看到别的队列。`}
            />
          )}
        </div>

        <div className="inboxDetail">
          {selected ? (
            <article className="inboxCard">
              <header className="inboxCardHead">
                <div className="inboxCardTitle">
                  <FileText size={16} />
                  <div>
                    <strong>{selected.docTitle}</strong>
                    <small>{selected.docId} · {selected.version}</small>
                  </div>
                </div>
                {/* 状态与优先级降成灰字：你都点进来了才看到它，列表里已经说过一遍。
                    这张卡里的彩色额度全部留给 AI 批注——那才是要你做判断的东西。 */}
                <p className="inboxCardStatus">
                  {inboxKindLabel[selected.kind]}
                  <span aria-hidden="true">·</span>
                  {priorityLabel[selected.priority]}
                </p>
              </header>

              <p className="inboxCardFlow">
                <span>{selected.actorName}<em>{selected.actorRole}</em></span>
                <CornerUpRight size={14} />
                <span className="isMe">你<em>{inboxRoleLabel[selected.audienceRole]}岗位</em></span>
              </p>

              <p className="inboxCardSummary">{selected.summary}</p>

              {selected.findings?.length ? (
                <div className="inboxCardFindings">
                  {selected.findings.map((finding) => (
                    <span className={`inboxFinding tone-${finding.tone}`} key={finding.label}>
                      <Sparkles size={12} />{finding.label}<b>{finding.count}</b>
                    </span>
                  ))}
                </div>
              ) : null}

              {selected.claimedBy ? (
                <p className="inboxCardClaim">同岗位的 {selected.claimedBy} 正在处理这条，注意重复审批。</p>
              ) : null}

              <dl className="inboxCardMeta">
                <div><dt>项目</dt><dd>{selected.project}</dd></div>
                <div><dt>所属任务</dt><dd>{selected.taskTitle}</dd></div>
                <div><dt>版本</dt><dd>{selected.version}</dd></div>
                <div><dt>到达时间</dt><dd>{selected.time}</dd></div>
              </dl>

              <section className="inboxCardTimeline" aria-label="流转记录">
                <h4>流转记录</h4>
                <ol>
                  {selected.timeline.map((entry) => (
                    <li key={`${entry.time}-${entry.text}`}>
                      <span className={`inboxTimelineDot ${entry.agent ? "isAgent" : ""}`} aria-hidden="true" />
                      <div>
                        <strong>{entry.actor}</strong>
                        <small>{entry.time}</small>
                        <p>{entry.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {rejectDraft !== null ? (
                <div className="inboxRejectDraft">
                  <label htmlFor="inbox-reject-reason">驳回理由（会写入审计轨迹，必填）</label>
                  <textarea
                    id="inbox-reject-reason"
                    autoFocus
                    rows={3}
                    value={rejectDraft}
                    placeholder="例如：盖章日期早于批准时间，请修订第 8 页后重新提交。"
                    onChange={(event) => setRejectDraft(event.target.value)}
                  />
                </div>
              ) : null}

              <footer className="inboxCardActions">
                <Button variant="ghost" onClick={() => onOpenReview(selected.docTitle, selected.project)}>
                  打开文件逐条审阅
                </Button>
                <div className="inboxCardActionsRight">
                  {rejectDraft !== null ? (
                    <>
                      <Button variant="secondary" onClick={() => setRejectDraft(null)}>取消</Button>
                      <Button variant="danger" disabled={!rejectDraft.trim()} onClick={() => resolve(selected, "reject", rejectDraft.trim())}>确认驳回</Button>
                    </>
                  ) : (
                    selected.actions.map((action) => (
                      action === "reject" ? (
                        <Button key={action} variant="secondary" leadingIcon={<Undo2 size={16} />} onClick={() => setRejectDraft("")}>
                          {inboxActionLabel[action]}
                        </Button>
                      ) : (
                        <Button
                          key={action}
                          variant={action === "acknowledge" ? "secondary" : "primary"}
                          leadingIcon={action === "approve" ? <Check size={16} /> : undefined}
                          onClick={() => resolve(selected, action)}
                        >
                          {inboxActionLabel[action]}
                        </Button>
                      )
                    ))
                  )}
                </div>
              </footer>
            </article>
          ) : (
            <EmptyState icon={<Inbox size={20} />} title="选择左侧一条事项" description="右侧会展开这条流转的全部事实与可做的动作。" />
          )}
        </div>
      </div>
    </section>
  );
}
