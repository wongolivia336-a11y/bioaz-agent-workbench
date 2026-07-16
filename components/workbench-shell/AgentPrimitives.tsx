"use client";

import { Check, ChevronDown, Clock3, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export function AgentReply({ children }: { children: ReactNode }) {
  return (
    <div className="agentReply">
      <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
      <p>{children}</p>
    </div>
  );
}

export function UserBubble({ text }: { text: string }) {
  return <div className="userBubble">{text}</div>;
}

export function PanelLink<T extends string>({ panelId, onOpen, children }: { panelId: T; onOpen: (panelId: T) => void; children: ReactNode }) {
  return <button className="bluePanelLink" type="button" onMouseEnter={() => onOpen(panelId)} onFocus={() => onOpen(panelId)} onClick={() => onOpen(panelId)}>{children}</button>;
}

export function ActivityChain({ title, steps, running, onOpen }: { title: string; steps: string[]; running: boolean; onOpen: (panelId: string) => void }) {
  return (
    <section className={`activityChain ${running ? "running" : "done"}`}>
      <button className="activityChainHeader" type="button" onClick={() => onOpen("process")}>
        <span>{running ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}</span>
        <strong>{title}</strong>
        <small>{running ? "处理中" : "已完成"}</small>
        <ChevronDown size={15} />
      </button>
      <div className="activityChainBody">
        {steps.map((step, index) => <div className="activityStep" key={step}><span>{index < steps.length - 1 || !running ? <Check size={12} /> : <Clock3 size={12} />}</span><p>{step}</p></div>)}
      </div>
    </section>
  );
}
