"use client";

import { Bot, GitBranch, ListChecks, FileText, Plus, Send, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import type { DetectionScenario } from "./ScenarioSelector";

type Tab = "prices" | "rules" | "parameters" | "templates";

interface Props {
  scenario: DetectionScenario;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onRuleDraft: (draft: string) => void;
}

export default function DmpkRuleAssistant({ activeTab, onTabChange, onRuleDraft }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [locked, setLocked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const expanded = hovered || locked;

  const handleConfirm = () => {
    if (proposal) {
      onRuleDraft(proposal);
      onTabChange("rules");
      setOpen(false);
      setProposal(null);
      setLocked(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setProposal(null);
    setLocked(false);
  };

  return (
    <div
      ref={ref}
      className="ambientFileAssistant quotationRuleAssistant"
      data-expanded={expanded || open ? "true" : "false"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setLocked(true)}
      onBlurCapture={() => requestAnimationFrame(() => {
        if (!ref.current?.contains(document.activeElement) && !text.trim()) setLocked(false);
      })}
    >
      {!open ? (
        <div className="ambientAssistantSuggestions" aria-hidden={!expanded}>
          <button type="button" tabIndex={expanded ? 0 : -1} onClick={() => { setText("以后 PK 样品少于 40 个都按 40 个收费"); setOpen(true); }}>
            <GitBranch /><span>改规则</span>
          </button>
          <button type="button" tabIndex={expanded ? 0 : -1} onClick={() => { setText("给 PK 检测增加一个自定义采血时间点字段"); setOpen(true); }}>
            <ListChecks /><span>改字段</span>
          </button>
          <button type="button" tabIndex={expanded ? 0 : -1} onClick={() => { setText("调整 PK 报价单模板里的费用明细顺序"); setOpen(true); }}>
            <FileText /><span>改模板</span>
          </button>
        </div>
      ) : null}
      <div className="ambientComposerFrame">
        {!open ? (
          <button className="ambientAssistantEntry" type="button" aria-label="展开 DMPK 报价同事" aria-expanded={expanded} onClick={() => { setLocked(true); setOpen(true); }}>
            <Sparkles size={17} /><span>问 DMPK 报价同事</span>
          </button>
        ) : null}
        {open ? (
          <section className="quotationAssistantPanel">
            <header>
              <div><span><Bot size={15} /></span><strong>DMPK 报价同事</strong></div>
              <button type="button" onClick={handleClose} aria-label="关闭 DMPK 报价同事"><X size={15} /></button>
            </header>
            {proposal ? (
              <div className="quotationChangeProposal">
                <span className="quotationAiTag"><Sparkles size={13} />已识别修改对象</span>
                <h3>这次将修改计价规则</h3>
                <dl>
                  <div><dt>修改</dt><dd>计价规则</dd></div>
                  <div><dt>不会修改</dt><dd>报价字段、报价模板</dd></div>
                  <div><dt>影响范围</dt><dd>未来新建的 PK 报价</dd></div>
                </dl>
                <footer>
                  <button type="button" onClick={() => setProposal(null)}>返回修改</button>
                  <button className="primary" type="button" onClick={handleConfirm}>确认并进入规则编辑</button>
                </footer>
              </div>
            ) : (
              <form className="ambientAssistantComposer quotationAssistantComposer" onSubmit={(event) => { event.preventDefault(); if (text.trim()) setProposal(text.trim()); }}>
                <label className="ambientComposerAdd" aria-label="添加文件"><Plus size={18} /><input type="file" multiple /></label>
                <input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="描述要改的字段、规则或模板..." />
                <button className="ambientComposerSend" type="submit" disabled={!text.trim()} aria-label="发送"><Send size={17} /></button>
              </form>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
