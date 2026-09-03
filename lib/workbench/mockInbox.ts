import { workspaceProjects } from "./mockWorkspace";

/* 收件箱的数据契约。
   -------------------------------------------------------------------
   这里刻意不做「消息」模型，只做「文档状态迁移事件」模型：投递方永远是
   某个 module 的状态机，不是某个人在打字。所以 kind 是一个封闭枚举，
   加一种新流转就加一个 kind，不会退化成通用 IM。

   收件人是岗位（audienceRole）而不是人。同岗位的多个账号会收到同一条，
   claimedBy 只是一行软提示——原型阶段不做抢占锁，做了只会挡住演示。 */

export type InboxRole = "author" | "approver" | "owner";

export type InboxAccount = {
  id: string;
  name: string;
  email: string;
  role: InboxRole;
  /** 显示用，比 role 具体：同为 author，「一线实验员」和「DMPK 报价同事」不是一回事 */
  roleLabel: string;
  /** 交接选择器里的分组：DMPK / QA / 药效 / 审批与管理 / 商务 */
  team: string;
  /** 侧栏账号切换器是否列出它。演示装置，不是权限。 */
  switchable?: boolean;
};

/** todo 做完才消失，feed 看过即褪。两者生命周期不同，绝不能混进一个列表。 */
export type InboxLane = "todo" | "feed";

export type InboxEventKind = "submit" | "aiReview" | "reject" | "approve" | "archive" | "handoff";

export type InboxFinding = { label: string; count: number; tone: "danger" | "warning" | "info" };

export type InboxTimelineEntry = { time: string; actor: string; text: string; agent?: boolean };

export type InboxAction = "approve" | "reject" | "revise" | "acknowledge";

export type InboxItem = {
  id: string;
  lane: InboxLane;
  kind: InboxEventKind;
  /** 收件岗位：谁在这个岗位谁收得到 */
  audienceRole: InboxRole;
  docTitle: string;
  docId: string;
  version: string;
  project: string;
  taskTitle: string;
  actorName: string;
  actorRole: string;
  /** 数字同事发出的流转，和真人混排但头像区分 */
  agent?: boolean;
  time: string;
  priority: "high" | "medium" | "low";
  summary: string;
  findings?: InboxFinding[];
  claimedBy?: string;
  timeline: InboxTimelineEntry[];
  actions: InboxAction[];
};

/* 通讯录。
   -------------------------------------------------------------------
   这里装两件不同的事,用一个 switchable 分开:

   **通讯录**是交接的目标范围——把活交给谁,可选的是全公司。
   **可切换账号**是演示装置,只有那么几个:要把「同一张单在两个人眼里长什么样」
   演出来,至少得能站到对面去看一眼。

   分成两个数组会立刻产生两处真相(同一个人在一处叫「撰写人」、另一处叫
   「DMPK 报价同事」这类事),所以只留一份,用标志位切。

   team 用于选择器里分组:一个你不熟的名字,光有姓名不够,得知道他是哪条线上的。 */
export const directory: InboxAccount[] = [
  { id: "acct-zhao", name: "赵敏", email: "zhaom@bioaz.com", role: "author", roleLabel: "DMPK 报价同事", team: "DMPK", switchable: true },
  { id: "acct-sun", name: "孙桦", email: "sunh@bioaz.com", role: "author", roleLabel: "DMPK 实验负责人", team: "DMPK" },
  { id: "acct-lin", name: "林一一", email: "lin@bioaz.com", role: "author", roleLabel: "一线实验员", team: "QA", switchable: true },
  { id: "acct-zhou", name: "周颖", email: "zhouy@bioaz.com", role: "author", roleLabel: "QA 审核员", team: "QA" },
  /* 肿瘤报价这条线的撰写人，跟 DMPK 的赵敏是对称的一位：同样是 author、
     同样可切换、同样对着审批人王林彬。他原来叫「药效实验员」且不可切换，
     那个身份在别处一次都没被引用过——改成报价线的岗位，比再造一个人干净。 */
  { id: "acct-chen", name: "陈默", email: "chenm@bioaz.com", role: "author", roleLabel: "肿瘤报价同事", team: "肿瘤", switchable: true },
  { id: "acct-wang", name: "王林彬", email: "wanglb@bioaz.com", role: "approver", roleLabel: "审批人", team: "审批与管理", switchable: true },
  { id: "acct-li", name: "李林", email: "lil@bioaz.com", role: "owner", roleLabel: "项目负责人", team: "审批与管理", switchable: true },
  { id: "acct-he", name: "何雯", email: "hew@bioaz.com", role: "owner", roleLabel: "商务经理", team: "商务" },
];

