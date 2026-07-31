"use client";

import { ArrowLeft, ChevronDown, FileSearch, Lightbulb, ListChecks, MessageSquare, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDismissableLayer } from "./useDismissableLayer";

export function CompactSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`compactSelect ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{value}<ChevronDown size={13} /></button>{open ? <div className="compactSelectMenu">{options.map((option) => <button type="button" className={option === value ? "active" : ""} aria-current={option === value ? "true" : undefined} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option}</span></button>)}</div> : null}</div>;
}

type LibraryAssistantContext = {
  project: string;
  business: string;
};

export type AssistantContext = "tasks" | "library" | "knowledgeBase";

const libraryReferences = [
  { kind: "file", title: "样本9_双批次报告_v3.docx", meta: "XX药业-PD1临床前评价 · 数字同事产出" },
  { kind: "file", title: "batch9_raw.xlsx", meta: "XX药业-PD1临床前评价 · 人工资料" },
  { kind: "list", title: "样本9_双批次交付包.zip", meta: "报告、图表、QC 与证据摘要" },
] as const;

const knowledgeReferences = [
  { kind: "file", title: "DMPK实验操作规程.docx", meta: "SOP · 第 3 节 采血与样品处理" },
  { kind: "file", title: "2024全球肿瘤药物研发白皮书.pdf", meta: "行业报告/肿瘤 · 第 12 页" },
  { kind: "list", title: "肿瘤药效评价术语表.xlsx", meta: "行业报告/肿瘤 · 已向量化" },
] as const;

const assistantCopy = {
  library: {
    name: "项目助手",
    welcome: "需要处理什么项目资料？",
    intro: "我可以基于当前范围内的文件与任务进行查找、总结和思路拓展。",
    placeholder: "问问这个项目的资料、结论或下一步…",
    suggestions: ["查找项目相关文件", "总结当前项目关键结论", "基于项目资料生成客户汇报"],
  },
  knowledgeBase: {
    name: "知识库助手",
    welcome: "想从知识库里了解什么？",
    intro: "我可以基于已解析的知识库文件回答问题，并标注引用来源。",
    placeholder: "问问知识库里的规程、报告或结论…",
    suggestions: ["这份 SOP 的关键步骤是什么", "汇总肿瘤方向的行业报告要点", "哪些资料已指派给肿瘤报告同事"],
  },
} as const;

export function WorkspaceAssistant({ context, onStartTask, libraryContext, scopeLabel: scopeOverride }: { context: AssistantContext; onStartTask?: () => void; libraryContext?: LibraryAssistantContext; scopeLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [assistantProject, setAssistantProject] = useState(libraryContext?.project ?? "全部项目");
  const [assistantBusiness, setAssistantBusiness] = useState(libraryContext?.business ?? "全部业务");
  const [kbScope, setKbScope] = useState("全部知识库");
  const [ambientLocked, setAmbientLocked] = useState(false);
  const ambientRef = useRef<HTMLDivElement>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const library = context === "library";
  const knowledgeBase = context === "knowledgeBase";
  const ambient = library || knowledgeBase;
  const copy = library ? assistantCopy.library : assistantCopy.knowledgeBase;
  const suggestions = context === "tasks" ? ["列出我待处理的任务", "按项目整理当前任务", "发起一份 DMPK 报价"] : copy.suggestions;
  // 知识库进到具体文件夹后，胶囊上的范围跟着收窄到该文件夹
  const scopeLabel = knowledgeBase
    ? scopeOverride ?? kbScope
    : libraryContext?.project === "全部项目" ? "全部项目" : "当前项目";
  const submit = (value: string) => { const next = value.trim(); if (!next) return; if (thinkingTimerRef.current) window.clearTimeout(thinkingTimerRef.current); setQuestion(next); setThinking(true); setText(""); thinkingTimerRef.current = window.setTimeout(() => { setThinking(false); thinkingTimerRef.current = null; }, 760); if (/DMPK.*报价|报价.*DMPK/i.test(next)) onStartTask?.(); };
  const ambientExpanded = ambientLocked;

  const closeAmbient = () => {
    setAmbientLocked(false);
    setText("");
    if (ambientRef.current?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
  };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    setAssistantProject(libraryContext?.project ?? "全部项目");
    setAssistantBusiness(libraryContext?.business ?? "全部业务");
  }, [libraryContext?.business, libraryContext?.project]);

  useEffect(() => {
    if (!ambientLocked) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!ambientRef.current?.contains(event.target as Node)) closeAmbient();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [ambientLocked]);

  useEffect(() => () => {
    if (thinkingTimerRef.current) window.clearTimeout(thinkingTimerRef.current);
  }, []);

  return (
    <div className={`workspaceAssistant ${ambient ? "libraryAssistant" : ""} ${open ? "isOpen" : ""}`}>
      {open ? (
        <section className={`workspaceAssistantPanel ${ambient ? "libraryAssistantWorkspace" : ""}`} aria-label={ambient ? copy.name : "BioAZ Helper"}>
          <header>
            <div>
              {ambient ? <button className="assistantBackButton" type="button" aria-label={`收起${copy.name}`} onClick={() => setOpen(false)}><ArrowLeft size={17} /></button> : <span className="assistantMark"><Sparkles size={15} /></span>}
              <strong>{ambient ? copy.name : "BioAZ Helper"}</strong>
            </div>
            <button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={16} /></button>
          </header>
          {library ? <div className="assistantContextBar"><CompactSelect value={assistantProject} options={["全部项目", "XX药业-PD1临床前评价", "YY药业-Balb/c nude评价", "ZZ药业-CT26模型评价"]} onChange={setAssistantProject} /><CompactSelect value={assistantBusiness} options={["全部业务", "DMPK报价", "肿瘤报告"]} onChange={setAssistantBusiness} /></div> : null}
          {knowledgeBase ? <div className="assistantContextBar"><CompactSelect value={kbScope} options={["全部知识库", "仅已指派给数字同事的文件"]} onChange={setKbScope} /></div> : null}
          <div className="workspaceAssistantBody">
            {question ? <><div className="assistantExchange"><p>{question}</p>{thinking ? <div className="assistantThinking" role="status" aria-live="polite"><span className="assistantThinkingLogo"><img src="/logo/bioaz-logo.svg" alt="" /></span><span>正在理解并整理当前范围</span></div> : <div><Sparkles size={14} /><span>{library ? `我已结合${assistantProject === "全部项目" ? "全部项目" : assistantProject}范围内的文件与任务整理相关内容。` : knowledgeBase ? `我已在${kbScope}范围内检索并整理相关内容，下面是引用来源。` : "已按最近更新时间检查任务，顶部三项需要你处理。"}</span></div>}</div>{ambient && !thinking ? <div className="assistantReferences">{(library ? libraryReferences : knowledgeReferences).map((item) => <button type="button" key={item.title}>{item.kind === "list" ? <ListChecks size={16} /> : <FileSearch size={16} />}<span><strong>{item.title}</strong><small>{item.meta}</small></span></button>)}</div> : null}</> : <div className="assistantWelcome"><span className="assistantHeroMark"><img src="/logo/bioaz-logo.svg" alt="" /></span><strong>{ambient ? copy.welcome : "你好，我是 BioAZ Helper"}</strong><p>{ambient ? copy.intro : "找任务、查进度或发起新工作。"}</p></div>}
            {!question ? <div className="assistantSuggestions">{suggestions.map((item, index) => <button type="button" key={item} onClick={() => submit(item)}>{ambient ? [<FileSearch key="search" size={16} />, <ListChecks key="summary" size={16} />, <Lightbulb key="ideas" size={16} />][index] : null}<span>{item}</span></button>)}</div> : null}
          </div>
          <form className="workspaceAssistantComposer workbenchComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}><label className="composerAddButton" aria-label="添加文件"><Plus size={18} /><input type="file" multiple /></label><input value={text} onChange={(event) => setText(event.target.value)} placeholder={ambient ? copy.placeholder : "给 BioAZ Helper 发消息..."} aria-label={`给 ${ambient ? copy.name : "BioAZ Helper"} 发消息`} /><button className="sendIconButton" type="submit" aria-label="发送" disabled={!text.trim()}><Send size={16} /></button></form>
        </section>
      ) : null}
      {!open && ambient ? (
        <div
          ref={ambientRef}
          className="ambientFileAssistant"
          data-expanded={ambientExpanded ? "true" : "false"}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeAmbient(); } }}
        >
          <div className="ambientAssistantSuggestions" aria-hidden={!ambientExpanded}>
            {suggestions.map((item, index) => <button type="button" tabIndex={ambientExpanded ? 0 : -1} key={item} onClick={() => { setOpen(true); submit(item); }}>{[<FileSearch key="search" />, <ListChecks key="summary" />, <Lightbulb key="ideas" />][index]}<span>{item}</span></button>)}
          </div>
          <div className="ambientComposerFrame">
            <button className="ambientAssistantEntry" type="button" aria-label={ambientExpanded ? `收起${copy.name}` : `展开${copy.name}`} aria-expanded={ambientExpanded} onClick={() => setAmbientLocked((value) => !value)}><Sparkles size={17} /><span>问问{copy.name}<i>·</i>{scopeLabel}</span></button>
            <form className="ambientAssistantComposer" onSubmit={(event) => { event.preventDefault(); if (!text.trim()) return; setOpen(true); submit(text); }}>
              <label className="ambientComposerAdd" aria-label="添加文件"><Plus size={18} /><input type="file" multiple /></label>
              <input value={text} onChange={(event) => { setText(event.target.value); setAmbientLocked(true); }} placeholder={copy.placeholder} aria-label={`给 ${copy.name} 发消息`} />
              <button className="ambientComposerSend" type="submit" aria-label="发送" disabled={!text.trim()}><Send size={17} /></button>
            </form>
          </div>
        </div>
      ) : null}
      {!open && !ambient ? <button className="workspaceAssistantLauncher" type="button" aria-label="打开 BioAZ Helper" onClick={() => setOpen(true)}><MessageSquare size={18} /></button> : null}
    </div>
  );
}
