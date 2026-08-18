"use client";

import { Archive, ArrowLeft, Check, FileArchive, FileText, Inbox, MessageSquarePlus, Paperclip, Search, Send, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { inboxAccounts, type InboxAccount } from "../../lib/workbench/mockInbox";
import { fileAttachmentFromUpload, mergeAttachments, type ComposerAttachment } from "../../lib/workbench/composerAttachments";
import { ComposerAttachMenu } from "./ComposerAttachMenu";
import {
  initialMail,
  type MailboxLane,
  type MailItem,
  type MailModuleId,
  type MailResourceRef,
} from "../../lib/workbench/mailboxData";
import type { WorkbenchTask } from "../../modules/types";
import { Button, Dialog, EmptyState, Menu, MenuGroup, MenuItem, NavTabs, SegmentedControl, StatusChip } from "../ui";

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

/** 收件人只有真人。要把活交给数字同事，走「进入处理会话」，不走邮件。 */
export type MailRecipient = { id: string; name: string; role: string };

export type MailHandoffPayload = {
  subject: string;
  project?: string;
  context: string;
  /* 附件走结构化，不再拼进 context 正文。拼字符串的话，会话里那条气泡
     只是一段写着文件名的文字——点不开、没有类型图标，和用户自己从
     composer 传上来的附件看起来是两种东西，但它们本该是同一种。 */
  attachments: ComposerAttachment[];
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
  /* 写邮件是这一页唯一的主操作，跟别的页一样挂到页头右边。
     它原来夹在左列的搜索框旁边，跟「找信」混成一组。 */
  const [topbarPrimaryHost, setTopbarPrimaryHost] = useState<HTMLElement | null>(null);
  const [mail, setMail] = useState(initialMail);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* 右侧大区默认是「写邮件」，不是空态。收信和发信是这一页的两件事，
     读信要先有目标、写信不用，所以没有选中邮件时最合理的落点是写信。 */
  const [pane, setPane] = useState<"compose" | "read">("compose");
  const [recipients, setRecipients] = useState<MailRecipient[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [composeAttachments, setComposeAttachments] = useState<ComposerAttachment[]>([]);
  const [requestAction, setRequestAction] = useState(true);
  const [preview, setPreview] = useState<MailResourceRef | null>(null);

  /* 搜索跨 lane。原来它只搜当前信箱，于是"搜不到"和"不在这个信箱"
     这两件事在界面上长得一模一样。有关键词时 lane 让位给搜索结果。 */
  const searching = Boolean(query.trim());
  const visible = useMemo(() => mail.filter((item) => (
    (searching || item.lane === lane)
    && (searching || lane !== "received" || filter === "all" || (filter === "todo" ? item.action === "open" : item.action === "done"))
    && `${item.from}${item.to.join("")}${item.subject}${item.preview}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [filter, lane, mail, query, searching]);
  const selected = selectedId ? mail.find((item) => item.id === selectedId) ?? null : null;
  const todoCount = mail.filter((item) => item.lane === "received" && item.action === "open").length;
  const draftCount = mail.filter((item) => item.lane === "draft").length;

  useEffect(() => { setTopbarPrimaryHost(document.getElementById("workbench-topbar-primary")); }, []);

  /* 只有真人。邮件是人与人之间的正式流转凭证——要把活交给数字同事，
     「进入处理会话」是更直接的一条路，两条路并存只会让人不知道该用哪个。 */
  const mentionCandidates = useMemo<MailRecipient[]>(() => inboxAccounts
    .filter((item) => item.id !== account.id)
    .map((item) => ({ id: item.id, name: item.name, role: item.roleLabel })), [account.id]);

  /* @ 只是唤出列表的一种写法，直接打字也该能筛——否则用户得先学会打 @ 才用得上。 */
  const mentionMatches = useMemo(() => {
    const keyword = recipientQuery.replace(/^@/, "").trim().toLowerCase();
    return mentionCandidates
      .filter((item) => !recipients.some((picked) => picked.id === item.id))
      .filter((item) => !keyword || `${item.name}${item.role}`.toLowerCase().includes(keyword));
  }, [mentionCandidates, recipientQuery, recipients]);

  const addRecipient = (person: MailRecipient) => {
    setRecipients((items) => items.some((item) => item.id === person.id) ? items : [...items, person]);
    setRecipientQuery("");
    setMentionOpen(false);
  };

  const startCompose = () => {
    setPane("compose");
    setSelectedId(null);
    setRecipients([]);
    setRecipientQuery("");
    setMentionOpen(false);
    setSubject("");
    setBody("");
    setComposeAttachments([]);
  };
  const writeWithAi = () => {
    setSubject((value) => value || "终审流转：硝酸异哈哈梨酯检测报告");
    setBody("李老师您好，\n\n该报告已完成一线撰写、AI 辅助校验及审批人复核，现将报告与审阅记录一并发送给您进行最终审批和归档。\n\n请重点确认报告结论及版本信息；如无异议，请完成归档。谢谢。");
  };
  const sendMail = () => {
    if (!recipients.length || !subject.trim()) return;
    const next: MailItem = {
      id: `mail-${Date.now()}`,
      lane: "sent",
      from: account.name,
      fromRole: account.roleLabel,
      to: recipients.map((person) => person.name),
      subject,
      preview: body || "已发送附件。",
      body: body || "已发送附件。",
      time: "刚刚",
      action: requestAction ? "open" : "none",
      actionLabel: requestAction ? "请完成处理" : undefined,
      /* 附件跟着真实选择走。此前这里写死一个 zip，于是发任何一封信、
         带任何附件，已发送里躺着的都是同一个文件名。 */
      attachments: composeAttachments.map((item) => ({
        id: item.id,
        name: item.label,
        kind: /\.(zip|rar|7z)$/i.test(item.label) ? "package" as const : "file" as const,
        meta: item.meta ?? "附件",
        source: "task-output" as const,
      })),
    };
    setMail((items) => [next, ...items]);
    setLane("sent");
    setSelectedId(next.id);
    setPane("read");
  };

  /* 存草稿。此前这颗按钮没有 onClick，草稿既存不下也没处看。 */
  const saveDraft = () => {
    if (!recipients.length && !subject.trim() && !body.trim() && !composeAttachments.length) return;
    const draft: MailItem = {
      id: `draft-${Date.now()}`,
      lane: "draft",
      from: account.name,
      fromRole: account.roleLabel,
      to: recipients.map((person) => person.name),
      subject: subject.trim() || "（无主题）",
      preview: body.trim() || "（无正文）",
      body,
      time: "刚刚",
      action: "none",
      attachments: composeAttachments.map((item) => ({
        id: item.id,
        name: item.label,
        kind: /\.(zip|rar|7z)$/i.test(item.label) ? "package" as const : "file" as const,
        meta: item.meta ?? "附件",
        source: "task-output" as const,
      })),
    };
    setMail((items) => [draft, ...items]);
    setLane("draft");
    startCompose();
  };

  /* 打开即已读。「已读」和「已处理」是两件事——读过它还留在待办里，
     徽标数看的是 action 不是 unread。 */
  const openMail = (id: string) => {
    setSelectedId(id);
    setPane("read");
    setMail((items) => items.map((item) => item.id === id && item.unread ? { ...item, unread: false } : item));
  };

  /* 邮件是「可注入对话的上下文」，不只是「任务启动器」：同一封信既可以开一条
     新的 Chat，也可以丢进这个项目下已经开着的那条。所以这里出参带 taskId，
     由 shell 决定是新建还是落到已有会话。 */
  const handoff = (item: MailItem, taskId?: string) => {
    onStartTask({
      subject: item.subject.replace(/^(请审批|待确认|终审流转)：?/, ""),
      project: item.contextProject,
      moduleId: item.moduleId,
      taskId,
      context: `来自邮件的任务上下文\n发件人：${item.from}（${item.fromRole}）\n要求：${item.preview}\n\n请基于以上上下文协助我完成处理。`,
      attachments: item.attachments.map((file) => ({
        id: `mail-${item.id}-${file.id}`,
        kind: "file" as const,
        label: file.name,
        meta: file.meta,
        origin: "library" as const,
      })),
    });
  };

  /** 候选会话按邮件所属项目收窄；没写项目的邮件（纯知会）就只能新开 */
  const candidatesFor = (item: MailItem) => item.contextProject
    ? tasks.filter((task) => task.project === item.contextProject)
    : [];

  return <section className="mailboxPage">
    {topbarPrimaryHost ? createPortal(
      <Button variant="primary" size="small" leadingIcon={<Send size={14} />} onClick={startCompose}>写邮件</Button>,
      topbarPrimaryHost,
    ) : null}
    <div className="mailboxListPane">
      {/* 信箱切换从 topbar 挪进这一列：它换的是「这一列显示哪批信」，
          放在被它控制的那一列头上，比放在 820px 外的顶栏讲得通。
          待办数挂 count 而不是拼进 label——NavTabs 自己会渲染徽标。 */}
      <NavTabs
        className="mailboxLaneTabs"
        items={[
          { id: "received" as const, label: "收件箱", count: todoCount || undefined },
          { id: "sent" as const, label: "已发送" },
          { id: "draft" as const, label: "草稿", count: draftCount || undefined },
        ]}
        value={lane}
        onChange={(next) => { setLane(next); setFilter("all"); }}
        label="邮箱"
      />
      {/* 搜索只过滤这一列，所以留在这一列里；写邮件是整页的动作，已经上到页头。 */}
      <div className="mailboxListTools">
        <label>
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索全部邮件" />
        </label>
      </div>
      {/* 「全部 / 待我处理 / 已完成」是收件箱内部的呈现切换，已发送和草稿没有
          「待我处理」这回事；搜索时结果跨 lane，这三颗也失去意义。 */}
      {lane === "received" && !searching ? (
        <SegmentedControl
          className="mailboxFilterControl"
          items={[{ id: "all" as const, label: "全部" }, { id: "todo" as const, label: "待我处理" }, { id: "done" as const, label: "已完成" }]}
          value={filter}
          onChange={setFilter}
          label="邮件筛选"
        />
      ) : null}
      <div className="mailboxRows">
        {visible.length ? visible.map((item) => {
          const candidates = candidatesFor(item);
          return (
            /* 行是 div 不是 button：右边那颗「加入对话」是行内的第二个动作，
               button 套 button 是非法嵌套，菜单也会被行的点击吃掉。 */
            <div
              className={`mailboxRow ${pane === "read" && selected?.id === item.id ? "active" : ""} ${item.unread ? "isUnread" : ""}`}
              key={item.id}
            >
              <button className="mailboxRowMain" type="button" onClick={() => openMail(item.id)}>
                <div>
                  <strong>{item.lane === "received" ? item.from : `发给 ${item.to.join("、") || "（未填收件人）"}`}</strong>
                  <time>{item.time}</time>
                </div>
                <b>{item.subject}</b>
                {/* 预览行删了：待处理的信这一格换成附件名，比一句截断的正文
                    更能决定"要不要现在点开"。搜索时补一个所在信箱的标签。 */}
                <footer>
                  {item.action === "open" ? <StatusChip tone="warning">待处理</StatusChip> : null}
                  {item.action === "done" ? <StatusChip tone="success">已完成</StatusChip> : null}
                  {searching ? <StatusChip tone="neutral">{item.lane === "received" ? "收件箱" : item.lane === "sent" ? "已发送" : "草稿"}</StatusChip> : null}
                  {item.attachments.length ? (
                    item.action === "open" ? (
                      <span className="mailboxRowFile" title={item.attachments.map((file) => file.name).join("、")}>
                        <Paperclip size={12} />
                        <b>{item.attachments[0].name}</b>
                        {item.attachments.length > 1 ? <i>等 {item.attachments.length} 个</i> : null}
                      </span>
                    ) : <span><Paperclip size={12} />{item.attachments.length}</span>
                  ) : null}
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
      {pane === "read" && selected ? (
        <div className="mailReader">
          <header>
            <div>
              {/* 返回写邮件：右区的默认态是写信，读完一封信要能回到默认态 */}
              <button className="mailReaderBack" type="button" onClick={startCompose}>
                <ArrowLeft size={14} />返回写邮件
              </button>
              <h2>{selected.subject}</h2>
              <p><strong>{selected.from}</strong><span>{selected.fromRole}</span> 发给 {selected.to.join("、") || "（未填收件人）"}</p>
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
                <button type="button" key={attachment.id} onClick={() => setPreview(attachment)}>
                  <span>{attachment.kind === "package" ? <FileArchive size={18} /> : <FileText size={18} />}</span>
                  <div>
                    <strong>{attachment.name}</strong>
                    <small>{attachment.meta}</small>
                  </div>
                </button>
              ))}
            </section>
          ) : null}
          {/* 决策卡留在最下面：先读事实再落动作，这是阅读顺序。
              「标记完成」已删——处置只发生在会话里，邮箱只负责把信送进会话。
              完成状态由会话结束时回写，所以这里只读地陈述当前状态。 */}
          {selected.action !== "none" ? (
            <section className={`mailDecisionCard ${selected.action === "done" ? "isDone" : ""}`}>
              <div>
                <span>{selected.action === "done" ? <Check size={15} /> : <Archive size={15} />}</span>
                <div>
                  <small>行动请求</small>
                  <strong>{selected.actionLabel}</strong>
                  <p>{selected.action === "done" ? "已由处理会话完成，状态已同步给发件人。" : "带着正文和全部附件新开一个处理会话；会话结束后，完成状态会自动写回这封邮件。"}</p>
                </div>
              </div>
              {selected.action === "open" ? (
                <div>
                  <Button variant="primary" size="small" leadingIcon={<Sparkles size={14} />} onClick={() => handoff(selected)}>进入处理会话</Button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : (
        <MailComposePane
          account={account}
          recipients={recipients}
          recipientQuery={recipientQuery}
          mentionOpen={mentionOpen}
          mentionMatches={mentionMatches}
          subject={subject}
          body={body}
          attachments={composeAttachments}
          requestAction={requestAction}
          onQueryChange={(value) => { setRecipientQuery(value); setMentionOpen(true); }}
          onMentionOpen={() => setMentionOpen(true)}
          onPick={addRecipient}
          onDropLast={() => setRecipients((items) => items.slice(0, -1))}
          onRemove={(id) => setRecipients((items) => items.filter((item) => item.id !== id))}
          onSubjectChange={setSubject}
          onBodyChange={setBody}
          onAttachmentsChange={setComposeAttachments}
          onRequestActionChange={setRequestAction}
          onWriteWithAi={writeWithAi}
          onSaveDraft={saveDraft}
          onSend={sendMail}
        />
      )}
    </article>

    {preview ? (
      <Dialog
        title={preview.name}
        description={preview.meta}
        onClose={() => setPreview(null)}
        footer={<Button variant="secondary" size="small" onClick={() => setPreview(null)}>关闭</Button>}
      >
        {/* 原型阶段不做真实渲染：这里只承诺"点得开、看得到是什么"，
            真正的处置仍然只发生在会话里。 */}
        <div className="mailAttachmentPreview">
          <span>{preview.kind === "package" ? <FileArchive size={28} /> : <FileText size={28} />}</span>
          <p>预览暂不可用。需要基于这个文件做处理，请回到邮件里点「进入处理会话」。</p>
        </div>
      </Dialog>
    ) : null}
  </section>;
}

/**
 * 写邮件。
 *
 * 它是右侧大区的默认形态，不是浮层——收信和发信是这一页并列的两件事，
 * 而写信不需要先选中任何东西，所以没有选中邮件时它就是这一格该显示的内容。
 * 也因此不再需要"全屏"：它本来就占满右区。
 */
function MailComposePane(props: {
  account: InboxAccount;
  recipients: MailRecipient[];
  recipientQuery: string;
  mentionOpen: boolean;
  mentionMatches: MailRecipient[];
  subject: string;
  body: string;
  attachments: ComposerAttachment[];
  requestAction: boolean;
  onQueryChange: (value: string) => void;
  onMentionOpen: () => void;
  onPick: (person: MailRecipient) => void;
  onDropLast: () => void;
  onRemove: (id: string) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onAttachmentsChange: (next: ComposerAttachment[]) => void;
  onRequestActionChange: (next: boolean) => void;
  onWriteWithAi: () => void;
  onSaveDraft: () => void;
  onSend: () => void;
}) {
  const { account, recipients, mentionMatches } = props;
  return (
    <div className="mailComposer" aria-label="写邮件">
      <header className="mailComposerHead">
        <strong>写邮件</strong>
        <span>发送后保留在已发送；勾选行动请求后，对方会收到待办。</span>
      </header>

      <div className="mailComposerBody">
        {/* 发件身份不是装饰：切账号会换岗位，而岗位决定这封信在对方那边
            以什么身份进入审批流。发出去之后再解释就晚了。 */}
        <div className="mailField mailFieldStatic">
          <span>发件人</span>
          <p><strong>{account.name}</strong><em>{account.roleLabel}</em>{account.email}</p>
        </div>

        <div className="mailField mailRecipientField">
          <span>收件人</span>
          <div className="mailRecipientBox">
            {recipients.map((person) => (
              <em key={person.id}>
                <UserRound size={12} />
                {person.name}
                <button type="button" aria-label={`移除 ${person.name}`} onClick={() => props.onRemove(person.id)}><X size={11} /></button>
              </em>
            ))}
            <input
              value={props.recipientQuery}
              placeholder={recipients.length ? "" : "输入 @ 或直接打名字"}
              onChange={(event) => props.onQueryChange(event.target.value)}
              onFocus={props.onMentionOpen}
              onKeyDown={(event) => {
                if (event.key === "Enter" && mentionMatches.length) { event.preventDefault(); props.onPick(mentionMatches[0]); }
                // 输入框空着时退格删掉上一个 chip，和常见收件人栏一致
                if (event.key === "Backspace" && !props.recipientQuery && recipients.length) props.onDropLast();
              }}
            />
            {props.mentionOpen && mentionMatches.length ? (
              <div className="mailMentionMenu" role="listbox">
                {mentionMatches.map((person) => (
                  <button type="button" key={person.id} onClick={() => props.onPick(person)}>
                    <span><UserRound size={13} /></span>
                    <b>{person.name}</b>
                    <small>{person.role}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <label className="mailField">
          <span>主题</span>
          <input value={props.subject} onChange={(event) => props.onSubjectChange(event.target.value)} placeholder="简明说明这次文件流转" />
        </label>

        <div className="mailAiBar">
          <button type="button" onClick={props.onWriteWithAi}><Sparkles size={14} />AI 帮我写</button>
          <button type="button" onClick={() => props.onBodyChange("附件为本次审批材料，已自动汇总关键结论与版本信息。请查收并完成后续处理。")}>根据附件生成摘要</button>
          <button type="button">检查遗漏</button>
        </div>

        <textarea value={props.body} onChange={(event) => props.onBodyChange(event.target.value)} placeholder="写邮件正文，或让 AI 根据收件人、附件和行动要求起草…" />
      </div>

      <footer className="mailComposerFoot">
        <div className="mailComposerTools">
          {/* 和会话里传文件走同一套：本地 / 项目文件库 / 知识库。
              交付产物本来就在项目文件库里（kind: 交付产物），不另开一类。 */}
          <ComposerAttachMenu
            attachments={props.attachments}
            onAdd={(attachment) => props.onAttachmentsChange(mergeAttachments(props.attachments, [attachment]))}
            onRemove={(id) => props.onAttachmentsChange(props.attachments.filter((item) => item.id !== id))}
            onLocalFiles={(files) => props.onAttachmentsChange(mergeAttachments(props.attachments, files.map(fileAttachmentFromUpload)))}
            project={null}
          />
          <label className="mailComposeTodo">
            <input type="checkbox" checked={props.requestAction} onChange={(event) => props.onRequestActionChange(event.target.checked)} />
            发送为待办<span>对方完成后回传状态</span>
          </label>
        </div>
        <div className="mailComposerSend">
          <Button variant="secondary" size="small" onClick={props.onSaveDraft}>存草稿</Button>
          <Button variant="primary" size="small" leadingIcon={<Send size={14} />} disabled={!recipients.length || !props.subject.trim()} onClick={props.onSend}>发送</Button>
        </div>
      </footer>
    </div>
  );
}
