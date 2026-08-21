import type { MailResourceRef, MailModuleId } from "./mailboxData";

/* 工单的数据契约。
   -------------------------------------------------------------------
   跟邮箱最根本的区别:邮件是「我通知过你了」,工单是「有人欠着一件事」。
   邮件发出去就不可变,状态只活在各人收件箱里;工单只有一份,谁改都改的是它,
   所以「这份报告审了几轮、现在在谁手上」是查得出来的事实,不是两个人收件箱
   的加和——CRO 要审计,这条不能靠人拼。

   驳回**不新开单**。一份产物一张工单,来回几轮都记在 steps 里;散成三张单,
   追溯就得靠人对时间戳,那正是审计事故的温床。

   原型只画审批人(王林彬)视角,但工单本身是共享的:他驳回之后状态变「已驳回」,
   撰写人那边看到的是同一张单。侧栏的账号切换器可以把这件事演出来。 */

/** open 交到手上还没动 / inProgress 正在处理 / rejected 已驳回,球在上一棒
 *  / done 这一棒结束(通过并已流转) / dropped 作废 */
export type TicketStatus = "open" | "inProgress" | "rejected" | "done" | "dropped";

export type TicketKind = "qa-review" | "dmpk-quotation";

/** 流转记录的一格。工单页的「详情」看的就是这条链。 */
export type TicketStep = {
  id: string;
  at: string;
  actor: string;
  actorRole: string;
  action: string;
  /** 驳回理由这类必须留痕的说明 */
  note?: string;
};

export type Ticket = {
  id: string;
  title: string;
  kind: TicketKind;
  status: TicketStatus;
  project: string;
  /** 交上来的人 */
  from: string;
  fromRole: string;
  /** 当前球在谁那儿 */
  assignee: string;
  assigneeRole: string;
  createdAt: string;
  updatedAt: string;
  attachments: MailResourceRef[];
  /** 点「处理」进哪条会话。没有就说明是手动上传开的单,还没接进任务。 */
  taskId?: string;
  moduleId?: MailModuleId;
  steps: TicketStep[];
};

export const ticketStatusLabel: Record<TicketStatus, string> = {
  open: "待处理",
  inProgress: "处理中",
  rejected: "已驳回",
  done: "已完成",
  dropped: "已废弃",
};

/* 语气映射独立于业务枚举——「已驳回」在业务上是个中性事实(球回到上一棒),
   但在扫列表时它需要和「待处理」区分开,所以给 danger 而不是 warning。 */
export const ticketStatusTone: Record<TicketStatus, "neutral" | "running" | "warning" | "success" | "danger"> = {
  open: "warning",
  inProgress: "running",
  rejected: "danger",
  done: "success",
  dropped: "neutral",
};

export const ticketKindLabel: Record<TicketKind, string> = {
  "qa-review": "QA 审核",
  "dmpk-quotation": "DMPK 报价",
};

const file = (id: string, name: string, meta: string): MailResourceRef => ({ id, name, kind: "file", meta, source: "task-output" });
const pkg = (id: string, name: string, meta: string): MailResourceRef => ({ id, name, kind: "package", meta, source: "task-output" });

