import { ReceiptText } from "lucide-react";
import { ModuleUnavailableState } from "../../components/workbench-shell/ModuleUnavailableState";
import { tumorQuotationCoworker } from "../coworkers";
import type { AgentModuleDefinition } from "../types";

export const tumorQuotationModule: AgentModuleDefinition = {
  moduleId: "tumor-quotation",
  moduleName: "肿瘤报价",
  taskType: "报价",
  availability: "placeholder",
  suggestedCoworker: tumorQuotationCoworker,
  supportedIntents: [{ id: "tumor-quotation", label: "肿瘤报价", examples: ["肿瘤模型项目报价"], keywords: /肿瘤.*报价|模型.*报价|药效.*报价/i }],
  quickStarts: [{ id: "tumor-quotation", label: "肿瘤报价", prompt: "我要发起一份肿瘤项目报价", icon: ReceiptText, availability: "placeholder" }],
  stages: [{ id: "placeholder", label: "暂未接入" }],
  composerActions: [],
  artifacts: [],
  requiredFiles: [],
  validationRules: [],
  handoffNotes: ["保留模块入口，不伪装业务可用"],
  Session: ModuleUnavailableState,
};
