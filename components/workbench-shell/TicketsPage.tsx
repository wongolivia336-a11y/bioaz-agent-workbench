"use client";

import { ChevronLeft, ChevronRight, Paperclip, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { NavTabs, StatusChip } from "../ui";
import { useModalDismiss } from "../ui/useModalDismiss";
import {
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
   但后面那几档必须在——工单是台账,不是待办清单,已完成和已废弃也得查得到,
   否则「这份报告现在在谁那儿」就没有地方能回答。 */
const STATUS_TABS: Array<{ id: TabId; label: string }> = [
  { id: "mine", label: "待我处理" },
  { id: "all", label: "全部状态" },
  { id: "open", label: "待处理" },
  { id: "inProgress", label: "处理中" },
  { id: "rejected", label: "已驳回" },
  { id: "done", label: "已完成" },
  { id: "dropped", label: "已废弃" },
];

export function TicketsPage({
  tickets,
  currentUser,
  projects,
  onHandle,
  onCreate,
}: {
  tickets: Ticket[];
  /** 当前账号。侧栏那个切换器一换，「待我处理」跟着换——同一张单在不同角色眼里是不同的事。 */
  currentUser: string;
  projects: string[];
  onHandle: (ticket: Ticket) => void;
  onCreate: () => void;
}) {
  const [tab, setTab] = useState<TabId>("mine");
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState("全部类型");
  const [project, setProject] = useState("全部项目");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Ticket | null>(null);
  /* 标题、状态 tab、主按钮都交给顶栏——跟数据中枢、数字团队、邮箱同一套。
     页内再写一遍 h1 就成了两个「工单」,而顶栏那个面包屑本来就在说这件事。 */
  const [topbarTabHost, setTopbarTabHost] = useState<HTMLElement | null>(null);
  const [topbarPrimaryHost, setTopbarPrimaryHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTopbarTabHost(document.getElementById("workbench-topbar-tabs"));
    setTopbarPrimaryHost(document.getElementById("workbench-topbar-primary"));
  }, []);

  /* 数字挂在「待我处理」这一档上,不挂侧栏。侧栏那颗徽标是催办,而工单不是
     未读消息——它没有「看过就消掉」这回事,常驻一个数字只会变成背景噪音。
     真要催,该催的是超期,不是"有几条"。 */
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

  return (
    <section className="workbenchView ticketsView">
      {topbarTabHost ? createPortal(
        <NavTabs
          className="ticketsTabs"
          items={STATUS_TABS.map((item) => item.id === "mine" ? { ...item, count: mineCount || undefined } : item)}
          value={tab}
          onChange={(id) => { setTab(id); setPage(1); }}
          label="工单状态"
        />,
        topbarTabHost,
      ) : null}

      {topbarPrimaryHost ? createPortal(
        <button className="primaryButton compact ticketsCreateButton" type="button" onClick={onCreate}>
          <Upload size={15} />上传并交接
        </button>,
        topbarPrimaryHost,
      ) : null}

      <div className="ticketsFilters">
        <label className="ticketsSearch">
          <Search size={14} />
          <input value={keyword} placeholder="搜索工单号、标题或提交人" onChange={(event) => { setKeyword(event.target.value); setPage(1); }} />
          {keyword ? <button type="button" aria-label="清空搜索" onClick={() => { setKeyword(""); setPage(1); }}><X size={13} /></button> : null}
        </label>
        <CompactSelect value={kind} options={["全部类型", "QA 审核", "DMPK 报价"]} onChange={reset(setKind)} />
        <CompactSelect value={project} options={["全部项目", ...projects]} onChange={reset(setProject)} />
      </div>

      <div className="ticketsTableWrap">
        <table className="ticketsTable">
          <thead>
            <tr>
              <th>工单号</th>
              <th>标题</th>
              <th>状态</th>
              <th>类型</th>
              <th>提交人</th>
              <th>所属项目</th>
              <th>当前处理人</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket) => {
              /* 只有球还在你手上时才给「处理」。已驳回是球在上一棒那儿,已完成和
                 已废弃是终态——给一个点不动的按钮，比不给更让人困惑。 */
              const actionable = (ticket.status === "open" || ticket.status === "inProgress") && ticket.assignee === currentUser;
              return (
                <tr key={ticket.id}>
                  <td className="ticketsId">{ticket.id}</td>
                  <td className="ticketsTitle">
                    <strong>{ticket.title}</strong>
                    {ticket.attachments.length ? (
                      <span className="ticketsAttach"><Paperclip size={11} />{ticket.attachments[0].name}</span>
                    ) : null}
                  </td>
                  <td><StatusChip tone={ticketStatusTone[ticket.status]} dot>{ticketStatusLabel[ticket.status]}</StatusChip></td>
                  <td>{ticketKindLabel[ticket.kind]}</td>
                  <td>{ticket.from}</td>
                  <td className="ticketsProject">{ticket.project}</td>
                  <td>{ticket.assignee}</td>
                  <td className="ticketsTime">{ticket.updatedAt}</td>
                  <td className="ticketsActions">
                    <button type="button" disabled={!actionable} onClick={() => onHandle(ticket)}>处理</button>
                    <button type="button" onClick={() => setDetail(ticket)}>详情</button>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr><td className="ticketsEmpty" colSpan={9}>没有符合当前筛选条件的工单</td></tr>
            ) : null}
          </tbody>
        </table>
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

      {detail ? <TicketDetail ticket={detail} onClose={() => setDetail(null)} /> : null}
    </section>
  );
}

