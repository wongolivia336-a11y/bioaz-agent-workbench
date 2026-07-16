import type { ApiResponse, ReportRun, ReviewModule, UploadedFile, WarningItem } from "./types";

export type CreateReportTaskRequest = {
  projectId: string;
  title?: string;
};

export type UploadReportFileRequest = {
  taskId: string;
  fileRole: UploadedFile["kind"];
  fileName: string;
};

export type ConfirmWarningRequest = {
  taskId: string;
  warningId: string;
  accepted: boolean;
};

export type TriggerExportRequest = {
  taskId: string;
  exportKind: "package";
};

export type ReportAgentApiContract = {
  createTask(input: CreateReportTaskRequest): Promise<ApiResponse<ReportRun>>;
  uploadFile(input: UploadReportFileRequest): Promise<ApiResponse<UploadedFile>>;
  getTask(taskId: string): Promise<ApiResponse<ReportRun>>;
  getValidationResult(taskId: string): Promise<ApiResponse<WarningItem[]>>;
  confirmWarning(input: ConfirmWarningRequest): Promise<ApiResponse<WarningItem>>;
  getReviewModules(taskId: string): Promise<ApiResponse<ReviewModule[]>>;
  triggerExport(input: TriggerExportRequest): Promise<ApiResponse<{ downloadUrl: string }>>;
};

// API contract only. The current prototype intentionally uses local mock state
// so the visual review flow remains deterministic and does not require backend services.
