export type PlanStatus = "todo" | "running" | "review" | "done" | "blocked";
export type PlanPriority = "urgent" | "high" | "medium" | "low";
export type DeliverableKind = "report" | "dataset" | "quotation" | "review";

export type ProjectMember = {
  id: string;
  name: string;
  /** 真人同事与数字同事共用一套负责人池，看板上不做区隔以外的差别对待 */
  kind: "human" | "agent";
  role: string;
};

/** 阶段要交付的东西。计划回答的是「这个项目要交付什么、怎么分阶段做出来」 */
export type Deliverable = {
  id: string;
  name: string;
  kind: DeliverableKind;
  status: PlanStatus;
  ownerId: string;
};

export type PlanItem = {
  id: string;
  title: string;
  stageId: string;
  status: PlanStatus;
  assigneeId: string;
  priority: PlanPriority;
  due: string;
};

export type PlanStage = {
  id: string;
  name: string;
  goal: string;
  window: string;
  deliverables: Deliverable[];
};

export const planStatusOrder: PlanStatus[] = ["todo", "running", "review", "done", "blocked"];

export const planStatusLabel: Record<PlanStatus, string> = {
  todo: "待开始",
  running: "进行中",
  review: "待审核",
  done: "已完成",
  blocked: "已阻塞",
};

export const planPriorityOrder: PlanPriority[] = ["urgent", "high", "medium", "low"];

export const planPriorityLabel: Record<PlanPriority, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

export const deliverableKindLabel: Record<DeliverableKind, string> = {
  report: "报告",
  dataset: "数据包",
  quotation: "报价单",
  review: "评审",
};

export const projectMembers: ProjectMember[] = [
  { id: "m-wang", name: "王 SD", kind: "human", role: "研究总监" },
  { id: "m-li", name: "李助理", kind: "human", role: "研究助理" },
  { id: "m-zhang", name: "张经理", kind: "human", role: "项目经理" },
  { id: "m-admin", name: "Admin", kind: "human", role: "数据管理" },
  { id: "tumor-report-coworker", name: "肿瘤报告同事", kind: "agent", role: "数字同事" },
  { id: "dmpk-quotation-coworker", name: "DMPK 报价同事", kind: "agent", role: "数字同事" },
  { id: "qa-review-coworker", name: "QA 审核同事", kind: "agent", role: "数字同事" },
];

/** 临床前评价的标准四阶段拆解 */
export const planStages: PlanStage[] = [
  {
    id: "stage-design",
    name: "阶段一 · 方案与立项",
    goal: "确认评价方案、分组设计与检测口径",
    window: "07-18 → 07-24",
    deliverables: [
      { id: "d-protocol", name: "实验方案确认单", kind: "report", status: "done", ownerId: "m-wang" },
      { id: "d-quote", name: "DMPK 检测报价单", kind: "quotation", status: "done", ownerId: "dmpk-quotation-coworker" },
    ],
  },
  {
    id: "stage-execute",
    name: "阶段二 · 实验执行与数据归集",
    goal: "完成双批次给药观察，归集原始数据",
    window: "07-24 → 07-29",
    deliverables: [
      { id: "d-raw", name: "双批次原始数据包", kind: "dataset", status: "done", ownerId: "m-admin" },
      { id: "d-ctrl", name: "历史对照数据包", kind: "dataset", status: "blocked", ownerId: "m-li" },
    ],
  },
  {
    id: "stage-analysis",
    name: "阶段三 · 分析与报告生成",
    goal: "产出两份药效报告并完成内部校验",
    window: "07-29 → 08-02",
    deliverables: [
      { id: "d-report9", name: "样本 9 双批次药效报告", kind: "report", status: "running", ownerId: "tumor-report-coworker" },
      { id: "d-report7", name: "样本 7 单批次药效报告", kind: "report", status: "done", ownerId: "tumor-report-coworker" },
      { id: "d-qc", name: "数据质控摘要", kind: "report", status: "review", ownerId: "qa-review-coworker" },
    ],
  },
  {
    id: "stage-delivery",
    name: "阶段四 · 审核与交付",
    goal: "专家审核通过后签核放行并打交付包",
    window: "08-02 → 08-08",
    deliverables: [
      { id: "d-expert", name: "专家小队审核意见", kind: "review", status: "todo", ownerId: "m-wang" },
      { id: "d-package", name: "客户交付包", kind: "dataset", status: "todo", ownerId: "m-zhang" },
    ],
  },
];

export const initialPlanItems: PlanItem[] = [
  { id: "p-1", title: "确认分组与给药方案", stageId: "stage-design", status: "done", assigneeId: "m-wang", priority: "high", due: "07-20" },
  { id: "p-2", title: "输出 DMPK 检测报价", stageId: "stage-design", status: "done", assigneeId: "dmpk-quotation-coworker", priority: "medium", due: "07-23" },
  { id: "p-3", title: "收集双批次原始数据", stageId: "stage-execute", status: "done", assigneeId: "m-admin", priority: "high", due: "07-26" },
  { id: "p-4", title: "确认 Day28 测量口径", stageId: "stage-execute", status: "done", assigneeId: "m-wang", priority: "high", due: "07-27" },
  { id: "p-5", title: "补充历史对照组数据", stageId: "stage-execute", status: "blocked", assigneeId: "m-li", priority: "urgent", due: "07-29" },
  { id: "p-6", title: "肿瘤体积趋势分析", stageId: "stage-analysis", status: "done", assigneeId: "tumor-report-coworker", priority: "medium", due: "07-30" },
  { id: "p-7", title: "统计显著性校验", stageId: "stage-analysis", status: "running", assigneeId: "tumor-report-coworker", priority: "high", due: "07-31" },
  { id: "p-8", title: "生成样本 9 报告初稿 v3", stageId: "stage-analysis", status: "running", assigneeId: "tumor-report-coworker", priority: "urgent", due: "08-01" },
  { id: "p-9", title: "数据质控与证据追溯", stageId: "stage-analysis", status: "review", assigneeId: "qa-review-coworker", priority: "medium", due: "08-02" },
  { id: "p-10", title: "发起专家小队审核", stageId: "stage-delivery", status: "todo", assigneeId: "m-wang", priority: "high", due: "08-03" },
  { id: "p-11", title: "逐项确认专家建议", stageId: "stage-delivery", status: "todo", assigneeId: "m-wang", priority: "medium", due: "08-05" },
  { id: "p-12", title: "签核并生成交付包", stageId: "stage-delivery", status: "todo", assigneeId: "m-zhang", priority: "low", due: "08-08" },
];
