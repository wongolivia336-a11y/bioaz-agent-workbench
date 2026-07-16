"use client";

import { Check, ChevronDown } from "lucide-react";
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
