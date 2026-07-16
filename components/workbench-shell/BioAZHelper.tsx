"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { CoworkerDefinition } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

export function DispatchConfirmCard({ coworker, coworkers, project, onCoworkerChange, onConfirm, onCancel }: { coworker: CoworkerDefinition; coworkers: CoworkerDefinition[]; project: string; onCoworkerChange: (id: string) => void; onConfirm: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <section className="dispatchConfirmCard">
    <div><span>建议分派</span><strong>{coworker.name}</strong><p>{coworker.description} · {project}</p></div>
    <div ref={ref} className={`dispatchCoworkerSelect ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>更换 <ChevronDown size={13} /></button>{open ? <div className="dispatchCoworkerMenu">{coworkers.map((item) => <button type="button" key={item.id} onClick={() => { onCoworkerChange(item.id); setOpen(false); }}><span>{item.name}</span>{item.id === coworker.id ? <Check size={14} /> : null}</button>)}</div> : null}</div>
    <button type="button" onClick={onCancel}>取消</button><button className="primaryButton compact" type="button" onClick={onConfirm}>确认分派</button>
  </section>;
}

export function CoworkerSwitchCard({ from, to, onConfirm, onCancel }: { from: string; to: string; onConfirm: () => void; onCancel: () => void }) {
  return <section className="coworkerSwitchCard"><div><span>切换数字同事</span><strong>{to}</strong><p>保留当前对话记录，并从这里开始使用新的任务上下文。</p></div><button className="iconButton" type="button" onClick={onCancel} aria-label="取消切换"><X size={15} /></button><button className="primaryButton compact" type="button" onClick={onConfirm}>确认切换</button><small>当前：{from}</small></section>;
}

export function ContextDivider({ children }: { children: string }) {
  return <div className="contextDivider"><span>{children}</span></div>;
}
