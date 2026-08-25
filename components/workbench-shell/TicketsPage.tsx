"use client";

import { ArrowLeft, Bot, ChevronLeft, ChevronRight, Highlighter, Paperclip, Search, Settings, Upload, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StatusChip } from "../ui";
import {
  dmpkQuoteLines,
  initialNotices,
  minutesFromLabel,
  noticeSourceLabel,
  ticketKindLabel,
  ticketStatusLabel,
  ticketStatusTone,
  type Notice,
  type Ticket,
} from "../../lib/workbench/ticketData";
import { CompactSelect } from "./ShellControls";

const PAGE_SIZE = 10;

/* 状态是筛选,不是视图。分成「站内信 / 工单」两栏曾经让同一批东西看起来像两批,
   而它们本来就是一批:一条消息,背后可能挂着一件要你办的事,也可能只是知会。
   所以列表只有一个,状态收进筛选栏——台账没被删,是化进列表了。 */
const STATUS_OPTIONS = ["待我处理", "全部", "待处理", "处理中", "已驳回", "已完成", "已作废", "仅通知"] as const;

/** 一行要么是一张工单（有人欠着一件事），要么是一条纯通知（知会，看过就翻篇）。 */
type Row =
  | { kind: "ticket"; at: number; ticket: Ticket }
  | { kind: "notice"; at: number; notice: Notice };

const sourceIcon = { person: User, coworker: Bot, system: Settings };

/**
 * 收件箱。两个视图看同一批对象:
 *
 *   站内信 —— 消息流。谁给了你一件事、什么时候。只读,按时间排。
 *   工单   —— 台账。状态、当前处理人、可筛可查。
 *
 * 分成两个视图而不是揉成一张表,是因为它们回答的问题不同:一个是「今天有什么
 * 新的」,一个是「那件事现在在谁那儿」。上一版把状态筛选挂在消息列表上,
 * 结果两个问题都答得含糊。
 */
