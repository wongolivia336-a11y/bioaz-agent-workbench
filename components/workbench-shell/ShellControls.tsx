"use client";

import { BookOpen, Check, ChevronDown, FileSearch, FolderKanban, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useDismissableLayer } from "./useDismissableLayer";

export function CompactSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`compactSelect ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{value}<ChevronDown size={13} /></button>{open ? <div className="compactSelectMenu">{options.map((option) => <button type="button" className={option === value ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option}</span>{option === value ? <Check size={13} /> : null}</button>)}</div> : null}</div>;
}

export function WorkspaceAssistant({ context, onStartTask }: { context: "tasks" | "library"; onStartTask?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const suggestions = context === "tasks" ? ["列出我待处理的任务", "按项目整理当前任务", "发起一份 DMPK 报价"] : ["查找样本9相关文件", "找到最新 DMPK 报价规则", "整理当前项目交付物"];
  const submit = (value: string) => { const next = value.trim(); if (!next) return; setQuestion(next); setText(""); if (/DMPK.*报价|报价.*DMPK/i.test(next)) onStartTask?.(); };
  const library = context === "library";
  return <div className={`workspaceAssistant ${library ? "libraryAssistant" : ""} ${open ? "isOpen" : ""}`}>{open && library ? <button className="assistantBackdrop" type="button" aria-label="关闭资料助手" onClick={() => setOpen(false)} /> : null}{open ? <section className="workspaceAssistantPanel" aria-label={library ? "BioAZ 资料助手" : "BioAZ Helper"}><header><div><span className="assistantMark"><Sparkles size={15} /></span><strong>{library ? "BioAZ 资料助手" : "BioAZ Helper"}</strong></div><button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={16} /></button></header><div className="workspaceAssistantBody">{question ? <><div className="assistantExchange"><p>{question}</p><div><Sparkles size={14} /><span>{library ? "我找到了 4 项相关内容，已按项目与更新时间整理。" : "已按最近更新时间检查任务，顶部三项需要你处理。"}</span></div></div>{library ? <div className="assistantReferences"><button type="button"><FileSearch size={16} /><span><strong>样本9_双批次报告_v3.docx</strong><small>XX药业-PD1临床前评价 · 36分钟前</small></span></button><button type="button"><BookOpen size={16} /><span><strong>肿瘤药效统计口径_v4.xlsx</strong><small>规则与模板 · 已发布</small></span></button><button type="button"><FolderKanban size={16} /><span><strong>样本9_双批次交付包.zip</strong><small>报告、图表、QC 与证据摘要</small></span></button></div> : null}</> : <div className="assistantWelcome"><span className="assistantHeroMark"><img src="/logo/bioaz-logo.svg" alt="" /></span><strong>{library ? "需要找什么资料？" : "你好，我是 BioAZ Helper"}</strong><p>{library ? "查找文件、规则和项目产物，并保留当前页面上下文。" : "找任务、查进度或发起新工作。"}</p></div>}<div className="assistantSuggestions">{suggestions.map((item, index) => <button type="button" key={item} onClick={() => submit(item)}>{library ? [<FileSearch key="search" size={16} />, <BookOpen key="rule" size={16} />, <FolderKanban key="folder" size={16} />][index] : null}<span>{item}</span></button>)}</div></div><form className="workspaceAssistantComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={library ? "询问项目文件、规则或产物..." : "给 BioAZ Helper 发消息..."} aria-label={library ? "给 BioAZ 资料助手发消息" : "给 BioAZ Helper 发消息"} /><button type="submit" aria-label="发送" disabled={!text.trim()}><Send size={16} /></button></form></section> : null}<button className="workspaceAssistantLauncher" type="button" aria-label={open ? "收起助手" : library ? "打开 BioAZ 资料助手" : "打开 BioAZ Helper"} onClick={() => setOpen((value) => !value)}>{open ? <X size={19} /> : <><MessageSquare size={18} />{library ? <span>询问资料助手</span> : null}</>}</button></div>;
}
