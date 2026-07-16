import type { WorkbenchProject } from "../../modules/types";
import type { KnowledgeFile, PinItem, TaskCollection } from "./shellTypes";

export const workspaceProjects: WorkbenchProject[] = [
  { id: "project-xx", name: "XX药业-PD1临床前评价" },
  { id: "project-yy", name: "YY药业-Balb/c nude评价" },
  { id: "project-zz", name: "ZZ药业-CT26模型评价" },
];

export const projectOptions = [...workspaceProjects.map((project) => project.name), "临时任务"];

export const workspacePinCatalog: PinItem[] = [
  ...workspaceProjects.map((project) => ({ id: project.id, type: "project" as const, title: project.name })),
  { id: "task-sample9", type: "task", title: "样本 9 双批次报告", project: workspaceProjects[0].name, moduleId: "tumor-report", coworkerId: "tumor-report-coworker", coworkerName: "药效报告同事", time: "36 分钟前", status: "pending" },
  { id: "task-balbc", type: "task", title: "Balb/c nude 报价", project: workspaceProjects[0].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "3 天前", status: "done" },
  { id: "task-qa", type: "task", title: "报告交付包 QA复核", project: workspaceProjects[0].name, moduleId: "qa-review", coworkerId: "qa-review-coworker", coworkerName: "QA审核同事", time: "1 小时前", status: "done" },
  { id: "task-new-quote", type: "task", title: "新建报价任务", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "刚刚", status: "running" },
  { id: "task-ba", type: "task", title: "Balb/c nude BA 报价", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "3 天前", status: "done" },
  { id: "task-temp", type: "task", title: "内部试跑报价模型对比", project: "临时任务", moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "今天", status: "running" },
];

export const workspaceTasks: TaskCollection = {
  actionRequired: [
    { id: "task-qa", title: "报告交付包 QA复核 · 等你审核", project: workspaceProjects[0].name, moduleId: "qa-review", coworkerId: "qa-review-coworker", coworkerName: "QA审核同事", time: "2小时前", status: "待我处理" },
    { id: "task-balbc", title: "Balb/c nude 报价 · 需要补充参数", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "昨天", status: "待补充" },
    { id: "task-ct26", title: "CT26 交付包 · 待确认最终版", project: workspaceProjects[2].name, moduleId: "qa-review", coworkerId: "qa-review-coworker", coworkerName: "QA审核同事", time: "3天前", status: "待确认" },
  ],
  all: [
    { id: "task-sample9", title: "样本9 双批次报告", project: workspaceProjects[0].name, moduleId: "tumor-report", coworkerId: "tumor-report-coworker", coworkerName: "药效报告同事", time: "36分钟前", status: "处理中" },
    { id: "task-ba", title: "Balb/c nude BA 报价", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "3天前", status: "已完成" },
    { id: "task-qa", title: "报告交付包 QA复核", project: workspaceProjects[0].name, moduleId: "qa-review", coworkerId: "qa-review-coworker", coworkerName: "QA审核同事", time: "1小时前", status: "待审核" },
    { id: "task-temp", title: "内部试跑报价模型对比", project: "临时任务", moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "今天", status: "临时任务" },
  ],
};

export const initialKnowledgeFiles: KnowledgeFile[] = [
  { id: "file-quote", title: "Balbc_nude_报价单.xlsx", project: workspaceProjects[1].name, space: "projects", kind: "交付产物", business: "DMPK报价", owner: "DMPK报价同事", updated: "3天前", status: "已交付", agentReady: true },
  { id: "file-report", title: "样本9_双批次报告_v3.docx", project: workspaceProjects[0].name, space: "projects", kind: "交付产物", business: "药效报告", owner: "药效报告同事", updated: "36分钟前", status: "待确认", agentReady: true },
  { id: "file-brief", title: "DMPK_报价需求说明.pdf", project: workspaceProjects[1].name, space: "projects", kind: "过程文件", business: "DMPK报价", owner: "Admin", updated: "昨天", status: "使用中", agentReady: true },
  { id: "file-raw", title: "batch9_raw.xlsx", project: workspaceProjects[0].name, space: "projects", kind: "原始数据", business: "药效报告", owner: "Admin", updated: "36分钟前", status: "已归档", agentReady: true },
  { id: "file-rule", title: "DMPK_报价规则_2026.docx", project: "组织规则", space: "rules", kind: "业务规则", business: "DMPK报价", owner: "规则管理员", updated: "6月28日", status: "已发布", agentReady: true },
  { id: "file-dmpk-dict", title: "DMPK_报价参数字典.xlsx", project: "组织规则", space: "rules", kind: "参数字典", business: "DMPK报价", owner: "规则管理员", updated: "7月8日", status: "已发布", agentReady: true },
  { id: "file-dmpk-template", title: "DMPK_报价单模板.docx", project: "组织规则", space: "rules", kind: "产出模板", business: "DMPK报价", owner: "规则管理员", updated: "7月6日", status: "已发布", agentReady: true },
  { id: "file-template", title: "肿瘤药效报告模板.docx", project: "组织规则", space: "rules", kind: "报告模板", business: "药效报告", owner: "规则管理员", updated: "7月5日", status: "已发布", agentReady: true },
  { id: "file-qa", title: "QA_交付包检查清单.xlsx", project: "组织规则", space: "rules", kind: "审核清单", business: "QA审核", owner: "QA审核同事", updated: "7月2日", status: "已发布", agentReady: true },
];
