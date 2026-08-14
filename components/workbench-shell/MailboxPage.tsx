"use client";

import { Archive, Check, ChevronDown, FileArchive, FileText, Inbox, MessageSquarePlus, Paperclip, Search, Send, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { InboxAccount } from "../../lib/workbench/mockInbox";
import {
  initialMail,
  type MailboxLane,
  type MailItem,
  type MailModuleId,
} from "../../lib/workbench/mailboxData";
import type { WorkbenchTask } from "../../modules/types";
import { Button, EmptyState, Menu, MenuGroup, MenuItem, NavTabs, SegmentedControl, StatusChip } from "../ui";

/**
 * 邮箱。
 *
 * 信息层级只有三层，多一层都要有理由：
 *   ① 顶栏 —— 我在哪个信箱、有几件待办、写新邮件（唯一的全局动作）
 *   ② 索引列 —— 搜索 + 筛选 + 邮件行。**不再重复一遍「收件箱」标题**：
 *      顶栏的 tab 已经说过一次，页面标题说过一次，列头再说第三次是纯噪音。
 *   ③ 阅读列 —— 事实（正文、附件）在上，要你做的事（决策卡）在下。
 *
 * 控件一律走 components/ui 的既有原语：筛选是 SegmentedControl（换「怎么看」
 * 同一批邮件），信箱是 NavTabs（换「看什么」），标签是 StatusChip，按钮是
 * Button。此前这里各写了一套，字号和圆角都对不齐。
 */

type MailFilter = "all" | "todo" | "done";

export type MailHandoffPayload = {
  subject: string;
  project?: string;
  context: string;
  moduleId?: MailModuleId;
  /** 传了就是「加入这条已有的对话」，不传才是新开一条 */
  taskId?: string;
};

export function MailboxPage({ account, tasks, onStartTask }: {
  account: InboxAccount;
  /** 「加入对话」的候选：同项目下已有的任务 Chat */
  tasks: WorkbenchTask[];
  onStartTask: (payload: MailHandoffPayload) => void;
}) {
  const [lane, setLane] = useState<MailboxLane>("received");
  const [filter, setFilter] = useState<MailFilter>("all");
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

  const visible = useMemo(() => mail.filter((item) => (
    item.lane === lane
    && (filter === "all" || (filter === "todo" ? item.action === "open" : item.action === "done"))
    && `${item.from}${item.subject}${item.preview}`.toLowerCase().includes(query.toLowerCase())
  )), [filter, lane, mail, query]);
  const selected = mail.find((item) => item.id === selectedId) ?? visible[0];
  const todoCount = mail.filter((item) => item.lane === "received" && item.action === "open").length;

  const startCompose = () => { setComposing(true); setRecipient(""); setSubject(""); setBody(""); };
  const writeWithAi = () => {
    setSubject((value) => value || "终审流转：硝酸异哈哈梨酯检测报告");
    setBody("李老师您好，\n\n该报告已完成一线撰写、AI 辅助校验及审批人复核，现将报告与审阅记录一并发送给您进行最终审批和归档。\n\n请重点确认报告结论及版本信息；如无异议，请完成归档。谢谢。");
  };
  const sendMail = () => {
    if (!recipient.trim() || !subject.trim()) return;
    const next: MailItem = {
      id: `mail-${Date.now()}`,
      lane: "sent",
      from: account.name,
      fromRole: account.roleLabel,
      to: [recipient],
      subject,
      preview: body || "已发送附件。",
      body: body || "已发送附件。",
      time: "刚刚",
      action: requestAction ? "open" : "none",
      actionLabel: requestAction ? "请完成处理" : undefined,
      attachments: [{ id: `attachment-${Date.now()}`, name: "硝酸异哈哈梨酯检测报告_审批包.zip", kind: "package", meta: "ZIP · 报告与审阅记录", source: "task-output" }],
    };
    setMail((items) => [next, ...items]);
    setLane("sent");
    setSelectedId(next.id);
    setComposing(false);
  };
  const resolve = () => selected && setMail((items) => items.map((item) => item.id === selected.id ? { ...item, action: "done" } : item));

  /* 打开即已读。「已读」和「已处理」是两件事——读过它还留在待办里，
     徽标数看的是 action 不是 unread。 */
  const openMail = (id: string) => {
    setSelectedId(id);
    setComposing(false);
    setMail((items) => items.map((item) => item.id === id && item.unread ? { ...item, unread: false } : item));
  };

  /* 邮件是「可注入对话的上下文」，不只是「任务启动器」：同一封信既可以开一条
     新的 Chat，也可以丢进这个项目下已经开着的那条。所以这里出参带 taskId，
     由 shell 决定是新建还是落到已有会话。 */
  const handoff = (item: MailItem, taskId?: string) => {
    const attachmentContext = item.attachments.map((file) => `- ${file.name}（${file.meta}）`).join("\n") || "- 无附件";
    onStartTask({
      subject: item.subject.replace(/^(请审批|待确认|终审流转)：?/, ""),
      project: item.contextProject,
      moduleId: item.moduleId,
      taskId,
      context: `来自邮件的任务上下文\n发件人：${item.from}（${item.fromRole}）\n要求：${item.preview}\n附件：\n${attachmentContext}\n\n请基于以上上下文协助我完成处理。`,
    });
  };

  /** 候选会话按邮件所属项目收窄；没写项目的邮件（纯知会）就只能新开 */
  const candidatesFor = (item: MailItem) => item.contextProject
    ? tasks.filter((task) => task.project === item.contextProject)
    : [];

  /* 待办数挂在 tab 的 count 上，不拼进 label——NavTabs 自己会渲染徽标，
     拼字符串会得到一个跟数字团队那几个 tab 对不齐的"假徽标"。 */
  const tabsPortal = topbarTabHost ? createPortal(
    <NavTabs
      items={[
        { id: "received" as const, label: "收件箱", count: todoCount || undefined },
        { id: "sent" as const, label: "已发送" },
      ]}
      value={lane}
      onChange={(next) => { setLane(next); setComposing(false); }}
      label="邮箱"
    />,
    topbarTabHost,
  ) : null;
  const actionPortal = topbarActionHost ? createPortal(
    <Button variant="secondary" size="small" leadingIcon={<Send size={14} />} onClick={startCompose}>写邮件</Button>,
    topbarActionHost,
  ) : null;

  return <section className="mailboxPage">
    {tabsPortal}{actionPortal}

    <div className="mailboxListPane">
      <div className="mailboxListTools">
        <label>
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${lane === "received" ? "收件" : "已发送"}邮件`} />
        </label>
      </div>
      {/* 「全部 / 待我处理 / 已完成」换的是同一批邮件的呈现，不是换内容区，
          所以是 SegmentedControl 而不是又一套下划线 tab。原来这行右边还有一颗
          漏斗图标按钮，点了没反应，且跟这三颗说的是同一件事，已删。 */}
      <SegmentedControl
        className="mailboxFilterControl"
        items={[{ id: "all" as const, label: "全部" }, { id: "todo" as const, label: "待我处理" }, { id: "done" as const, label: "已完成" }]}
        value={filter}
        onChange={setFilter}
        label="邮件筛选"
      />
      <div className="mailboxRows">
        {visible.length ? visible.map((item) => {
          const candidates = candidatesFor(item);
          return (
            /* 行是 div 不是 button：右边那颗「加入对话」是行内的第二个动作，
               button 套 button 是非法嵌套，菜单也会被行的点击吃掉。 */
            <div
              className={`mailboxRow ${selected?.id === item.id && !composing ? "active" : ""} ${item.unread ? "isUnread" : ""}`}
              key={item.id}
            >
              <button className="mailboxRowMain" type="button" onClick={() => openMail(item.id)}>
                <div>
                  <strong>{item.lane === "received" ? item.from : `发给 ${item.to.join("、")}`}</strong>
                  <time>{item.time}</time>
                </div>
                <b>{item.subject}</b>
                <p>{item.preview}</p>
                <footer>
                  {item.action === "open" ? <StatusChip tone="warning">待处理</StatusChip> : null}
                  {item.action === "done" ? <StatusChip tone="success">已完成</StatusChip> : null}
                  {item.attachments.length ? <span><Paperclip size={12} />{item.attachments.length}</span> : null}
                </footer>
              </button>
              {/* 不必先点开邮件才能把它交给数字同事——扫列表时就能决定 */}
              <div className="mailboxRowActions">
                <Menu icon={<MessageSquarePlus size={15} />} label="加入对话">
                  <MenuGroup label="新开一条">
                    <MenuItem onSelect={() => handoff(item)}>新建任务处理这封邮件</MenuItem>
                  </MenuGroup>
                  {candidates.length ? (
                    <MenuGroup label={`加入 ${item.contextProject} 下已有的`}>
                      {candidates.map((task) => (
                        <MenuItem key={task.id} onSelect={() => handoff(item, task.id)}>{task.title}</MenuItem>
                      ))}
                    </MenuGroup>
                  ) : null}
                </Menu>
              </div>
            </div>
          );
        }) : (
          <EmptyState
            icon={<Inbox size={20} />}
            title={query || filter !== "all" ? "没有符合条件的邮件" : "这个信箱是空的"}
            description={query || filter !== "all" ? "换个关键词，或切回「全部」。" : undefined}
          />
        )}
      </div>
    </div>

    <article className="mailboxDetailPane">
      {composing ? (
        <div className="mailComposer">
          <header>
            <div>
              <strong>新邮件</strong>
              <span>发送后保留在已发送；勾选行动请求后，对方会收到待办。</span>
            </div>
            <button type="button" onClick={() => setComposing(false)} aria-label="关闭"><X size={16} /></button>
          </header>
          {/* 发件身份不是装饰：切账号会换岗位，而岗位决定这封信在对方那边
              以什么身份进入审批流。发出去之后再解释就晚了。 */}
          <div className="mailField mailFieldStatic">
            <span>发件人</span>
            <p><strong>{account.name}</strong><em>{account.roleLabel}</em>{account.email}</p>
          </div>
          <label className="mailField">
            <span>收件人</span>
            <div className="mailRecipient">
              <UserRound size={14} />
              <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="输入 @数字同事 或真人同事" />
            </div>
          </label>
          <label className="mailField">
            <span>主题</span>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="简明说明这次文件流转" />
          </label>
          <div className="mailAttachment">
            <FileArchive size={18} />
            <div>
              <strong>硝酸异哈哈梨酯检测报告_审批包.zip</strong>
              <span>报告 + AI 批注 + 审批记录 · 来自任务产物</span>
            </div>
            <ChevronDown size={14} />
          </div>
          <div className="mailAiBar">
            <button type="button" onClick={writeWithAi}><Sparkles size={14} />AI 帮我写</button>
            <button type="button" onClick={() => setBody("附件为本次审批材料，已自动汇总关键结论与版本信息。请查收并完成后续处理。")}>根据附件生成摘要</button>
            <button type="button">检查遗漏</button>
          </div>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="写邮件正文，或让 AI 根据收件人、附件和行动要求起草…" />
          <footer>
            <label>
              <input type="checkbox" checked={requestAction} onChange={(event) => setRequestAction(event.target.checked)} />
              发送为待办 <span>对方完成后回传状态</span>
            </label>
            <div>
              <Button variant="secondary" size="small">存草稿</Button>
              <Button variant="primary" size="small" leadingIcon={<Send size={14} />} disabled={!recipient.trim() || !subject.trim()} onClick={sendMail}>发送</Button>
            </div>
          </footer>
        </div>
      ) : selected ? (
        <div className="mailReader">
          <header>
            <div>
              <h2>{selected.subject}</h2>
              <p><strong>{selected.from}</strong><span>{selected.fromRole}</span> 发给 {selected.to.join("、")}</p>
            </div>
            <time>{selected.time}</time>
          </header>
          <div className="mailReaderBody">
            {selected.body.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>)}
          </div>
          {selected.attachments.length ? (
            <section className="mailAttachments">
              <div><strong>附件</strong><span>{selected.attachments.length} 项</span></div>
              {selected.attachments.map((attachment) => (
                <button type="button" key={attachment.id}>
                  <span>{attachment.kind === "package" ? <FileArchive size={18} /> : <FileText size={18} />}</span>
                  <div>
                    <strong>{attachment.name}</strong>
                    <small>{attachment.meta}</small>
                  </div>
                </button>
              ))}
            </section>
          ) : null}
          {/* 决策卡留在最下面，也留着重色：先读事实再落动作，这是阅读顺序。
              它是业务卡不是通用卡（accent 底色专门用来标"这封要你动手"），
              但里面的按钮走 Button 原语，不再自己写 primaryButton。 */}
          {selected.action !== "none" ? (
            <section className={`mailDecisionCard ${selected.action === "done" ? "isDone" : ""}`}>
              <div>
                <span>{selected.action === "done" ? <Check size={15} /> : <Archive size={15} />}</span>
                <div>
                  <small>行动请求</small>
                  <strong>{selected.actionLabel}</strong>
                  <p>{selected.action === "done" ? "已完成，状态会同步给发件人。" : "进入对应数字同事的会话，邮件正文和附件会自动成为首轮上下文。"}</p>
                </div>
              </div>
              {selected.action === "open" ? (
                <div>
                  <Button variant="primary" size="small" leadingIcon={<Sparkles size={14} />} onClick={() => handoff(selected)}>进入处理会话</Button>
                  <Button variant="secondary" size="small" leadingIcon={<Check size={14} />} onClick={resolve}>标记完成</Button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : (
        <EmptyState icon={<Inbox size={20} />} title="选择左侧一封邮件" description="右边会展开这封邮件的正文、附件和要你做的事。" />
      )}
    </article>
  </section>;
}
