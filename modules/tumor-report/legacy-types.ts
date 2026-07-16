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

export type InspectorTopic = "process" | "warnings" | "generation" | "review" | "artifacts";
export type PreviewSection = "recognized" | "issues" | "qa" | "context";
export type PreviewKind = "validation" | "review";
export type ArtifactPreviewKind = "word" | "package" | "prism" | "figure" | "qc" | "evidence" | "review-doc";

export type UserEvent = {
  id: string;
  after: "upload" | "warning" | "review";
  text: string;
};

export type FollowupState = "idle" | "thinking" | "answered";
