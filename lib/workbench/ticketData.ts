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

/** open 球在当前处理人手上,这件事还欠着 / rejected 已驳回,球回到上一棒
 *  / done 这一棒结束(通过并已流转) / dropped 作废
 *
 *  曾经还有一个 inProgress(「处理中」),接手时从 open 翻过去。删了:开始看
 *  并不代表这件事了结,从待办的角度它跟 open 是同一个状态,而代码里每一处
 *  也都把两者当同一件事(侧栏计数、可处置判断、状态筛选无一例外)。
 *  「我什么时候开始看的」不会因此丢失——它记在 steps 里,那才是它该待的地方:
 *  流转记录说的是发生过什么,状态说的是现在欠着什么。 */
export type TicketStatus = "open" | "rejected" | "done" | "dropped";

export type TicketKind = "qa-review" | "dmpk-quotation" | "tumor-quotation";

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
  rejected: "已驳回",
  done: "已通过",
  dropped: "已废弃",
};

/* 语气映射独立于业务枚举——「已驳回」在业务上是个中性事实(球回到上一棒),
   但在扫列表时它需要和「待处理」区分开,所以给 danger 而不是 warning。 */
export const ticketStatusTone: Record<TicketStatus, "neutral" | "running" | "warning" | "success" | "danger"> = {
  open: "warning",
  rejected: "danger",
  done: "success",
  dropped: "neutral",
};