export function TicketsPage({
  tickets,
  currentUser,
  projects,
  onHandle,
  onAccept,
  onCreate,
}: {
  tickets: Ticket[];
  /** 当前账号。侧栏那个切换器一换，「待我处理」跟着换——同一张单在不同角色眼里是不同的事。 */
  currentUser: string;
  projects: string[];
  /** 带到会话里处理（QA 审核走这条:它要跟数字同事一起看） */
  onHandle: (ticket: Ticket) => void;
  /** 只接手、不跳走（DMPK 报价复核走这条:全程人工，就在这一页做完） */
  onAccept: (ticket: Ticket) => void;
  /* 交接入口已经搬进会话（干完活那一下顺手交出去）。这里留成可选:工单不是
     「新建」出来的,在一个收信的页面上放「发出去」的按钮语义也拧。 */
  onCreate?: () => void;
}) {
  const [status, setStatus] = useState<string>("待我处理");
  const [keyword, setKeyword] = useState("");
  const [openNotice, setOpenNotice] = useState<Notice | null>(null);
  const [kind, setKind] = useState("全部类型");
  const [project, setProject] = useState("全部项目");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  /* 读过哪几条。站内信是通知,通知只有「看没看过」这一个状态——
     它跟工单自己的状态是两回事,所以存在这一层,不写进 Ticket。 */
  const [readIds, setReadIds] = useState<string[]>([]);
  /* 批注按工单存。放在这一层而不是详情组件里,是因为详情会随返回列表卸载——
     写了一半的批注不该因为回去看一眼列表就没了。 */
  const [notesByTicket, setNotesByTicket] = useState<Record<string, Record<string, string>>>({});
  /* 顶栏不再挂 tab——列表只有一个,没有视图可切。待我处理的数量在侧栏那颗徽标上。 */
  const [topbarPrimaryHost, setTopbarPrimaryHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTopbarPrimaryHost(document.getElementById("workbench-topbar-primary"));
  }, []);

  /* 工单和通知在同一个列表里,按时间倒着排。它们本来就是一批东西:
     一条消息,背后可能挂着一件要你办的事,也可能只是知会。 */
  const filtered = useMemo<Row[]>(() => {
    const text = keyword.trim().toLowerCase();
    const ticketRows: Row[] = tickets
      .filter((ticket) => {
        if (status === "仅通知") return false;
        if (status === "待我处理") {
          /* 判据是 assignee,不是状态名。「已驳回」是从审批人视角起的名字,可球这时候
             正在撰写人手上——他要改完重交,那就是他的待办。用状态名筛会让撰写人
             看到一片空白,而他其实欠着一件事。 */
          if (ticket.assignee !== currentUser) return false;
          if (ticket.status === "done" || ticket.status === "dropped") return false;
        } else if (status !== "全部" && ticketStatusLabel[ticket.status] !== status) return false;
        if (kind !== "全部类型" && ticketKindLabel[ticket.kind] !== kind) return false;
        if (project !== "全部项目" && ticket.project !== project) return false;
        if (text && !`${ticket.id}${ticket.title}${ticket.from}`.toLowerCase().includes(text)) return false;
        return true;
      })
      .map((ticket) => ({ kind: "ticket" as const, at: minutesFromLabel(ticket.updatedAt), ticket }));

    /* 通知没有状态,所以除了「全部」和「仅通知」,任何状态筛选都把它们排除掉——
       在「已驳回」里混进一条规则发布公告,那一档就答不了它该答的问题了。 */
    const noticeRows: Row[] = (status === "全部" || status === "仅通知" ? initialNotices : [])
      .filter((notice) => {
        if (kind !== "全部类型") return false;
        if (project !== "全部项目" && notice.project !== project) return false;
        if (text && !`${notice.title}${notice.from}`.toLowerCase().includes(text)) return false;
        return true;
      })
      .map((notice) => ({ kind: "notice" as const, at: minutesFromLabel(notice.at), notice }));

    return [...ticketRows, ...noticeRows].sort((a, b) => a.at - b.at);
  }, [tickets, status, kind, project, keyword, currentUser]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const reset = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(1); };

  const open = openId ? tickets.find((ticket) => ticket.id === openId) ?? null : null;

  if (open) {
    return (
      <TicketDetailView
        ticket={open}
        isMine={open.assignee === currentUser}
        notes={notesByTicket[open.id] ?? {}}
        onNoteChange={(lineId, value) => setNotesByTicket((current) => ({ ...current, [open.id]: { ...(current[open.id] ?? {}), [lineId]: value } }))}
        onBack={() => setOpenId(null)}
        onHandle={() => onHandle(open)}
        onAccept={() => onAccept(open)}
      />
    );
  }

  const openTicket = (ticket: Ticket) => {
    setOpenId(ticket.id);
    setReadIds((ids) => ids.includes(ticket.id) ? ids : [...ids, ticket.id]);
  };

  if (openNotice) {
    return <NoticeDetailView notice={openNotice} onBack={() => setOpenNotice(null)} />;
  }

  return (
    <section className="workbenchView ticketsView">
      {onCreate && topbarPrimaryHost ? createPortal(
        <button className="primaryButton compact ticketsCreateButton" type="button" onClick={onCreate}>
          <Upload size={15} />上传并交接
        </button>,
        topbarPrimaryHost,
      ) : null}

      <div className="ticketsFilters">
        <label className="ticketsSearch">
          <Search size={14} />
          <input value={keyword} placeholder="搜索标题、发件人或工单号" onChange={(event) => { setKeyword(event.target.value); setPage(1); }} />
          {keyword ? <button type="button" aria-label="清空搜索" onClick={() => { setKeyword(""); setPage(1); }}><X size={13} /></button> : null}
        </label>
        {/* 状态跟类型、项目并排,因为它们是同一种东西:缩小这一屏的三把尺子。
            之前它是一排独立的胶囊,看起来像视图切换,可它从来就只是筛选。 */}
        <CompactSelect value={status} options={[...STATUS_OPTIONS]} onChange={reset(setStatus)} />
        <CompactSelect value={kind} options={["全部类型", "QA 审核", "DMPK 报价"]} onChange={reset(setKind)} />
        <CompactSelect value={project} options={["全部项目", ...projects]} onChange={reset(setProject)} />
      </div>

      {/* 一个列表。工单行右边挂状态,通知行不挂——「这件事在谁那儿」不用切视图
          就能读出来,而知会本来就没有状态可读。 */}
      <ul className="messageList">
        {rows.map((row) => {
          if (row.kind === "notice") {
            const notice = row.notice;
            const Icon = sourceIcon[notice.source];
            const unread = !readIds.includes(notice.id);
            return (
              <li key={notice.id}>
                <button
                  className={`messageRow isNotice ${unread ? "isUnread" : ""}`}
                  type="button"
                  onClick={() => { setOpenNotice(notice); setReadIds((ids) => ids.includes(notice.id) ? ids : [...ids, notice.id]); }}
                >
                  <span className="messageDot" aria-hidden="true" />
                  <span className="messageFrom"><Icon size={13} />{notice.from}</span>
                  <span className="messageBody">
                    <strong>{notice.title}</strong>
                    <small>{notice.project ?? noticeSourceLabel[notice.source]}</small>
                  </span>
                  <span className="messageState"><em className="messageNoticeTag">知会</em></span>
                  <span className="messageTime">{notice.at}</span>
                  {unread ? <span className="visuallyHidden">，未读</span> : null}
                </button>
              </li>
            );
          }
          const ticket = row.ticket;
          const unread = !readIds.includes(ticket.id);
          const Icon = ticket.fromRole.includes("数字同事") ? Bot : User;
          return (
            <li key={ticket.id}>
              <button className={`messageRow ${unread ? "isUnread" : ""}`} type="button" onClick={() => openTicket(ticket)}>
                <span className="messageDot" aria-hidden="true" />
                <span className="messageFrom"><Icon size={13} />{ticket.from}</span>
                <span className="messageBody">
                  <strong>{ticket.title}</strong>
                  <small>
                    {ticket.project}
                    {ticket.attachments.length ? <em><Paperclip size={11} />{ticket.attachments[0].name}</em> : null}
                  </small>
                </span>
                <span className="messageState">
                  <StatusChip tone={ticketStatusTone[ticket.status]} dot>{ticketStatusLabel[ticket.status]}</StatusChip>
                  {ticket.assignee !== currentUser ? <em className="messageAssignee">{ticket.assignee}</em> : null}
                </span>
                <span className="messageTime">{ticket.updatedAt}</span>
                {unread ? <span className="visuallyHidden">，未读</span> : null}
              </button>
            </li>
          );
        })}
        {!rows.length ? <li className="messageEmpty">没有符合当前筛选条件的消息</li> : null}
      </ul>

      <footer className="ticketsPager">
        <span>共 {filtered.length} 条</span>
        <div>
          <button type="button" aria-label="上一页" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={14} /></button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
            <button key={number} className={number === safePage ? "active" : ""} type="button" onClick={() => setPage(number)}>{number}</button>
          ))}
          <button type="button" aria-label="下一页" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight size={14} /></button>
        </div>
      </footer>
    </section>
  );
}

