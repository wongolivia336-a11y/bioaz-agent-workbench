"use client";

import { AlertTriangle, Check, ChevronRight, Eye, FileArchive, FileCheck2, FileSpreadsheet, FileText, LoaderCircle, Plus, Send, X } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { WorkbenchInspector } from "../../components/workbench-inspector/WorkbenchInspector";
import { AgentReply, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { ContextDivider, CoworkerSwitchCard } from "../../components/workbench-shell/BioAZHelper";
import { CoworkerSelector } from "../../components/workbench-shell/CoworkerSelector";
import type { AgentModuleSessionProps } from "../types";
import { getTumorInspectorPanels } from "./inspectorPanels";
import { tumorArtifacts, tumorReviews, tumorWarnings } from "./mockData";
import type { TumorArtifact, TumorInspectorPanelId, TumorReportFile, TumorReportStage, TumorReview, TumorWarning } from "./types";

type Message = { id: string; role: "user" | "agent"; text: string };

export default function TumorReportSession({ projectName, taskTitle, initialRequest, coworkers, activeCoworkerId, onCoworkerChange, handoffNotice }: AgentModuleSessionProps) {
  const [stage, setStage] = useState<TumorReportStage>("collecting");
  const [files, setFiles] = useState<TumorReportFile[]>([]);
  const [warnings, setWarnings] = useState<TumorWarning[]>(tumorWarnings.map((item) => ({ ...item })));
  const [reviews, setReviews] = useState<TumorReview[]>(tumorReviews.map((item) => ({ ...item })));
  const [messages, setMessages] = useState<Message[]>(() => [
    ...(initialRequest ? [{ id: "initial", role: "user" as const, text: initialRequest }] : []),
    { id: "welcome", role: "agent", text: "我会先检查实验方案与原始数据，再完成风险确认、报告生成和专家审核。请通过下方加号上传材料。" },
  ]);
  const [composerText, setComposerText] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(true);
  const [inspectorPanelId, setInspectorPanelId] = useState<TumorInspectorPanelId>("materials");
  const [pendingCoworkerId, setPendingCoworkerId] = useState<string | null>(null);
  const [previewArtifact, setPreviewArtifact] = useState<TumorArtifact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canValidate = files.some((file) => file.kind === "protocol") && files.some((file) => file.kind === "data");
  const busy = ["validating", "generating", "reviewing"].includes(stage);
  const activeCoworker = coworkers.find((item) => item.id === activeCoworkerId) ?? coworkers[0];
  const pendingCoworker = coworkers.find((item) => item.id === pendingCoworkerId);
  const append = (role: Message["role"], text: string) => setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text }]);

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const next = selected.map((file, index): TumorReportFile => ({ id: `${file.name}-${file.size}-${index}`, name: file.name, size: formatSize(file.size), kind: file.name.toLowerCase().endsWith(".docx") ? "protocol" : "data" }));
    setFiles((current) => [...current.filter((item) => !next.some((incoming) => incoming.kind === item.kind)), ...next]);
    append("user", `已上传 ${selected.map((file) => file.name).join("、")}`);
    event.target.value = "";
  };

  const useSampleMaterials = () => {
    setFiles([
      { id: "sample-protocol", name: "NCI-H82_双批次实验方案.docx", size: "1.2 MB", kind: "protocol" },
      { id: "sample-data", name: "sample9_batch_raw.xlsx", size: "864 KB", kind: "data" },
    ]);
    append("user", "使用项目中的示例方案和原始数据");
  };

  const startValidation = () => {
    if (!canValidate || busy) return;
    append("user", "开始校验材料"); setStage("validating"); setInspectorPanelId("materials");
    window.setTimeout(() => { setStage("warning"); setInspectorPanelId("risks"); setInspectorOpen(true); append("agent", "材料校验完成。当前没有阻断问题，但有 3 项风险需要你确认后才能生成报告。"); }, 1500);
  };

  const acceptWarnings = () => {
    setWarnings((items) => items.map((item) => ({ ...item, accepted: true }))); append("user", "已确认风险并继续生成"); setStage("generating");
    window.setTimeout(() => { setStage("generated"); setInspectorPanelId("artifacts"); setInspectorOpen(true); append("agent", "肿瘤药效报告与交付包已经生成，数据、图表和 Word 数字校验一致。"); }, 1700);
  };

  const startReview = () => {
    append("user", "发起专家小队审核"); setStage("reviewing"); setInspectorPanelId("review"); setInspectorOpen(true);
    window.setTimeout(() => { setStage("review"); append("agent", "专家小队已完成初审，共有 3 条建议需要人工确认。"); }, 1700);
  };

  const confirmReviews = () => {
    setReviews((items) => items.map((item) => ({ ...item, status: "confirmed" }))); setStage("exported"); setInspectorPanelId("artifacts"); append("user", "已确认全部专家建议"); append("agent", "审核记录已写入交付包，当前版本可以进入正式交付。");
  };

  const submitMessage = () => {
    const text = composerText.trim(); if (!text || busy) return;
    append("user", text); setComposerText("");
    window.setTimeout(() => append("agent", stage === "collecting" ? "收到。我会把这条说明与上传材料一起用于校验。" : "已记录到当前任务上下文。"), 450);
  };

  const inspectorPanels = useMemo(() => getTumorInspectorPanels({ stage, files, warnings, reviews, artifacts: tumorArtifacts, projectName, onPreviewArtifact: setPreviewArtifact }), [files, projectName, reviews, stage, warnings]);

  return <>
    <section className="dmpkWorkspace tumorWorkspace">
      <header className="topbar"><div className="breadcrumb"><span>{projectName}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></div></header>
      <header className="agentHeader"><div className="agentTitle"><span className="agentIcon pending"><FileCheck2 size={18} /></span><span>{activeCoworker?.name ?? "药效报告同事"}</span></div></header>
      <div className="dmpkChatScroller"><div className="dmpkConversation tumorConversation">
        {handoffNotice ? <ContextDivider>{handoffNotice}</ContextDivider> : null}
        {messages.map((message) => message.role === "user" ? <UserBubble key={message.id} text={message.text} /> : <AgentReply key={message.id}>{message.text}</AgentReply>)}
        {busy ? <TumorActivity stage={stage} /> : null}
        {["generated", "reviewing", "review", "exported"].includes(stage) ? <ArtifactCards onPreview={setPreviewArtifact} onOpen={() => { setInspectorPanelId("artifacts"); setInspectorOpen(true); }} /> : null}
      </div></div>
      <footer className="dmpkComposerWrap tumorComposerWrap">
        {stage === "collecting" ? <MaterialActionCard files={files} canValidate={canValidate} onUseSamples={useSampleMaterials} onValidate={startValidation} /> : null}
        {stage === "warning" ? <WarningActionCard warnings={warnings} onInspect={() => { setInspectorPanelId("risks"); setInspectorOpen(true); }} onAccept={acceptWarnings} /> : null}
        {stage === "generated" ? <ReviewLaunchCard onOpenArtifacts={() => { setInspectorPanelId("artifacts"); setInspectorOpen(true); }} onStart={startReview} /> : null}
        {stage === "review" ? <ReviewActionCard reviews={reviews} onInspect={() => { setInspectorPanelId("review"); setInspectorOpen(true); }} onConfirm={confirmReviews} /> : null}
        {pendingCoworker && activeCoworker ? <CoworkerSwitchCard from={activeCoworker.name} to={pendingCoworker.name} onConfirm={() => { onCoworkerChange(pendingCoworker.id); setPendingCoworkerId(null); }} onCancel={() => setPendingCoworkerId(null)} /> : null}
        <CoworkerSelector coworkers={coworkers} activeCoworkerId={activeCoworkerId} onChange={(id) => id !== activeCoworkerId && setPendingCoworkerId(id)} />
        <div className="dmpkComposer"><button className="composerAddButton" type="button" onClick={() => fileInputRef.current?.click()} aria-label="上传文件"><Plus size={18} /></button><input ref={fileInputRef} className="visuallyHidden" type="file" multiple accept=".docx,.xlsx" onChange={selectFiles} /><div className="composerInputStack"><input value={composerText} onChange={(event) => setComposerText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitMessage(); }} placeholder="补充研究说明，或通过加号上传方案与数据" /></div><button className="sendIconButton" type="button" onClick={submitMessage} disabled={!composerText.trim() || busy} aria-label="发送"><Send size={18} /></button></div>
      </footer>
    </section>
    <aside className={`dmpkPanel moduleInspectorRail tumorInspectorRail ${inspectorPinned ? "hasPinnedInspector" : ""}`}><WorkbenchInspector panels={inspectorPanels} activePanelId={inspectorPanelId} open={inspectorOpen} pinned={inspectorPinned} onOpenChange={setInspectorOpen} onPinnedChange={setInspectorPinned} onPanelChange={(id) => setInspectorPanelId(id as TumorInspectorPanelId)} /></aside>
    {previewArtifact ? <ArtifactPreview artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} /> : null}
  </>;
}

