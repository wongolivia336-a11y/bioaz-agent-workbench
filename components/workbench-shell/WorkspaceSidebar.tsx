"use client";

import { BadgeDollarSign, Check, ChevronRight, ChevronUp, Eye, FileText, Folder, Inbox, Library, LogOut, MoreHorizontal, Orbit, PanelRight, Pin, PinOff, Plus, Search, Settings, Trash2, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { inboxAccounts, type InboxAccount } from "../../lib/workbench/mockInbox";
import { workspacePinCatalog, workspaceProjects } from "../../lib/workbench/mockWorkspace";
import type { LibraryFolder, PinItem } from "../../lib/workbench/shellTypes";
import type { ProjectType, WorkbenchProject, WorkbenchRoute, WorkbenchTask } from "../../modules/types";
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
  libraryFolders: LibraryFolder[];
  activeLibraryFolderId: string | null;
  /** 当前打开的资料空间名，用来给侧栏那一行上高亮 */
  activeLibrarySpace: string | null;
  highlightedProjectId: string | null;
  account: InboxAccount;
  inboxCount: number;
  onAccountChange: (accountId: string) => void;
  onOpenLibraryFolder: (project: string, folderId: string | null) => void;
  onCreateProject: (name: string, type: ProjectType) => WorkbenchProject | null;
  onOpenInbox: () => void;
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
  /* null = 没在建。开着的时候直接记类型，因为类型由「你点了哪一组的 +」决定，
     不再有二选一那一步。 */
  const [createType, setCreateType] = useState<ProjectType | null>(null);
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
  const openCreate = (type: ProjectType) => { setCreateType(type); setProjectDraft(""); };
  const commitProject = () => {
    if (!createType) return;
    const created = props.onCreateProject(projectDraft, createType);
    if (!created) return;
    setOpenProjects((current) => ({ ...current, [created.id]: true }));
    setProjectDraft("");
    setCreateType(null);
  };
  const closeProjectCreate = () => { setCreateType(null); setProjectDraft(""); };

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo/bioaz-logo.svg" alt="" />
        <span>BioAZ</span>
        <button className="sidebarCollapseButton" type="button" onClick={props.onToggleCollapsed} aria-label={props.collapsed ? "展开侧边栏" : "折叠侧边栏"}><PanelRight size={16} /></button>
      </div>

      <div className="sidebarActions">
        {searchOpen ? (
          <div className="sidebarSearch">
            <Search size={14} />
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
                    {/* 只列客户委托项目：资料空间没有任务流转，挂过去是条死路 */}
                    {visibleProjects.filter((project) => project.type === "client").map((project) => (
                      <button type="button" key={project.id} onClick={() => startTask(project.name)}>
                        <Folder size={16} />{project.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            {/* 收件箱保持高频图标入口；它现在进入独立邮箱页面。 */}
            <button className="sidebarInboxButton" type="button" onClick={props.onOpenInbox} aria-label={`收件箱，${props.inboxCount} 条待处理`} title={`收件箱 · ${props.inboxCount} 条待处理`}>
              <Inbox size={16} />
              {props.inboxCount ? <i className="sidebarInboxBadge">{props.inboxCount}</i> : null}
            </button>
            <button className="sidebarSearchButton" type="button" onClick={() => setSearchOpen(true)} aria-label="搜索"><Search size={16} /></button>
          </>
        )}
      </div>

      <nav className="navBlock workspaceViews" aria-label="工作区">
        <button className={`workspaceViewRow ${props.activeRoute === "library" ? "active" : ""}`} type="button" onClick={() => props.onRouteChange("library")}><Orbit size={14} /><span>数据中枢</span></button>
        <button className={`workspaceViewRow ${props.activeRoute === "digitalTeam" ? "active" : ""}`} type="button" onClick={() => props.onRouteChange("digitalTeam")}><Users size={14} /><span>数字团队</span></button>
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
          <button type="button" aria-label="新建项目" title="新建项目" onClick={() => openCreate("client")}><Plus size={14} /></button>
        </div>
        {/* 位置已经说明了类型：在「项目」这一行点 +，要建的就是项目。
            原来这里还弹一个「项目 / 资料空间」二选一，是让人回答一个他刚刚
            用点击位置已经回答过的问题。 */}
        {createType === "client" ? <ContainerCreateRow type="client" value={projectDraft} onChange={setProjectDraft} onCommit={commitProject} onCancel={closeProjectCreate} /> : null}
        {visibleProjects.filter((project) => project.type === "client").map((project) => (
          <SidebarProject
            key={project.id}
            title={project.name}
            highlighted={props.highlightedProjectId === project.id}
            open={Boolean(openProjects[project.id])}
            onToggle={() => setOpenProjects((current) => ({ ...current, [project.id]: !current[project.id] }))}
            onRename={(name) => props.onRenameProject(project.id, name)}
            onOpenFiles={() => props.onOpenLibraryFolder(project.name, null)}
            onStartTask={() => startTask(projectNameById.get(project.id) ?? project.name)}
            onDelete={() => props.onDeleteProject(project.id)}
          >
            {props.libraryFolders.filter((folder) => folder.project === project.name && folder.pinned).map((folder) => (
              <button className={`sidebarFolderShortcut ${props.activeLibraryFolderId === folder.id ? "active" : ""}`} type="button" key={folder.id} onClick={() => props.onOpenLibraryFolder(project.name, folder.id)}>
                <Folder size={14} /><span>{folder.name}</span>
              </button>
            ))}
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

      {/* 资料空间独立成组：它跟项目共用实现，但不是项目——混进项目列表就
          又变回"假项目"了，而且往后项目要挂委托方/合同号，它一列都填不上。

          两组的能力必须对等。原来只有「项目」那组能建能改，资料空间只能点开看，
          可它们明明是同一种容器——一个能管一个不能管，层级就说不通了。 */}
      <nav className="navBlock librarySpaceTree" aria-label="资料空间">
        <div className="navSectionHeader">
          <span>资料空间</span>
          <button type="button" aria-label="新建资料空间" title="新建资料空间" onClick={() => openCreate("library")}><Plus size={14} /></button>
        </div>
        {createType === "library" ? <ContainerCreateRow type="library" value={projectDraft} onChange={setProjectDraft} onCommit={commitProject} onCancel={closeProjectCreate} /> : null}
        <div className="librarySpaceScroll">
          {visibleProjects.filter((project) => project.type === "library").map((project) => (
            <SidebarLibrarySpace
              key={project.id}
              title={project.name}
              active={props.activeLibrarySpace === project.name}
              onOpen={() => props.onOpenLibraryFolder(project.name, null)}
              onRename={(name) => props.onRenameProject(project.id, name)}
              onDelete={() => props.onDeleteProject(project.id)}
            />
          ))}
        </div>
      </nav>

      <div ref={accountRef} className={`account accountMenuTrigger ${accountMenuOpen ? "menuOpen" : ""}`}>
        <button type="button" onClick={() => setAccountMenuOpen((value) => !value)} aria-expanded={accountMenuOpen}>
          <span className="avatar">{props.account.name.slice(0, 1)}</span>
          <span><strong>{props.account.name}</strong><small>{props.account.roleLabel} · {props.account.email}</small></span>
          <ChevronUp size={14} />
        </button>
        {accountMenuOpen ? (
          <div className="accountMenu">
            <div><span className="avatar">{props.account.name.slice(0, 1)}</span><span><strong>{props.account.name}</strong><small>{props.account.roleLabel} · {props.account.email}</small></span></div>
            {/* 角色权限本应由登录账号决定，原型里给一个切换器把三个岗位的队列都演示出来 */}
            <p className="accountMenuLabel">切换账号（演示）</p>
            {inboxAccounts.map((item) => (
              <button className={`accountSwitchRow ${item.id === props.account.id ? "isCurrent" : ""}`} type="button" key={item.id} onClick={() => { props.onAccountChange(item.id); setAccountMenuOpen(false); }}>
                <span className="avatar">{item.name.slice(0, 1)}</span>
                <span><strong>{item.name}</strong><small>{item.roleLabel}</small></span>
                {item.id === props.account.id ? <Check size={14} /> : null}
              </button>
            ))}
            <button type="button"><Settings size={14} />账户设置</button>
            <button className="quotationManagementEntry" type="button" onClick={() => { setAccountMenuOpen(false); props.onOpenQuotationManagement(); }}><BadgeDollarSign size={14} />报价管理</button>
            <button type="button"><LogOut size={14} />退出登录</button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/** 两组共用的新建行。类型由调用位置传进来，行内不再问一次。 */
function ContainerCreateRow({ type, value, onChange, onCommit, onCancel }: { type: ProjectType; value: string; onChange: (value: string) => void; onCommit: () => void; onCancel: () => void }) {
  return (
    <div className="projectCreateRow">
      {type === "client" ? <Folder size={14} /> : <Library size={14} />}
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") onCommit(); if (event.key === "Escape") onCancel(); }}
        placeholder={type === "client" ? "项目名称" : "资料空间名称"}
        aria-label={type === "client" ? "项目名称" : "资料空间名称"}
      />
      <button type="button" disabled={!value.trim()} onClick={onCommit} aria-label="确认新建"><Check size={14} /></button>
      <button type="button" onClick={onCancel} aria-label="取消"><X size={12} /></button>
    </div>
  );
}

/** 资料空间一行。跟项目行一样能重命名、能删——两组能力对等，层级才立得住。 */
function SidebarLibrarySpace({ title, active, onOpen, onRename, onDelete }: { title: string; active: boolean; onOpen: () => void; onRename: (name: string) => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const ref = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const commit = () => {
    const next = draft.trim();
    if (next && next !== title) onRename(next);
    setEditing(false);
  };
  if (editing) {
    return (
      <div className="projectCreateRow sidebarInlineEditor">
        <Library size={14} />
        <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); if (event.key === "Escape") { setDraft(title); setEditing(false); } }} aria-label="资料空间名称" />
      </div>
    );
  }
  return (
    <div ref={ref} className={`librarySpaceRowWrap ${menuOpen ? "menuOpen" : ""}`} onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
      <button className={`sidebarFolderShortcut librarySpaceRow ${active ? "active" : ""}`} type="button" onClick={onOpen}>
        <Library size={14} /><span>{title}</span>
      </button>
      <button className="librarySpaceMoreButton" type="button" aria-label={`${title}更多操作`} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={14} /></button>
      {menuOpen ? (
        <div className="sidebarMenu chatMenu">
          <button type="button" onClick={() => { onOpen(); setMenuOpen(false); }}><Eye size={14} />打开</button>
          <button type="button" onClick={() => { setDraft(title); setEditing(true); setMenuOpen(false); }}><FileText size={14} />重命名</button>
          <button type="button" onClick={() => { if (window.confirm(`删除资料空间「${title}」？`)) onDelete(); setMenuOpen(false); }}><Trash2 size={14} />删除</button>
        </div>
      ) : null}
    </div>
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

function SidebarProject({ title, highlighted = false, open, onToggle, onRename, onOpenFiles, onStartTask, onDelete, children }: { title: string; highlighted?: boolean; open: boolean; onToggle: () => void; onRename: (name: string) => void; onOpenFiles: () => void; onStartTask: () => void; onDelete: () => void; children: ReactNode }) {
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
      <div ref={ref} className={`projectRowWrap ${menuOpen ? "menuOpen" : ""} ${highlighted ? "justCreated" : ""}`} onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
        {editing ? (
          <div className="projectCreateRow sidebarInlineEditor">
            <Folder size={14} />
            <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); if (event.key === "Escape") { setDraft(title); setEditing(false); } }} aria-label="项目名称" />
          </div>
        ) : (
          <>
            <button className="projectRow" type="button" onClick={onToggle}>
              <Folder size={14} />
              <strong>{title}</strong>
              <ChevronRight className={open ? "isOpen" : ""} size={14} />
            </button>
            <div className="projectHoverActions isActionOnly">
              <button type="button" aria-label={`${title}更多操作`} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }}><MoreHorizontal size={14} /></button>
              {menuOpen ? (
                <div className="sidebarMenu projectMenu">
                  <button type="button" onClick={() => { setDraft(title); setEditing(true); setMenuOpen(false); }}><FileText size={14} />重命名项目</button>
                  <button type="button" onClick={() => { onOpenFiles(); setMenuOpen(false); }}><Folder size={14} />查看项目文件</button>
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
            <FileText className="sidebarIcon" size={14} />
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
