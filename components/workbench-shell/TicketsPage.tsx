"use client";

import { ArrowLeft, ArrowRight, Bot, Check, ChevronLeft, ChevronRight, Highlighter, Paperclip, Search, Settings, Upload, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StatusChip } from "../ui";
import { QuoteReviewCanvas } from "./QuoteReviewCanvas";
import { TicketFilePreview, downloadTicketFile, ticketFileView, type TicketFileView } from "./TicketFilePreview";
import type { MailResourceRef } from "../../lib/workbench/mailboxData";
import { quoteAnchorLabel, quoteCurrentValue, quoteNoteLabel, quoteNoteSeverityLabel, seededNotesByTicket, type QuoteNote } from "../../lib/workbench/quoteData";
import {
  initialNotices,
  minutesFromLabel,
  noticeSourceLabel,
  ticketKindLabel,
  ticketStatusLabel,
  ticketStatusTone,
  type Notice,
  type Ticket,
  type TicketStatus,
} from "../../lib/workbench/ticketData";
import { CompactSelect } from "./ShellControls";

const PAGE_SIZE = 10;

/* 状态是筛选,不是视图。分成「站内信 / 工单」两栏曾经让同一批东西看起来像两批,
   而它们本来就是一批:一条消息,背后可能挂着一件要你办的事,也可能只是知会。
   所以列表只有一个,状态收进筛选栏——台账没被删,是化进列表了。

   筛选分三轴,每一轴只回答一个问题:
     类型  这是什么    —— 工单的两类 + 通知的两类
     状态  走到哪一步  —— 只对工单成立
     项目  哪个项目
   ------------------------------------------------------------------
   状态那个下拉以前混了三种东西:「待我处理」量的是归属(assignee)、「仅通知」
   量的是类型、其余才是状态。两个都搬走了:类型归类型轴;而归属根本不需要一个
   筛子——收件箱本来就是你的,装的就是到你手上的东西(见 filtered)。
   未读与否由行首那颗点指示,也不必再多一个筛子。 */
const STATUS_OPTIONS = ["全部状态", "待处理", "已驳回", "已通过", "已作废"] as const;

/* 这几个键必须跟 ticketStatusLabel 的取值一模一样,否则筛出来永远是空——
   done 从「已完成」改名成「已通过」时,这里差点忘了跟着改。 */
const STATUS_MATCH: Record<string, TicketStatus[]> = {
  "待处理": ["open"],
  "已驳回": ["rejected"],
  "已通过": ["done"],
  "已作废": ["dropped"],
};

/* 类型拆到底。通知在数据里本来就分两类(Notice.source),而「系统发布了新的计价
   规则」和「数字同事把产物交给下一棒了」不是一回事:前者要你知道规矩变了,
   后者只是告诉你机器之间的进度。以前这两类连同工单混在一个「仅通知」里筛。 */