function MaterialActionCard({ files, canValidate, onUseSamples, onValidate }: { files: TumorReportFile[]; canValidate: boolean; onUseSamples: () => void; onValidate: () => void }) {
  const protocol = files.find((file) => file.kind === "protocol"); const data = files.find((file) => file.kind === "data");
  return <section className="tumorActionCard"><header><div><span>所需材料</span><strong>上传方案和原始数据</strong></div><small>{files.length}/2</small></header><div className="tumorMaterialChecks"><span className={protocol ? "done" : ""}><FileText size={15} />{protocol?.name ?? "实验方案 DOCX"}</span><span className={data ? "done" : ""}><FileSpreadsheet size={15} />{data?.name ?? "原始数据 XLSX"}</span></div><footer><button type="button" onClick={onUseSamples}>使用示例材料</button><button className="primaryButton compact" type="button" onClick={onValidate} disabled={!canValidate}>开始校验</button></footer></section>;
}

function WarningActionCard({ warnings, onInspect, onAccept }: { warnings: TumorWarning[]; onInspect: () => void; onAccept: () => void }) {
  return <section className="tumorActionCard warning"><header><div><span>校验完成</span><strong>{warnings.length} 项风险需要确认</strong></div><AlertTriangle size={18} /></header><p>当前没有阻断问题。确认表示允许进入报告生成，不代表最终科学结论放行。</p><footer><button type="button" onClick={onInspect}>查看证据</button><button className="primaryButton compact" type="button" onClick={onAccept}>确认并生成</button></footer></section>;
}

