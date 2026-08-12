import { Check } from "lucide-react";
import { qaReviewCoworker } from "../coworkers";
import type { AgentModuleDefinition } from "../types";
import QaReviewSession from "./QaReviewSession";

export const qaReviewModule: AgentModuleDefinition = {
  moduleId: "qa-review",
  moduleName: "QA 审核",
  taskType: "审核",
  availability: "available",
  suggestedCoworker: qaReviewCoworker,
  supportedIntents: [{ id: "qa-review", label: "QA 审核", examples: ["复核报告交付包"], keywords: /qa|审核|复核|检查.*交付包|交付包.*检查/i }],
  quickStarts: [{ id: "qa-review", label: "QA 审核", prompt: "我要复核一份报告交付包", icon: Check }],
  stages: [
    { id: "upload", label: "上传文件" },
    { id: "ai-review", label: "AI 校验" },
    { id: "revise", label: "逐条处置" },
    { id: "approval", label: "审批" },
    { id: "archive", label: "归档" },
  ],
  composerActions: [],
  artifacts: [{ id: "review-record", label: "审核记录", kind: "markdown" }],
  requiredFiles: [{ id: "delivery-package", label: "待审文件", required: true }],
  validationRules: [
    { id: "time-logic", label: "时间逻辑校验" },
    { id: "page-logic", label: "页码逻辑校验" },
    { id: "content-consistency", label: "内容一致性校验" },
  ],
  handoffNotes: ["审批结论落在文档版本上，全程写入审计轨迹"],
  Session: QaReviewSession,
};