/** 详情只回答一个问题:这件事到今天为止,谁在什么时候对它做了什么。 */
function TicketDetail({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const dismiss = useModalDismiss(onClose);
  return (
    <div className="modalBackdrop" role="presentation" {...dismiss}>
      <section className="previewModal ticketDetailModal" role="dialog" aria-modal="true" aria-label={`${ticket.id} 详情`}>
        <header>
          <div><span>{ticket.id} · {ticketKindLabel[ticket.kind]}</span><h2>{ticket.title}</h2></div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="ticketDetailBody">
          <dl className="ticketDetailMeta">
            <div><dt>状态</dt><dd><StatusChip tone={ticketStatusTone[ticket.status]} dot>{ticketStatusLabel[ticket.status]}</StatusChip></dd></div>
            <div><dt>提交人</dt><dd>{ticket.from} · {ticket.fromRole}</dd></div>
            <div><dt>当前处理人</dt><dd>{ticket.assignee}{ticket.assigneeRole !== "—" ? ` · ${ticket.assigneeRole}` : ""}</dd></div>
            <div><dt>所属项目</dt><dd>{ticket.project}</dd></div>
            <div><dt>创建</dt><dd>{ticket.createdAt}</dd></div>
            <div><dt>最近更新</dt><dd>{ticket.updatedAt}</dd></div>
          </dl>

          {ticket.attachments.length ? (
            <section className="ticketDetailFiles">
              <h3>随单产物</h3>
              {ticket.attachments.map((item) => (
                <article key={item.id}><Paperclip size={13} /><div><strong>{item.name}</strong><small>{item.meta}</small></div></article>
              ))}
            </section>
          ) : null}

          {/* 这条链就是工单相对邮件多出来的那样东西。邮件里同一份报告来回三轮
              是三封信,谁也拼不出全貌;这里它是一条。 */}
          <section className="ticketDetailFlow">
            <h3>流转记录</h3>
            <ol>
              {ticket.steps.map((step) => (
                <li key={step.id}>
                  <div><strong>{step.action}</strong><time>{step.at}</time></div>
                  <small>{step.actor} · {step.actorRole}</small>
                  {step.note ? <p>{step.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </section>
    </div>
  );
}
