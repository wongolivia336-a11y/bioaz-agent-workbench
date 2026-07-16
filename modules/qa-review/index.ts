import { Check } from "lucide-react";
import { ModuleUnavailableState } from "../../components/workbench-shell/ModuleUnavailableState";
import { qaReviewCoworker } from "../coworkers";
import type { AgentModuleDefinition } from "../types";

export const qaReviewModule: AgentModuleDefinition = {
  moduleId: "qa-review",
  moduleName: "QA 审核",
  taskType: "审核",
  availability: "placeholder",
  suggestedCoworker: qaReviewCoworker,
  supportedIntents: [{ id: "qa-review", label: "QA 审核", examples: ["复核报告交付包"], keywords: /qa|审核|复核|检查.*交付包|交付包.*检查/i }],
  quickStarts: [{ id: "qa-review", label: "复核交付包", prompt: "我要复核一份报告交付包", icon: Check }],
  stages: [{ id: "placeholder", label: "暂未接入" }],
  composerActions: [],
  artifacts: [],
  requiredFiles: [],
  validationRules: [],
  handoffNotes: ["后续接入审核清单与证据追溯"],
  Session: ModuleUnavailableState,
};
