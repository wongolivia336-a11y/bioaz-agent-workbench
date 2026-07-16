import { dmpkQuotationModule } from "./dmpk-quotation";
import { qaReviewModule } from "./qa-review";
import { tumorQuotationModule } from "./tumor-quotation";
import { tumorReportModule } from "./tumor-report";
import type { AgentModuleDefinition, IntentResolution } from "./types";

export const moduleRegistry: AgentModuleDefinition[] = [
  dmpkQuotationModule,
  tumorReportModule,
  tumorQuotationModule,
  qaReviewModule,
];

export const coworkerRegistry = moduleRegistry.map((module) => module.suggestedCoworker);
export const quickStartRegistry = moduleRegistry.flatMap((module) => module.quickStarts.map((quickStart) => ({ ...quickStart, moduleId: module.moduleId })));

export function getAgentModule(moduleId: string) {
  return moduleRegistry.find((module) => module.moduleId === moduleId) ?? null;
}

export function getModuleForCoworker(coworkerId: string) {
  return moduleRegistry.find((module) => module.suggestedCoworker.id === coworkerId) ?? null;
}

export function resolveModuleIntent(text: string): IntentResolution {
  const matches = moduleRegistry.filter((module) => module.supportedIntents.some((intent) => intent.keywords.test(text)));
  if (matches.length === 1) return { module: matches[0], confidence: "matched" };
  if (matches.length > 1) {
    return {
      module: null,
      confidence: "ambiguous",
      clarification: "这项工作是报告撰写、业务报价，还是交付包 QA 审核？",
    };
  }
  return {
    module: null,
    confidence: "unmatched",
    clarification: "这项工作更接近 DMPK 报价、肿瘤药效报告、肿瘤报价，还是 QA 审核？",
  };
}