export const ticketKindLabel: Record<TicketKind, string> = {
  "qa-review": "QA 审核",
  "dmpk-quotation": "DMPK 报价",
  "tumor-quotation": "肿瘤报价",
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
    /* 两份,不是一个压缩包:报价书是给客户的,计算表是内部推导单价的底稿——
       复核要同时看这两样(「报价书写的这个数,计算表里是怎么算出来的」),
       打成一个包只会让人先解压再对着两个窗口来回切。
       打包适合的是交付归档那一类,比如下面 TK-2035 的模型评价交付包。 */
    attachments: [
      file("tk-2046-a", "Balbc_nude_报价书.docx", "DOCX · 客户版 · 0.6 MB"),
      file("tk-2046-b", "Balbc_nude_报价计算表.xlsx", "XLSX · 内部底稿 · 0.3 MB"),
    ],
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
    status: "open",
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
  /* 肿瘤报价这条线的第一张单。跟 TK-2046 是同一副骨架（撰写人送审、
     系统分派给王林彬、随单两份产物），只是业务线换了——两条报价线在
     审批人的收件箱里应该长得一样，因为他做的是同一件事。
     编号是 2043 不是 2045：2045 已经被下面那张「SD 大鼠 PK 预试报价」占了，
     两张单同号会让按 id 取单的地方（详情、附件、流转记录）取到先命中的那一张。 */
  {
    id: "TK-2043",
    title: "待确认：CT26 模型评价报价交付包",
    kind: "tumor-quotation",
    status: "open",
    project: "ZZ药业-CT26模型评价",
    from: "陈默",
    fromRole: "肿瘤报价同事",
    assignee: "王林彬",
    assigneeRole: "审批人",
    createdAt: "今天 09:05",
    updatedAt: "1 小时前",
    attachments: [
      file("tk-2043-a", "CT26_模型评价报价书.docx", "DOCX · 客户版 · 0.7 MB"),
      file("tk-2043-b", "CT26_模型评价报价计算表.xlsx", "XLSX · 内部底稿 · 0.4 MB"),
    ],
    taskId: "task-ct26-quote",
    moduleId: "tumor-quotation",
    steps: [
      { id: "s1", at: "今天 09:05", actor: "陈默", actorRole: "肿瘤报价同事", action: "提交送审", note: "模型、品系与给药分组已确认，检测指标按 IVIS 计价，请复核动物数与周期。" },
      { id: "s2", at: "1 小时前", actor: "系统", actorRole: "流转", action: "分派给王林彬" },
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
  /* DMPK 这条线在演示里要能同时摆出「待审」「已驳回」「已通过」三种状态,
     而且撰写人赵敏那一侧要有东西可看——否则她的收件箱是空的,
     「球换手了它自己就到了」这句话就没有画面。所以这条线上刻意多备了几张。 */
  {
    id: "TK-2045",
    title: "待确认：SD 大鼠 PK 预试报价",
    kind: "dmpk-quotation",
    status: "open",
    project: "YY药业-Balb/c nude评价",
    from: "赵敏",
    fromRole: "DMPK 报价同事",
    assignee: "王林彬",
    assigneeRole: "审批人",
    createdAt: "今天 10:20",
    updatedAt: "40 分钟前",
    attachments: [
      file("tk-2043-a", "SD大鼠_PK预试_报价书.docx", "DOCX · 客户版 · 0.5 MB"),
      file("tk-2043-b", "SD大鼠_PK预试_计算表.xlsx", "XLSX · 内部底稿 · 0.3 MB"),
    ],
    taskId: "task-balbc",
    moduleId: "dmpk-quotation",
    steps: [
      { id: "s1", at: "今天 10:20", actor: "赵敏", actorRole: "DMPK 报价同事", action: "提交送审", note: "客户催得急，采血点按 8 个先报，后面可能加。" },
      { id: "s2", at: "40 分钟前", actor: "系统", actorRole: "流转", action: "分派给王林彬" },
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
  /* CT26 是鼠源肿瘤细胞系，这一单从头到尾是肿瘤药效评价——原来挂在 DMPK 线上，
     跟它指向的 task-ct26-quote 一样是挂错了。同一条任务在工单里写「DMPK 报价」、
     点进去开的却是肿瘤报价会话，是这套演示里最容易被当场问住的地方。 */
  {
    id: "TK-2033",
    title: "待确认：CT26 模型评价报价交付包",
    kind: "tumor-quotation",
    status: "done",
    project: "ZZ药业-CT26模型评价",
    from: "陈默",
    fromRole: "肿瘤报价同事",
    /* 通过之后交回提交人。这条是给演示准备的「已通过」样本:
       陈默的收件箱里要能看到一件已经审完的事,附件可预览可下载,
       随行的建议修订也还在——通过不等于批注消失。 */
    assignee: "陈默",
    assigneeRole: "肿瘤报价同事",
    createdAt: "5 天前",
    updatedAt: "3 天前",
    attachments: [
      file("tk-2033-a", "CT26_报价书.docx", "DOCX · 客户版 · 0.9 MB"),
      file("tk-2033-b", "CT26_报价计算表.xlsx", "XLSX · 内部底稿 · 0.4 MB"),
    ],
    taskId: "task-ct26-quote",
    moduleId: "tumor-quotation",
    steps: [
      { id: "s1", at: "5 天前", actor: "陈默", actorRole: "肿瘤报价同事", action: "提交送审" },
      { id: "s2", at: "4 天前", actor: "王林彬", actorRole: "审批人", action: "开始审核" },
      { id: "s3", at: "3 天前", actor: "王林彬", actorRole: "审批人", action: "审批通过", note: "1 条建议修订随行留档，不影响通过。" },
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

/* 报价单的计价条目。DMPK 的审核就是逐条看这些数——所以批注的锚点是「哪一条」,
   不是文档里的一段文字。跟 QA 那边 anchorField 锚在「收检日期」上是同一回事:
   有名字的字段本来就比一段选区更好定位,也更容易在下一版里被验证改没改。 */
export type QuoteLine = {
  id: string;
  group: string;
  label: string;
  detail: string;
  amount: string;
};

export const dmpkQuoteLines: QuoteLine[] = [
  { id: "ql-animal", group: "动物实验", label: "SD 大鼠 · 2 组 · 每组 2 只", detail: "试验周期 1 周，含饲养与给药操作", amount: "¥12,800" },
  { id: "ql-dosing", group: "动物实验", label: "给药与采血操作", detail: "周期内 3 个非加班时间点", amount: "¥6,400" },
  { id: "ql-plasma", group: "生物分析", label: "血浆样品检测", detail: "LC-MS/MS · 12 个样品", amount: "¥21,600" },
  { id: "ql-method", group: "生物分析", label: "方法学确认", detail: "普通小分子，沿用已验证方法", amount: "¥8,000" },
  { id: "ql-report", group: "报告与报价", label: "报告撰写", detail: "中文 Word + Excel 明细", amount: "¥2,500" },
  { id: "ql-fee", group: "报告与报价", label: "项目管理费", detail: "按 30% 口径计取（Excel 明细为 15%）", amount: "¥15,390" },
];

/* ─── 纯通知 ─────────────────────────────────────────────────────────────
   站内信里不是每条都要你动手。机机协作本身不产生站内信——否则收件箱会被
   机器人的交谈填满;只有当一件事需要一个人时它才浮上来。剩下这些是「知会」:
   你不必做什么,但不知道会出事。

   跟工单的分野就一条:通知没有归属、没有状态、没有流转链,看过就翻篇。 */
export type NoticeSource = "coworker" | "system";

export type Notice = {
  id: string;
  source: NoticeSource;
  from: string;
  fromRole: string;
  title: string;
  body: string;
  project?: string;
  at: string;
};

export const noticeSourceLabel: Record<NoticeSource, string> = {
  coworker: "数字同事",
  system: "系统",
};

export const initialNotices: Notice[] = [
  {
    id: "NT-118", source: "coworker", from: "肿瘤报价同事", fromRole: "数字同事",
    title: "已把 CT26 报价产物交给 QA 审核同事预检",
    body: "CT26 模型评价的报价单与明细已生成，已按规则交 QA 审核同事做交付前预检。预检通过后会直接进入你的待办；如果预检发现问题，会连同问题清单一起退回给我重做。此条仅知会，你现在不需要做任何事。",
    project: "ZZ药业-CT26模型评价", at: "18 分钟前",
  },
  {
    id: "NT-117", source: "system", from: "规则管理员", fromRole: "系统",
    title: "DMPK 计价规则已发布 v1.0.14",
    body: "本次变更：PK 检测样品数少于 6 个时按 6 个计费；生物分析方法学确认价格上调 8%。新规则对本次发布之后创建的报价生效，已生成的报价单不受影响。",
    project: "组织规则", at: "昨天",
  },
  {
    id: "NT-115", source: "coworker", from: "药效报告同事", fromRole: "数字同事",
    title: "样本 7 的原始数据解析完成，未发现阻断项",
    body: "batch7_raw.xlsx 已完成结构解析与统计口径核对，未发现阻断项。报告生成会在你确认实验方案版本后开始。",
    project: "XX药业-PD1临床前评价", at: "2 天前",
  },
  {
    id: "NT-112", source: "system", from: "系统", fromRole: "系统",
    title: "本周起归档包统一使用新的命名规则",
    body: "归档包命名统一为「报告编号_版本_日期」。历史归档不做追溯修改，新归档请遵循此格式。",
    project: "组织规则", at: "5 天前",
  },
];

/* 「12 分钟前」这类标签排不了序,但列表要按时间倒着排。这里把标签折回分钟数——
   数据本来就是这么写的,与其给每条再加一个时间戳、让两处各说各的,不如从
   唯一那份事实里算出来。 */
export function minutesFromLabel(label: string) {
  if (/刚刚/.test(label)) return 0;
  const value = Number(label.match(/\d+/)?.[0] ?? 0);
  if (/分钟/.test(label)) return value;
  if (/小时/.test(label)) return value * 60;
  if (/昨天/.test(label)) return 1440;
  if (/天/.test(label)) return value * 1440;
  if (/今天/.test(label)) return 60;
  return 99999;
}
