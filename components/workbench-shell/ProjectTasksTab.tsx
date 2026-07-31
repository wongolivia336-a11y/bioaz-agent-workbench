"use client";

import { FileText, MessageSquare, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { WorkbenchTask } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

type HighLevelStatus = "notStarted" | "running" | "awaitingReview" | "done" | "blocked";

const statusLabel: Record<HighLevelStatus, string> = {
  notStarted: "未开始",
  running: "处理中",
  awaitingReview: "待审核",
  done: "已完成",
  blocked: "阻塞中",
};

// 项目中枢只展示高层状态；执行/审阅/放行三类细分状态仅在肿瘤报告审核流程内部展示。
function toHighLevelStatus(status: string): HighLevelStatus {
  if (/blocked|阻塞|失败|驳回/.test(status)) return "blocked";
  if (/done|完成|交付/.test(status)) return "done";
  if (/pending|待确认|待审核|审阅/.test(status)) return "awaitingReview";
  if (/running|处理中|进行中/.test(status)) return "running";
  return "notStarted";
}

export function ProjectTasksTab({ project, tasks, onOpenTask }: { project: string; tasks: WorkbenchTask[]; onOpenTask: (task: WorkbenchTask) => void }) {
  return (
    <section className="projectTabPanel projectTasksPanel">
      <div className="projectTabIntro">
        <strong>项目任务</strong>
        <span>{project} 下的全部任务 · {tasks.length} 项</span>
      </div>
      <div className="workbenchTaskList projectTaskList">
        {tasks.map((task) => <ProjectTaskRow key={task.id} task={task} onEnter={() => onOpenTask(task)} />)}
        {!tasks.length ? (
          <div className="projectTabEmptyState">
            <strong>暂无任务</strong>
            <span>在该项目下发起任务后会显示在这里。</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProjectTaskRow({ task, onEnter }: { task: WorkbenchTask; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLElement>(open, () => setOpen(false));
  const status = toHighLevelStatus(task.status);
  return (
    <article ref={ref} className="workbenchTaskCard projectTaskCard" onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}>
      <button className="taskRowMain" type="button" onClick={onEnter}>
        <FileText size={16} strokeWidth={1.8} />
        <span><strong>{task.title}</strong><small>{task.coworkerName} · {task.time}</small></span>
      </button>
      <em className={`projectTaskStatus status-${status}`}>{statusLabel[status]}</em>
      <button className="rowMoreButton" type="button" aria-label={`${task.title}更多操作`} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={15} /></button>
      {open ? (
        <div className="rowActionMenu">
          <button type="button" onClick={() => { onEnter(); setOpen(false); }}><MessageSquare size={14} />进入会话</button>
        </div>
      ) : null}
    </article>
  );
}