const KIND_OPTIONS = ["全部类型", "QA 审核", "DMPK 报价", "数字同事知会", "系统通知"] as const;
const NOTICE_KIND: Record<string, "coworker" | "system"> = {
  "数字同事知会": "coworker",
  "系统通知": "system",
};

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
  openTicketId,
  onOpenTicketChange,
  openNoticeTitle,
  onOpenNoticeChange,
  reviewing,
  onReviewingChange,
  reviewerRole,
  onReject,
  onArchive,
  lensKind,
}: {
  tickets: Ticket[];
  /** 当前账号。侧栏那个切换器一换，「待我处理」跟着换——同一张单在不同角色眼里是不同的事。 */
  currentUser: string;
  projects: string[];
  /** 带到会话里处理。批注一起带过去——被退回的那一版回到原会话时，
   *  「要改什么」必须在眼前，否则他还得切回站内信逐条读再切回来。 */
  onHandle: (ticket: Ticket, notes: QuoteNote[]) => void;
  /** 只接手、不跳走（DMPK 报价复核走这条:全程人工，就在这一页做完） */
  onAccept: (ticket: Ticket) => void;
  /* 交接入口已经搬进会话（干完活那一下顺手交出去）。这里留成可选:工单不是
     「新建」出来的,在一个收信的页面上放「发出去」的按钮语义也拧。 */
  onCreate?: () => void;
  /* 当前停在第几层由 shell 持有——面包屑要画出「站内信 › TK-2046 › 报价复核」,
     顶栏就得够得着这个位置。留在页内的话返回只能靠页内再放一个按钮,
     而那正是面包屑该做的事。 */
  openTicketId: string | null;
  onOpenTicketChange: (id: string | null) => void;
  openNoticeTitle: string | null;
  onOpenNoticeChange: (title: string | null) => void;
  reviewing: boolean;
  onReviewingChange: (value: boolean) => void;
  /** 批注要署名——一条不署名的批注答不了「这句话该问谁」,而追问原提出人
      正是审核来回时最常做的事。 */
  reviewerRole: string;
  /** 驳回 = 打回上一棒（工单里不用猜,提交人就写在单子上）;归档 = 落进数据中枢并收到终态。 */
  onReject: (ticket: Ticket, summary: string) => void;
  onArchive: (ticket: Ticket) => void;
  /** 演示镜头:只看这一类工单。null = 两条线都看。**脚手架,上线前删。** */
  lensKind?: string | null;
}) {
  const [status, setStatus] = useState<string>("全部状态");
  const [keyword, setKeyword] = useState("");

  const [kind, setKind] = useState("全部类型");
  const [project, setProject] = useState("全部项目");
  const [page, setPage] = useState(1);

  /* 读过哪几条。站内信是通知,通知只有「看没看过」这一个状态——
     它跟工单自己的状态是两回事,所以存在这一层,不写进 Ticket。 */
  const [readIds, setReadIds] = useState<string[]>([]);
  /* 批注按工单存。放在这一层而不是详情组件里,是因为详情会随返回列表卸载——
     写了一半的批注不该因为回去看一眼列表就没了。 */
  const [notesByTicket, setNotesByTicket] = useState<Record<string, Record<string, QuoteNote>>>(seededNotesByTicket);
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
        /* 收件箱只装到你手上的东西。这不是一个可关掉的筛子,是这个页面的定义——
           球一换手,那张单就出现在对方的收件箱里、从你这儿消失(驳回把 assignee
           设回提交人,归档则留在你名下收终态)。判据跟侧栏那颗徽标一致。 */
        if (ticket.assignee !== currentUser) return false;
        if (lensKind && ticketKindLabel[ticket.kind] !== lensKind) return false;
        if (status !== "全部状态" && !(STATUS_MATCH[status] ?? []).includes(ticket.status)) return false;
        if (kind !== "全部类型" && ticketKindLabel[ticket.kind] !== kind) return false;
        if (project !== "全部项目" && ticket.project !== project) return false;
        if (text && !`${ticket.id}${ticket.title}${ticket.from}`.toLowerCase().includes(text)) return false;
        return true;
      })
      .map((ticket) => ({ kind: "ticket" as const, at: minutesFromLabel(ticket.updatedAt), ticket }));

    const noticeRows: Row[] = initialNotices
      .filter((notice) => {
        /* 知会没有状态。一选具体状态就把它们排除掉——在「已驳回」里混进一条
           规则发布公告,那一档就答不了它该答的问题了。 */
        if (status !== "全部状态") return false;
        if (kind !== "全部类型") {
          const wanted = NOTICE_KIND[kind];
          if (!wanted || notice.source !== wanted) return false;
        }
        if (project !== "全部项目" && notice.project !== project) return false;
        if (text && !`${notice.title}${notice.from}`.toLowerCase().includes(text)) return false;
        return true;
      })
      .map((notice) => ({ kind: "notice" as const, at: minutesFromLabel(notice.at), notice }));

    return [...ticketRows, ...noticeRows].sort((a, b) => a.at - b.at);
  }, [tickets, status, kind, project, keyword, currentUser, lensKind]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const reset = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(1); };

  const open = openTicketId ? tickets.find((ticket) => ticket.id === openTicketId) ?? null : null;
  const openNotice = openNoticeTitle ? initialNotices.find((item) => item.title === openNoticeTitle) ?? null : null;

  if (open) {
    return (
      <TicketDetailView
        ticket={open}
        isMine={open.assignee === currentUser}
        notes={notesByTicket[open.id] ?? {}}
        onNotesChange={(next) => setNotesByTicket((current) => ({ ...current, [open.id]: next }))}
        onHandle={() => onHandle(open, Object.values(notesByTicket[open.id] ?? {}))}
        onAccept={() => onAccept(open)}
        reviewing={reviewing}
        onReviewingChange={onReviewingChange}
        currentUser={currentUser}
        reviewerRole={reviewerRole}
        onReject={(summary) => { onReject(open, summary); onReviewingChange(false); onOpenTicketChange(null); }}
        onArchive={() => { onArchive(open); onReviewingChange(false); onOpenTicketChange(null); }}
      />
    );
  }

  const openTicket = (ticket: Ticket) => {
    onOpenTicketChange(ticket.id);
    setReadIds((ids) => ids.includes(ticket.id) ? ids : [...ids, ticket.id]);
  };

  if (openNotice) {
    return <NoticeDetailView notice={openNotice} />;
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
          <input value={keyword} placeholder="搜索主题、发件人或项目" onChange={(event) => { setKeyword(event.target.value); setPage(1); }} />
          {keyword ? <button type="button" aria-label="清空搜索" onClick={() => { setKeyword(""); setPage(1); }}><X size={13} /></button> : null}
        </label>
        {/* 类型、状态、项目并排:它们是同一种东西,缩小这一屏的三把尺子。 */}
        <CompactSelect value={kind} options={lensKind ? KIND_OPTIONS.filter((item) => item === "全部类型" || item === lensKind || NOTICE_KIND[item]) : [...KIND_OPTIONS]} onChange={reset(setKind)} />
        <CompactSelect value={status} options={[...STATUS_OPTIONS]} onChange={reset(setStatus)} />
        <CompactSelect value={project} options={["全部项目", ...projects]} onChange={reset(setProject)} />
      </div>

      {/* 列名、列表、分页收进同一张卡。之前是三条互不相干的横条浮在白底上,
          分页孤零零钉在屏幕最底、离最后一行 400px——那片空白不是页面留白,
          是列表容器自己撑出来的。合成一个面板之后:卡随内容收缩(三条就三条高),
          条数多了才长到满高、行在卡内滚。

          列名必须跟行待在同一个滚动容器里(自己 sticky 住),不能各占一个 grid 行。
          分开放的话,列表一出滚动条,行的可用宽度就比列名少了一条滚动条,
          两边的列宽再也对不上——差的正好是那 15px。

          筛选栏留在卡外:它作用于列表,但不是列表的一部分。 */}
      <div className="messageListPanel">
        <div className="messageListScroll">
          {/* 行里那几格排得整齐,但整齐本身不说明它们是什么——尤其右边那两格,
              「已驳回 / 赵敏」并排时,不标注就看不出后者是当前处理人还是提出人。 */}
          <div className="messageListHead" aria-hidden="true">
            <span />
            <span>发件人</span>
            <span>主题 · 所属项目</span>
            <span>状态 · 当前处理人</span>
            <span>更新时间</span>
          </div>

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
                      onClick={() => { onOpenNoticeChange(notice.title); setReadIds((ids) => ids.includes(notice.id) ? ids : [...ids, notice.id]); }}
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
                        {/* 多份产物时补一个计数。只报第一个的名字会让人以为随单就这一份,
                            而复核前得知道要看几样东西。 */}
                        {ticket.attachments.length ? (
                          <em>
                            <Paperclip size={11} />
                            {ticket.attachments[0].name}
                            {ticket.attachments.length > 1 ? ` 等 ${ticket.attachments.length} 份` : ""}
                          </em>
                        ) : null}
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
        </div>

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
      </div>
    </section>
  );
}

