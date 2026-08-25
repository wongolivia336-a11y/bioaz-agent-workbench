"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Highlighter, Paperclip, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { NavTabs, StatusChip } from "../ui";
import {
  dmpkQuoteLines,
  ticketKindLabel,
  ticketStatusLabel,
  ticketStatusTone,
  type Ticket,
  type TicketStatus,
} from "../../lib/workbench/ticketData";
import { CompactSelect } from "./ShellControls";

const PAGE_SIZE = 10;

type TabId = TicketStatus | "all" | "mine";

/* 默认停在「待我处理」:日常打开这一页的人要的是今天该干什么。
   但后面那几档必须在——工单是台账,不是待办清单,已完成和已作废也得查得到,
   否则「这份报告现在在谁那儿」就没有地方能回答。 */
const STATUS_TABS: Array<{ id: TabId; label: string }> = [
  { id: "mine", label: "待我处理" },
  { id: "all", label: "全部" },
  { id: "open", label: "待处理" },
  { id: "inProgress", label: "处理中" },
  { id: "rejected", label: "已驳回" },
  { id: "done", label: "已完成" },
  { id: "dropped", label: "已作废" },
];

/**
 * 站内信。
 *
 * 首屏是**消息列表**,不是工单表:到达面只负责告诉你「有人给了你一件事」,
 * 状态、处理人、流转链这些是那件事自己的属性,要点进去才谈。把它们摊在第一屏,
 * 等于要求人先读懂一张台账才知道今天有什么事。
 *
 * 点进某一条 → 二级是这张工单。走整页而不是抽屉:DMPK 要在里面逐条批注、
 * 后面还要并排比对两版报价,抽屉那点宽度放不下。
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
  const [tab, setTab] = useState<TabId>("mine");
  const [keyword, setKeyword] = useState("");
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
  const [topbarTabHost, setTopbarTabHost] = useState<HTMLElement | null>(null);
  const [topbarPrimaryHost, setTopbarPrimaryHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTopbarTabHost(document.getElementById("workbench-topbar-tabs"));
    setTopbarPrimaryHost(document.getElementById("workbench-topbar-primary"));
  }, []);

  const mineCount = useMemo(
    () => tickets.filter((ticket) => ticket.assignee === currentUser && ticket.status !== "done" && ticket.status !== "dropped").length,
    [tickets, currentUser],
  );

  const filtered = useMemo(() => tickets.filter((ticket) => {
    if (tab === "mine") {
      /* 判据是 assignee,不是状态名。「已驳回」是从审批人视角起的名字,可球这时候
         正在撰写人手上——他要改完重交,那就是他的待办。用状态名筛会让撰写人
         切进来看到一片空白,而他其实欠着一件事。 */
      if (ticket.assignee !== currentUser) return false;
      if (ticket.status === "done" || ticket.status === "dropped") return false;
    } else if (tab !== "all" && ticket.status !== tab) return false;
    if (kind !== "全部类型" && ticketKindLabel[ticket.kind] !== kind) return false;
    if (project !== "全部项目" && ticket.project !== project) return false;
    const text = keyword.trim();
    if (text && !`${ticket.id}${ticket.title}${ticket.from}`.toLowerCase().includes(text.toLowerCase())) return false;
    return true;
  }), [tickets, tab, kind, project, keyword, currentUser]);

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

  return (
    <section className="workbenchView ticketsView">
      {topbarTabHost ? createPortal(
        <NavTabs
          className="ticketsTabs"
          items={STATUS_TABS.map((item) => item.id === "mine" ? { ...item, count: mineCount || undefined } : item)}
          value={tab}
          onChange={(id) => { setTab(id); setPage(1); }}
          label="站内信筛选"
        />,
        topbarTabHost,
      ) : null}

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
        <CompactSelect value={kind} options={["全部类型", "QA 审核", "DMPK 报价"]} onChange={reset(setKind)} />
        <CompactSelect value={project} options={["全部项目", ...projects]} onChange={reset(setProject)} />
      </div>

      {/* 消息形态:谁发的、什么事、什么时候。整行可点,没有操作列——
          到达面只负责让你知道有这件事,做不做得了是进去之后的事。 */}
      <ul className="messageList">
        {rows.map((ticket) => {
          const unread = !readIds.includes(ticket.id);
          return (
            <li key={ticket.id}>
              <button
                className={`messageRow ${unread ? "isUnread" : ""}`}
                type="button"
                onClick={() => { setOpenId(ticket.id); setReadIds((ids) => ids.includes(ticket.id) ? ids : [...ids, ticket.id]); }}
              >
                <span className="messageDot" aria-hidden="true" />
                <span className="messageFrom">{ticket.from}</span>
                <span className="messageBody">
                  <strong>{ticket.title}</strong>
                  <small>
                    {ticket.project}
                    {ticket.attachments.length ? <em><Paperclip size={11} />{ticket.attachments[0].name}</em> : null}
                  </small>
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
 * 二级:这一条消息背后的那张工单。
 *
 * 两种工单在这里分岔,而且分得很干脆:
 *   QA 审核  —— 带到会话里处理。它要跟数字同事一起看:批注有 AI 提的也有人工补的,
 *               还要跨版本验证上一轮提的问题改没改。
 *   DMPK 报价 —— 全程人工,就在这一页做完。它不需要 agent 介入,拉一个对话区进来
 *               只会凭空长出「这里能问 AI 吗」的期待,而它确实不能。
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
  /* 已经接手过的单直接展开复核面。不这样的话,回列表看一眼再进来,面收起来了、
     按钮还写着「开始审核」——可你明明已经开始了,状态也已经是处理中。 */
  const [reviewing, setReviewing] = useState(ticket.status === "inProgress");
  /* 只有球还在你手上时才谈处置。已驳回是球在上一棒那儿,已完成和已作废是终态——
     给一个点不动的按钮,比不给更让人困惑。 */
  const actionable = (ticket.status === "open" || ticket.status === "inProgress") && isMine;
  const isQuotation = ticket.kind === "dmpk-quotation";
  const noted = Object.values(notes).filter((value) => value.trim()).length;

  return (
    <section className="workbenchView ticketDetailView">
      <header className="ticketDetailHead">
        <button className="ticketDetailBack" type="button" onClick={onBack}><ArrowLeft size={15} />返回站内信</button>
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

      {isQuotation && reviewing ? (
        <QuotationReviewPane notes={notes} onNoteChange={onNoteChange} />
      ) : null}

      <footer className="ticketDetailActions">
        {!actionable ? (
          <p className="ticketDetailHint">
            {ticket.status === "done" || ticket.status === "dropped" ? "这张工单已经结束，只能查看。" : "球不在你这边，当前处理人是 " + ticket.assignee + "。"}
          </p>
        ) : isQuotation ? (
          reviewing ? (
            <>
              <p className="ticketDetailHint">已批注 {noted} 条</p>
              <button className="secondaryButton compact" type="button">驳回并退回提交人</button>
              <button className="primaryButton compact" type="button">通过并归档到数据中枢</button>
            </>
          ) : (
            <>
              <p className="ticketDetailHint">这一单全程人工复核，不经过数字同事。</p>
              <button className="primaryButton compact" type="button" onClick={() => { onAccept(); setReviewing(true); }}>
                <Highlighter size={15} />开始审核
              </button>
            </>
          )
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
 * 报价复核面。
 *
 * 锚点是**计价条目**,不是文档里的一段选区——报价单本来就是结构化的,
 * 有名字的行比一段坐标更好定位,下一版也更容易验证「那一条改了没有」。
 * 这跟 QA 那边把批注锚在「收检日期」这种字段上是同一套办法。
 */
function QuotationReviewPane({ notes, onNoteChange }: { notes: Record<string, string>; onNoteChange: (lineId: string, value: string) => void }) {
  const groups = dmpkQuoteLines.map((line) => line.group).filter((group, index, list) => list.indexOf(group) === index);
  return (
    <section className="quotationReviewPane">
      <h2>逐条复核</h2>
      {groups.map((group) => (
        <section className="quotationReviewGroup" key={group}>
          <h3>{group}</h3>
          {dmpkQuoteLines.filter((line) => line.group === group).map((line) => {
            const value = notes[line.id] ?? "";
            return (
              <article className={`quotationReviewLine ${value.trim() ? "hasNote" : ""}`} key={line.id}>
                <div className="quotationReviewMeta">
                  <strong>{line.label}</strong>
                  <small>{line.detail}</small>
                  <b>{line.amount}</b>
                </div>
                <input
                  value={value}
                  placeholder="对这一条有意见就写在这里，留空表示无异议"
                  aria-label={`${line.label}的批注`}
                  onChange={(event) => onNoteChange(line.id, event.target.value)}
                />
              </article>
            );
          })}
        </section>
      ))}
    </section>
  );
}
