"use client";

import { Check, ChevronDown, HelpCircle } from "lucide-react";
import { useState } from "react";
import type { CoworkerDefinition } from "../../modules/types";
import type { AgentSessionSnapshot } from "../../modules/types";
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
  return <section className="coworkerSwitchCard" aria-label="数字同事交接确认"><div><span>{endingCurrentFlow ? "任务交接" : "切换数字同事"}</span><strong>{from}<i aria-hidden="true">→</i>{to}</strong><p>{endingCurrentFlow ? "当前流程将结束；已确认内容、对话记录与产物会保留，未发送草稿不会带入。" : "当前对话记录会保留，新数字同事将从已确认上下文开始。"}</p></div><button type="button" onClick={onCancel}>取消</button><button className="primaryButton compact" type="button" onClick={onConfirm}>{endingCurrentFlow ? "确认交接" : "确认切换"}</button></section>;
}

export function ContextDivider({ children }: { children: string }) {
  return <div className="contextDivider"><span>{children}</span><span className="contextSummaryHelp"><button type="button" aria-label="查看交接上下文摘要"><HelpCircle size={14} /></button><span className="contextSummaryCard" role="tooltip"><strong>交接上下文摘要</strong><p>已保留上一位数字同事确认过的任务目标、关键参数、材料与产物状态；未发送草稿和未确认推断不会带入新会话。</p><small>{children}</small></span></span></div>;
}

export function PriorSessionHistory({ snapshots }: { snapshots?: AgentSessionSnapshot[] }) {
  if (!snapshots?.length) return null;
  return <div className="priorSessionHistory">{snapshots.map((snapshot) => <div key={snapshot.moduleId} className="priorSessionSegment"><div className="priorSessionEntries">{snapshot.entries.map((entry) => <p className={entry.role} key={entry.id}>{entry.text}</p>)}</div><ContextDivider>{`${snapshot.coworkerName} · ${snapshot.stageLabel} · 已保留上下文`}</ContextDivider></div>)}</div>;
}
