import {
  generationGroups,
  initialReviews,
  initialWarnings,
} from "./mock-data";
import type {
  ReportAgentApiContract,
  CreateReportTaskRequest,
  ConfirmWarningRequest,
  TriggerExportRequest,
  UploadReportFileRequest,
} from "./api-contract";
import type { ApiResponse, ReportRun, UploadedFile } from "./types";

const demoTaskId = "mock-report-run-nci-h82";

const createMockRun = (): ReportRun => ({
  id: demoTaskId,
  status: "idle",
  files: [],
  warnings: initialWarnings,
  reviews: initialReviews,
  exports: generationGroups,
});

const ok = <T,>(data: T): ApiResponse<T> => ({ ok: true, data });

// Prototype-only service that mirrors the future backend contract.
// The current UI still uses local state for deterministic design review.
export const mockReportAgentApi: ReportAgentApiContract = {
  async createTask(_input: CreateReportTaskRequest) {
    return ok(createMockRun());
  },

  async uploadFile(input: UploadReportFileRequest) {
    const file: UploadedFile = {
      id: `${input.taskId}-${input.fileName}`,
      name: input.fileName,
      size: "mock",
      kind: input.fileRole,
    };

    return ok(file);
  },

  async getTask(_taskId: string) {
    return ok(createMockRun());
  },

  async getValidationResult(_taskId: string) {
    return ok(initialWarnings);
  },

  async confirmWarning(input: ConfirmWarningRequest) {
    const warning = initialWarnings.find((item) => item.id === input.warningId) ?? initialWarnings[0];
    return ok({ ...warning, accepted: input.accepted });
  },

  async getReviewModules(_taskId: string) {
    return ok(initialReviews);
  },

  async triggerExport(_input: TriggerExportRequest) {
    return ok({ downloadUrl: "/mock/report-package.zip" });
  },
};
