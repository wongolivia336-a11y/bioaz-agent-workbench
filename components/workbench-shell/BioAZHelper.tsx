"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { CoworkerDefinition } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

export function DispatchConfirmCard({ taskType, coworker, coworkers, onCoworkerChange, onConfirm, onCancel }: { taskType: string; coworker: CoworkerDefinition; coworkers: CoworkerDefinition[]; onCoworkerChange: (id: string) => void; onConfirm: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <section className="dispatchConfirmCard">
    <div><span>识别结果</span><strong>{taskType}</strong><p>推荐：{coworker.name}</p></div>
    <div ref={ref} className={`dispatchCoworkerSelect ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>更换 <ChevronDown size={13} /></button>{open ? <div className="dispatchCoworkerMenu">{coworkers.map((item) => <button type="button" key={item.id} onClick={() => { onCoworkerChange(item.id); setOpen(false); }}><span>{item.name}</span>{item.id === coworker.id ? <Check size={14} /> : null}</button>)}</div> : null}</div>
    <button type="button" onClick={onCancel}>取消</button><button className="primaryButton compact" type="button" onClick={onConfirm}>确认分派</button>
  </section>;
}

export function CoworkerSwitchCard({ from, to, endingCurrentFlow = false, onConfirm, onCancel }: { from: string; to: string; endingCurrentFlow?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return <section className="coworkerSwitchCard"><div><span>{endingCurrentFlow ? "结束当前流程并切换" : "切换数字同事"}</span><strong>{to}</strong><p>{endingCurrentFlow ? `结束 ${from} 的当前流程，并保留已有上下文。` : "保留当前对话记录，从这里开始新的任务上下文。"}</p></div><button type="button" onClick={onCancel}>取消</button><button className="primaryButton compact" type="button" onClick={onConfirm}>{endingCurrentFlow ? "确认结束并切换" : "确认切换"}</button></section>;
}

export function ContextDivider({ children }: { children: string }) {
  return <div className="contextDivider"><span>{children}</span></div>;
}
