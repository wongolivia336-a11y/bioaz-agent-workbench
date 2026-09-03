import { dmpkQuotationModule } from "./dmpk-quotation";
import { qaReviewModule } from "./qa-review";
import { tumorQuotationModule } from "./tumor-quotation";
import { tumorReportModule } from "./tumor-report";
import { bioazHelperCoworker } from "./coworkers";
import type { AgentModuleDefinition, IntentResolution } from "./types";

export const moduleRegistry: AgentModuleDefinition[] = [
  dmpkQuotationModule,
  tumorReportModule,
  tumorQuotationModule,
  qaReviewModule,
];

export const availableModuleRegistry = moduleRegistry.filter((module) => module.availability === "available");
export const coworkerRegistry = [bioazHelperCoworker, ...availableModuleRegistry.map((module) => module.suggestedCoworker)];
export const quickStartRegistry = moduleRegistry.flatMap((module) => module.quickStarts.map((quickStart) => ({
  ...quickStart,
  moduleId: module.moduleId,
  availability: module.availability,
})));

export function getAgentModule(moduleId: string) {
  return moduleRegistry.find((module) => module.moduleId === moduleId) ?? null;
}

export function getModuleForCoworker(coworkerId: string) {
  return moduleRegistry.find((module) => module.suggestedCoworker.id === coworkerId) ?? null;
}

export function resolveModuleIntent(text: string): IntentResolution {
  /* 报价先分流，再走通用匹配。
     ----------------------------------------------------------------------
     两条报价线的说法高度重叠——「我要报价」对 DMPK 和肿瘤都成立，光靠
     supportedIntents 逐个匹配，结果必然是 ambiguous，等于每次都要反问一句。
     所以这里先看是不是在说报价，是的话再由业务词决定是哪一条线。
     肿瘤线的判据是模型和瘤株的说法（肿瘤 / 药效 / 荷瘤 / CDX / PDX），
     其余归 DMPK——这跟两个 quickStart 的落点一致。 */
  if (/报价|询价/.test(text)) {
    const tumorLine = /肿瘤|药效|荷瘤|cdx|pdx|皮下接种|细胞系/i.test(text);
    return { module: tumorLine ? tumorQuotationModule : dmpkQuotationModule, confidence: "matched" };
  }
  const matches = availableModuleRegistry.filter((module) => module.supportedIntents.some((intent) => intent.keywords.test(text)));
  if (matches.length === 1) return { module: matches[0], confidence: "matched" };
  if (matches.length > 1) {
    return {
      module: null,
      confidence: "ambiguous",
      clarification: `这项工作更接近哪一项：${matches.map((module) => module.moduleName).join("、")}？`,
    };
  }
  return {
    module: null,
    confidence: "unmatched",
    clarification: "请确认这项工作更接近 DMPK 报价、肿瘤报价，还是肿瘤药效报告？",
  };
}