/**
 * 纯通知的详情。没有归属、没有状态、没有流转链——看过就翻篇。
 * 刻意做得比工单详情单薄:它单薄是因为它本来就该单薄,给它配上处置按钮
 * 只会让人以为自己漏了一件该做的事。
 */
function NoticeDetailView({ notice, onBack }: { notice: Notice; onBack: () => void }) {
  const Icon = sourceIcon[notice.source];
  return (
    <section className="workbenchView ticketDetailView">
      <header className="ticketDetailHead">
        <button className="ticketDetailBack" type="button" onClick={onBack}><ArrowLeft size={15} />返回收件箱</button>
        <div className="ticketDetailTitle">
          <span><Icon size={12} /> {notice.from}（{noticeSourceLabel[notice.source]}） · {notice.at}</span>
          <h1>{notice.title}</h1>
          {notice.project ? <p>{notice.project}</p> : null}
        </div>
        <em className="messageNoticeTag">知会</em>
      </header>
      <section className="noticeBody"><p>{notice.body}</p></section>
    </section>
  );
}

/**
 * 二级:这一条消息背后的那张工单。
 *
 * 两种工单在这里分岔:
 *   QA 审核  —— 带到会话里处理。批注有 AI 提的也有人工补的,还要跨版本验证
 *               上一轮提的问题改没改,这些都得跟数字同事一起看。
 *   DMPK 报价 —— 全程人工,进本页自己的审核画布。它不需要 agent 介入,
 *               拉一个对话区进来只会凭空长出「这里能问 AI 吗」的期待。
 */
