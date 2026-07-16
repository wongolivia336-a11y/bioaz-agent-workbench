import { FileText } from "lucide-react";
import { ModuleUnavailableState } from "../../components/workbench-shell/ModuleUnavailableState";
import { tumorReportCoworker } from "../coworkers";
import type { AgentModuleDefinition } from "../types";

export const tumorReportModule: AgentModuleDefinition = {
  moduleId: "tumor-report",
  moduleName: "肿瘤药效报告",
  taskType: "报告",
  availability: "placeholder",
  suggestedCoworker: tumorReportCoworker,
  supportedIntents: [{ id: "tumor-report", label: "肿瘤药效报告", examples: ["撰写肿瘤药效报告"], keywords: /肿瘤.*报告|药效报告|撰写报告|批次报告/i }],
  quickStarts: [{ id: "tumor-report", label: "撰写药效报告", prompt: "我要撰写一份肿瘤药效报告", icon: FileText }],
  stages: [{ id: "placeholder", label: "暂未接入" }],
  composerActions: [],
  artifacts: [],
  requiredFiles: [],
  validationRules: [],
  handoffNotes: ["后续从肿瘤报告项目迁移真实流程"],
  Session: ModuleUnavailableState,
};
