"use client";

import { ArrowLeft, Check, ChevronDown, FileSearch, Lightbulb, ListChecks, MessageSquare, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDismissableLayer } from "./useDismissableLayer";

export function CompactSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`compactSelect ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{value}<ChevronDown size={13} /></button>{open ? <div className="compactSelectMenu">{options.map((option) => <button type="button" className={option === value ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option}</span>{option === value ? <Check size={13} /> : null}</button>)}</div> : null}</div>;
}

type LibraryAssistantContext = {
  project: string;
  business: string;
};

export function WorkspaceAssistant({ context, onStartTask, libraryContext }: { context: "tasks" | "library"; onStartTask?: () => void; libraryContext?: LibraryAssistantContext }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [assistantProject, setAssistantProject] = useState(libraryContext?.project ?? "全部项目");
  const [assistantBusiness, setAssistantBusiness] = useState(libraryContext?.business ?? "全部业务");
  const [ambientHovered, setAmbientHovered] = useState(false);
  const [ambientLocked, setAmbientLocked] = useState(false);
  const ambientRef = useRef<HTMLDivElement>(null);
  const suggestions = context === "tasks" ? ["列出我待处理的任务", "按项目整理当前任务", "发起一份 DMPK 报价"] : ["查找项目相关文件", "总结当前项目关键结论", "基于项目资料生成客户汇报 PPT"];
  const submit = (value: string) => { const next = value.trim(); if (!next) return; setQuestion(next); setText(""); if (/DMPK.*报价|报价.*DMPK/i.test(next)) onStartTask?.(); };
  const library = context === "library";
  const ambientExpanded = ambientHovered || ambientLocked;

  const closeAmbient = () => {
    setAmbientHovered(false);
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

  return (
    <div className={`workspaceAssistant ${library ? "libraryAssistant" : ""} ${open ? "isOpen" : ""}`}>
      {open ? (
        <section className={`workspaceAssistantPanel ${library ? "libraryAssistantWorkspace" : ""}`} aria-label={library ? "BioAZ 文件助手" : "BioAZ Helper"}>
          <header>
            <div>
              {library ? <button className="assistantBackButton" type="button" aria-label="返回文件管理系统" onClick={() => setOpen(false)}><ArrowLeft size={17} /></button> : <span className="assistantMark"><Sparkles size={15} /></span>}
              <strong>{library ? "BioAZ 文件助手" : "BioAZ Helper"}</strong>
            </div>
            <button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={16} /></button>
          </header>
          {library ? <div className="assistantContextBar"><CompactSelect value={assistantProject} options={["全部项目", "XX药业-PD1临床前评价", "YY药业-Balb/c nude评价", "ZZ药业-CT26模型评价"]} onChange={setAssistantProject} /><CompactSelect value={assistantBusiness} options={["全部业务", "DMPK报价", "肿瘤报告"]} onChange={setAssistantBusiness} /></div> : null}
          <div className="workspaceAssistantBody">
            {question ? <><div className="assistantExchange"><p>{question}</p><div><Sparkles size={14} /><span>{library ? `我已结合${assistantProject === "全部项目" ? "全部项目" : assistantProject}范围内的文件与任务整理相关内容。` : "已按最近更新时间检查任务，顶部三项需要你处理。"}</span></div></div>{library ? <div className="assistantReferences"><button type="button"><FileSearch size={16} /><span><strong>样本9_双批次报告_v3.docx</strong><small>XX药业-PD1临床前评价 · 数字同事产出</small></span></button><button type="button"><FileSearch size={16} /><span><strong>batch9_raw.xlsx</strong><small>XX药业-PD1临床前评价 · 人工资料</small></span></button><button type="button"><ListChecks size={16} /><span><strong>样本9_双批次交付包.zip</strong><small>报告、图表、QC 与证据摘要</small></span></button></div> : null}</> : <div className="assistantWelcome"><span className="assistantHeroMark"><img src="/logo/bioaz-logo.svg" alt="" /></span><strong>{library ? "需要处理什么项目资料？" : "你好，我是 BioAZ Helper"}</strong><p>{library ? "我可以基于当前范围内的文件与任务进行查找、总结和思路拓展。" : "找任务、查进度或发起新工作。"}</p></div>}
            {!question ? <div className="assistantSuggestions">{suggestions.map((item, index) => <button type="button" key={item} onClick={() => submit(item)}>{library ? [<FileSearch key="search" size={16} />, <ListChecks key="summary" size={16} />, <Lightbulb key="ideas" size={16} />][index] : null}<span>{item}</span></button>)}</div> : null}
          </div>
          <form className="workspaceAssistantComposer workbenchComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}><label className="composerAddButton" aria-label="添加文件"><Plus size={18} /><input type="file" multiple /></label><input value={text} onChange={(event) => setText(event.target.value)} placeholder={library ? "询问文件内容，或描述想拓展的思路..." : "给 BioAZ Helper 发消息..."} aria-label={library ? "给 BioAZ 文件助手发消息" : "给 BioAZ Helper 发消息"} /><button className="sendIconButton" type="submit" aria-label="发送" disabled={!text.trim()}><Send size={16} /></button></form>
        </section>
      ) : null}
      {!open && library ? (
        <div
          ref={ambientRef}
          className="ambientFileAssistant"
          data-expanded={ambientExpanded ? "true" : "false"}
          onMouseEnter={() => setAmbientHovered(true)}
          onMouseLeave={() => setAmbientHovered(false)}
          onFocusCapture={() => setAmbientLocked(true)}
          onBlurCapture={() => requestAnimationFrame(() => {
            if (!ambientRef.current?.contains(document.activeElement) && !text.trim()) setAmbientLocked(false);
          })}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeAmbient(); } }}
        >
          <div className="ambientAssistantSuggestions" aria-hidden={!ambientExpanded}>
            {suggestions.map((item, index) => <button type="button" tabIndex={ambientExpanded ? 0 : -1} key={item} onClick={() => { setOpen(true); submit(item); }}>{[<FileSearch key="search" />, <ListChecks key="summary" />, <Lightbulb key="ideas" />][index]}<span>{item}</span></button>)}
          </div>
          <div className="ambientComposerFrame">
            <button className="ambientAssistantEntry" type="button" aria-label="展开文件助手" aria-expanded={ambientExpanded} onClick={() => setAmbientLocked(true)}><Sparkles size={17} /><span>问问文件助手</span></button>
            <form className="ambientAssistantComposer" onSubmit={(event) => { event.preventDefault(); if (!text.trim()) return; setOpen(true); submit(text); }}>
              <label className="ambientComposerAdd" aria-label="添加文件"><Plus size={18} /><input type="file" multiple /></label>
              <input value={text} onChange={(event) => { setText(event.target.value); setAmbientLocked(true); }} placeholder="关于这些文件，你想知道什么？" aria-label="给 BioAZ 文件助手发消息" />
              <button className="ambientComposerSend" type="submit" aria-label="发送" disabled={!text.trim()}><Send size={17} /></button>
            </form>
          </div>
        </div>
      ) : null}
      {!open && !library ? <button className="workspaceAssistantLauncher" type="button" aria-label="打开 BioAZ Helper" onClick={() => setOpen(true)}><MessageSquare size={18} /></button> : null}
    </div>
  );
}