/** 侧栏那个账号切换器只列这些——演示要站到对面去看，不是要模拟全公司登录。 */
export const inboxAccounts: InboxAccount[] = directory.filter((person) => person.switchable);

/** 默认站在审批人视角。写成 id 而不是下标：下标会随通讯录增删悄悄换人。 */
export const DEFAULT_ACCOUNT_ID = "acct-wang";

/** 选择器里的分组顺序。跟 directory 的排列一致，改一处即可。 */
export const directoryTeams = directory
  .map((person) => person.team)
  .filter((team, index, list) => list.indexOf(team) === index);

export const inboxRoleLabel: Record<InboxRole, string> = {
  author: "撰写人",
  approver: "审批人",
  owner: "负责人",
};

const [projectXX, projectYY, projectZZ] = workspaceProjects.map((project) => project.name);

export const inboxItems: InboxItem[] = [
  {
    id: "inbox-1",
    lane: "todo",
    kind: "submit",
    audienceRole: "approver",
    docTitle: "硝酸异哈哈梨酯检测报告.pdf",
    docId: "IARC-R-20253333063",
    version: "第一版",
    project: projectXX,
    taskTitle: "样本 9 双批次报告",
    actorName: "林一一",
    actorRole: "撰写人",
    time: "12 分钟前",
    priority: "high",
    summary: "提交终审。AI 已完成全文校验，撰写人未逐条消化 AI 批注即提交。",
    findings: [
      { label: "时间逻辑", count: 3, tone: "danger" },
      { label: "页码逻辑", count: 2, tone: "warning" },
    ],
    claimedBy: "王林林",
    timeline: [
      { time: "01-12 15:22", actor: "林一一", text: "上传第一版并提交审批" },
      { time: "01-12 15:23", actor: "QA 审核同事", text: "完成 AI 全文校验，提出 5 条批注", agent: true },
      { time: "01-12 15:24", actor: "系统", text: "投递至「审批人」岗位（3 人可处理）" },
    ],
    actions: ["approve", "reject"],
  },
  {
    id: "inbox-2",
    lane: "todo",
    kind: "reject",
    audienceRole: "author",
    docTitle: "样本7_单批次报告_v2.docx",
    docId: "IARC-R-20253331207",
    version: "第二版",
    project: projectXX,
    taskTitle: "样本 7 单批次报告",
    actorName: "王林彬",
    actorRole: "审批人",
    time: "1 小时前",
    priority: "high",
    summary: "驳回：盖章日期早于批准时间，需修订后重新提交。",
    findings: [{ label: "驳回理由", count: 1, tone: "danger" }],
    timeline: [
      { time: "01-12 09:10", actor: "林一一", text: "提交第二版" },
      { time: "01-12 14:02", actor: "王林彬", text: "驳回，附 1 条人工备注" },
    ],
    actions: ["revise"],
  },
  {
    id: "inbox-3",
    lane: "todo",
    kind: "aiReview",
    audienceRole: "author",
    docTitle: "Balbc_nude_报价单.xlsx",
    docId: "QT-20260112-004",
    version: "草稿",
    project: projectYY,
    taskTitle: "Balb/c nude BA 报价",
    actorName: "DMPK 报价同事",
    actorRole: "数字同事",
    agent: true,
    time: "2 小时前",
    priority: "medium",
    summary: "AI 校验完成，2 条参数与标准价目表不一致，待撰写人确认后才能提交审批。",
    findings: [{ label: "价格偏差", count: 2, tone: "warning" }],
    timeline: [
      { time: "01-12 13:40", actor: "DMPK 报价同事", text: "完成价目一致性校验", agent: true },
    ],
    actions: ["revise"],
  },
  {
    id: "inbox-4",
    lane: "todo",
    kind: "submit",
    audienceRole: "approver",
    docTitle: "CT26_模型评价交付包.zip",
    docId: "IARC-P-20253338841",
    version: "第三版",
    project: projectZZ,
    taskTitle: "CT26 模型评价交付包",
    actorName: "赵敏",
    actorRole: "撰写人",
    time: "昨天",
    priority: "low",
    summary: "提交复核。前两版均已驳回，本版已按备注修订全部 4 处。",
    findings: [{ label: "AI 未发现问题", count: 0, tone: "info" }],
    timeline: [
      { time: "01-11 17:30", actor: "赵敏", text: "提交第三版" },
      { time: "01-11 17:31", actor: "QA 审核同事", text: "完成 AI 全文校验，未发现问题", agent: true },
    ],
    actions: ["approve", "reject"],
  },
  {
    id: "inbox-5",
    lane: "todo",
    kind: "handoff",
    audienceRole: "owner",
    docTitle: "硝酸异哈哈梨酯检测报告.pdf",
    docId: "IARC-R-20253333063",
    version: "第一版",
    project: projectXX,
    taskTitle: "样本 9 双批次报告",
    actorName: "王林彬",
    actorRole: "审批人",
    time: "20 分钟前",
    priority: "medium",
    summary: "审批人申请转派：该报告涉及委托方变更，需负责人指派新的审批岗位人选。",
    timeline: [
      { time: "01-12 15:30", actor: "王林彬", text: "申请转派，理由：委托方变更需回避" },
    ],
    actions: ["approve", "reject"],
  },
  {
    id: "inbox-6",
    lane: "feed",
    kind: "approve",
    audienceRole: "author",
    docTitle: "样本9_QC一致性报告.md",
    docId: "IARC-Q-20253330912",
    version: "第一版",
    project: projectXX,
    taskTitle: "样本 9 双批次报告",
    actorName: "王林林",
    actorRole: "审批人",
    time: "3 小时前",
    priority: "low",
    summary: "终审通过，文档已生效。",
    timeline: [{ time: "01-12 12:40", actor: "王林林", text: "终审通过，无修改意见" }],
    actions: ["acknowledge"],
  },
  {
    id: "inbox-7",
    lane: "feed",
    kind: "archive",
    audienceRole: "owner",
    docTitle: "样本9_双批次交付包.zip",
    docId: "IARC-P-20253330455",
    version: "第二版",
    project: projectXX,
    taskTitle: "样本 9 双批次报告",
    actorName: "系统",
    actorRole: "流程",
    time: "昨天",
    priority: "low",
    summary: "生效满 30 天，已自动归档至项目文件。",
    timeline: [{ time: "01-11 02:00", actor: "系统", text: "自动归档" }],
    actions: ["acknowledge"],
  },
  {
    id: "inbox-8",
    lane: "feed",
    kind: "aiReview",
    audienceRole: "approver",
    docTitle: "新建报价任务_初稿.xlsx",
    docId: "QT-20260112-009",
    version: "草稿",
    project: projectYY,
    taskTitle: "新建报价任务",
    actorName: "DMPK 报价同事",
    actorRole: "数字同事",
    agent: true,
    time: "刚刚",
    priority: "low",
    summary: "撰写人正在补全参数，预计 1 小时后提交审批。",
    timeline: [{ time: "01-12 15:35", actor: "DMPK 报价同事", text: "参数补全进度 6/9", agent: true }],
    actions: ["acknowledge"],
  },
  {
    id: "inbox-9",
    lane: "feed",
    kind: "approve",
    audienceRole: "owner",
    docTitle: "CT26_模型评价交付包.zip",
    docId: "IARC-P-20253338841",
    version: "第二版",
    project: projectZZ,
    taskTitle: "CT26 模型评价交付包",
    actorName: "李林",
    actorRole: "负责人",
    time: "3 天前",
    priority: "low",
    summary: "第二版驳回记录已归入审计轨迹。",
    timeline: [{ time: "01-09 10:12", actor: "李林", text: "确认驳回记录" }],
    actions: ["acknowledge"],
  },
];

export const inboxKindLabel: Record<InboxEventKind, string> = {
  submit: "待审批",
  aiReview: "AI 校验",
  reject: "已驳回",
  approve: "已通过",
  archive: "已归档",
  handoff: "待转派",
};

export const inboxActionLabel: Record<InboxAction, string> = {
  approve: "通过",
  reject: "驳回",
  revise: "去修订",
  acknowledge: "知道了",
};
