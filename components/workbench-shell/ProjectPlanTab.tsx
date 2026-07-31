"use client";

import { Bot, Check, Columns3, Filter, LayoutList, Plus, Users } from "lucide-react";
import { InlineSelect } from "./InlineSelect";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  deliverableKindLabel,
  initialPlanItems,
  planPriorityLabel,
  planPriorityOrder,
  planStages,
  planStatusLabel,
  planStatusOrder,
  projectMembers,
  type Deliverable,
  type PlanItem,
  type PlanPriority,
  type PlanStatus,
} from "../../lib/workbench/projectPlanData";
import { useDismissableLayer } from "./useDismissableLayer";

type ViewMode = "list" | "board";

const memberById = new Map(projectMembers.map((member) => [member.id, member]));

export function ProjectPlanTab({ project }: { project: string }) {
  const [items, setItems] = useState<PlanItem[]>(initialPlanItems);
  const [view, setView] = useState<ViewMode>("list");
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PlanPriority | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => { setHost(document.getElementById("workbench-topbar-actions")); }, []);

  const update = (id: string, patch: Partial<PlanItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const visible = items.filter((item) => (
    (!assigneeFilter || item.assigneeId === assigneeFilter)
    && (!priorityFilter || item.priority === priorityFilter)
  ));

  return (
    <section className="projectTabPanel projectPlanPanel">
      {host ? createPortal(
        <div className="libraryToolLayer">
          <div className="tabViewSwitch" role="tablist" aria-label="计划视图">
            <button className={view === "list" ? "active" : ""} type="button" role="tab" aria-selected={view === "list"} onClick={() => setView("list")}>
              <LayoutList size={14} />列表
            </button>
            <button className={view === "board" ? "active" : ""} type="button" role="tab" aria-selected={view === "board"} onClick={() => setView("board")}>
              <Columns3 size={14} />看板
            </button>
          </div>
          <ToolMenu icon={<Users size={16} />} label="负责人" active={Boolean(assigneeFilter)}>
            <MenuItem active={!assigneeFilter} onSelect={() => setAssigneeFilter(null)}>全部负责人</MenuItem>
            {projectMembers.map((member) => (
              <MenuItem key={member.id} active={assigneeFilter === member.id} onSelect={() => setAssigneeFilter(member.id)}>{member.name}</MenuItem>
            ))}
          </ToolMenu>
          <ToolMenu icon={<Filter size={16} />} label="优先级" active={Boolean(priorityFilter)}>
            <MenuItem active={!priorityFilter} onSelect={() => setPriorityFilter(null)}>全部优先级</MenuItem>
            {planPriorityOrder.map((priority) => (
              <MenuItem key={priority} active={priorityFilter === priority} onSelect={() => setPriorityFilter(priority)}>{planPriorityLabel[priority]}</MenuItem>
            ))}
          </ToolMenu>
          <button className="primaryButton compact" type="button"><Plus size={15} />新建工作项</button>
        </div>,
        host,
      ) : null}

      {(assigneeFilter || priorityFilter) ? (
        <div className="filterChips">
          {assigneeFilter ? <span className="filterChip">负责人：{memberById.get(assigneeFilter)?.name}<button type="button" onClick={() => setAssigneeFilter(null)} aria-label="清除负责人筛选">×</button></span> : null}
          {priorityFilter ? <span className="filterChip">优先级：{planPriorityLabel[priorityFilter]}<button type="button" onClick={() => setPriorityFilter(null)} aria-label="清除优先级筛选">×</button></span> : null}
          <button className="clearAllChips" type="button" onClick={() => { setAssigneeFilter(null); setPriorityFilter(null); }}>清除全部</button>
        </div>
      ) : null}

      {view === "list"
        ? <PlanList items={visible} onUpdate={update} />
        : <PlanBoard items={visible} onUpdate={update} />}

      {!visible.length ? (
        <div className="projectTabEmptyState">
          <strong>没有匹配的工作项</strong>
          <span>试试清除筛选条件，或新建一个工作项。</span>
        </div>
      ) : null}
    </section>
  );
}