/* 一件事的生命周期就这三步,来回多少轮都还是这三步。
   驳回不是第四步,是被打回到「审核」那一格——所以它不占位置,只把当前格子染红。

   原本还有第四格「归档」。删了:归档要落进数据中枢,而数据中枢还没建好——
   画一格永远走不到的进度,比不画更误导。通过之后这件事回到撰写人手上,
   后续动作发生在这个系统之外,所以「通过」就是这条链的终点。 */
const TICKET_STAGES = ["提交", "审核", "通过"] as const;

/**
 * 状态条:现在到哪一步。
 *
 * 它跟下面那条流转记录**不是一回事**,之前混成一个组件才会显得奇怪——
 * 状态条答的是「这件事走到哪了」,流转记录答的是「都发生过什么」。
 * 一个是位置,一个是历史;前者只有四格且永远只有四格,后者随轮次增长。
 */
function TicketStageBar({ status }: { status: Ticket["status"] }) {
  const current = status === "done" ? 2 : 1;
  const rejected = status === "rejected";
  return (
    <ol className="ticketStageBar" aria-label="处理进度">
      {TICKET_STAGES.map((stage, index) => {
        const state = index < current ? "done" : index === current ? (rejected ? "rejected" : "current") : "todo";
        return (
          <li key={stage} className={`is-${state}`}>
            <span className="ticketStageDot" aria-hidden="true">{index < current ? <Check size={11} /> : index + 1}</span>
            <span className="ticketStageLabel">{rejected && index === current ? "审核 · 已驳回" : stage}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 纯通知的详情。没有归属、没有状态、没有流转链——看过就翻篇。
 * 刻意做得比工单详情单薄:它单薄是因为它本来就该单薄,给它配上处置按钮
 * 只会让人以为自己漏了一件该做的事。
 */
function NoticeDetailView({ notice }: { notice: Notice }) {
  const Icon = sourceIcon[notice.source];
  return (
    <section className="workbenchView ticketDetailView">
      <div className="ticketDetailHead">
        <div className="ticketDetailTitle">
          <span><Icon size={12} /> {notice.from}（{noticeSourceLabel[notice.source]}） · {notice.at}</span>
          <h1>{notice.title}</h1>
          {notice.project ? <p>{notice.project}</p> : null}
        </div>
        <em className="messageNoticeTag">知会</em>
      </div>
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
function TicketDetailView({ ticket, isMine, notes, onNotesChange, onHandle, onAccept, reviewing, onReviewingChange, currentUser, reviewerRole, onReject, onArchive }: {
  ticket: Ticket;
  isMine: boolean;
  notes: Record<string, QuoteNote>;
  onNotesChange: (next: Record<string, QuoteNote>) => void;
  onHandle: () => void;
  onAccept: () => void;
  reviewing: boolean;
  onReviewingChange: (value: boolean) => void;
  currentUser: string;
  reviewerRole: string;
  onReject: (summary: string) => void;
  onArchive: () => void;
}) {
  /* 只有球还在你手上、且这件事还没了结时才谈处置。
     判据必须是「归属 + 未到终态」,不能只看状态是不是 open——驳回之后
     assignee 换回了撰写人,那张单对他就是头号待办,可它的状态是 rejected。
     只认 open 会让他看到一句「球不在你这边,当前处理人是林一一」,而他就是林一一。 */
  const isTerminal = ticket.status === "done" || ticket.status === "dropped";
  const actionable = isMine && !isTerminal;
  /* 他是不是这件事的提交人。驳回时 assignee 换回 from,所以撰写人同时是两者;
     审批人是 assignee 但不是 from。一个人在这件事里是什么身份,单子自己说得清,
     不用另造一个「角色」概念。 */
  const isSubmitter = currentUser === ticket.from;
  /* 批注随这件事走,谁打开都看得见。 */
  const noted = Object.values(notes);
  const blockingCount = noted.filter((note) => note.severity === "blocking").length;
  const isQuotation = ticket.kind === "dmpk-quotation";
  const [preview, setPreview] = useState<{ file: MailResourceRef; view: TicketFileView } | null>(null);

  if (isQuotation && reviewing) {
    return (
      <QuoteReviewCanvas
        ticket={ticket}
        notes={notes}
        onNotesChange={onNotesChange}
        reviewer={currentUser}
        reviewerRole={reviewerRole}
        onReject={onReject}
        onArchive={onArchive}
      />
    );
  }

  return (
    <section className="workbenchView ticketDetailView">
      {/* 工单号和类型已经在面包屑里,这儿不再重复一遍。标题 + 一行元信息就够,
          之前是「眉标 + 大标题 + 元信息 + 一大片留白」,占掉小半屏说的却是同一件事。 */}
      <div className="ticketDetailHead">
        <div className="ticketDetailTitle">
          <h1>{ticket.title}</h1>
          <p>{ticketKindLabel[ticket.kind]} · {ticket.from} → {ticket.assignee} · {ticket.project}</p>
        </div>
        <StatusChip tone={ticketStatusTone[ticket.status]} dot>{ticketStatusLabel[ticket.status]}</StatusChip>
      </div>

      <TicketStageBar status={ticket.status} />

      {ticket.attachments.length ? (
        <section className="ticketDetailFiles">
          <h2>随行产物</h2>
          {ticket.attachments.map((file) => {
            const view = ticketFileView(ticket, file);
            return (
              <article key={file.id}>
                <Paperclip size={13} />
                <div className="ticketFileMeta"><strong>{file.name}</strong><small>{file.meta}</small></div>
                {/* 动作只给原型确实有内容的那些文件。摆两个点了没反应的按钮,
                    比不摆更糟——按钮存在就是在承诺一件事做得到。 */}
                {view ? (
                  <div className="ticketFileActions">
                    <button type="button" onClick={() => setPreview({ file, view })}>预览</button>
                    <button type="button" onClick={() => downloadTicketFile(file, view)}>下载</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {preview ? (
        <TicketFilePreview file={preview.file} view={preview.view} notes={noted} onClose={() => setPreview(null)} />
      ) : null}

      {/* 批注随这件事一起走,不锁在批注画布里。
          之前它只在审批人的画布上渲染,而提交人走的是另一条路——他拿到的只有
          流转记录里一行「批注 N 条」。哪一条、现值多少、建议改成什么,全看不到。
          可 suggested 这个字段的全部意义,就是让要改的那个人能逐条核验。

          通过的那些也留着:「1 条建议修订随行留档,不影响通过」——
          说了留档,就得真的看得见。 */}
      {noted.length ? (
        <section className="ticketDetailNotes">
          <h2>复核批注<small>{noted.length} 条{blockingCount ? ` · 必须修订 ${blockingCount} 条` : ""}</small></h2>
          <ul>
            {noted.map((note) => (
              <li key={note.anchorId} className={`is-${note.severity}`}>
                <div className="ticketDetailNoteHead">
                  <i className={`quoteNoteSev is-${note.severity}`}>{quoteNoteSeverityLabel[note.severity]}</i>
                  <em className="quoteNoteCat">{quoteNoteLabel(note)}</em>
                  <strong>{quoteAnchorLabel(note.anchorId)}</strong>
                </div>
                {note.suggested ? (
                  <span className="quoteNoteDiff">
                    <s>{quoteCurrentValue(note.anchorId) || "—"}</s>
                    <ArrowRight size={11} aria-hidden="true" />
                    <b>{note.suggested}</b>
                  </span>
                ) : null}
                <p>{note.text}</p>
                <span className="quoteNoteBy">{note.author} · {note.authorRole} · {note.at}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 这条链就是工单相对邮件多出来的那样东西。邮件里同一份报告来回三轮,
          是三封孤立的信;工单里它是一条链,谁在什么时候做了什么一目了然。 */}
      {/* 一条竖线穿到底,每一格「谁 · 做了什么 · 什么时候」三件事排在同一行读完。
          之前动作和时间被推到两端,中间一大片空白,眼睛要来回横跳才拼得出一句话。 */}
      <section className="ticketDetailFlow">
        <h2>流转记录</h2>
        <ol>
          {ticket.steps.map((step, index) => (
            <li key={step.id} className={index === ticket.steps.length - 1 ? "isLatest" : ""}>
              <span className="ticketFlowDot" aria-hidden="true" />
              <div className="ticketFlowMain">
                <strong>{step.action}</strong>
                <small>{step.actor}<i>{step.actorRole}</i></small>
                <time>{step.at}</time>
              </div>
              {step.note ? <p className="ticketFlowNote">{step.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <footer className="ticketDetailActions">
        {!actionable ? (
          <p className="ticketDetailHint">
            {isTerminal ? "这件事已经结束，只能查看。" : `球不在你这边，当前处理人是 ${ticket.assignee}。`}
          </p>
        ) : isQuotation && isSubmitter ? (
          /* 提交人拿回这一单(被驳回、或要改)时,该回到当初产出它的那个会话去改,
             不是进批注台——他不是来批注的,他是来改的。 */
          <>
            <p className="ticketDetailHint">回到当初产出这份报价的会话，改完再交一次。</p>
            <button className="primaryButton compact" type="button" onClick={onHandle}>进入会话处理</button>
          </>
        ) : isQuotation ? (
          <>
            <p className="ticketDetailHint">这一单全程人工复核，不经过数字同事。</p>
            <button className="primaryButton compact" type="button" onClick={() => { onAccept(); onReviewingChange(true); }}>
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

