"use client";

import { Bot, Check, GitBranch, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { DetectionScenario } from "../components/ScenarioSelector";

export default function RuleConfig({ scenario, draftRequest }: { scenario: DetectionScenario; draftRequest?: string | null }) {
  const incomingDraft = draftRequest || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("draft") : null);
  const [prompt, setPrompt] = useState(() => incomingDraft || "SD 大鼠超过 30 只时，动物使用费按 85 折计算");
  const [generated, setGenerated] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [extraCondition, setExtraCondition] = useState(false);
  const [extraAdjustment, setExtraAdjustment] = useState(false);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [inlineEditor, setInlineEditor] = useState<"condition" | "adjustment" | null>(null);
  const [inlineRequest, setInlineRequest] = useState("");

  const openInlineEditor = (kind: "condition" | "adjustment") => {
    setInlineEditor(kind);
    setInlineRequest(kind === "condition" ? "并且试验周期不超过 4 周" : "同时将报告费设为 2,500 元");
  };

  const addInlineRule = () => {
    if (inlineEditor === "condition") setExtraCondition(true);
    if (inlineEditor === "adjustment") setExtraAdjustment(true);
    setShowTrial(false);
    setSaved(false);
    setPublished(false);
    setInlineEditor(null);
  };

  const markRuleChanged = () => { setShowTrial(false); setSaved(false); setPublished(false); };

  if (incomingDraft) return <IncomingRuleDraft request={incomingDraft} />;

  return (
    <>
      <section className="quotationRulePrompt">
        <textarea
          value={prompt}
          onChange={(event) => { setPrompt(event.target.value); setGenerated(false); setShowTrial(false); setSaved(false); setPublished(false); }}
          aria-label="描述特殊报价规则"
          placeholder="例如：SD 大鼠超过 30 只时，动物使用费按 85 折计算"
        />
        <footer>
          <button className="primary" type="button" disabled={!prompt.trim()} onClick={() => { setGenerated(true); setShowTrial(false); }}>
            <Sparkles size={15} />整理为规则
          </button>
        </footer>
      </section>
      {generated ? (
        <div className="quotationRuleGrid">
          <article className="quotationRuleCard">
            <header className="quotationRuleDraftHeader">
              <span className="quotationAiTag"><Bot size={13} />{published ? "已发布" : saved ? "草稿已保存" : "规则草稿 · 尚未生效"}</span>
              <small>{published ? "用于后续新报价" : saved ? "可继续编辑" : "修改后请保存并验证"}</small>
            </header>
            <h2>SD 大鼠批量折扣</h2>
            <RuleSentence prefix="适用于" values={["PK 检测"]} onChange={markRuleChanged} />
            <RuleSentence prefix="当" values={["动物种属", "等于", "SD 大鼠"]} onChange={markRuleChanged} />
            <RuleSentence prefix="并且" values={["动物数量", "大于", "30", "只"]} onChange={markRuleChanged} />
            {extraCondition ? <RuleSentence prefix="并且" values={["试验周期", "小于等于", "4", "周"]} onChange={markRuleChanged} /> : null}
            <RuleSentence prefix="调整为" values={["动物使用费", "乘以", "85%"]} onChange={markRuleChanged} />
            {extraAdjustment ? <RuleSentence prefix="同时" values={["报告费", "设为", "2500", "元"]} onChange={markRuleChanged} /> : null}
            <div className="quotationRuleAddArea">
              <div className="quotationRuleAddActions">
                <button type="button" onClick={() => openInlineEditor("condition")}><Plus size={14} />添加条件</button>
                <button type="button" onClick={() => openInlineEditor("adjustment")}><Plus size={14} />添加费用调整</button>
              </div>
              {inlineEditor ? (
                <section className="quotationInlineRuleEditor">
                  <header><div><Sparkles size={14} /><strong>{inlineEditor === "condition" ? "新增触发条件" : "新增费用调整"}</strong></div><button type="button" onClick={() => setInlineEditor(null)} aria-label="关闭"><X size={14} /></button></header>
                  <textarea autoFocus rows={2} value={inlineRequest} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setInlineRequest(event.target.value)} />
                  <footer><small>AI 会整理为可继续编辑的规则字段</small><button className="primary" type="button" disabled={!inlineRequest.trim()} onClick={addInlineRule}>整理并添加</button></footer>
                </section>
              ) : null}
            </div>
            <footer>
              <span className="quotationRuleSaveHint">{published ? "规则已生效" : saved ? "草稿已保存，尚未生效" : showTrial ? "验证通过，尚未保存" : "修改尚未保存"}</span>
              <div>
                <button type="button" onClick={() => setSaved(true)}>保存草稿</button>
                <button type="button" onClick={() => setShowTrial(true)}>验证计算</button>
                <button className="primary" type="button" disabled={!showTrial} onClick={() => { setSaved(true); setPublished(true); }}>发布规则</button>
              </div>
            </footer>
          </article>
          {showTrial ? (
            <aside className="quotationTrial">
              <h2>验证结果</h2>
              <small>验证参数：PK · SD 大鼠 · 36 只</small>
              <strong className="quotationTrialStatus"><Check size={14} />规则已触发</strong>
              <dl>
                <div><dt>标准动物费</dt><dd>¥4,320</dd></div>
                <div><dt>规则调整</dt><dd>− ¥648</dd></div>
                {extraAdjustment ? <div><dt>报告费</dt><dd>¥2,500</dd></div> : null}
                <div><dt>调整后动物费</dt><dd>¥3,672</dd></div>
              </dl>
            </aside>
          ) : null}
        </div>
      ) : (
        <>
          <div className="quotationRuleEmpty"><Sparkles size={18} /><strong>描述一条例外计价方式</strong><span>AI 会整理成可编辑的规则草稿。</span></div>
          <EngineerWorkflowPreview />
        </>
      )}
    </>
  );
}

