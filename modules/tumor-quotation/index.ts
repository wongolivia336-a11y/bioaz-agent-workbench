import { ReceiptText } from "lucide-react";
import { tumorQuotationCoworker } from "../coworkers";
import type { AgentModuleDefinition } from "../types";
import TumorQuotationSession from "./TumorQuotationSession";

export const tumorQuotationModule: AgentModuleDefinition = {
  moduleId: "tumor-quotation",
  moduleName: "肿瘤报价",
  taskType: "报价",
  availability: "available",
  /* 跟 DMPK 报价是同一副外壳：同一条对话流、同一个 composer、同一套参数卡与
     右栏台账。外壳的样式是照着 `.dmpk-quotationModuleShell` 写的（123 条规则，
     散在四个全局样式表里），借它的类名比把那 123 条逐个改成 :is() 白名单可靠——
     白名单漏掉 responsive.css 那两处，窄屏会静默塌掉。 */
  shellVariant: "dmpk-quotation",
  suggestedCoworker: tumorQuotationCoworker,
  supportedIntents: [{
    id: "tumor-quotation",
    label: "肿瘤报价",
    examples: ["肿瘤模型项目报价", "CDX 药效评价报价"],
    keywords: /肿瘤.*报价|模型.*报价|药效.*报价|cdx|pdx|荷瘤/i,
    clarification: "这是一项肿瘤药效评价报价工作吗？",
  }],
  quickStarts: [{ id: "tumor-quotation", label: "肿瘤报价", prompt: "我要发起一份肿瘤项目报价", icon: ReceiptText }],
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
  validationRules: [
    { id: "model-strain", label: "模型与动物品系匹配" },
    { id: "amount-consistency", label: "页面与文件金额一致" },
  ],
  handoffNotes: ["参数不完整时继续追问", "改了模型要重选品系与细胞系", "生成前必须由用户确认"],
  Session: TumorQuotationSession,
};
