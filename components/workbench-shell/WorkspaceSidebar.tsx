"use client";

import { BadgeDollarSign, Check, ChevronRight, ChevronUp, Eye, FileText, Folder, LogOut, MoreHorizontal, Orbit, PanelRight, Pin, PinOff, Plus, Search, Settings, Trash2, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { workspacePinCatalog, workspaceProjects } from "../../lib/workbench/mockWorkspace";
import type { PinItem } from "../../lib/workbench/shellTypes";
import type { WorkbenchProject, WorkbenchRoute, WorkbenchTask } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

type Props = {
  collapsed: boolean;
  activeRoute: WorkbenchRoute;
  activeTaskId: string | null;
  currentProject: string | null;
  projects: WorkbenchProject[];
  runtimeTasks: WorkbenchTask[];
  pinnedItemIds: string[];
  deletedProjectIds: string[];
  deletedTaskIds: string[];
  renamedTaskTitles: Record<string, string>;
  onCreateProject: (name: string) => WorkbenchProject | null;
  onRenameProject: (projectId: string, name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameTask: (taskId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  onTogglePinnedItem: (id: string) => void;
  onRouteChange: (route: Exclude<WorkbenchRoute, "module">) => void;
  onStartTask: (project?: string | null) => void;
  onOpenTask: (task: WorkbenchTask) => void;
  onOpenQuotationManagement: () => void;
  onToggleCollapsed: () => void;
};

export function WorkspaceSidebar(props: Props) {
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({ "project-xx": true, "project-yy": true, "project-zz": false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRef = useDismissableLayer<HTMLDivElement>(accountMenuOpen, () => setAccountMenuOpen(false));
  const activeProject = props.activeTaskId ? props.currentProject : null;
  const visibleProjects = props.projects.filter((project) => !props.deletedProjectIds.includes(project.id));
  const originalProjectNameById = new Map(workspaceProjects.map((project) => [project.id, project.name]));
  const currentProjectNameByOriginal = new Map(visibleProjects.map((project) => [originalProjectNameById.get(project.id) ?? project.name, project.name]));
  const projectNameById = new Map(visibleProjects.map((project) => [project.id, project.name]));
  const runtimePinItems: PinItem[] = props.runtimeTasks.map((task) => ({ ...task, type: "task" }));
  const staticTaskItems = workspacePinCatalog.filter((item) => item.type === "task").map((item) => ({
    ...item,
    title: props.renamedTaskTitles[item.id] ?? item.title,
    project: currentProjectNameByOriginal.get(item.project ?? "") ?? item.project,
  }));
  const catalog: PinItem[] = [...runtimePinItems, ...staticTaskItems].filter((item) => (
    !props.deletedTaskIds.includes(item.id)
    && visibleProjects.some((project) => project.name === item.project)
  ));
  const pinnedItems = props.pinnedItemIds.map((id) => catalog.find((item) => item.id === id)).filter((item): item is PinItem => Boolean(item));

  const startTask = (project?: string | null) => {
    setNewTaskOpen(false);
    props.onStartTask(project);
  };
  const commitProject = () => {
    const created = props.onCreateProject(projectDraft);
    if (!created) return;
    setOpenProjects((current) => ({ ...current, [created.id]: true }));
    setProjectDraft("");
    setProjectCreateOpen(false);
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo/bioaz-logo.svg" alt="" />
        <span>BioAZ</span>
        <button className="sidebarCollapseButton" type="button" onClick={props.onToggleCollapsed} aria-label={props.collapsed ? "展开侧边栏" : "折叠侧边栏"}><PanelRight size={17} /></button>
      </div>

      <div className="sidebarActions">
        {searchOpen ? (
          <div className="sidebarSearch">
            <Search size={15} />
            <input autoFocus placeholder="搜索任务、项目" />
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="关闭搜索"><X size={14} /></button>
          </div>
        ) : (
          <>
            <div className="newChatWrap" onMouseEnter={() => setNewTaskOpen(true)} onMouseLeave={() => setNewTaskOpen(false)}>
              <button className={`newChat ${props.activeRoute === "newTask" ? "active" : ""}`} type="button" aria-expanded={newTaskOpen} title={activeProject ? `在 ${activeProject} 中新建任务` : "新建任务"} onFocus={() => setNewTaskOpen(true)} onClick={() => startTask()}>
                <span>+</span>新建任务
              </button>
              {newTaskOpen ? (
                <>
                  <span className="newChatHoverBridge" aria-hidden="true" />
                  <div className="newChatMenu isOpen">
                    <span className="newChatMenuLabel">挂靠到</span>
                    {visibleProjects.map((project) => (
                      <button type="button" key={project.id} onClick={() => startTask(project.name)}>
                        <Folder size={16} />{project.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <button className="sidebarSearchButton" type="button" onClick={() => setSearchOpen(true)} aria-label="搜索"><Search size={17} /></button>
          </>
        )}
      </div>

      <nav className="navBlock workspaceViews" aria-label="工作区">
        <button className={`workspaceViewRow ${props.activeRoute === "library" ? "active" : ""}`} type="button" onClick={() => props.onRouteChange("library")}><Orbit size={15} strokeWidth={1.8} /><span>数据中枢</span></button>
        <button className={`workspaceViewRow ${props.activeRoute === "digitalTeam" ? "active" : ""}`} type="button" onClick={() => props.onRouteChange("digitalTeam")}><Users size={15} strokeWidth={1.8} /><span>数字团队</span></button>
      </nav>

      {pinnedItems.length ? (
        <section className="navBlock pinnedBlock" aria-label="置顶">
          <p>置顶</p>
          {pinnedItems.map((item) => (
            <SidebarTask
              key={item.id}
              item={item}
              active={props.activeTaskId === item.id}
              pinned
              onClick={() => props.onOpenTask(toTask(item))}
              onRename={(title) => props.onRenameTask(item.id, title)}
              onDelete={() => props.onDeleteTask(item.id)}
              onPinToggle={() => props.onTogglePinnedItem(item.id)}
            />
          ))}
        </section>
      ) : null}

      <nav className="navBlock projectTree" aria-label="项目">
        <div className="navSectionHeader">
          <span>项目</span>
          <button type="button" aria-label="新建项目" title="新建项目" onClick={() => setProjectCreateOpen(true)}><Plus size={14} /></button>
        </div>
        {projectCreateOpen ? (
          <div className="projectCreateRow">
            <Folder size={14} />
            <input autoFocus value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") commitProject(); if (event.key === "Escape") { setProjectCreateOpen(false); setProjectDraft(""); } }} placeholder="项目名称" aria-label="项目名称" />
            <button type="button" disabled={!projectDraft.trim()} onClick={commitProject} aria-label="确认新建项目"><Check size={14} /></button>
            <button type="button" onClick={() => { setProjectCreateOpen(false); setProjectDraft(""); }} aria-label="取消"><X size={13} /></button>
          </div>
        ) : null}
        {visibleProjects.map((project) => (
          <SidebarProject
            key={project.id}
            title={project.name}
            open={Boolean(openProjects[project.id])}
            onToggle={() => setOpenProjects((current) => ({ ...current, [project.id]: !current[project.id] }))}
            onRename={(name) => props.onRenameProject(project.id, name)}
            onStartTask={() => startTask(projectNameById.get(project.id) ?? project.name)}
            onDelete={() => props.onDeleteProject(project.id)}
          >
            {catalog.filter((item) => item.project === project.name).map((item) => (
              <SidebarTask
                key={item.id}
                item={item}
                active={props.activeTaskId === item.id}
                pinned={props.pinnedItemIds.includes(item.id)}
                onPinToggle={() => props.onTogglePinnedItem(item.id)}
                onClick={() => props.onOpenTask(toTask(item))}
                onRename={(title) => props.onRenameTask(item.id, title)}
                onDelete={() => props.onDeleteTask(item.id)}
              />
            ))}
          </SidebarProject>
        ))}
      </nav>

      <div ref={accountRef} className={`account accountMenuTrigger ${accountMenuOpen ? "menuOpen" : ""}`}>
        <button type="button" onClick={() => setAccountMenuOpen((value) => !value)} aria-expanded={accountMenuOpen}>
          <span className="avatar">A</span>
          <span><strong>Admin</strong><small>admin@example.com</small></span>
          <ChevronUp size={15} />
        </button>
        {accountMenuOpen ? (
          <div className="accountMenu">
            <div><span className="avatar">A</span><span><strong>Admin</strong><small>admin@example.com</small></span></div>
            <button type="button"><Settings size={15} />账户设置</button>
            <button className="quotationManagementEntry" type="button" onClick={() => { setAccountMenuOpen(false); props.onOpenQuotationManagement(); }}><BadgeDollarSign size={15} />报价管理</button>
            <button type="button"><LogOut size={15} />退出登录</button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function toTask(item: PinItem): WorkbenchTask {
  return {
    id: item.id,
    title: item.title,
    project: item.project ?? "",
    moduleId: item.moduleId ?? "dmpk-quotation",
    coworkerId: item.coworkerId ?? "dmpk-quotation-coworker",
    coworkerName: item.coworkerName ?? "DMPK报价同事",
    time: item.time ?? "",
    status: item.status ?? "",
  };
}

function SidebarProject({ title, open, onToggle, onRename, onStartTask, onDelete, children }: { title: string; open: boolean; onToggle: () => void; onRename: (name: string) => void; onStartTask: () => void; onDelete: () => void; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const ref = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const commit = () => {
    const next = draft.trim();
    if (next && next !== title) onRename(next);
    setEditing(false);
  };
  return (
    <div className="projectGroup">
      <div ref={ref} className={`projectRowWrap ${menuOpen ? "menuOpen" : ""}`} onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
        {editing ? (
          <div className="projectCreateRow sidebarInlineEditor">
            <Folder size={14} />
            <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); if (event.key === "Escape") { setDraft(title); setEditing(false); } }} aria-label="项目名称" />
          </div>
        ) : (
          <>
            <button className="projectRow" type="button" onClick={onToggle}>
              <Folder size={15} strokeWidth={1.8} />
              <strong>{title}</strong>
              <ChevronRight className={open ? "isOpen" : ""} size={14} strokeWidth={1.8} />
            </button>
            <div className="projectHoverActions isActionOnly">
              <button type="button" aria-label={`${title}更多操作`} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }}><MoreHorizontal size={14} /></button>
              {menuOpen ? (
                <div className="sidebarMenu projectMenu">
                  <button type="button" onClick={() => { setDraft(title); setEditing(true); setMenuOpen(false); }}><FileText size={14} />重命名项目</button>
                  <button type="button" onClick={() => { onStartTask(); setMenuOpen(false); }}><Plus size={14} />新建任务</button>
                  <button type="button" onClick={() => { if (window.confirm(`删除项目“${title}”？项目下任务会从当前列表隐藏。`)) onDelete(); setMenuOpen(false); }}><Trash2 size={14} />删除项目</button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
      {open ? <div className="chatTree">{children}</div> : null}
    </div>
  );
}

function SidebarTask({ item, active = false, pinned = false, onClick, onPinToggle, onRename, onDelete }: { item: PinItem; active?: boolean; pinned?: boolean; onClick: () => void; onPinToggle: () => void; onRename: (title: string) => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const ref = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const commit = () => {
    const next = draft.trim();
    if (next && next !== item.title) onRename(next);
    setEditing(false);
  };
  return (
    <div ref={ref} className={`chatRow status-${item.status ?? "done"} ${active ? "active" : ""} ${pinned ? "isPinnedShortcut" : ""} ${menuOpen ? "menuOpen" : ""}`} onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
      {editing ? (
        <div className="projectCreateRow sidebarInlineEditor">
          <FileText size={14} />
          <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); if (event.key === "Escape") { setDraft(item.title); setEditing(false); } }} aria-label="任务名称" />
        </div>
      ) : (
        <>
          <button className="chatRowMain" type="button" onClick={onClick}>
            <FileText className="sidebarIcon" size={15} strokeWidth={1.8} />
            <strong>{item.title}</strong>
            <small>{item.time}</small>
          </button>
          <button className="chatMoreButton" type="button" aria-label={`${item.title}更多操作`} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={14} /></button>
          {menuOpen ? (
            <div className="sidebarMenu chatMenu">
              <button type="button" onClick={() => { onClick(); setMenuOpen(false); }}><Eye size={14} />打开任务</button>
              <button type="button" onClick={() => { setDraft(item.title); setEditing(true); setMenuOpen(false); }}><FileText size={14} />重命名任务</button>
              <button type="button" onClick={() => { onPinToggle(); setMenuOpen(false); }}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}{pinned ? "取消置顶" : "置顶任务"}</button>
              <button type="button" onClick={() => { onDelete(); setMenuOpen(false); }}><Trash2 size={14} />删除任务</button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