function EngineerWorkflowPreview() {
  const nodes = ["读取 PK 入参", "判断是否 PK", "准备 PK 计价数量", "PK 固定价格表", "动物费和体内费", "生物分析费", "报告费", "标准汇总"];
  return (
    <section className="quotationWorkflowPreview">
      <header><div><GitBranch size={17} /><strong>工程师 Workflow</strong></div><span>保留</span></header>
      <div>{nodes.map((node, index) => <article style={{ "--workflow-index": index } as React.CSSProperties} key={node}>{node}</article>)}</div>
    </section>
  );
}

function IncomingRuleDraft({ request }: { request: string }) {
  const match = request.match(/样品.*?少于\s*(\d+)\s*个?.*?按\s*(\d+)\s*个?.*?收费/i);
  const minimum = match?.[2] ?? "40";
  const [showTrial, setShowTrial] = useState(false);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const markChanged = () => { setShowTrial(false); setSaved(false); setPublished(false); };
  return (
    <>
      <section className="quotationRulePrompt quotationIncomingPrompt">
        <div><span className="quotationAiTag"><Bot size={13} />来自前台对话</span><small>请检查 AI 整理结果，再验证并发布。</small></div>
        <textarea value={request} readOnly aria-label="前台提交的规则需求" />
      </section>
      <div className="quotationRuleGrid">
        <article className="quotationRuleCard">
          <header className="quotationRuleDraftHeader">
            <span className="quotationAiTag"><Bot size={13} />{published ? "已发布" : saved ? "草稿已保存" : "规则草稿 · 尚未生效"}</span>
            <small>{published ? "用于后续新报价" : "可点击字段手动修改"}</small>
          </header>
          <h2>PK 样品最低计费数量</h2>
          <RuleSentence prefix="适用于" values={["PK 检测"]} onChange={markChanged} />
          <RuleSentence prefix="当" values={["样品数量", "少于", minimum, "个"]} onChange={markChanged} />
          <RuleSentence prefix="计费为" values={["样品数量", minimum, "个"]} onChange={markChanged} />
          <footer>
            <span className="quotationRuleSaveHint">{published ? "规则已生效" : saved ? "草稿已保存，尚未生效" : showTrial ? "验证通过，尚未发布" : "规则尚未验证"}</span>
            <div>
              <button type="button" onClick={() => setSaved(true)}>保存草稿</button>
              <button type="button" onClick={() => setShowTrial(true)}>验证计算</button>
              <button className="primary" type="button" disabled={!showTrial} onClick={() => { setSaved(true); setPublished(true); }}>发布规则</button>
            </div>
          </footer>
        </article>
        {showTrial ? (
          <aside className="quotationTrial">
            <h2>验证结果</h2>
            <small>验证参数：PK · 32 个样品</small>
            <strong className="quotationTrialStatus"><Check size={14} />规则已触发</strong>
            <dl>
              <div><dt>实际样品数</dt><dd>32 个</dd></div>
              <div><dt>计费样品数</dt><dd>{minimum} 个</dd></div>
              <div><dt>规则结果</dt><dd>按 {minimum} 个收费</dd></div>
            </dl>
          </aside>
        ) : null}
      </div>
    </>
  );
}

function RuleSentence({ prefix, values, onChange }: { prefix: string; values: string[]; onChange: () => void }) {
  return <div className="quotationRuleSentence"><span>{prefix}</span><div>{values.map((value, index) => <EditableRuleToken initialValue={value} onChange={onChange} key={`${value}-${index}`} />)}</div></div>;
}

function EditableRuleToken({ initialValue, onChange }: { initialValue: string; onChange: () => void }) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  return editing ? (
    <input className="quotationRuleTokenInput" autoFocus value={value} onChange={(event) => { setValue(event.target.value); onChange(); }} onBlur={() => setEditing(false)} onKeyDown={(event) => { if (event.key === "Enter") setEditing(false); }} aria-label={`修改${initialValue}`} />
  ) : (
    <button type="button" title="点击修改" aria-label={`修改${value}`} onClick={() => setEditing(true)}>{value}<span className="quotationRuleTokenEdit">⌄</span></button>
  );
}
