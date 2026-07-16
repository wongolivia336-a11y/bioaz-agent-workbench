"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { CoworkerDefinition } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

export function CoworkerSelector({ coworkers, activeCoworkerId, onChange }: { coworkers: CoworkerDefinition[]; activeCoworkerId: string; onChange: (coworkerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
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
      {open ? (
        <div className="roleSelectorMenu isOpen">
          {coworkers.map((coworker) => {
            const Icon = coworker.icon;
            return (
              <button className={coworker.id === activeCoworker.id ? "active" : ""} type="button" key={coworker.id} onClick={() => { onChange(coworker.id); setOpen(false); }}>
                <Icon size={16} strokeWidth={1.9} />
                <strong>{coworker.name}</strong>
                {coworker.id === activeCoworker.id ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
