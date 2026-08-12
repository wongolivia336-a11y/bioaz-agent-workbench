"use client";

import { Bot, Check, CornerUpRight, FileText, Inbox, Sparkles, Undo2, User } from "lucide-react";
import { useMemo, useState } from "react";
import {
  inboxActionLabel,
  inboxItems,
  inboxKindLabel,
  inboxRoleLabel,
  type InboxAccount,
  type InboxAction,
  type InboxItem,
  type InboxLane,
} from "../../lib/workbench/mockInbox";
import { Button, EmptyState, NavTabs, StatusChip, type StatusTone } from "../ui";
import { InlineSelect } from "./InlineSelect";

/**
 * 收件箱 —— shell 层能力，不是 module。
 *
 * 它只消费 InboxItem[] 这一个契约，不认识任何具体 module；反过来 module
 * 也不认识收件箱，只往事件流里投递状态迁移。这样 DMPK 报价以后要走审批，
 * 投同样的事件即可，这里一行都不用改。
 *
 * 左右两栏是「索引 + 原件摘要」，不是聊天双栏：右侧放的是决策所需的全部
 * 事实与动作，看细节才跳进任务本体。审批结论必须落在文档版本上、可追溯，
 * 所以这里不提供自由对话入口。
 */

type Props = {
  account: InboxAccount;
  /** 已处理条目提升到 shell 持有，否则侧栏徽标和这里的计数会各算各的 */
  resolved: Record<string, string>;
  onResolve: (itemId: string, note: string) => void;
  /** 收件箱不认识 module，只喊「把这份文件的审阅台打开」，由 shell 决定落点 */
  onOpenReview: (docTitle: string, project: string) => void;
};

const laneTabs: Array<{ id: InboxLane; label: string }> = [
  { id: "todo", label: "待我处理" },
  { id: "feed", label: "动态" },
];

const kindTone: Record<string, StatusTone> = {
  submit: "running",
  aiReview: "warning",
  reject: "danger",
  approve: "success",
  archive: "neutral",
  handoff: "warning",
};

const priorityLabel = { high: "高优先级", medium: "中优先级", low: "低优先级" } as const;

export function InboxPage({ account, resolved, onResolve, onOpenReview }: Props) {
  const [lane, setLane] = useState<InboxLane>("todo");
  const [projectFilter, setProjectFilter] = useState("全部项目");
  const [priorityFilter, setPriorityFilter] = useState("全部优先级");
  /** 看过即褪：仅作用于「动态」栏，不影响徽标 */
  const [read, setRead] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectDraft, setRejectDraft] = useState<string | null>(null);

  const mine = useMemo(
    () => inboxItems.filter((item) => item.audienceRole === account.role),
    [account.role],
  );
  const projects = useMemo(
    () => ["全部项目", ...Array.from(new Set(mine.map((item) => item.project)))],
    [mine],
  );

  const laneItems = mine.filter((item) => (
    item.lane === lane
    && !resolved[item.id]
    && (projectFilter === "全部项目" || item.project === projectFilter)
    && (priorityFilter === "全部优先级" || priorityLabel[item.priority] === priorityFilter)
  ));
  const todoCount = mine.filter((item) => item.lane === "todo" && !resolved[item.id]).length;
  const feedCount = mine.filter((item) => item.lane === "feed" && !resolved[item.id]).length;
  const selected = laneItems.find((item) => item.id === selectedId) ?? laneItems[0] ?? null;

  const select = (item: InboxItem) => {
    setSelectedId(item.id);
    setRejectDraft(null);
    if (item.lane === "feed" && !read.includes(item.id)) setRead((current) => [...current, item.id]);
  };
  const resolve = (item: InboxItem, action: InboxAction, note?: string) => {
    onResolve(item.id, note ? `${inboxActionLabel[action]}：${note}` : inboxActionLabel[action]);
    setRejectDraft(null);
    setSelectedId(null);
  };

  return (
    <section className="inboxPage">
      <NavTabs
        items={[
          { id: "todo" as InboxLane, label: laneTabs[0].label, count: todoCount },
          { id: "feed" as InboxLane, label: laneTabs[1].label, count: feedCount },
        ]}
        value={lane}
        onChange={(next) => { setLane(next); setSelectedId(null); setRejectDraft(null); }}
        label="收件箱分栏"
        className="inboxLaneTabs"
      >
        <div className="inboxFilters">
          <InlineSelect label="按项目筛选" trigger={<span>{projectFilter}</span>}>
            {(close) => projects.map((name) => (
              <button type="button" key={name} onClick={() => { setProjectFilter(name); close(); }}>{name}</button>
            ))}
          </InlineSelect>
          <InlineSelect label="按优先级筛选" trigger={<span>{priorityFilter}</span>} align="end">
            {(close) => ["全部优先级", ...Object.values(priorityLabel)].map((name) => (
              <button type="button" key={name} onClick={() => { setPriorityFilter(name); close(); }}>{name}</button>
            ))}
          </InlineSelect>
        </div>
      </NavTabs>

      <p className="inboxLaneHint">
        {lane === "todo"
          ? `以「${account.roleLabel}」岗位收件。做出动作后条目才会消失，只是点开看过不算处理完。`
          : "与你相关的流转记录。看过即褪为灰色，不计入待办，随时可回溯。"}
      </p>

      <div className="inboxBody">
        <div className="inboxList" role="list">
          {laneItems.length ? laneItems.map((item) => (
            <button
              className={`inboxRow ${selected?.id === item.id ? "isActive" : ""} ${item.lane === "feed" && read.includes(item.id) ? "isRead" : ""}`}
              type="button"
              role="listitem"
              key={item.id}
              onClick={() => select(item)}
            >
              <span className={`inboxRowAvatar ${item.agent ? "isAgent" : ""}`} aria-hidden="true">
                {item.agent ? <Bot size={14} /> : <User size={14} />}
              </span>
              <span className="inboxRowMain">
                <span className="inboxRowTop">
                  <StatusChip tone={kindTone[item.kind]} dot>{inboxKindLabel[item.kind]}</StatusChip>
                  <strong>{item.docTitle}</strong>
                </span>
                <span className="inboxRowMeta">
                  {item.actorName} · {item.actorRole} · {item.project}
                </span>
              </span>
              <span className="inboxRowSide">
                <small>{item.time}</small>
                {item.priority === "high" ? <em className="inboxRowPriority">高优</em> : null}
              </span>
            </button>
          )) : (
            <EmptyState
              icon={<Inbox size={20} />}
              title={lane === "todo" ? "没有待你处理的事项" : "暂无相关动态"}
              description={lane === "todo" ? `当前以「${account.roleLabel}」岗位收件，换个账号可以看到别的队列。` : undefined}
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
                <div className="inboxCardChips">
                  <StatusChip tone={kindTone[selected.kind]} dot>{inboxKindLabel[selected.kind]}</StatusChip>
                  <StatusChip tone={selected.priority === "high" ? "danger" : "neutral"}>{priorityLabel[selected.priority]}</StatusChip>
                </div>
              </header>

              <p className="inboxCardFlow">
                <span className={selected.agent ? "isAgent" : ""}>{selected.actorName}<em>{selected.actorRole}</em></span>
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
