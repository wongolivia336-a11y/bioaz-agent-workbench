"use client";

import { AlertTriangle, Check, Eye, FileArchive, FileCheck2, FileSpreadsheet, FileText, History, Paperclip } from "lucide-react";
import { resolveInspectorPanels, type InspectorPanelRegistry, type ResolvedInspectorPanel } from "../../components/workbench-inspector/WorkbenchInspector";
import type { TumorArtifact, TumorInspectorPanelId, TumorReportFile, TumorReportStage, TumorReview, TumorWarning } from "./types";

export type TumorInspectorContext = {
  stage: TumorReportStage;
  files: TumorReportFile[];
  warnings: TumorWarning[];
  reviews: TumorReview[];
  artifacts: TumorArtifact[];
  projectName: string;
  onPreviewArtifact: (artifact: TumorArtifact) => void;
};

const registry: InspectorPanelRegistry<TumorInspectorContext> = [
  { id: "materials", label: "输入材料", icon: Paperclip, defaultWhen: (context) => ["collecting", "validating", "warning", "generating"].includes(context.stage), render: (context) => <Materials context={context} /> },
  { id: "risks", label: "风险与缺失项", icon: AlertTriangle, available: (context) => ["warning", "generating", "generated", "reviewing", "review", "exported"].includes(context.stage), render: (context) => <Risks warnings={context.warnings} /> },
  { id: "artifacts", label: "报告产物", icon: FileCheck2, available: (context) => ["generated", "reviewing", "review", "exported"].includes(context.stage), defaultWhen: (context) => context.stage === "generated", render: (context) => <Artifacts artifacts={context.artifacts} onPreview={context.onPreviewArtifact} /> },
  { id: "review", label: "审核记录", icon: History, available: (context) => ["reviewing", "review", "exported"].includes(context.stage), defaultWhen: (context) => ["reviewing", "review", "exported"].includes(context.stage), render: (context) => <Reviews reviews={context.reviews} /> },
];

export function getTumorInspectorPanels(context: TumorInspectorContext): ResolvedInspectorPanel[] {
  return resolveInspectorPanels(registry, context);
}

function Materials({ context }: { context: TumorInspectorContext }) {
  const protocol = context.files.find((file) => file.kind === "protocol");
  const data = context.files.find((file) => file.kind === "data");
  return <div className="tumorInspectorList"><div className="tumorPanelIntro"><strong>{context.files.length}/2 类材料已提供</strong><span>{context.projectName}</span></div><MaterialRow icon={FileText} title="实验方案" value={protocol?.name ?? "待上传 DOCX"} ready={Boolean(protocol)} /><MaterialRow icon={FileSpreadsheet} title="原始数据" value={data?.name ?? "待上传 XLSX"} ready={Boolean(data)} /><div className="tumorInspectorNote">材料齐全后，数字同事会检查分组、终点、统计口径和异常事件。</div></div>;
}

function MaterialRow({ icon: Icon, title, value, ready }: { icon: typeof FileText; title: string; value: string; ready: boolean }) {
  return <div className="tumorMaterialRow"><Icon size={16} /><div><strong>{title}</strong><small>{value}</small></div><span className={ready ? "ready" : ""}>{ready ? <Check size={13} /> : "缺失"}</span></div>;
}

function Risks({ warnings }: { warnings: TumorWarning[] }) {
  return <div className="tumorInspectorList"><div className="tumorPanelIntro"><strong>{warnings.filter((item) => !item.accepted).length} 项需要确认</strong><span>无 blocking 问题</span></div>{warnings.map((warning) => <article className="tumorRiskRow" key={warning.id}><span>{warning.id}</span><div><strong>{warning.title}</strong><small>{warning.impact}</small></div><em>{warning.accepted ? "已确认" : warning.owner}</em></article>)}</div>;
}

function Artifacts({ artifacts, onPreview }: { artifacts: TumorArtifact[]; onPreview: (artifact: TumorArtifact) => void }) {
  return <div className="tumorInspectorList"><div className="tumorPanelIntro"><strong>报告版本 v1</strong><span>刚刚生成 · QC 通过</span></div>{artifacts.map((artifact) => <button className="tumorArtifactRow" type="button" key={artifact.id} onClick={() => onPreview(artifact)}><FileArchive size={17} /><div><strong>{artifact.title}</strong><small>{artifact.meta}</small></div><Eye size={14} /></button>)}</div>;
}

function Reviews({ reviews }: { reviews: TumorReview[] }) {
  return <div className="tumorInspectorList"><div className="tumorPanelIntro"><strong>专家审核</strong><span>{reviews.filter((item) => item.status === "confirmed").length}/{reviews.length} 已确认</span></div>{reviews.map((review) => <article className="tumorReviewRow" key={review.id}><span className={review.status}><Check size={13} /></span><div><strong>{review.title}</strong><small>{review.source}</small></div><em>{review.owner}</em></article>)}</div>;
}

export type { TumorInspectorPanelId };
