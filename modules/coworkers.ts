import { Check, FileSpreadsheet, FileText, ReceiptText, Sparkles } from "lucide-react";
import type { CoworkerDefinition } from "./types";

export const bioazHelperCoworker: CoworkerDefinition = {
  id: "bioaz-helper",
  name: "BioAZ Helper",
  icon: Sparkles,
  description: "识别任务意图并分派给合适的数字同事",
};

export const dmpkQuotationCoworker: CoworkerDefinition = {
  id: "dmpk-quotation-coworker",
  name: "DMPK报价同事",
  icon: FileSpreadsheet,
  description: "收集参数、匹配规则并生成报价产物",
};

export const tumorReportCoworker: CoworkerDefinition = {
  id: "tumor-report-coworker",
  name: "肿瘤报告同事",
  icon: FileText,
  description: "整理原始数据并撰写肿瘤药效报告",
};

export const tumorQuotationCoworker: CoworkerDefinition = {
  id: "tumor-quotation-coworker",
  name: "肿瘤报价同事",
  icon: ReceiptText,
  description: "识别肿瘤项目范围并生成报价",
};

export const qaReviewCoworker: CoworkerDefinition = {
  id: "qa-review-coworker",
  name: "QA审核同事",
  icon: Check,
  description: "复核交付包完整性并追溯证据",
};
