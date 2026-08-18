"use client";

import { useEffect, useState, type ReactNode } from "react";
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
export function ActivityChain({
  title,
  steps,
  running,
  onOpen,
  doneTitle,
  timedOut = false,
  onRetry,
}: {
  title: string;
  steps: string[];
  running: boolean;
  onOpen: (panelId: string) => void;
  /** 跑完之后的标题。传了才可折叠——不传则维持常展开的旧行为。
      「查看过程 / 收起」这类操作提示走 small，不揉进标题里，
      否则展开状态下会读成「已完成…查看过程 · 已完成」。 */
  doneTitle?: string;
  /** 跑批超时。超时不是"失败"——过程仍然留着，只是结论没出来，所以给一颗重试 */
  timedOut?: boolean;
  onRetry?: () => void;
}) {
  const activeStepIndex = steps.length - 1;
  const collapsible = Boolean(doneTitle) && !running;
  /* 跑完就收起：过程是给"正在等"的人看的，等完了它就该让位给结论。
     用户想回看再点开——这条链留在时间线上，不像以前那样整个消失。 */
  const [expanded, setExpanded] = useState(running);
  useEffect(() => { setExpanded(running); }, [running]);

  const showTimeline = running || !collapsible || expanded;

  return (
    <article
      className={`agentRun ${running ? "running" : "settled"} ${collapsible && !expanded ? "collapsed" : ""}`}
      data-minimap="activity"
      data-minimap-label={title}
    >
      <button
        className="runHeader"
        type="button"
        aria-expanded={collapsible ? expanded : undefined}
        onClick={() => (collapsible ? setExpanded((value) => !value) : onOpen("process"))}
      >
        <span className={`motionLogo ${running ? "running" : ""}`} data-step={running ? activeStepIndex : undefined}>
          <img src="/logo/bioaz-logo.svg" alt="" />
          <span key={running ? activeStepIndex : "settled"} />
        </span>
        <strong>{running ? title : doneTitle ?? title}</strong>
        <small>{running ? "处理中" : timedOut ? "已超时" : collapsible ? (expanded ? "收起" : "查看过程") : "已完成"}</small>
      </button>

      {showTimeline ? (
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
      ) : null}

      {/* 超时态：说清楚"跑到哪儿停的"，并给一条出路。不给出路的超时提示等于死路 */}
      {timedOut && showTimeline ? (
        <p className="agentRunTimeout">
          AI 审核超时，结论没能生成。
          {onRetry ? <button type="button" onClick={onRetry}>重新检查</button> : null}
        </p>
      ) : null}
    </article>
  );
}