function PlanList({ items, onUpdate }: { items: PlanItem[]; onUpdate: (id: string, patch: Partial<PlanItem>) => void }) {
  if (!items.length) return null;
  return (
    <div className="planList">
      {planStages.map((stage) => {
        const rows = items.filter((item) => item.stageId === stage.id);
        if (!rows.length) return null;
        const shipped = stage.deliverables.filter((item) => item.status === "done").length;
        return (
          <section className="planStageGroup" key={stage.id}>
            <header className="planStageHeader">
              <div className="planStageHeading">
                <strong>{stage.name}</strong>
                <small>{stage.goal}</small>
              </div>
              <span className="planStageWindow">{stage.window}</span>
              <span className="planStageCount">交付 {shipped}/{stage.deliverables.length}</span>
            </header>
            <div className="planDeliverables">
              {stage.deliverables.map((item) => <DeliverableChip key={item.id} deliverable={item} />)}
            </div>
            <div className="planTable">
              {rows.map((item) => (
                <article className="planRow" key={item.id}>
                  <StatusSelect value={item.status} onChange={(status) => onUpdate(item.id, { status })} />
                  <span className="planRowTitle">{item.title}</span>
                  <PrioritySelect value={item.priority} onChange={(priority) => onUpdate(item.id, { priority })} />
                  <AssigneeSelect value={item.assigneeId} onChange={(assigneeId) => onUpdate(item.id, { assigneeId })} />
                  <span className="planRowDue">{item.due}</span>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DeliverableChip({ deliverable }: { deliverable: Deliverable }) {
  const owner = memberById.get(deliverable.ownerId);
  return (
    <span className="planDeliverable" title={`${deliverableKindLabel[deliverable.kind]} · ${owner?.name ?? ""}`}>
      <StatusDot status={deliverable.status} />
      <strong>{deliverable.name}</strong>
      <small>{deliverableKindLabel[deliverable.kind]}</small>
    </span>
  );
}

function PlanBoard({ items, onUpdate }: { items: PlanItem[]; onUpdate: (id: string, patch: Partial<PlanItem>) => void }) {
  return (
    <div className="planBoard">
      {planStatusOrder.map((status) => {
        const column = items.filter((item) => item.status === status);
        return (
          <section className="planBoardColumn" key={status}>
            <header>
              <StatusDot status={status} />
              <strong>{planStatusLabel[status]}</strong>
              <b>{column.length}</b>
            </header>
            <div className="planBoardCards">
              {column.map((item) => (
                <article className="planBoardCard" key={item.id}>
                  <strong>{item.title}</strong>
                  <small className="planCardStage">{planStages.find((stage) => stage.id === item.stageId)?.name ?? ""}</small>
                  <div className="planCardMeta">
                    <PrioritySelect value={item.priority} onChange={(priority) => onUpdate(item.id, { priority })} />
                    <AssigneeSelect value={item.assigneeId} onChange={(assigneeId) => onUpdate(item.id, { assigneeId })} compact />
                    <span className="planRowDue">{item.due}</span>
                  </div>
                </article>
              ))}
              {!column.length ? <div className="planBoardEmpty">暂无事项</div> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatusDot({ status }: { status: PlanStatus }) {
  return <i className={`planStatusDot is-${status}`} aria-hidden="true" />;
}

function StatusSelect({ value, onChange }: { value: PlanStatus; onChange: (value: PlanStatus) => void }) {
  return (
    <InlineSelect
      label="状态"
      trigger={<><StatusDot status={value} /><span>{planStatusLabel[value]}</span></>}
      triggerClassName={`planStatusTrigger is-${value}`}
    >
      {(close) => planStatusOrder.map((status) => (
        <button className={`toolMenuItem ${status === value ? "active" : ""}`} type="button" key={status} onClick={() => { onChange(status); close(); }}>
          <span><StatusDot status={status} />{planStatusLabel[status]}</span>
          {status === value ? <Check size={13} /> : null}
        </button>
      ))}
    </InlineSelect>
  );
}

function PrioritySelect({ value, onChange }: { value: PlanPriority; onChange: (value: PlanPriority) => void }) {
  return (
    <InlineSelect
      label="优先级"
      trigger={<span>{planPriorityLabel[value]}</span>}
      triggerClassName={`planPriorityTrigger is-${value}`}
    >
      {(close) => planPriorityOrder.map((priority) => (
        <button className={`toolMenuItem ${priority === value ? "active" : ""}`} type="button" key={priority} onClick={() => { onChange(priority); close(); }}>
          <span>{planPriorityLabel[priority]}</span>
          {priority === value ? <Check size={13} /> : null}
        </button>
      ))}
    </InlineSelect>
  );
}

function AssigneeSelect({ value, onChange, compact }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  const member = memberById.get(value);
  return (
    <InlineSelect
      label="负责人"
      trigger={<>
        <span className={`planAvatar ${member?.kind === "agent" ? "isAgent" : ""}`}>{member?.kind === "agent" ? <Bot size={11} /> : member?.name.slice(0, 1)}</span>
        {compact ? null : <span>{member?.name ?? "未指派"}</span>}
      </>}
      triggerClassName="planAssigneeTrigger"
    >
      {(close) => projectMembers.map((item) => (
        <button className={`toolMenuItem ${item.id === value ? "active" : ""}`} type="button" key={item.id} onClick={() => { onChange(item.id); close(); }}>
          <span>
            <span className={`planAvatar ${item.kind === "agent" ? "isAgent" : ""}`}>{item.kind === "agent" ? <Bot size={11} /> : item.name.slice(0, 1)}</span>
            {item.name}
          </span>
          {item.id === value ? <Check size={13} /> : null}
        </button>
      ))}
    </InlineSelect>
  );
}

function ToolMenu({ icon, label, active, children }: { icon: ReactNode; label: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="toolMenuWrap">
      <button className={`toolIconButton ${active ? "active" : ""}`} type="button" title={label} aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{icon}</button>
      {open ? <div className="toolMenu" onClick={() => setOpen(false)}>{children}</div> : null}
    </div>
  );
}

function MenuItem({ active, onSelect, children }: { active: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button className={`toolMenuItem ${active ? "active" : ""}`} type="button" onClick={onSelect}>
      <span>{children}</span>{active ? <Check size={13} /> : null}
    </button>
  );
}
