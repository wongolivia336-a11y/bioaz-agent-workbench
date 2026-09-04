"use client";

import { Eye, FileSpreadsheet, FileText, Send, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { ComposerChipTray, formatParamValue, ParameterTaskCard, splitRepeat, type ParamField } from "../../components/params";
import { PreviewModal } from "../../components/ui/PreviewModal";
import { ScrollTopButton } from "../../components/ui/ScrollTopButton";
import { ActivityChain, AgentReply, PanelLink, UserBubble } from "../../components/workbench-shell/AgentPrimitives";
import { WorkbenchComposer } from "../../components/workbench-shell/WorkbenchComposer";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import {
  getTumorGroupTitle,
  initialTumorFields,
  tumorGroups,
  type TumorDraftTab,
  type TumorField,
  type TumorGroupId,
  type TumorStage,
} from "./fields";
import type { TumorInspectorPanelId } from "./inspectorPanels";

export type TumorChatMessage = {
  id: string;
  role: "user" | "agent" | "run" | "artifacts";
  text: string;
  attachments?: ComposerAttachment[];
  runSteps?: string[];
};

/** 一次运行的标题与步骤。进行中的那条和留档的那条取自同一处，免得分叉。 */
export function tumorRunRecord(kind: "params" | "quote", options: { running?: boolean; missingCount?: number } = {}) {
  const { running = false, missingCount = 0 } = options;
  if (kind === "quote") {
    return {
      text: running ? "正在生成报价单" : "已完成报价生成过程",
      runSteps: ["检查计价关键字段", "匹配动物与模型价格规则", "匹配检测指标价格规则", "生成 Word / Excel 报价单", "校验页面与文件金额一致"],
    };
  }
  return {
    text: running ? "正在处理报价参数" : "已更新报价参数",
    runSteps: ["读取用户输入", "识别肿瘤药效报价类型", missingCount ? `还缺 ${missingCount} 项报价参数` : "当前阶段参数已齐全"],
  };
}

export function TumorConversation({ messages, stage, missingCount, onOpenInspector, onArtifactPreview }: {
  messages: TumorChatMessage[];
  stage: TumorStage;
  missingCount: number;
  onOpenInspector: (panelId: TumorInspectorPanelId) => void;
  onArtifactPreview: () => void;
}) {
  const liveRun = stage === "thinking" || stage === "generating"
    ? tumorRunRecord(stage === "generating" ? "quote" : "params", { running: true, missingCount })
    : null;
  return (
    <div className="dmpkConversation">
      {messages.map((message) => {
        if (message.role === "run") {
          return <ActivityChain key={message.id} title={message.text} doneTitle={message.text} steps={message.runSteps ?? []} running={false} onOpen={(panelId) => onOpenInspector(panelId as TumorInspectorPanelId)} />;
        }
        if (message.role === "artifacts") return <TumorArtifactCards key={message.id} onPreview={onArtifactPreview} onOpenInspector={onOpenInspector} />;
        if (message.role === "agent") return <AgentReply key={message.id}>{message.text}</AgentReply>;
        return <UserBubble key={message.id} text={message.text} attachments={message.attachments} />;
      })}
      {/* 只有正在跑的那一条留在最下面——它确实是此刻正在发生的事。
          跑完就进消息流，钉在它发生的那个位置。 */}
      {liveRun ? <ActivityChain title={liveRun.text} steps={liveRun.runSteps} running onOpen={(panelId) => onOpenInspector(panelId as TumorInspectorPanelId)} /> : null}
    </div>
  );
}

function TumorFinalConfirmCard({ onPreview, onGenerate }: { onPreview: () => void; onGenerate: () => void }) {
  return (
    <section className="warningDecision">
      <header className="warningDecisionHeader">
        <div>
          <span>报价前确认</span>
          <strong>参数已齐全，可以生成正式报价单</strong>
          <p>请先预览完整参数和计价条目。确认后将生成 Word 报价单与 Excel 报价明细。</p>
        </div>
        <small>待确认</small>
      </header>
      <div className="warningActions">
        <button className="previewIconOnlyButton" type="button" onClick={onPreview} aria-label="预览全部参数"><Eye size={16} /></button>
        <button className="primaryButton compact" type="button" onClick={onGenerate}>生成报价单</button>
      </div>
    </section>
  );
}

function TumorArtifactCards({ onPreview, onOpenInspector }: { onPreview: () => void; onOpenInspector: (panelId: TumorInspectorPanelId) => void }) {
  return (
    <section className="artifactCards" data-minimap="artifact" data-minimap-label="报价单产物">
      <div className="agentReply artifactReply">
        <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
        <p>报价单已生成。你可以<PanelLink panelId="artifacts" onOpen={onOpenInspector}>查看产物列表</PanelLink>，或直接预览下方文件。</p>
      </div>
      {(["word", "excel"] as const).map((kind) => (
        <article className="artifactCard" key={kind}>
          <span className="artifactFileIcon">{kind === "word" ? <FileText size={24} /> : <FileSpreadsheet size={24} />}</span>
          <div>
            <strong>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</strong>
            <p>{kind === "word" ? "肿瘤药效评价正式报价单，包含模型方案、报价条目、管理费和交付说明。" : "报价明细表，包含计价项、数量、单价、管理费和金额一致性校验。"}</p>
            <span>{kind === "word" ? "Document · DOCX · 管理费 30%" : "Spreadsheet · XLSX · 管理费 15%"}</span>
          </div>
          <button className="artifactActionButton" type="button" onClick={onPreview} aria-label="预览"><Eye size={16} /><span>预览</span></button>
        </article>
      ))}
    </section>
  );
}

/**
 * 计价条目。
 *
 * 演示单价，不是真实报价——但**必须是从参数算出来的**。
 * 摆一张跟参数无关的静态表，等于把这一整套「参数决定价格」的说法自己拆了：
 * 人改了组数回来一看金额没动，就再也不会信右边那个台账。
 */
export function tumorPriceLines(fields: TumorField[]) {
  const valueOf = (id: string) => fields.find((field) => field.id === id)?.value ?? "";
  const groups = splitRepeat(valueOf("doseGroups")).length || 1;
  const perGroup = Number(valueOf("animalsPerGroup").match(/\d+/)?.[0] ?? 0);
  const animals = groups * perGroup;
  const readouts = valueOf("readouts") ? valueOf("readouts").split("、").filter((item) => item !== "不需要检测") : [];
  const weeks = Number(valueOf("cycle").match(/(\d+)\s*[-–~至]?\s*(\d+)?/)?.[2] ?? valueOf("cycle").match(/\d+/)?.[0] ?? 0);

  const lines: Array<{ id: string; item: string; detail: string; qty: string; amount: number }> = [
    { id: "animal", item: "实验动物与饲养", detail: `${valueOf("strain") || "—"} · ${groups} 组 × ${perGroup || "—"} 只`, qty: `${animals || "—"} 只`, amount: animals * 320 },
    { id: "model", item: "模型建立与接种", detail: `${valueOf("model") || "—"} · ${valueOf("inoculation") || "—"}`, qty: `${animals || "—"} 只`, amount: animals * 450 },
    { id: "dosing", item: "给药与在体监测", detail: `${valueOf("route") || "—"} · ${valueOf("frequency") || "—"} · ${weeks || "—"} 周`, qty: `${groups} 组`, amount: groups * weeks * 600 },
  ];
  if (readouts.length) {
    lines.push({ id: "readout", item: "检测指标", detail: readouts.join("、"), qty: `${readouts.length} 项`, amount: readouts.length * 2800 });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, subtotal, management: Math.round(subtotal * 0.3), total: subtotal + Math.round(subtotal * 0.3) };
}

/** 报价前确认／产物预览共用的那张表。参数在上，计价条目在下。 */
export function TumorQuotationPreviewModal({ fields, title, onClose }: { fields: TumorField[]; title: string; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { lines, subtotal, management, total } = tumorPriceLines(fields);
  const money = (value: number) => `¥${value.toLocaleString()}`;

  return (
    <PreviewModal eyebrow="报价前确认" title={title} onClose={onClose}>
      <div className="previewBody">
        <div className="previewContent" ref={scrollRef}>
          <div className="previewTableWrap">
            <h3>报价参数</h3>
            <table className="previewTable">
              <thead><tr><th>类别</th><th>项目</th><th>说明</th></tr></thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id}>
                    <td>{getTumorGroupTitle(field.group)}</td>
                    <td>{field.label}</td>
                    <td>{formatParamValue(field, field.value) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="previewTableWrap">
            <h3>计价条目（演示单价）</h3>
            <table className="previewTable">
              <thead><tr><th>计价项</th><th>依据</th><th>数量</th><th>金额</th></tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}><td>{line.item}</td><td>{line.detail}</td><td>{line.qty}</td><td>{money(line.amount)}</td></tr>
                ))}
                <tr><td>小计</td><td>—</td><td>—</td><td>{money(subtotal)}</td></tr>
                <tr><td>管理费</td><td>Word 口径 30%</td><td>—</td><td>{money(management)}</td></tr>
                <tr><td>合计</td><td>—</td><td>—</td><td>{money(total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ScrollTopButton targetRef={scrollRef} />
    </PreviewModal>
  );
}

