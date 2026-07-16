import { FileSpreadsheet } from "lucide-react";
import type { AgentModuleDefinition } from "../types";
import { dmpkQuotationCoworker } from "../coworkers";
import DmpkQuotationSession from "./DmpkQuotationSession";

export const dmpkQuotationModule: AgentModuleDefinition = {
  moduleId: "dmpk-quotation",
  moduleName: "DMPK 报价",
  taskType: "报价",
  availability: "available",
  suggestedCoworker: dmpkQuotationCoworker,
  supportedIntents: [
    {
      id: "dmpk-quotation",
      label: "DMPK 报价",
      examples: ["发起一份 DMPK 报价", "PK 动物实验报价"],
      keywords: /dmpk|\bpk\b|生物分析报价|动物实验报价/i,
      clarification: "这是一项 DMPK / PK 报价工作吗？",
    },
  ],
  quickStarts: [
    { id: "dmpk-quotation", label: "DMPK 报价", prompt: "我要发起一份 DMPK 报价", icon: FileSpreadsheet },
  ],
  stages: [
    { id: "identify", label: "识别业务线" },
    { id: "collect", label: "参数收集" },
    { id: "validate", label: "规则校验" },
    { id: "generate", label: "报价生成" },
  ],
  composerActions: [{ id: "confirm-parameters", label: "确认参数" }],
  artifacts: [
    { id: "word-quotation", label: "Word 报价单", kind: "docx" },
    { id: "excel-detail", label: "Excel 报价明细", kind: "xlsx" },
  ],
  requiredFiles: [{ id: "request-brief", label: "报价需求说明", required: false }],
  validationRules: [{ id: "amount-consistency", label: "页面与文件金额一致" }],
  handoffNotes: ["参数不完整时继续追问", "生成前必须由用户确认"],
  Session: DmpkQuotationSession,
};
