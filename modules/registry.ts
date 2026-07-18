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
  if (/(?:我要|需要|做|发起|创建)?.*报价|询价/i.test(text) && !/肿瘤|药效|模型/.test(text)) {
    return { module: dmpkQuotationModule, confidence: "matched" };
  }
  const matches = availableModuleRegistry.filter((module) => module.supportedIntents.some((intent) => intent.keywords.test(text)));
  if (matches.length === 1) return { module: matches[0], confidence: "matched" };
  if (matches.length > 1) {
    return {
      module: null,
      confidence: "ambiguous",
      clarification: "这项工作是要发起 DMPK 报价，还是撰写肿瘤药效报告？",
    };
  }
  return {
    module: null,
    confidence: "unmatched",
    clarification: "请确认这项工作更接近 DMPK 报价，还是肿瘤药效报告？",
  };
}
