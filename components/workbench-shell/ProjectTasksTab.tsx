"use client";

import { Bot, Columns3, LayoutList, MessageSquare, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import type { TaskPriority, WorkbenchTask } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

type HighLevelStatus = "notStarted" | "running" | "awaitingReview" | "done" | "blocked";
type ViewMode = "table" | "board";

const statusLabel: Record<HighLevelStatus, string> = {
  notStarted: "未开始",
  running: "处理中",
  awaitingReview: "待审核",
  done: "已完成",
  blocked: "阻塞中",
};

// 看板列顺序：按任务实际推进方向排列，阻塞放最后便于集中处理
const boardOrder: HighLevelStatus[] = ["notStarted", "running", "awaitingReview", "done", "blocked"];

const priorityLabel: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
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
  const [view, setView] = useState<ViewMode>("table");

  return (
    <section className="projectTabPanel projectTasksPanel">
      <div className="projectTaskToolbar">
        <div className="taskViewSwitch" role="tablist" aria-label="任务视图">
          <button className={view === "table" ? "active" : ""} type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")}>
            <LayoutList size={14} />表格
          </button>
          <button className={view === "board" ? "active" : ""} type="button" role="tab" aria-selected={view === "board"} onClick={() => setView("board")}>
            <Columns3 size={14} />看板
          </button>
        </div>
        <span className="projectTaskCount">{project} · {tasks.length} 项任务</span>
      </div>

      {!tasks.length ? (
        <div className="projectTabEmptyState">
          <strong>暂无任务</strong>
          <span>在该项目下发起任务后会显示在这里。</span>
        </div>
      ) : view === "table" ? (
        <TaskTable tasks={tasks} onOpenTask={onOpenTask} />
      ) : (
        <TaskBoard tasks={tasks} onOpenTask={onOpenTask} />
      )}
    </section>
  );
}

function TaskTable({ tasks, onOpenTask }: { tasks: WorkbenchTask[]; onOpenTask: (task: WorkbenchTask) => void }) {
  return (
    <div className="taskTable" role="table">
      <div className="taskTableHeader" role="row">
        <span>标题</span>
        <span>状态</span>
        <span>处理人</span>
        <span>优先级</span>
        <span>更新时间</span>
        <span />
      </div>
      {tasks.map((task) => <TaskTableRow key={task.id} task={task} onEnter={() => onOpenTask(task)} />)}
    </div>
  );
}

function TaskTableRow({ task, onEnter }: { task: WorkbenchTask; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLElement>(open, () => setOpen(false));
  const status = toHighLevelStatus(task.status);
  return (
    <article ref={ref} className={`taskTableRow ${open ? "menuOpen" : ""}`} role="row" onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}>
      <button className="taskTableTitle" type="button" onClick={onEnter}>{task.title}</button>
      <span><em className={`taskStatusChip status-${status}`}><i className="taskStatusDot" aria-hidden="true" />{statusLabel[status]}</em></span>
      <span className="taskAssignee"><span className="taskAssigneeMark"><Bot size={12} /></span>{task.coworkerName}</span>
      <span>{task.priority ? <em className={`taskPriorityChip priority-${task.priority}`}>{priorityLabel[task.priority]}</em> : <small className="taskFieldEmpty">—</small>}</span>
      <span className="taskTime">{task.time}</span>
      <div className="taskRowActions">
        <button className="rowMoreButton" type="button" aria-label={`${task.title}更多操作`} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={15} /></button>
      </div>
      {open ? (
        <div className="rowActionMenu">
          <button type="button" onClick={() => { onEnter(); setOpen(false); }}><MessageSquare size={14} />进入会话</button>
        </div>
      ) : null}
    </article>
  );
}

function TaskBoard({ tasks, onOpenTask }: { tasks: WorkbenchTask[]; onOpenTask: (task: WorkbenchTask) => void }) {
  return (
    <div className="taskBoard">
      {boardOrder.map((status) => {
        const column = tasks.filter((task) => toHighLevelStatus(task.status) === status);
        return (
          <section className="taskBoardColumn" key={status}>
            <header>
              <em className={`taskStatusChip status-${status}`}><i className="taskStatusDot" aria-hidden="true" />{statusLabel[status]}</em>
              <b>{column.length}</b>
              <button type="button" aria-label={`在${statusLabel[status]}中新建任务`}><Plus size={14} /></button>
            </header>
            <div className="taskBoardCards">
              {column.map((task) => (
                <button className="taskBoardCard" type="button" key={task.id} onClick={() => onOpenTask(task)}>
                  <strong>{task.title}</strong>
                  <div className="taskBoardCardMeta">
                    {task.priority ? <em className={`taskPriorityChip priority-${task.priority}`}>{priorityLabel[task.priority]}</em> : null}
                    <span className="taskAssigneeMark"><Bot size={12} /></span>
                    <small>{task.time}</small>
                  </div>
                </button>
              ))}
              {!column.length ? <div className="taskBoardEmpty">暂无事项</div> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
