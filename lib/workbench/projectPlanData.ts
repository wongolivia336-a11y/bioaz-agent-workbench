export type PlanStatus = "todo" | "running" | "review" | "done" | "blocked";
export type PlanPriority = "urgent" | "high" | "medium" | "low";

export type ProjectMember = {
  id: string;
  name: string;
  /** 真人同事与数字同事共用一套负责人池，看板上不做区隔以外的差别对待 */
  kind: "human" | "agent";
  role: string;
};

export type PlanItem = {
  id: string;
  title: string;
  stage: string;
  status: PlanStatus;
  assigneeId: string;
  priority: PlanPriority;
  due: string;
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

export const projectMembers: ProjectMember[] = [
  { id: "m-wang", name: "王 SD", kind: "human", role: "研究总监" },
  { id: "m-li", name: "李助理", kind: "human", role: "研究助理" },
  { id: "m-zhang", name: "张经理", kind: "human", role: "项目经理" },
  { id: "m-admin", name: "Admin", kind: "human", role: "数据管理" },
  { id: "tumor-report-coworker", name: "肿瘤报告同事", kind: "agent", role: "数字同事" },
  { id: "dmpk-quotation-coworker", name: "DMPK 报价同事", kind: "agent", role: "数字同事" },
  { id: "qa-review-coworker", name: "QA 审核同事", kind: "agent", role: "数字同事" },
];

export const planStages = ["数据准备", "分析与生成", "审核与交付"];

export const initialPlanItems: PlanItem[] = [
  { id: "p-1", title: "收集双批次原始数据", stage: "数据准备", status: "done", assigneeId: "m-admin", priority: "high", due: "07-24" },
  { id: "p-2", title: "确认 Day28 测量口径", stage: "数据准备", status: "done", assigneeId: "m-wang", priority: "high", due: "07-25" },
  { id: "p-3", title: "补充历史对照组数据", stage: "数据准备", status: "blocked", assigneeId: "m-li", priority: "urgent", due: "07-26" },
  { id: "p-4", title: "肿瘤体积趋势分析", stage: "分析与生成", status: "done", assigneeId: "tumor-report-coworker", priority: "medium", due: "07-28" },
  { id: "p-5", title: "统计显著性校验", stage: "分析与生成", status: "running", assigneeId: "tumor-report-coworker", priority: "high", due: "07-30" },
  { id: "p-6", title: "生成报告初稿 v3", stage: "分析与生成", status: "running", assigneeId: "tumor-report-coworker", priority: "urgent", due: "07-31" },
  { id: "p-7", title: "交付包完整性复核", stage: "分析与生成", status: "review", assigneeId: "qa-review-coworker", priority: "medium", due: "08-01" },
  { id: "p-8", title: "发起专家小队审核", stage: "审核与交付", status: "todo", assigneeId: "m-wang", priority: "high", due: "08-02" },
  { id: "p-9", title: "逐项确认专家建议", stage: "审核与交付", status: "todo", assigneeId: "m-wang", priority: "medium", due: "08-04" },
  { id: "p-10", title: "签核并生成交付包", stage: "审核与交付", status: "todo", assigneeId: "m-zhang", priority: "low", due: "08-06" },
];
