/* 邮箱的数据契约。
   -------------------------------------------------------------------
   邮件是容器，待办只是它的一个属性（action）——所以这里没有第二套「待办」
   模型，「待我处理」是对同一批邮件的筛选，不是另一个列表。侧栏那颗徽标
   也读这里的 mailboxTodoCount，不再另算一份。

   放在 lib/workbench 而不是组件里：假数据和共享类型归这儿，组件只负责渲染。 */

/* draft 是第三条 lane：此前「存草稿」是颗死按钮，草稿既存不下也没处看。 */
export type MailboxLane = "received" | "sent" | "draft";

/** none = 纯知会，没有要你做的事；open/done 才进待办口径 */
export type MailActionStatus = "open" | "done" | "none";

export type MailResourceRef = {
  id: string;
  name: string;
  kind: "file" | "package";
  meta: string;
  source: "uploaded" | "task-output" | "mail-copy";
};

export type MailModuleId = "qa-review" | "dmpk-quotation" | "tumor-quotation";

export type MailItem = {
  id: string;
  lane: MailboxLane;
  from: string;
  fromRole: string;
  to: string[];
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread?: boolean;
  action: MailActionStatus;
  actionLabel?: string;
  attachments: MailResourceRef[];
  contextProject?: string;
  moduleId?: MailModuleId;
};

export const initialMail: MailItem[] = [
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
    /* 没看过，但也不用你做什么——这正是蓝点存在的意义：它跟上面两封
       「待处理」的黄点不是同一件事。 */
    unread: true,
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

/** 徽标口径：收件箱里还没落动作的条数。未读和未处理是两件事，这里只算后者。 */
export function mailboxTodoCount(mail: MailItem[] = initialMail) {
  return mail.filter((item) => item.lane === "received" && item.action === "open").length;
}
