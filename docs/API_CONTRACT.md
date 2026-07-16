# API Contract Draft

This is a planning document for backend integration. The current prototype uses mock local state.

## Create Task

```ts
POST /api/report-runs

type CreateReportTaskRequest = {
  projectId: string;
  title?: string;
};
```

Returns a `ReportRun`.

## Upload File

```ts
POST /api/report-runs/:taskId/files

type UploadReportFileRequest = {
  taskId: string;
  fileRole: "protocol" | "data" | "other";
  fileName: string;
};
```

Returns an `UploadedFile`.

## Get Task Detail

```ts
GET /api/report-runs/:taskId
```

Returns the latest `ReportRun`, including workflow status, files, warnings, reviews, and export items.

## Get Validation Result

```ts
GET /api/report-runs/:taskId/validation
```

Returns `WarningItem[]`.

## Confirm Warning

```ts
POST /api/report-runs/:taskId/warnings/:warningId/confirm

type ConfirmWarningRequest = {
  taskId: string;
  warningId: string;
  accepted: boolean;
};
```

Returns the updated `WarningItem`.

## Get Module Review Status

```ts
GET /api/report-runs/:taskId/reviews
```

Returns `ReviewModule[]`.

## Trigger Export

```ts
POST /api/report-runs/:taskId/export

type TriggerExportRequest = {
  taskId: string;
  exportKind: "package";
};
```

Returns a permission-checked package download URL.

## Response Envelope

```ts
type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
```