export const initialTickets: Ticket[] = [
  {
    id: "TK-2047",
    title: "请审批：硝酸异哈哈梨酯检测报告（第一版）",
    kind: "qa-review",
    status: "open",
    project: "XX药业-PD1临床前评价",
    from: "林一一",
    fromRole: "一线实验员",
    assignee: "王林彬",
    assigneeRole: "审批人",
    createdAt: "今天 09:42",
    updatedAt: "12 分钟前",
    attachments: [file("tk-2047-a", "硝酸异哈哈梨酯检测报告.pdf", "PDF · 第一版 · 2.8 MB")],
    taskId: "task-sample9",
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "今天 09:42", actor: "林一一", actorRole: "一线实验员", action: "提交送审", note: "QA 审核同事已完成全文校验，保留 6 条批注供审批参考。" },
      { id: "s2", at: "12 分钟前", actor: "系统", actorRole: "流转", action: "分派给王林彬" },
    ],
  },
  {
    id: "TK-2046",
    title: "待确认：Balb/c nude 报价交付包",
    kind: "dmpk-quotation",
    status: "open",
    project: "YY药业-Balb/c nude评价",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    assignee: "王林彬",
    assigneeRole: "审批人",
    createdAt: "今天 08:10",
    updatedAt: "2 小时前",
    attachments: [pkg("tk-2046-a", "Balbc_nude_报价交付包.zip", "ZIP · 3 个文件 · 5.4 MB")],
    taskId: "task-balbc",
    moduleId: "dmpk-quotation",
    steps: [
      { id: "s1", at: "今天 08:10", actor: "赵敏", actorRole: "DMPK 报价同事", action: "提交送审", note: "报价参数已按最新模板整理，请确认价格偏差项。" },
      { id: "s2", at: "2 小时前", actor: "系统", actorRole: "流转", action: "分派给王林彬" },
    ],
  },
  {
    id: "TK-2044",
    title: "请审批：样本 9 双批次报告（第三版）",
    kind: "qa-review",
    status: "inProgress",
    project: "XX药业-PD1临床前评价",
    from: "林一一",
    fromRole: "一线实验员",
    assignee: "王林彬",
    assigneeRole: "审批人",
    createdAt: "昨天 16:20",
    updatedAt: "36 分钟前",
    attachments: [file("tk-2044-a", "样本9_双批次报告_v3.docx", "DOCX · 第三版 · 1.9 MB")],
    taskId: "task-sample9",
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "昨天 16:20", actor: "林一一", actorRole: "一线实验员", action: "提交送审" },
      { id: "s2", at: "36 分钟前", actor: "王林彬", actorRole: "审批人", action: "开始审批" },
    ],
  },
  {
    id: "TK-2041",
    title: "请审批：样本 7 单批次报告（第一版）",
    kind: "qa-review",
    status: "rejected",
    project: "XX药业-PD1临床前评价",
    from: "林一一",
    fromRole: "一线实验员",
    assignee: "林一一",
    assigneeRole: "一线实验员",
    createdAt: "昨天 10:05",
    updatedAt: "1 小时前",
    attachments: [file("tk-2041-a", "样本7_单批次报告_v1.docx", "DOCX · 第一版 · 1.4 MB")],
    taskId: "task-report-7",
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "昨天 10:05", actor: "林一一", actorRole: "一线实验员", action: "提交送审" },
      { id: "s2", at: "昨天 14:30", actor: "王林彬", actorRole: "审批人", action: "开始审批" },
      { id: "s3", at: "1 小时前", actor: "王林彬", actorRole: "审批人", action: "驳回", note: "第 8 页时间逻辑与原始记录对不上；终点日缺失值的补齐口径需要在方法学里注明出处。" },
    ],
  },
  {
    id: "TK-2039",
    title: "待确认：Balb/c nude BA 报价单",
    kind: "dmpk-quotation",
    status: "rejected",
    project: "YY药业-Balb/c nude评价",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    assignee: "赵敏",
    assigneeRole: "DMPK 报价同事",
    createdAt: "3 天前",
    updatedAt: "2 天前",
    attachments: [file("tk-2039-a", "Balbc_nude_BA_报价单.xlsx", "XLSX · 1.1 MB")],
    taskId: "task-ba",
    moduleId: "dmpk-quotation",
    steps: [
      { id: "s1", at: "3 天前", actor: "赵敏", actorRole: "DMPK 报价同事", action: "提交送审" },
      { id: "s2", at: "2 天前", actor: "王林彬", actorRole: "审批人", action: "驳回", note: "管理费口径与本单合同不一致，按 15% 重出一版。" },
    ],
  },
  {
    id: "TK-2035",
    title: "终审流转：CT26 模型评价交付包",
    kind: "qa-review",
    status: "done",
    project: "ZZ药业-CT26模型评价",
    from: "王林彬",
    fromRole: "审批人",
    assignee: "李林",
    assigneeRole: "项目负责人",
    createdAt: "3 天前",
    updatedAt: "昨天",
    attachments: [pkg("tk-2035-a", "CT26_模型评价交付包.zip", "ZIP · 第三版 · 8.1 MB")],
    taskId: "task-ct26-quote",
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "4 天前", actor: "林一一", actorRole: "一线实验员", action: "提交送审" },
      { id: "s2", at: "3 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过", note: "6 条批注均已处置，统计口径与 v4 一致。" },
      { id: "s3", at: "昨天", actor: "王林彬", actorRole: "审批人", action: "流转给李林终审归档" },
    ],
  },
  {
    id: "TK-2033",
    title: "待确认：CT26 模型评价报价交付包",
    kind: "dmpk-quotation",
    status: "done",
    project: "ZZ药业-CT26模型评价",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    assignee: "李林",
    assigneeRole: "项目负责人",
    createdAt: "5 天前",
    updatedAt: "3 天前",
    attachments: [file("tk-2033-a", "CT26_报价单.docx", "DOCX · 0.9 MB")],
    taskId: "task-ct26-quote",
    moduleId: "dmpk-quotation",
    steps: [
      { id: "s1", at: "5 天前", actor: "赵敏", actorRole: "DMPK 报价同事", action: "提交送审" },
      { id: "s2", at: "4 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过" },
      { id: "s3", at: "3 天前", actor: "王林彬", actorRole: "审批人", action: "流转给李林终审归档" },
    ],
  },
  {
    id: "TK-2030",
    title: "请审批：样本 6 单批次报告（第二版）",
    kind: "qa-review",
    status: "done",
    project: "XX药业-PD1临床前评价",
    from: "林一一",
    fromRole: "一线实验员",
    assignee: "李林",
    assigneeRole: "项目负责人",
    createdAt: "6 天前",
    updatedAt: "4 天前",
    attachments: [file("tk-2030-a", "样本6_单批次报告_v2.docx", "DOCX · 第二版 · 1.6 MB")],
    taskId: "task-report-7",
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "6 天前", actor: "林一一", actorRole: "一线实验员", action: "提交送审" },
      { id: "s2", at: "5 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过" },
      { id: "s3", at: "4 天前", actor: "王林彬", actorRole: "审批人", action: "流转给李林终审归档" },
    ],
  },
  {
    id: "TK-2028",
    title: "待确认：PK 方法学验证报价",
    kind: "dmpk-quotation",
    status: "dropped",
    project: "YY药业-Balb/c nude评价",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    assignee: "—",
    assigneeRole: "—",
    createdAt: "7 天前",
    updatedAt: "6 天前",
    attachments: [],
    moduleId: "dmpk-quotation",
    steps: [
      { id: "s1", at: "7 天前", actor: "赵敏", actorRole: "DMPK 报价同事", action: "提交送审" },
      { id: "s2", at: "6 天前", actor: "王林彬", actorRole: "审批人", action: "作废", note: "客户撤回询价，本单不再报。" },
    ],
  },
  {
    id: "TK-2026",
    title: "请审批：样本 5 双批次报告（第一版）",
    kind: "qa-review",
    status: "dropped",
    project: "XX药业-PD1临床前评价",
    from: "林一一",
    fromRole: "一线实验员",
    assignee: "—",
    assigneeRole: "—",
    createdAt: "8 天前",
    updatedAt: "8 天前",
    attachments: [],
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "8 天前", actor: "林一一", actorRole: "一线实验员", action: "提交送审" },
      { id: "s2", at: "8 天前", actor: "林一一", actorRole: "一线实验员", action: "作废", note: "原始数据有误，重新出数后另起一单。" },
    ],
  },
  {
    id: "TK-2024",
    title: "请审批：样本 4 单批次报告（第三版）",
    kind: "qa-review",
    status: "done",
    project: "XX药业-PD1临床前评价",
    from: "林一一",
    fromRole: "一线实验员",
    assignee: "李林",
    assigneeRole: "项目负责人",
    createdAt: "10 天前",
    updatedAt: "9 天前",
    attachments: [file("tk-2024-a", "样本4_单批次报告_v3.docx", "DOCX · 第三版 · 1.5 MB")],
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "10 天前", actor: "林一一", actorRole: "一线实验员", action: "提交送审" },
      { id: "s2", at: "9 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过" },
    ],
  },
  {
    id: "TK-2021",
    title: "待确认：TOX 批量报价（第二版）",
    kind: "dmpk-quotation",
    status: "done",
    project: "ZZ药业-CT26模型评价",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    assignee: "李林",
    assigneeRole: "项目负责人",
    createdAt: "12 天前",
    updatedAt: "11 天前",
    attachments: [file("tk-2021-a", "TOX_批量报价_v2.xlsx", "XLSX · 1.3 MB")],
    moduleId: "dmpk-quotation",
    steps: [
      { id: "s1", at: "12 天前", actor: "赵敏", actorRole: "DMPK 报价同事", action: "提交送审" },
      { id: "s2", at: "11 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过" },
    ],
  },
  {
    id: "TK-2018",
    title: "请审批：样本 3 双批次报告（第二版）",
    kind: "qa-review",
    status: "done",
    project: "XX药业-PD1临床前评价",
    from: "林一一",
    fromRole: "一线实验员",
    assignee: "李林",
    assigneeRole: "项目负责人",
    createdAt: "14 天前",
    updatedAt: "13 天前",
    attachments: [],
    moduleId: "qa-review",
    steps: [
      { id: "s1", at: "14 天前", actor: "林一一", actorRole: "一线实验员", action: "提交送审" },
      { id: "s2", at: "13 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过" },
    ],
  },
  {
    id: "TK-2015",
    title: "待确认：Beagle 犬 PK 报价",
    kind: "dmpk-quotation",
    status: "done",
    project: "YY药业-Balb/c nude评价",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    assignee: "李林",
    assigneeRole: "项目负责人",
    createdAt: "16 天前",
    updatedAt: "15 天前",
    attachments: [],
    moduleId: "dmpk-quotation",
    steps: [
      { id: "s1", at: "16 天前", actor: "赵敏", actorRole: "DMPK 报价同事", action: "提交送审" },
      { id: "s2", at: "15 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过" },
    ],
  },
];

/** 侧栏徽标读这个:球在我这儿、又没走到终态的都算。
 *  判据是 assignee 而不是状态名——「已驳回」是审批人视角的说法,可球那时候正在
 *  撰写人手上,对他就是待办。谁的回合只有 assignee 说了算。 */
export function pendingTicketCount(tickets: Ticket[], assignee: string) {
  return tickets.filter((ticket) => ticket.assignee === assignee && ticket.status !== "done" && ticket.status !== "dropped").length;
}
