"use client";

import { ArrowRightLeft, ChevronDown, CircleHelp } from "lucide-react";
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
        <ChevronDown size={14} strokeWidth={1.8} />
      </button>
      <button className="roleSelectorHelp" type="button" aria-label={`查看${activeCoworker.name}职责`} title={activeCoworker.description}>
        <CircleHelp size={14} />
        <span role="tooltip"><strong>{activeCoworker.name}</strong>{activeCoworker.description}</span>
      </button>
      {open ? (
        <div className="roleSelectorMenu isOpen">
          {coworkers.map((coworker) => {
            const Icon = coworker.icon;
            const disabled = locked && !forceMode && coworker.id !== activeCoworker.id;
            return (
              <button className={coworker.id === activeCoworker.id ? "active" : ""} disabled={disabled} type="button" key={coworker.id} onClick={() => { if (coworker.id !== activeCoworker.id) onChange(coworker.id); setOpen(false); setForceMode(false); }}>
                <Icon size={16} strokeWidth={1.9} />
                <span className="roleSelectorOptionCopy"><strong>{coworker.name}</strong><small>{coworker.description}</small></span>
              </button>
            );
          })}
          {locked && !forceMode ? <button className="roleSelectorForceSwitch" type="button" onClick={() => setForceMode(true)}><ArrowRightLeft size={15} /><strong>结束当前流程并切换</strong><span>需要再次确认</span></button> : null}
        </div>
      ) : null}
    </div>
  );
}
