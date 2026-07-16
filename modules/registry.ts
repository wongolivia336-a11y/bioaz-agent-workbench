import { dmpkQuotationModule } from "./dmpk-quotation";
import { tumorReportModule } from "./tumor-report";
import type { AgentModuleDefinition, IntentResolution } from "./types";

export const moduleRegistry: AgentModuleDefinition[] = [
  dmpkQuotationModule,
  tumorReportModule,
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
      clarification: "这项工作是要发起 DMPK 报价，还是撰写肿瘤药效报告？",
    };
  }
  return {
    module: null,
    confidence: "unmatched",
    clarification: "请确认这项工作更接近 DMPK 报价，还是肿瘤药效报告？",
  };
}
