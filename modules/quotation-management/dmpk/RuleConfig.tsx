"use client";

import { Bot, Check, GitBranch, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { DetectionScenario } from "../components/ScenarioSelector";

interface WorkflowNode {
  id: string;
  type: "start" | "condition" | "formula" | "fee_item" | "summary";
  label: string;
  description?: string;
  formula?: string;
}

const pkWorkflowNodes: WorkflowNode[] = [
  { id: "start", type: "start", label: "读取 PK 入参", description: "样品数量、动物种属、试验周期" },
  { id: "condition", type: "condition", label: "判断是否 PK", description: "检测类型 = PK" },
  { id: "prepare", type: "formula", label: "准备 PK 计价数量", formula: "max(实际样品数, 40)" },
  { id: "animal", type: "fee_item", label: "动物费和体内费", formula: "动物单价 × 数量 × 折扣" },
  { id: "bioanalysis", type: "fee_item", label: "生物分析费", formula: "样品检测单价 × 计价数量" },
  { id: "report", type: "fee_item", label: "报告费", formula: "固定费用 ¥3,000" },
  { id: "summary", type: "summary", label: "标准汇总", formula: "动物费 + 生物分析费 + 报告费" },
];

const baWorkflowNodes: WorkflowNode[] = [
  { id: "start", type: "start", label: "读取 BA Only 入参", description: "样品数量、分析方法、检测周期" },
  { id: "condition", type: "condition", label: "判断是否 BA Only", description: "检测类型 = BA Only" },
  { id: "prepare", type: "formula", label: "准备 BA 计价数量", formula: "实际样品数" },
  { id: "bioanalysis", type: "fee_item", label: "生物分析费", formula: "样品检测单价 × 计价数量" },
  { id: "report", type: "fee_item", label: "报告费", formula: "固定费用 ¥3,000" },
  { id: "summary", type: "summary", label: "标准汇总", formula: "生物分析费 + 报告费" },
];

const toxWorkflowNodes: WorkflowNode[] = [
  { id: "start", type: "start", label: "读取 TOX 入参", description: "动物数量、试验周期、检测项目" },
  { id: "condition", type: "condition", label: "判断是否 TOX", description: "检测类型 = TOX" },
  { id: "animal", type: "fee_item", label: "动物费和体内费", formula: "动物单价 × 数量" },
  { id: "bioanalysis", type: "fee_item", label: "生物分析费", formula: "样品检测单价 × 计价数量" },
  { id: "report", type: "fee_item", label: "报告费", formula: "固定费用 ¥3,000" },
  { id: "summary", type: "summary", label: "标准汇总", formula: "动物费 + 生物分析费 + 报告费" },
];

const workflowMap: Record<DetectionScenario, WorkflowNode[]> = {
  pk: pkWorkflowNodes,
  "ba-only": baWorkflowNodes,
  tox: toxWorkflowNodes,
};

const nodeTypeLabels: Record<WorkflowNode["type"], { bg: string; color: string; border: string }> = {
  start: { bg: "#f0f4ff", color: "#4a5af5", border: "#c7cfff" },
  condition: { bg: "#fff8f0", color: "#e67e22", border: "#ffe4cc" },
  formula: { bg: "#f0fff4", color: "#27ae60", border: "#c8f0d8" },
  fee_item: { bg: "#f5f0ff", color: "#7e57c2", border: "#ddd4f5" },
  summary: { bg: "#fff0f5", color: "#e91e63", border: "#f5c8d8" },
};

export default function RuleConfig({ scenario, draftRequest }: { scenario: DetectionScenario; draftRequest?: string | null }) {
  const incomingDraft = draftRequest || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("draft") : null);
  const [prompt, setPrompt] = useState(() => incomingDraft || "");
  const [generated, setGenerated] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const nodes = workflowMap[scenario] ?? pkWorkflowNodes;

  const markChanged = () => { setShowTrial(false); setSaved(false); setPublished(false); };

  return (
    <div className="ruleConfigLayout">
      <section className="ruleConfigLeft">
        <header className="ruleConfigHeader">
          <h2>工程师 Workflow</h2>
          <span className="ruleConfigBadge">保留</span>
        </header>
        <div className="workflowCanvas">
          {nodes.map((node, index) => (
            <div key={node.id} className="workflowNodeWrapper">
              <button
                type="button"
                className={`workflowNode ${activeNode === node.id ? "active" : ""}`}
                style={{
                  "--node-bg": nodeTypeLabels[node.type].bg,
                  "--node-color": nodeTypeLabels[node.type].color,
                  "--node-border": nodeTypeLabels[node.type].border,
                } as React.CSSProperties}
                onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
              >
                <span className="workflowNodeType">{node.type}</span>
                <strong>{node.label}</strong>
                {node.description ? <small>{node.description}</small> : null}
              </button>
              {index < nodes.length - 1 ? <div className="workflowConnector" /> : null}
            </div>
          ))}
        </div>
      </section>
      <section className="ruleConfigRight">
        <header className="ruleConfigHeader">
          <h2>自然语言规则</h2>
          <span className="ruleConfigBadge">AI</span>
        </header>
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
          <div className="quotationRuleCard">
            <header className="quotationRuleDraftHeader">
              <span className="quotationAiTag"><Bot size={13} />{published ? "已发布" : saved ? "草稿已保存" : "规则草稿 · 尚未生效"}</span>
              <small>{published ? "用于后续新报价" : saved ? "可继续编辑" : "修改后请保存并验证"}</small>
            </header>
            <h2>SD 大鼠批量折扣</h2>
            <RuleSentence prefix="适用于" values={["PK 检测"]} onChange={markChanged} />
            <RuleSentence prefix="当" values={["动物种属", "等于", "SD 大鼠"]} onChange={markChanged} />
            <RuleSentence prefix="并且" values={["动物数量", "大于", "30", "只"]} onChange={markChanged} />
            <RuleSentence prefix="调整为" values={["动物使用费", "乘以", "85%"]} onChange={markChanged} />
            <footer>
              <span className="quotationRuleSaveHint">{published ? "规则已生效" : saved ? "草稿已保存，尚未生效" : showTrial ? "验证通过，尚未保存" : "修改尚未保存"}</span>
              <div>
                <button type="button" onClick={() => setSaved(true)}>保存草稿</button>
                <button type="button" onClick={() => setShowTrial(true)}>验证计算</button>
                <button className="primary" type="button" disabled={!showTrial} onClick={() => { setSaved(true); setPublished(true); }}>发布规则</button>
              </div>
            </footer>
          </div>
        ) : (
          <div className="quotationRuleEmpty"><Sparkles size={18} /><strong>描述一条例外计价方式</strong><span>AI 会整理成可编辑的规则草稿。</span></div>
        )}
        {showTrial ? (
          <aside className="quotationTrial">
            <h2>验证结果</h2>
            <small>验证参数：PK · SD 大鼠 · 36 只</small>
            <strong className="quotationTrialStatus"><Check size={14} />规则已触发</strong>
            <dl>
              <div><dt>标准动物费</dt><dd>¥4,320</dd></div>
              <div><dt>规则调整</dt><dd>− ¥648</dd></div>
              <div><dt>调整后动物费</dt><dd>¥3,672</dd></div>
            </dl>
          </aside>
        ) : null}
      </section>
      {activeNode ? (
        <aside className="workflowNodeEditor">
          <header>
            <h3>{nodes.find((n) => n.id === activeNode)?.label}</h3>
            <button type="button" onClick={() => setActiveNode(null)}><X size={14} /></button>
          </header>
          <div className="workflowNodeEditorBody">
            {nodes.find((n) => n.id === activeNode)?.formula ? (
              <label>
                公式
                <input defaultValue={nodes.find((n) => n.id === activeNode)?.formula} />
              </label>
            ) : null}
            {nodes.find((n) => n.id === activeNode)?.description ? (
              <label>
                描述
                <textarea rows={2} defaultValue={nodes.find((n) => n.id === activeNode)?.description} />
              </label>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function RuleSentence({ prefix, values, onChange }: { prefix: string; values: string[]; onChange: () => void }) {
  return (
    <div className="quotationRuleSentence">
      <span>{prefix}</span>
      <div>{values.map((value, index) => <EditableRuleToken initialValue={value} onChange={onChange} key={`${value}-${index}`} />)}</div>
    </div>
  );
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
