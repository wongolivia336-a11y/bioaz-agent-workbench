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
  { id: "task-report-7", type: "task", title: "样本 7 单批次报告", project: workspaceProjects[0].name, moduleId: "tumor-report", coworkerId: "tumor-report-coworker", coworkerName: "药效报告同事", time: "1 小时前", status: "done" },
  { id: "task-new-quote", type: "task", title: "新建报价任务", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "刚刚", status: "running" },
  { id: "task-ba", type: "task", title: "Balb/c nude BA 报价", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "3 天前", status: "done" },
  { id: "task-temp", type: "task", title: "内部试跑报价模型对比", project: "临时任务", moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "今天", status: "running" },
];

export const workspaceTasks: TaskCollection = {
  actionRequired: [
    { id: "task-report-7", title: "样本 7 单批次报告 · 等你确认", project: workspaceProjects[0].name, moduleId: "tumor-report", coworkerId: "tumor-report-coworker", coworkerName: "药效报告同事", time: "2小时前", status: "待我处理" },
    { id: "task-balbc", title: "Balb/c nude 报价 · 需要补充参数", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "昨天", status: "待补充" },
    { id: "task-ct26", title: "CT26 项目报价 · 待确认", project: workspaceProjects[2].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "3天前", status: "待确认" },
  ],
  all: [
    { id: "task-sample9", title: "样本9 双批次报告", project: workspaceProjects[0].name, moduleId: "tumor-report", coworkerId: "tumor-report-coworker", coworkerName: "药效报告同事", time: "36分钟前", status: "处理中" },
    { id: "task-ba", title: "Balb/c nude BA 报价", project: workspaceProjects[1].name, moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "3天前", status: "已完成" },
    { id: "task-report-7", title: "样本 7 单批次报告", project: workspaceProjects[0].name, moduleId: "tumor-report", coworkerId: "tumor-report-coworker", coworkerName: "药效报告同事", time: "1小时前", status: "待确认" },
    { id: "task-temp", title: "内部试跑报价模型对比", project: "临时任务", moduleId: "dmpk-quotation", coworkerId: "dmpk-quotation-coworker", coworkerName: "DMPK报价同事", time: "今天", status: "临时任务" },
  ],
};

export const initialKnowledgeFiles: KnowledgeFile[] = [
  { id: "file-quote", title: "Balbc_nude_报价单.xlsx", project: workspaceProjects[1].name, space: "projects", kind: "交付产物", business: "DMPK报价", owner: "DMPK报价同事", updated: "3天前", status: "已交付", agentReady: true },
  { id: "file-report", title: "样本9_双批次报告_v3.docx", project: workspaceProjects[0].name, space: "projects", kind: "交付产物", business: "药效报告", owner: "药效报告同事", updated: "36分钟前", status: "待确认", agentReady: true },
  { id: "file-report-package", title: "样本9_双批次交付包.zip", project: workspaceProjects[0].name, space: "projects", kind: "交付产物", business: "药效报告", owner: "药效报告同事", updated: "34分钟前", status: "专家审核", agentReady: true },
  { id: "file-qc", title: "样本9_QC一致性报告.md", project: workspaceProjects[0].name, space: "projects", kind: "审核记录", business: "药效报告", owner: "药效报告同事", updated: "32分钟前", status: "已通过", agentReady: true },
  { id: "file-figure", title: "tumor_volume_day21_300dpi.png", project: workspaceProjects[0].name, space: "projects", kind: "报告图表", business: "药效报告", owner: "药效报告同事", updated: "31分钟前", status: "已生成", agentReady: true },
  { id: "file-brief", title: "DMPK_报价需求说明.pdf", project: workspaceProjects[1].name, space: "projects", kind: "过程文件", business: "DMPK报价", owner: "Admin", updated: "昨天", status: "使用中", agentReady: true },
  { id: "file-quote-word", title: "Balbc_nude_DMPK正式报价单.docx", project: workspaceProjects[1].name, space: "projects", kind: "交付产物", business: "DMPK报价", owner: "DMPK报价同事", updated: "3天前", status: "已交付", agentReady: true },
  { id: "file-quote-evidence", title: "DMPK_计价规则匹配摘要.pdf", project: workspaceProjects[1].name, space: "projects", kind: "计算依据", business: "DMPK报价", owner: "DMPK报价同事", updated: "3天前", status: "已归档", agentReady: true },
  { id: "file-raw", title: "batch9_raw.xlsx", project: workspaceProjects[0].name, space: "projects", kind: "原始数据", business: "药效报告", owner: "Admin", updated: "36分钟前", status: "已归档", agentReady: true },
  { id: "file-protocol", title: "NCI-H82_双批次实验方案.docx", project: workspaceProjects[0].name, space: "projects", kind: "输入材料", business: "药效报告", owner: "Admin", updated: "40分钟前", status: "使用中", agentReady: true },
  { id: "file-ct26-brief", title: "CT26_模型评价需求说明.pdf", project: workspaceProjects[2].name, space: "projects", kind: "输入材料", business: "药效报告", owner: "Admin", updated: "2天前", status: "待处理", agentReady: true },
  { id: "file-rule", title: "DMPK_报价规则_2026.docx", project: "组织规则", space: "rules", kind: "业务规则", business: "DMPK报价", owner: "规则管理员", updated: "6月28日", status: "已发布", agentReady: true },
  { id: "file-dmpk-dict", title: "DMPK_报价参数字典.xlsx", project: "组织规则", space: "rules", kind: "参数字典", business: "DMPK报价", owner: "规则管理员", updated: "7月8日", status: "已发布", agentReady: true },
  { id: "file-dmpk-template", title: "DMPK_报价单模板.docx", project: "组织规则", space: "rules", kind: "产出模板", business: "DMPK报价", owner: "规则管理员", updated: "7月6日", status: "已发布", agentReady: true },
  { id: "file-template", title: "肿瘤药效报告模板.docx", project: "组织规则", space: "rules", kind: "报告模板", business: "药效报告", owner: "规则管理员", updated: "7月5日", status: "已发布", agentReady: true },
  { id: "file-stat-rule", title: "肿瘤药效统计口径_v4.xlsx", project: "组织规则", space: "rules", kind: "统计规则", business: "药效报告", owner: "规则管理员", updated: "7月9日", status: "已发布", agentReady: true },
  { id: "file-qa-rule", title: "报告交付前_QA检查清单.xlsx", project: "组织规则", space: "rules", kind: "审核清单", business: "药效报告", owner: "规则管理员", updated: "7月10日", status: "已发布", agentReady: true },
];
