export type WorkflowStatus =
  | "idle"
  | "uploaded"
  | "validating"
  | "warning_required"
  | "generating"
  | "generated"
  | "reviewing"
  | "ready_to_export"
  | "failed";

export type Stage =
  | "empty"
  | "uploaded"
  | "validating"
  | "warning"
  | "generating"
  | "generated"
  | "reviewing"
  | "review"
  | "exported";

export type User = {
  id: string;
  name: string;
  role: "sd" | "qa" | "statistician" | "engineer" | "viewer";
};

export type UploadedFile = {
  id: string;
  name: string;
  size: string;
  kind: "protocol" | "data" | "other";
};

export type StepStatus = "done" | "active" | "pending";

export type ValidationStep = {
  label: string;
  detail: string;
  status: StepStatus;
  tech?: string;
  artifacts?: string[];
};

export type ActionStep = ValidationStep;

export type WarningItem = {
  id: string;
  title: string;
  impact: string;
  owner: string;
  accepted: boolean;
};

export type ReviewModule = {
  id: string;
  title: string;
  source: string;
  owner: string;
  status: "pending" | "confirmed";
};

export type ReviewItem = ReviewModule;

export type ExportItem = {
  title: string;
  meta: string;
  count: string;
  kind: ArtifactPreviewKind;
  downloadable: boolean;
};

export type ReportRun = {
  id: string;
  status: WorkflowStatus;
  files: UploadedFile[];
  warnings: WarningItem[];
  reviews: ReviewModule[];
  exports: ExportItem[];
};

export type TaskRun = ReportRun;

export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export type InspectorTopic = "files" | "process" | "warnings" | "generation" | "review" | "artifacts";
export type PreviewSection = "recognized" | "issues" | "qa" | "context";
export type PreviewKind = "validation" | "review";
export type ArtifactPreviewKind = "word" | "package" | "prism" | "figure" | "qc" | "evidence" | "review-doc";

/**
 * 用户消息挂在哪一段之后。锚点必须跟着对话往下走，否则消息会浮到
 * 它所回应的那段过程上面去——「已确认全部专家建议」原来和「发起审核」
 * 共用 review 锚点，于是确认语出现在专家检查过程之前。
 */
export type UserEvent = {
  id: string;
  after: "upload" | "warning" | "generation" | "review" | "review-confirm" | "review-followup";
  text: string;
};

export type FollowupState = "idle" | "thinking" | "answered";
