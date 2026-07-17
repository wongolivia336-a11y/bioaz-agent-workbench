"use client";

import { ArrowRightLeft, Check, ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
import type { CoworkerDefinition } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

export function CoworkerSelector({ coworkers, activeCoworkerId, onChange, locked = false }: { coworkers: CoworkerDefinition[]; activeCoworkerId: string; onChange: (coworkerId: string) => void; locked?: boolean }) {
  const [open, setOpen] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(open, () => { setOpen(false); setForceMode(false); });
  const activeCoworker = coworkers.find((coworker) => coworker.id === activeCoworkerId) ?? coworkers[0];
  if (!activeCoworker) return null;
  const ActiveIcon = activeCoworker.icon;

  return (
    <div ref={menuRef} className={`roleSelector ${open ? "isOpen" : ""}`}>
      <button className="roleSelectorCurrent" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ActiveIcon size={16} strokeWidth={1.9} />
        <span>{activeCoworker.name}</span>
        {locked ? <Lock size={13} aria-label="当前业务进行中" /> : null}
        <ChevronDown size={14} strokeWidth={1.8} />
      </button>
      {open ? (
        <div className="roleSelectorMenu isOpen">
          {coworkers.map((coworker) => {
            const Icon = coworker.icon;
            const disabled = locked && !forceMode && coworker.id !== activeCoworker.id;
            return (
              <button className={coworker.id === activeCoworker.id ? "active" : ""} disabled={disabled} type="button" key={coworker.id} onClick={() => { if (coworker.id !== activeCoworker.id) onChange(coworker.id); setOpen(false); setForceMode(false); }}>
                <Icon size={16} strokeWidth={1.9} />
                <strong>{coworker.name}</strong>
                {coworker.id === activeCoworker.id ? <Check size={14} /> : disabled ? <Lock size={13} /> : null}
              </button>
            );
          })}
          {locked && !forceMode ? <button className="roleSelectorForceSwitch" type="button" onClick={() => setForceMode(true)}><ArrowRightLeft size={15} /><strong>结束当前流程并切换</strong><span>需要再次确认</span></button> : null}
        </div>
      ) : null}
    </div>
  );
}
