"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useDismissableLayer } from "./useDismissableLayer";

/**
 * 行内属性编辑器：一个 chip 样式的触发器，点开后在下方选值。
 * 项目中枢的计划与知识库的「指派给」共用，保证两个空间改属性的手感一致。
 */
export function InlineSelect({
  label,
  trigger,
  triggerClassName = "",
  align = "start",
  children,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  align?: "start" | "end";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="inlineSelect">
      <button
        className={`inlineSelectTrigger ${triggerClassName}`}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
      >
        {trigger}
        <ChevronDown className="inlineSelectCaret" size={12} />
      </button>
      {open ? (
        <div className={`toolMenu inlineSelectMenu ${align === "end" ? "alignEnd" : ""}`}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