function TicketDetailView({ ticket, isMine, notes, onNoteChange, onBack, onHandle, onAccept }: {
  ticket: Ticket;
  isMine: boolean;
  notes: Record<string, string>;
  onNoteChange: (lineId: string, value: string) => void;
  onBack: () => void;
  onHandle: () => void;
  onAccept: () => void;
}) {
  /* 已经接手过的单直接进画布。不这样的话,回列表看一眼再进来,画布退回详情、
     按钮还写着「开始审核」——可你明明已经开始了,状态也已经是处理中。 */
  const [reviewing, setReviewing] = useState(ticket.status === "inProgress" && ticket.kind === "dmpk-quotation");
  /* 只有球还在你手上时才谈处置。已驳回是球在上一棒那儿,已完成和已作废是终态——
     给一个点不动的按钮,比不给更让人困惑。 */
  const actionable = (ticket.status === "open" || ticket.status === "inProgress") && isMine;
  const isQuotation = ticket.kind === "dmpk-quotation";

  if (isQuotation && reviewing) {
    return (
      <QuotationReviewCanvas
        ticket={ticket}
        notes={notes}
        onNoteChange={onNoteChange}
        onBack={() => setReviewing(false)}
      />
    );
  }

  return (
    <section className="workbenchView ticketDetailView">
      <header className="ticketDetailHead">
        <button className="ticketDetailBack" type="button" onClick={onBack}><ArrowLeft size={15} />返回收件箱</button>
        <div className="ticketDetailTitle">
          <span>{ticket.id} · {ticketKindLabel[ticket.kind]}</span>
          <h1>{ticket.title}</h1>
          <p>{ticket.from}（{ticket.fromRole}）交接给 {ticket.assignee} · {ticket.project}</p>
        </div>
        <StatusChip tone={ticketStatusTone[ticket.status]} dot>{ticketStatusLabel[ticket.status]}</StatusChip>
      </header>

      {ticket.attachments.length ? (
        <section className="ticketDetailFiles">
          <h2>随单产物</h2>
          {ticket.attachments.map((file) => (
            <article key={file.id}>
              <Paperclip size={13} />
              <div><strong>{file.name}</strong><small>{file.meta}</small></div>
            </article>
          ))}
        </section>
      ) : null}

      {/* 这条链就是工单相对邮件多出来的那样东西。邮件里同一份报告来回三轮,
          是三封孤立的信;工单里它是一条链,谁在什么时候做了什么一目了然。 */}
      <section className="ticketDetailFlow">
        <h2>流转记录</h2>
        <ol>
          {ticket.steps.map((step) => (
            <li key={step.id}>
              <span className="ticketFlowDot" aria-hidden="true" />
              <div>
                <strong>{step.action}</strong>
                <small>{step.actor}（{step.actorRole}） · {step.at}</small>
                {step.note ? <p>{step.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="ticketDetailActions">
        {!actionable ? (
          <p className="ticketDetailHint">
            {ticket.status === "done" || ticket.status === "dropped" ? "这张工单已经结束，只能查看。" : `球不在你这边，当前处理人是 ${ticket.assignee}。`}
          </p>
        ) : isQuotation ? (
          <>
            <p className="ticketDetailHint">这一单全程人工复核，不经过数字同事。</p>
            <button className="primaryButton compact" type="button" onClick={() => { onAccept(); setReviewing(true); }}>
              <Highlighter size={15} />开始审核
            </button>
          </>
        ) : (
          <>
            <p className="ticketDetailHint">审核要跟 QA 数字同事一起看，会打开这条任务的会话。</p>
            <button className="primaryButton compact" type="button" onClick={onHandle}>进入会话处理</button>
          </>
        )}
      </footer>
    </section>
  );
}

/**
 * 报价审核画布。跟 QA 审核台同一个骨架:左边是原件、右边是批注清单,
 * 点批注定位到原件,点原件给它加批注。
 *
 * 差别只有一处——这里没有对话区。报价复核全程人工,拉一个 chatflow 进来
 * 只会长出「这里能问 AI 吗」的期待,而它确实不能。
 *
 * 锚点是**计价条目**而不是文档里的一段选区:报价单本来就是结构化的,
 * 有名字的行比一段坐标好定位,下一版也更容易验证「那一条改了没有」。
 * 这跟 QA 把批注锚在「收检日期」这类字段上是同一套办法。
 */
function QuotationReviewCanvas({ ticket, notes, onNoteChange, onBack }: {
  ticket: Ticket;
  notes: Record<string, string>;
  onNoteChange: (lineId: string, value: string) => void;
  onBack: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const noted = dmpkQuoteLines.filter((line) => (notes[line.id] ?? "").trim());
  const groups = dmpkQuoteLines.map((line) => line.group).filter((group, index, list) => list.indexOf(group) === index);
  const active = activeId ? dmpkQuoteLines.find((line) => line.id === activeId) ?? null : null;

  const pick = (lineId: string) => {
    setActiveId(lineId);
    setDraft(notes[lineId] ?? "");
  };
  const commit = () => {
    if (!activeId) return;
    onNoteChange(activeId, draft);
    setActiveId(null);
    setDraft("");
  };

  return (
    <section className="workbenchView quoteReviewCanvas">
      <header className="quoteReviewHead">
        <button className="ticketDetailBack" type="button" onClick={onBack}><ArrowLeft size={15} />返回工单</button>
        <div className="ticketDetailTitle">
          <span>{ticket.id} · 报价复核</span>
          <h1>{ticket.title}</h1>
        </div>
        <StatusChip tone="warning" dot>人工复核</StatusChip>
      </header>

      <div className="quoteReviewBody">
        {/* 左栏:原件。点哪一行就给哪一行写批注——锚点是行,不是坐标。 */}
        <div className="quoteDocPane">
          <article className="quoteDoc">
            <header>
              <strong>DMPK 检测报价单</strong>
              <small>{ticket.project} · 提交人 {ticket.from}</small>
            </header>
            {groups.map((group) => (
              <section key={group}>
                <h3>{group}</h3>
                {dmpkQuoteLines.filter((line) => line.group === group).map((line) => {
                  const note = (notes[line.id] ?? "").trim();
                  return (
                    <button
                      key={line.id}
                      className={`quoteDocLine ${note ? "hasNote" : ""} ${activeId === line.id ? "isActive" : ""}`}
                      type="button"
                      onClick={() => pick(line.id)}
                    >
                      <span className="quoteDocLabel">
                        <strong>{line.label}</strong>
                        <small>{line.detail}</small>
                      </span>
                      <b>{line.amount}</b>
                      {note ? <i className="quoteDocMark" aria-label="已批注" /> : null}
                    </button>
                  );
                })}
              </section>
            ))}
          </article>
        </div>

        {/* 右栏:批注清单。跟 QA 那边一样,清单给结论、原件给证据。 */}
        <aside className="quoteNotePane">
          <header>
            <strong>人工批注</strong>
            <small>{noted.length} 条</small>
          </header>

          {active ? (
            <div className="quoteNoteEditor">
              <span>{active.label}</span>
              <textarea
                autoFocus
                value={draft}
                placeholder="写下这一条的问题，留空表示无异议"
                aria-label={`${active.label}的批注`}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div>
                <button className="secondaryButton compact" type="button" onClick={() => { setActiveId(null); setDraft(""); }}>取消</button>
                <button className="primaryButton compact" type="button" onClick={commit}>保存批注</button>
              </div>
            </div>
          ) : (
            <p className="quoteNoteHint">点左边任意一条计价项，给它写批注。</p>
          )}

          <ul className="quoteNoteList">
            {noted.map((line) => (
              <li key={line.id}>
                <button type="button" onClick={() => pick(line.id)}>
                  <strong>{line.label}</strong>
                  <p>{notes[line.id]}</p>
                </button>
              </li>
            ))}
            {!noted.length ? <li className="quoteNoteEmpty">还没有批注。没有批注就通过，表示这一版你全部认可。</li> : null}
          </ul>
        </aside>
      </div>

      <footer className="ticketDetailActions">
        <p className="ticketDetailHint">已批注 {noted.length} 条</p>
        <button className="secondaryButton compact" type="button" disabled={!noted.length}>驳回并退回 {ticket.from}</button>
        <button className="primaryButton compact" type="button">通过并归档到数据中枢</button>
      </footer>
    </section>
  );
}
