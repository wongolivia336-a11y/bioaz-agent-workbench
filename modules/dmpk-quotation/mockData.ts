import type { DmpkField } from "./fields";

export const dmpkQuotationPreviewRows = [
  ["检测业务", "PK", "已确认"],
  ["动物实验", "SD 大鼠 · 2 组", "已确认"],
  ["生物分析", "LC-MS/MS", "已确认"],
  ["交付格式", "Word + Excel", "已确认"],
] as const;

export function summarizeDmpkFields(fields: DmpkField[]) {
  return fields.filter((field) => field.value).map((field) => [field.label, field.value, "已确认"] as const);
}