function ReviewLaunchCard({ onOpenArtifacts, onStart }: { onOpenArtifacts: () => void; onStart: () => void }) { return <section className="tumorActionCard"><header><div><span>报告已生成</span><strong>进入专家审核</strong></div><Check size={18} /></header><p>报告、Prism、Figure 与 QC 产物已准备完成。</p><footer><button type="button" onClick={onOpenArtifacts}>查看产物</button><button className="primaryButton compact" type="button" onClick={onStart}>发起审核</button></footer></section>; }

function ReviewActionCard({ reviews, onInspect, onConfirm }: { reviews: TumorReview[]; onInspect: () => void; onConfirm: () => void }) { return <section className="tumorActionCard"><header><div><span>专家审核</span><strong>{reviews.length} 条建议待确认</strong></div><small>待处理</small></header><p>确认后会把审核记录写入交付包，并形成可追溯版本。</p><footer><button type="button" onClick={onInspect}>查看建议</button><button className="primaryButton compact" type="button" onClick={onConfirm}>确认全部</button></footer></section>; }

function TumorActivity({ stage }: { stage: TumorReportStage }) { const content = stage === "validating" ? ["读取实验方案与工作表结构", "检查统计口径与异常事件", "生成校验摘要"] : stage === "generating" ? ["冻结确认事实", "生成 Prism 与 Figure", "生成 Word、QC 和交付包"] : ["数据一致性复核", "统计与安全性复核", "合并专家建议"]; return <section className="tumorActivity"><header><LoaderCircle className="spin" size={16} /><strong>{stage === "validating" ? "正在校验材料" : stage === "generating" ? "正在生成报告" : "专家小队正在审核"}</strong></header>{content.map((item) => <span key={item}><Check size={12} />{item}</span>)}</section>; }

function ArtifactCards({ onPreview, onOpen }: { onPreview: (artifact: TumorArtifact) => void; onOpen: () => void }) { return <section className="tumorArtifactCards"><header><strong>报告产物</strong><button type="button" onClick={onOpen}>查看全部</button></header>{tumorArtifacts.slice(0, 2).map((artifact) => <article key={artifact.id}><FileArchive size={21} /><div><strong>{artifact.title}</strong><span>{artifact.meta}</span></div><button type="button" onClick={() => onPreview(artifact)} aria-label={`预览${artifact.title}`}><Eye size={15} /></button></article>)}</section>; }

function ArtifactPreview({ artifact, onClose }: { artifact: TumorArtifact; onClose: () => void }) { return <div className="modalBackdrop" role="dialog" aria-modal="true"><section className="previewModal tumorPreview"><header><div><span>产物预览</span><h2>{artifact.title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><div className="tumorPreviewBody"><span><FileArchive size={26} /></span><h3>{artifact.title.replace(/\.[^.]+$/, "")}</h3><p>{artifact.meta}</p><div><strong>版本状态</strong><span>数据、图表与报告数字已完成一致性检查</span></div><div><strong>项目归属</strong><span>任务产物将在文件管理系统中保留可追溯记录</span></div></div></section></div>; }

function formatSize(size: number) { return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`; }
