export type TumorReportStage = "collecting" | "validating" | "warning" | "generating" | "generated" | "reviewing" | "review" | "exported";

export type TumorReportFile = {
  id: string;
  name: string;
  size: string;
  kind: "protocol" | "data";
};

export type TumorWarning = {
  id: string;
  title: string;
  impact: string;
  owner: string;
  accepted: boolean;
};

export type TumorReview = {
  id: string;
  title: string;
  source: string;
  owner: string;
  status: "pending" | "confirmed";
};

export type TumorArtifact = {
  id: string;
  title: string;
  meta: string;
  kind: "word" | "package" | "prism" | "figure" | "qc";
};

export type TumorInspectorPanelId = "materials" | "risks" | "artifacts" | "review";