export function TumorComposer({
  attention, stage, text, setText, activeGroup, fields, allFields, mode, remainingCount, draftTabs,
  formOpen, onToggleForm,
  onSelect, onRemove, onSend, onPreview, onGenerate, disabled, projectName,
  attachments, onAttachmentsChange, activeCoworkerId, notice,
}: {
  attention?: boolean;
  stage: TumorStage;
  text: string;
  setText: (value: string) => void;
  activeGroup: TumorGroupId;
  fields: TumorField[];
  allFields: TumorField[];
  /** 参数表单开着没有。跟 stage 解耦——参数齐了人也可以再打开回头改 */
  formOpen: boolean;
  onToggleForm: () => void;
  mode: "collect" | "edit";
  /** 还欠着输入的项数。跟卡里列出来的行数不是一回事——多选和重复行填过之后
      仍然留在卡上让人接着改，但它们已经不欠了。 */
  remainingCount?: number;
  draftTabs: TumorDraftTab[];
  onSelect: (field: ParamField, value: string) => void;
  onRemove: (fieldId: string) => void;
  onSend: () => void;
  onPreview: () => void;
  onGenerate: () => void;
  disabled: boolean;
  projectName: string;
  attachments: ComposerAttachment[];
  onAttachmentsChange: (next: ComposerAttachment[]) => void;
  activeCoworkerId: string;
  notice?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!attention) return;
    wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    inputRef.current?.focus({ preventScroll: true });
  }, [attention]);

  return (
    <footer ref={wrapRef} className={`dmpkComposerWrap ${attention ? "needsAttention" : ""}`}>
      {notice}
      {formOpen ? (
        <ParameterTaskCard
          groups={tumorGroups}
          fields={fields}
          allFields={allFields}
          activeGroup={activeGroup}
          draftTabs={draftTabs}
          mode={mode}
          remainingCount={remainingCount}
          /* 参数齐了之后再打开，列的是**全部**字段而不是缺的，那时人是来
             回头核对／改两项的，卡头再写「请补全报价参数」就是在催一件
             已经做完的事。 */
          collectTitle={stage === "collecting" ? "请补全报价参数" : "核对报价参数"}
          onSelect={onSelect}
        />
      ) : null}
      {stage === "ready" && !formOpen ? <TumorFinalConfirmCard onPreview={onPreview} onGenerate={onGenerate} /> : null}
      {/* 表单的常驻开关。放在 composer 上沿，跟输入框同一路——
          「填参数」和「说话」是同一件事的两种输入方式，不该一个在手边、
          一个要去右栏找。参数齐了之后打开列的是全部，那时它是「回头改」的入口。 */}
      {stage !== "idle" && stage !== "thinking" && stage !== "generating" ? (
        <div className="tumorFormToggleRow">
          <button className="tumorFormToggle" type="button" aria-expanded={formOpen} onClick={onToggleForm}>
            <SlidersHorizontal size={14} aria-hidden="true" />
            {formOpen ? "收起报价参数" : "填写报价参数"}
          </button>
        </div>
      ) : null}
      <WorkbenchComposer
        className="dmpkComposer"
        attachments={attachments}
        onAttachmentsChange={onAttachmentsChange}
        activeCoworkerId={activeCoworkerId}
        project={projectName}
        globalDrop
      >
        <div className="composerInputStack">
          <ComposerChipTray tabs={draftTabs} groups={tumorGroups} fields={initialTumorFields} onRemove={onRemove} />
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSend();
              // 光标在空输入框上按退格，删掉最后一个 chip——chip 多到要折叠时，
              // 逐个去点那个叉号是最烦的一件事
              if (event.key === "Backspace" && !text && draftTabs.length) {
                event.preventDefault();
                onRemove(draftTabs[draftTabs.length - 1].fieldId);
              }
            }}
            placeholder={draftTabs.length ? "" : stage === "idle" ? "例如：CDX 免疫缺陷模型，BALB/c nude，皮下接种 A549，每组 10 只，4 周，口服 qd" : ""}
          />
        </div>
        <button className="sendIconButton" type="button" onClick={onSend} disabled={disabled} aria-label="发送"><Send size={18} /></button>
      </WorkbenchComposer>
    </footer>
  );
}
