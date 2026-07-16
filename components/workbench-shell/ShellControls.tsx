"use client";

import { Check, ChevronDown, MessageSquare, Send, Sparkles, X } from "lucide-react";
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
  return <div className={`workspaceAssistant ${open ? "isOpen" : ""}`}>{open ? <section className="workspaceAssistantPanel" aria-label="BioAZ Helper"><header><div><span className="assistantMark"><Sparkles size={15} /></span><strong>BioAZ Helper</strong></div><button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={16} /></button></header><div className="workspaceAssistantBody">{question ? <div className="assistantExchange"><p>{question}</p><div><Sparkles size={14} /><span>{context === "tasks" ? "已按最近更新时间检查任务，顶部三项需要你处理。" : "已检索项目产物、业务规则与原始文件。"}</span></div></div> : <div className="assistantWelcome"><strong>你好，我是 BioAZ Helper</strong><p>{context === "tasks" ? "找任务、查进度或发起新工作。" : "查找文件、规则和项目产物。"}</p></div>}<div className="assistantSuggestions">{suggestions.map((item) => <button type="button" key={item} onClick={() => submit(item)}>{item}</button>)}</div></div><form className="workspaceAssistantComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="给 BioAZ Helper 发消息..." aria-label="给 BioAZ Helper 发消息" /><button type="submit" aria-label="发送" disabled={!text.trim()}><Send size={16} /></button></form></section> : null}<button className="workspaceAssistantLauncher" type="button" aria-label={open ? "收起 BioAZ Helper" : "打开 BioAZ Helper"} onClick={() => setOpen((value) => !value)}>{open ? <X size={19} /> : <MessageSquare size={19} />}</button></div>;
}
