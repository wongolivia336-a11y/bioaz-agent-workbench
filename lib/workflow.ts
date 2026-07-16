import type { ActionStep, Stage, StepStatus, UploadedFile, WorkflowStatus } from "./types";

export const WORKFLOW_STATUS_LABEL: Record<WorkflowStatus, string> = {
  idle: "空状态",
  uploaded: "文件已上传",
  validating: "校验中",
  warning_required: "需要确认 warning",
  generating: "生成中",
  reviewing: "审核中",
  ready_to_export: "可导出",
  failed: "失败",
};

export const STAGE_TO_WORKFLOW_STATUS: Record<Stage, WorkflowStatus> = {
  empty: "idle",
  uploaded: "uploaded",
  validating: "validating",
  warning: "warning_required",
  generating: "generating",
  review: "reviewing",
  exported: "ready_to_export",
};

export const formatSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

export const classifyFile = (file: File): UploadedFile["kind"] => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return "protocol";
  if (name.endsWith(".xlsx")) return "data";
  return "other";
};

export const makeSteps = (
  base: Array<Omit<ActionStep, "status">>,
  progress: number,
  running: boolean,
): ActionStep[] =>
  base.map((step, index) => {
    const status: StepStatus =
      index < progress ? "done" : index === progress && running ? "active" : "pending";
    return { ...step, status };
  });
