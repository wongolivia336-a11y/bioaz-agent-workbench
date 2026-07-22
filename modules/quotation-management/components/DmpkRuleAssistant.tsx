"use client";

import { ArrowLeft, FileText, GitBranch, ListChecks, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DetectionScenario } from "./ScenarioSelector";

type Tab = "prices" | "rules" | "parameters" | "templates";

interface Props {
  scenario: DetectionScenario;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onRuleDraft: (draft: string) => void;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposal?: string;
};

export default function DmpkRuleAssistant({ onTabChange, onRuleDraft }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [locked, setLocked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const expanded = hovered || locked;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking, open]);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || thinking) return;
    setOpen(true);
    setText("");
    setProposal(null);
    setMessages((current) => [
      ...current,
      { id: `dmpk-user-${Date.now()}`, role: "user", text: trimmed },
    ]);
    setThinking(true);
    window.setTimeout(() => {
      setThinking(false);
      setProposal(trimmed);
      setMessages((current) => [
        ...current,
        {
          id: `dmpk-agent-${Date.now()}`,
          role: "assistant",
          text: "我已识别这次修改对象，请先确认影响范围，再进入对应编辑区。",
          proposal: trimmed,
        },
      ]);
    }, 500);
  };

  const handleConfirm = (draft = proposal) => {
    if (draft) {
      onRuleDraft(draft);
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
    <>
      {/* 悬浮入口 */}
      <div
        ref={ref}
        className="ambientFileAssistant quotationRuleAssistant"
        data-expanded={expanded && !open ? "true" : "false"}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setLocked(true)}
        onBlurCapture={() => requestAnimationFrame(() => {
          if (!ref.current?.contains(document.activeElement) && !text.trim()) setLocked(false);
        })}
      >
          <div className="ambientAssistantSuggestions" aria-hidden={!expanded || open}>
          <button type="button" tabIndex={expanded && !open ? 0 : -1} onClick={() => submit("以后 PK 样品少于 40 个都按 40 个收费")}>
            <GitBranch size={14} strokeWidth={1.6} /><span>改规则</span>
          </button>
          <button type="button" tabIndex={expanded && !open ? 0 : -1} onClick={() => submit("给 PK 检测增加一个自定义采血时间点字段")}>
            <ListChecks size={14} strokeWidth={1.6} /><span>改字段</span>
          </button>
          <button type="button" tabIndex={expanded && !open ? 0 : -1} onClick={() => submit("调整 PK 报价单模板里的费用明细顺序")}>
            <FileText size={14} strokeWidth={1.6} /><span>改模板</span>
          </button>
        </div>
        <div className="ambientComposerFrame">
          <button className="ambientAssistantEntry" type="button" aria-label="展开 DMPK 报价同事" aria-expanded={expanded} onClick={() => setLocked(true)}>
            <Sparkles size={17} /><span>问 DMPK 报价同事</span>
          </button>
          <form className="ambientAssistantComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}>
            <label className="ambientComposerAdd" aria-label="添加文件"><Plus size={18} /><input type="file" multiple /></label>
            <input value={text} onChange={(event) => { setText(event.target.value); setLocked(true); }} placeholder="描述要改的规则、字段或模板..." aria-label="给 DMPK 报价同事发消息" />
            <button className="ambientComposerSend" type="submit" aria-label="发送" disabled={!text.trim() || thinking}><Send size={17} /></button>
          </form>
        </div>
      </div>

      {/* 放大聊天面板（和前台文件助手一致） */}
      {open ? (
        <section className="workspaceAssistantPanel libraryAssistantWorkspace quotationAssistantWorkspace" aria-label="DMPK 报价同事">
          <header>
            <div>
              <button className="assistantBackButton" type="button" aria-label="返回" onClick={handleClose}><ArrowLeft size={17} /></button>
              <strong>DMPK 报价同事</strong>
            </div>
            <button type="button" aria-label="关闭" onClick={handleClose}><X size={16} /></button>
          </header>
          <div className="workspaceAssistantBody quotationAssistantChatBody" ref={scrollRef}>
            {messages.length ? (
              <div className="quotationAssistantMessages">
                {messages.map((message) => (
                  <div className={`quotationAssistantMessage ${message.role}`} key={message.id}>
                    {message.role === "assistant" ? <span className="quotationAssistantAvatar"><img src="/logo/bioaz-logo.svg" alt="" /></span> : null}
                    <div className="quotationAssistantBubble">
                      <p>{message.text}</p>
                      {message.proposal ? (
                        <div className="quotationChangeProposal">
                          <span className="quotationAiTag"><Sparkles size={13} />已识别修改对象</span>
                          <h3>这次将修改计价规则</h3>
                          <dl>
                            <div><dt>修改</dt><dd>计价规则</dd></div>
                            <div><dt>不会修改</dt><dd>报价字段、报价模板</dd></div>
                            <div><dt>影响范围</dt><dd>未来新建的 PK 报价</dd></div>
                          </dl>
                          <footer>
                            <button type="button" onClick={() => setProposal(null)}>继续补充</button>
                            <button className="primary" type="button" onClick={() => handleConfirm(message.proposal)}>确认并进入规则编辑</button>
                          </footer>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {thinking ? (
                  <div className="quotationAssistantMessage assistant">
                    <span className="quotationAssistantAvatar"><img src="/logo/bioaz-logo.svg" alt="" /></span>
                    <div className="quotationAssistantBubble">
                      <div className="assistantThinking" role="status" aria-live="polite"><span className="assistantThinkingLogo"><img src="/logo/bioaz-logo.svg" alt="" /></span><span>正在识别修改对象</span></div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="assistantWelcome">
                <span className="assistantHeroMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
                <strong>DMPK 报价同事</strong>
                <p>描述要改的字段、规则或模板，我会识别修改对象并推荐操作。</p>
              </div>
            )}
          </div>
          <form className="workspaceAssistantComposer workbenchComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}>
            <label className="composerAddButton" aria-label="添加文件"><Plus size={18} /><input type="file" multiple /></label>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="描述要改的字段、规则或模板..." aria-label="给 DMPK 报价同事发消息" />
            <button className="sendIconButton" type="submit" aria-label="发送" disabled={!text.trim() || thinking}><Send size={16} /></button>
          </form>
        </section>
      ) : null}
    </>
  );
}
