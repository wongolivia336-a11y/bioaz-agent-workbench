"use client";

import { Archive, Check, ChevronDown, FileArchive, FileText, Filter, Paperclip, Search, Send, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { InboxAccount } from "../../lib/workbench/mockInbox";
import { NavTabs } from "../ui";

type MailboxLane = "received" | "sent";
type ActionStatus = "open" | "done" | "none";

type ResourceRef = {
  id: string;
  name: string;
  kind: "file" | "package";
  meta: string;
  source: "uploaded" | "task-output" | "mail-copy";
};

type MailItem = {
  id: string;
  lane: Exclude<MailboxLane, "drafts">;
  from: string;
  fromRole: string;
  to: string[];
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread?: boolean;
  action: ActionStatus;
  actionLabel?: string;
  attachments: ResourceRef[];
  contextProject?: string;
  moduleId?: "qa-review" | "dmpk-quotation";
};

const initialMail: MailItem[] = [
  {
    id: "mail-qa-final",
    lane: "received",
    from: "林一一",
    fromRole: "一线实验员",
    to: ["王林彬"],
    subject: "请审批：硝酸异哈哈梨酯检测报告（第一版）",
    preview: "报告已完成撰写和 AI 全文校验，请完成审批并流转给负责人。",
    body: "王老师您好，\n\n硝酸异哈哈梨酯检测报告第一版已完成撰写。QA 审核同事已完成全文校验，共保留 6 条批注供审批时参考。请您审批；通过后请将报告与审阅记录一并发送给负责人终审归档。",
    time: "12 分钟前",
    unread: true,
    action: "open",
    actionLabel: "完成报告审批",
    attachments: [{ id: "report-1", name: "硝酸异哈哈梨酯检测报告.pdf", kind: "file", meta: "PDF · 第一版 · 2.8 MB", source: "task-output" }],
    contextProject: "XX药业-PD1临床前评价",
    moduleId: "qa-review",
  },
  {
    id: "mail-dmpk",
    lane: "received",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    to: ["王林彬"],
    subject: "待确认：Balb/c nude 报价交付包",
    preview: "报价参数和说明文件已打包，请确认后发送商务负责人。",
    body: "报价参数已按最新模板整理，附件包含报价单、参数说明和校验记录。请确认价格偏差项后完成流转。",
    time: "2 小时前",
    action: "open",
    actionLabel: "确认报价交付包",
    attachments: [{ id: "quote-1", name: "Balbc_nude_报价交付包.zip", kind: "package", meta: "ZIP · 3 个文件 · 5.4 MB", source: "task-output" }],
    contextProject: "YY药业-Balb/c nude评价",
    moduleId: "dmpk-quotation",
  },
  {
    id: "mail-notice",
    lane: "received",
    from: "李林",
    fromRole: "项目负责人",
    to: ["王林彬"],
    subject: "本周报告归档命名规则更新",
    preview: "请从本周起使用新的归档命名规则。",
    body: "本周起归档包统一使用“报告编号_版本_日期”的命名格式，请知悉。",
    time: "昨天",
    action: "none",
    attachments: [],
  },
  {
    id: "mail-sent",
    lane: "sent",
    from: "王林彬",
    fromRole: "审批人",
    to: ["李林"],
    subject: "终审流转：CT26 模型评价交付包",
    preview: "审批已通过，请完成最终确认和归档。",
    body: "CT26 模型评价交付包已完成审批，现发送给您进行最终确认和归档。",
    time: "昨天",
    action: "none",
    attachments: [{ id: "ct26", name: "CT26_模型评价交付包.zip", kind: "package", meta: "ZIP · 第三版 · 8.1 MB", source: "mail-copy" }],
  },
];

export function MailboxPage({ account, onStartTask }: { account: InboxAccount; onStartTask: (payload: { subject: string; project?: string; context: string; moduleId?: "qa-review" | "dmpk-quotation" }) => void }) {
  const [lane, setLane] = useState<MailboxLane>("received");
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");
  const [query, setQuery] = useState("");
  const [mail, setMail] = useState(initialMail);
  const [selectedId, setSelectedId] = useState(initialMail[0].id);
  const [composing, setComposing] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [requestAction, setRequestAction] = useState(true);
  const [topbarActionHost, setTopbarActionHost] = useState<HTMLElement | null>(null);
  const [topbarTabHost, setTopbarTabHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTopbarActionHost(document.getElementById("workbench-topbar-actions"));
    setTopbarTabHost(document.getElementById("workbench-topbar-tabs"));
  }, []);

  const visible = useMemo(() => mail.filter((item) => item.lane === lane && (filter === "all" || (filter === "todo" ? item.action === "open" : item.action === "done")) && `${item.from}${item.subject}${item.preview}`.toLowerCase().includes(query.toLowerCase())), [filter, lane, mail, query]);
  const selected = mail.find((item) => item.id === selectedId) ?? visible[0];
  const todoCount = mail.filter((item) => item.lane === "received" && item.action === "open").length;

  const startCompose = () => { setComposing(true); setRecipient(""); setSubject(""); setBody(""); };
  const writeWithAi = () => {
    setSubject((value) => value || "终审流转：硝酸异哈哈梨酯检测报告");
    setBody("李老师您好，\n\n该报告已完成一线撰写、AI 辅助校验及审批人复核，现将报告与审阅记录一并发送给您进行最终审批和归档。\n\n请重点确认报告结论及版本信息；如无异议，请完成归档。谢谢。");
  };
  const sendMail = () => {
    if (!recipient.trim() || !subject.trim()) return;
    const next: MailItem = { id: `mail-${Date.now()}`, lane: "sent", from: account.name, fromRole: account.roleLabel, to: [recipient], subject, preview: body || "已发送附件。", body: body || "已发送附件。", time: "刚刚", action: requestAction ? "open" : "none", actionLabel: requestAction ? "请完成处理" : undefined, attachments: [{ id: `attachment-${Date.now()}`, name: "硝酸异哈哈梨酯检测报告_审批包.zip", kind: "package", meta: "ZIP · 报告与审阅记录", source: "task-output" }] };
    setMail((items) => [next, ...items]); setLane("sent"); setSelectedId(next.id); setComposing(false);
  };
  const resolve = () => selected && setMail((items) => items.map((item) => item.id === selected.id ? { ...item, action: "done" } : item));
  const startTask = () => {
    if (!selected) return;
    const attachmentContext = selected.attachments.map((item) => `- ${item.name}（${item.meta}）`).join("\n") || "- 无附件";
    onStartTask({
      subject: selected.subject.replace(/^(请审批|待确认|终审流转)：?/, ""),
      project: selected.contextProject,
      moduleId: selected.moduleId,
      context: `来自邮件的任务上下文\n发件人：${selected.from}（${selected.fromRole}）\n要求：${selected.preview}\n附件：\n${attachmentContext}\n\n请基于以上上下文协助我完成处理。`,
    });
  };

  const tabsPortal = topbarTabHost ? createPortal(
    <NavTabs items={[{ id: "received" as const, label: `收件箱${todoCount ? ` ${todoCount}` : ""}` }, { id: "sent" as const, label: "已发送" }]} value={lane} onChange={(next) => { setLane(next); setComposing(false); }} label="邮箱" />,
    topbarTabHost,
  ) : null;
  const actionPortal = topbarActionHost ? createPortal(
    <button className="secondaryButton compact mailboxTopCompose" type="button" onClick={startCompose}><Send size={13} />写邮件</button>,
    topbarActionHost,
  ) : null;

  return <section className="mailboxPage">
    {tabsPortal}{actionPortal}
    <div className="mailboxListPane">
      <div className="mailboxListIntro">
        <div><strong>{lane === "received" ? "收件箱" : "已发送"}</strong><span>{visible.length} 封邮件</span></div>
        {lane === "received" && todoCount ? <small>{todoCount} 封待处理</small> : null}
      </div>
      <div className="mailboxListTools">
        <label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${lane === "received" ? "收件" : "已发送"}邮件`} /></label>
        <button type="button" title="筛选邮件" aria-label="筛选邮件"><Filter size={14} /></button>
      </div>
      <div className="mailboxFilters">
        {([['all','全部'],['todo','待我处理'],['done','已完成']] as const).map(([id,label]) => <button className={filter === id ? "active" : ""} type="button" key={id} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <div className="mailboxRows">
        {visible.map((item) => <button className={`mailboxRow ${selected?.id === item.id && !composing ? "active" : ""}`} type="button" key={item.id} onClick={() => { setSelectedId(item.id); setComposing(false); }}>
          <div><strong>{item.lane === "received" ? item.from : `发给 ${item.to.join('、')}`}</strong><time>{item.time}</time></div>
          <b>{item.subject}</b><p>{item.preview}</p>
          <footer>{item.action === "open" ? <span className="mailTodoTag">待处理</span> : item.action === "done" ? <span>已完成</span> : null}{item.attachments.length ? <span><Paperclip size={12} />{item.attachments.length}</span> : null}</footer>
        </button>)}
        {!visible.length ? <div className="mailboxEmpty">这里还没有邮件</div> : null}
      </div>
    </div>

    <article className="mailboxDetailPane">
      {composing ? <div className="mailComposer">
        <header><div><strong>新邮件</strong><span>发送后保留在已发送；勾选行动请求后，对方会收到待办。</span></div><button type="button" onClick={() => setComposing(false)} aria-label="关闭"><X size={16} /></button></header>
        <label className="mailField"><span>收件人</span><div className="mailRecipient"><UserRound size={14} /><input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="输入 @数字同事 或真人同事" /></div></label>
        <label className="mailField"><span>主题</span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="简明说明这次文件流转" /></label>
        <div className="mailAttachment"><FileArchive size={18} /><div><strong>硝酸异哈哈梨酯检测报告_审批包.zip</strong><span>报告 + AI 批注 + 审批记录 · 来自任务产物</span></div><ChevronDown size={14} /></div>
        <div className="mailAiBar"><button type="button" onClick={writeWithAi}><Sparkles size={14} />AI 帮我写</button><button type="button" onClick={() => setBody("附件为本次审批材料，已自动汇总关键结论与版本信息。请查收并完成后续处理。")}>根据附件生成摘要</button><button type="button">检查遗漏</button></div>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="写邮件正文，或让 AI 根据收件人、附件和行动要求起草…" />
        <footer><label><input type="checkbox" checked={requestAction} onChange={(event) => setRequestAction(event.target.checked)} />发送为待办 <span>对方完成后回传状态</span></label><div><button className="secondaryButton compact" type="button">存草稿</button><button className="primaryButton compact" type="button" disabled={!recipient.trim() || !subject.trim()} onClick={sendMail}><Send size={14} />发送</button></div></footer>
      </div> : selected ? <div className="mailReader">
        <header><div><h2>{selected.subject}</h2><p><strong>{selected.from}</strong><span>{selected.fromRole}</span> 发给 {selected.to.join("、")}</p></div><time>{selected.time}</time></header>
        <div className="mailReaderBody">{selected.body.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>)}</div>
        {selected.attachments.length ? <section className="mailAttachments"><div><strong>附件</strong><span>{selected.attachments.length} 项</span></div>{selected.attachments.map((attachment) => <button type="button" key={attachment.id}><span>{attachment.kind === "package" ? <FileArchive size={18} /> : <FileText size={18} />}</span><div><strong>{attachment.name}</strong><small>{attachment.meta}</small></div></button>)}</section> : null}
        {selected.action !== "none" ? <section className={`mailDecisionCard ${selected.action === "done" ? "isDone" : ""}`}><div><span>{selected.action === "done" ? <Check size={15} /> : <Archive size={15} />}</span><div><small>行动请求</small><strong>{selected.actionLabel}</strong><p>{selected.action === "done" ? "已完成，状态会同步给发件人。" : "进入对应数字同事的会话，邮件正文和附件会自动成为首轮上下文。"}</p></div></div><div>{selected.action === "open" ? <button className="primaryButton compact" type="button" onClick={startTask}><Sparkles size={14} />进入处理会话</button> : null}{selected.action === "open" ? <button className="secondaryButton compact" type="button" onClick={resolve}><Check size={14} />标记完成</button> : null}</div></section> : null}
      </div> : <div className="mailboxEmpty">选择一封邮件查看</div>}
    </article>
  </section>;
}
