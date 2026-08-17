"use client";

import type { ReactNode } from "react";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import { MessageAttachments } from "./WorkbenchComposer";

export function AgentReply({ children }: { children: ReactNode }) {
  return (
    <div className="agentReply" data-minimap="agent">
      <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
      <p>{children}</p>
    </div>
  );
}

export function UserBubble({ text, attachments }: { text: string; attachments?: ComposerAttachment[] }) {
  return <div className="userBubble" data-minimap="user" data-minimap-label={text}>{text}<MessageAttachments items={attachments} /></div>;
}

export function PanelLink<T extends string>({ panelId, onOpen, children }: { panelId: T; onOpen: (panelId: T) => void; children: ReactNode }) {
  return <button className="bluePanelLink" type="button" onMouseEnter={() => onOpen(panelId)} onFocus={() => onOpen(panelId)} onClick={() => onOpen(panelId)}>{children}</button>;
}

/**
 * 执行链。
 *
 * 此前这里是另一套形态（无边框、✓ 图标、LoaderCircle 转圈、限宽 720），
 * 和 DMPK / 肿瘤报告用的 .agentRun 时间轴并存——同一件事在三个会话里
 * 长着两副样子，宽度还是 720 / 820 / 860 三个值。
 *
 * 现在统一到时间轴那套：圆点 + 连接线表达「有先后的执行链」，
 * 运行指示统一用 motionLogo（BioAZ logo），不再用通用转圈。
 */
export function ActivityChain({ title, steps, running, onOpen }: { title: string; steps: string[]; running: boolean; onOpen: (panelId: string) => void }) {
  const activeStepIndex = steps.length - 1;
  return (
    <article className={`agentRun ${running ? "running" : "settled"}`} data-minimap="activity" data-minimap-label={title}>
      <button className="runHeader" type="button" onClick={() => onOpen("process")}>
        <span className={`motionLogo ${running ? "running" : ""}`} data-step={running ? activeStepIndex : undefined}>
          <img src="/logo/bioaz-logo.svg" alt="" />
          <span key={running ? activeStepIndex : "settled"} />
        </span>
        <strong>{title}</strong>
        <small>{running ? "处理中" : "已完成"}</small>
      </button>
      <div className="timeline">
        {steps.map((step, index) => (
          <div className={`timelineItem ${running && index === activeStepIndex ? "active" : "done"}`} key={step}>
            <span className="timelineDot" />
            <div className="timelineContent">
              <div className="timelineTitle">
                <strong>{step}</strong>
                {running && index === activeStepIndex ? <span>进行中</span> : null}
              </div>
            </div>
            {index < steps.length - 1 ? <span className="timelineLine" /> : null}
          </div>
        ))}
      </div>
    </article>
  );
}
