import { FileText } from "lucide-react";
import { tumorReportCoworker } from "../coworkers";
import type { AgentModuleDefinition } from "../types";
import TumorReportSession from "./TumorReportSession";

export const tumorReportModule: AgentModuleDefinition = {
  moduleId: "tumor-report",
  moduleName: "肿瘤报告",
  taskType: "报告",
  availability: "available",
  suggestedCoworker: tumorReportCoworker,
  supportedIntents: [{ id: "tumor-report", label: "肿瘤药效报告", examples: ["撰写肿瘤药效报告"], keywords: /肿瘤.*报告|药效报告|撰写报告|批次报告/i }],
  quickStarts: [{ id: "tumor-report", label: "肿瘤报告", prompt: "我要撰写一份肿瘤药效报告", icon: FileText }],
  stages: [{ id: "collect", label: "材料收集" }, { id: "validate", label: "文件校验" }, { id: "warning", label: "风险确认" }, { id: "generate", label: "报告生成" }, { id: "review", label: "专家审核" }, { id: "deliver", label: "交付" }],
  composerActions: [{ id: "upload", label: "上传方案和原始数据" }],
  artifacts: [{ id: "report", label: "Word 肿瘤药效报告", kind: "docx" }, { id: "package", label: "报告交付包", kind: "zip" }],
  requiredFiles: [{ id: "protocol", label: "实验方案", required: true }, { id: "data", label: "原始数据", required: true }],
  validationRules: [{ id: "statistics", label: "统计口径一致" }, { id: "events", label: "异常事件闭环" }],
  handoffNotes: ["上传入口由共享 Composer 提供", "Warning 必须由用户确认", "专家建议确认后才能交付"],
  Session: TumorReportSession,
};
