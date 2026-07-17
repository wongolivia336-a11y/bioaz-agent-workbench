"use client";

import { ArrowLeft, Check, ChevronDown, FileSearch, FolderKanban, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDismissableLayer } from "./useDismissableLayer";

export function CompactSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`compactSelect ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{value}<ChevronDown size={13} /></button>{open ? <div className="compactSelectMenu">{options.map((option) => <button type="button" className={option === value ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option}</span>{option === value ? <Check size={13} /> : null}</button>)}</div> : null}</div>;
}

type LibraryAssistantContext = {
  project: string;
  business: string;
  files: string[];
};

export function WorkspaceAssistant({ context, onStartTask, libraryContext }: { context: "tasks" | "library"; onStartTask?: () => void; libraryContext?: LibraryAssistantContext }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const suggestions = context === "tasks" ? ["列出我待处理的任务", "按项目整理当前任务", "发起一份 DMPK 报价"] : ["查找样本9相关文件", "查看当前项目的最近产物", "整理当前项目交付文件"];
  const submit = (value: string) => { const next = value.trim(); if (!next) return; setQuestion(next); setText(""); if (/DMPK.*报价|报价.*DMPK/i.test(next)) onStartTask?.(); };
  const library = context === "library";

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className={`workspaceAssistant ${library ? "libraryAssistant" : ""} ${open ? "isOpen" : ""}`}>
      {open ? (
        <section className={`workspaceAssistantPanel ${library ? "libraryAssistantWorkspace" : ""}`} aria-label={library ? "BioAZ 资料助手" : "BioAZ Helper"}>
          <header>
            <div>
              {library ? <button className="assistantBackButton" type="button" aria-label="返回文件管理系统" onClick={() => setOpen(false)}><ArrowLeft size={17} /></button> : <span className="assistantMark"><Sparkles size={15} /></span>}
              <strong>{library ? "BioAZ 资料助手" : "BioAZ Helper"}</strong>
            </div>
            <button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={16} /></button>
          </header>
          {library ? <div className="assistantContextBar"><span>{libraryContext?.project ?? "全部项目"}</span><span>{libraryContext?.business ?? "全部业务"}</span>{libraryContext?.files.map((file) => <span key={file}>{file}</span>)}</div> : null}
          <div className="workspaceAssistantBody">
            {question ? <><div className="assistantExchange"><p>{question}</p><div><Sparkles size={14} /><span>{library ? "我找到了 4 项相关内容，已结合当前项目与文件上下文整理。" : "已按最近更新时间检查任务，顶部三项需要你处理。"}</span></div></div>{library ? <div className="assistantReferences"><button type="button"><FileSearch size={16} /><span><strong>样本9_双批次报告_v3.docx</strong><small>XX药业-PD1临床前评价 · 数字同事产物</small></span></button><button type="button"><FileSearch size={16} /><span><strong>batch9_raw.xlsx</strong><small>XX药业-PD1临床前评价 · 人工上传</small></span></button><button type="button"><FolderKanban size={16} /><span><strong>样本9_双批次交付包.zip</strong><small>报告、图表、QC 与证据摘要</small></span></button></div> : null}</> : <div className="assistantWelcome"><span className="assistantHeroMark"><img src="/logo/bioaz-logo.svg" alt="" /></span><strong>{library ? "需要找什么资料？" : "你好，我是 BioAZ Helper"}</strong><p>{library ? "我会结合当前项目、筛选条件和已选文件查找资料。" : "找任务、查进度或发起新工作。"}</p></div>}
            <div className="assistantSuggestions">{suggestions.map((item, index) => <button type="button" key={item} onClick={() => submit(item)}>{library ? [<FileSearch key="search" size={16} />, <FileSearch key="recent" size={16} />, <FolderKanban key="folder" size={16} />][index] : null}<span>{item}</span></button>)}</div>
          </div>
          <form className="workspaceAssistantComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={library ? "询问项目文件或产物..." : "给 BioAZ Helper 发消息..."} aria-label={library ? "给 BioAZ 资料助手发消息" : "给 BioAZ Helper 发消息"} /><button type="submit" aria-label="发送" disabled={!text.trim()}><Send size={16} /></button></form>
        </section>
      ) : null}
      {!open && library ? <div className="workspaceAssistantHoverMenu"><span>可以这样问</span>{suggestions.map((item) => <button type="button" key={item} onClick={() => { setOpen(true); submit(item); }}><FileSearch size={15} />{item}</button>)}</div> : null}
      {!open ? <button className="workspaceAssistantLauncher" type="button" aria-label={library ? "打开 BioAZ 资料助手" : "打开 BioAZ Helper"} onClick={() => setOpen(true)}><MessageSquare size={18} />{library ? <span>询问资料助手</span> : null}</button> : null}
    </div>
  );
}
