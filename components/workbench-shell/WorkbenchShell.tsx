"use client";

import { ChevronRight, Menu } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coworkerRegistry, getAgentModule, getModuleForCoworker, quickStartRegistry, resolveModuleIntent } from "../../modules/registry";
import type { AgentModuleDefinition, AgentSessionSnapshot, ModuleRunStatus, WorkbenchRoute, WorkbenchTask } from "../../modules/types";
import { FileManager } from "./FileManager";
import { NewTaskHome } from "./NewTaskHome";
import { TaskList } from "./TaskList";
import { TicketsPage } from "./TicketsPage";
import { TicketHandoffDialog, type HandoffPayload } from "./TicketHandoffDialog";
import { initialTickets, type Ticket } from "../../lib/workbench/ticketData";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { DigitalTeamPage } from "./DigitalTeamPage";
import { KnowledgeBasePage } from "../knowledge-base/KnowledgeBasePage";
import { inboxAccounts } from "../../lib/workbench/mockInbox";
import { seededUnreadTaskIds, workspacePinCatalog, workspaceProjects } from "../../lib/workbench/mockWorkspace";
import type { LibraryFolder, LibraryView } from "../../lib/workbench/shellTypes";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { ProjectType, QuotationManagementTarget, SessionHandoff, SessionOutcome, WorkbenchProject } from "../../modules/types";
import { QuotationManagement } from "../../modules/quotation-management";

export default function WorkbenchShell() {
  // Start closed so narrow viewports never paint the desktop sidebar before
  // hydration. The viewport effect below restores the expanded desktop state.
  const [collapsed, setCollapsed] = useState(true);
  const [route, setRoute] = useState<WorkbenchRoute>("newTask");
  const [project, setProject] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("新建任务");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<AgentModuleDefinition | null>(null);
  const [activeCoworkerId, setActiveCoworkerId] = useState(coworkerRegistry[0]?.id ?? "");
  const [initialRequest, setInitialRequest] = useState<string | undefined>();
  /* 只在 initialRequest 有值时才会被渲染，所以不必跟着每一处 setInitialRequest(undefined)
     一起清；但凡是给 initialRequest 赋新值的地方都必须同时给它赋值，否则上一封邮件的
     附件会挂到下一条不相干的首轮请求上。 */
  const [initialAttachments, setInitialAttachments] = useState<ComposerAttachment[] | undefined>();
  const [text, setText] = useState("");
  const [clarification, setClarification] = useState<{ request: string; question: string } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [pendingModule, setPendingModule] = useState<AgentModuleDefinition | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | undefined>();
  const [pinnedItemIds, setPinnedItemIds] = useState<string[]>([]);
  const [runtimeTasks, setRuntimeTasks] = useState<WorkbenchTask[]>([]);
  /* 未读 = agent 在你不在场的时候把活干完了。运行时靠真实的状态翻转产生
     （见下面那个 effect），初值种一条，好让侧栏一打开就能同时看见两种点。 */
  const [unreadTaskIds, setUnreadTaskIds] = useState<string[]>(seededUnreadTaskIds);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [projects, setProjects] = useState<WorkbenchProject[]>(workspaceProjects);
  const [deletedProjectIds, setDeletedProjectIds] = useState<string[]>([]);
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
  const [renamedTaskTitles, setRenamedTaskTitles] = useState<Record<string, string>>({});
  const [libraryProject, setLibraryProject] = useState<string | null>(null);
  const [libraryFolderId, setLibraryFolderId] = useState<string | null>(null);
  const [libraryFolders] = useState<LibraryFolder[]>([]);
  const [libraryView, setLibraryView] = useState<LibraryView>("overview");
  const [accountId, setAccountId] = useState(inboxAccounts[1].id);
  const [helperConversationStarted, setHelperConversationStarted] = useState(false);
  const [, setModuleRunStatus] = useState<ModuleRunStatus>("active");
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, AgentSessionSnapshot[]>>({});
  /* 会话结论按任务存。module 会随路由重挂载，结论放在它里面等于切走就没了。 */
  const [sessionOutcomes, setSessionOutcomes] = useState<Record<string, SessionOutcome>>({});
  /* null = 没开。开的时候带上落点，这样从报价会话过去能直接停在规则页并带着草稿，
     不用把参数塞进 URL 再整页刷新。 */
  const [quotationTarget, setQuotationTarget] = useState<QuotationManagementTarget | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);

  const quickStarts = useMemo(() => quickStartRegistry.map((item) => { const Icon = item.icon; return { id: item.id, label: item.label, prompt: item.prompt, availability: item.availability, icon: <Icon size={16} /> }; }), []);
  const suggestedCoworker = pendingModule?.suggestedCoworker ?? null;

  const createRuntimeTask = (title: string, module: AgentModuleDefinition | null, projectOverride?: string | null) => {
    const taskProject = projectOverride === undefined ? project : projectOverride;
    if (!taskProject) {
      setProjectNotice("请先选择任务所属项目，再开始任务。");
      return null;
    }
    const taskId = `task-runtime-${Date.now()}`;
    const coworker = module?.suggestedCoworker ?? coworkerRegistry[0];
    const task: WorkbenchTask = {
      id: taskId,
      title,
      project: taskProject,
      moduleId: module?.moduleId ?? "bioaz-helper",
      coworkerId: coworker?.id ?? "bioaz-helper",
      coworkerName: coworker?.name ?? "BioAZ Helper",
      time: "刚刚",
      status: "running",
    };
    setProject(taskProject);
    setTaskTitle(title);
    setActiveTaskId(taskId);
    setRuntimeTasks((tasks) => [task, ...tasks]);
    return taskId;
  };

  const updateRuntimeTask = (taskId: string, module: AgentModuleDefinition) => {
    setRuntimeTasks((tasks) => tasks.map((task) => task.id === taskId ? {
      ...task,
      moduleId: module.moduleId,
      coworkerId: module.suggestedCoworker.id,
      coworkerName: module.suggestedCoworker.name,
      status: "running",
    } : task));
  };

  const openNewTaskHome = () => {
    setProject(null); setProjectNotice(null); setTaskTitle("新建任务"); setActiveTaskId(null); setActiveModule(null); setActiveCoworkerId("bioaz-helper"); setInitialRequest(undefined); setHandoffNotice(undefined); setText(""); setClarification(null); setPendingRequest(null); setPendingModule(null); setHelperConversationStarted(false); setModuleRunStatus("active"); setRoute("newTask");
  };

  const startTaskInProject = (projectName: string) => {
    const taskId = createRuntimeTask("新建任务", null, projectName);
    if (!taskId) return;
    setProject(projectName); setProjectNotice(null); setTaskTitle("新建任务"); setActiveTaskId(taskId); setActiveModule(null); setActiveCoworkerId("bioaz-helper"); setInitialRequest(undefined); setHandoffNotice(undefined); setText(""); setClarification(null); setPendingRequest(null); setPendingModule(null); setHelperConversationStarted(true); setModuleRunStatus("active"); setRoute("newTask");
  };

  const resetNewTask = (nextProject?: string | null) => {
    if (typeof nextProject === "string" && nextProject) {
      startTaskInProject(nextProject);
      return;
    }
    if (activeTaskId && project) {
      startTaskInProject(project);
      return;
    }
    openNewTaskHome();
  };

  const navigateShellRoute = (nextRoute: Exclude<WorkbenchRoute, "module">) => {
    if (nextRoute === "newTask") {
      resetNewTask();
      return;
    }
    setProject(null);
    setTaskTitle("新建任务");
    setActiveTaskId(null);
    setActiveModule(null);
    setActiveCoworkerId("bioaz-helper");
    setInitialRequest(undefined);
    setHandoffNotice(undefined);
    setText("");
    setClarification(null);
    setPendingRequest(null);
    setPendingModule(null);
    setHelperConversationStarted(false);
    setModuleRunStatus("active");
    if (nextRoute === "library") {
      setLibraryProject(null);
      setLibraryFolderId(null);
      setLibraryView("overview");
    }
    setRoute(nextRoute);
  };

  const submitIntent = () => {
    const next = text.trim(); if (!next) return;
    if (!project) { setProjectNotice("请先选择任务所属项目，再开始任务。"); return; }
    const request = clarification ? `${clarification.request}；补充：${next}` : next;
    if (!activeTaskId) {
      const title = request.length > 20 ? `${request.slice(0, 20)}…` : request;
      createRuntimeTask(title, null);
    }
    setHelperConversationStarted(true);
    setActiveCoworkerId("bioaz-helper");
    const resolution = resolveModuleIntent(request);
    setText("");
    if (!resolution.module) { setClarification({ request, question: resolution.clarification ?? "请再补充一点任务目标。" }); return; }
    setClarification(null); setPendingRequest(request); setPendingModule(resolution.module); setActiveCoworkerId(resolution.module.suggestedCoworker.id);
  };

  const selectPendingCoworker = (coworkerId: string) => { const module = getModuleForCoworker(coworkerId); if (!module) return; setActiveCoworkerId(coworkerId); setPendingModule(module); };
  const confirmDispatch = () => {
    if (!pendingModule || !pendingRequest) return;
    const taskId = activeTaskId ?? createRuntimeTask(taskTitle, pendingModule);
    if (!taskId) return;
    updateRuntimeTask(taskId, pendingModule);
    setActiveModule(pendingModule);
    setActiveCoworkerId(pendingModule.suggestedCoworker.id);
    setInitialRequest(pendingRequest);
    setInitialAttachments(undefined);
    setHandoffNotice(`BioAZ Helper 已将任务分派给 ${pendingModule.suggestedCoworker.name}`);
    setModuleRunStatus("active");
    setPendingModule(null);
    setPendingRequest(null);
    setRoute("module");
  };
  const cancelDispatch = () => { setText(pendingRequest ?? ""); setPendingRequest(null); setPendingModule(null); };

  const startModuleDirect = (moduleId: string) => {
    const module = getAgentModule(moduleId);
    if (!module || module.availability !== "available") return;
    if (!project) { setProjectNotice("请先选择任务所属项目，再启动流程。"); setRoute("newTask"); return; }
    const taskId = createRuntimeTask(`${module.moduleName}任务`, module);
    if (!taskId) return;
    setActiveModule(module);
    setActiveCoworkerId(module.suggestedCoworker.id);
    setInitialRequest(undefined);
    setHandoffNotice(undefined);
    setText("");
    setClarification(null);
    setPendingRequest(null);
    setPendingModule(null);
    setHelperConversationStarted(false);
    setModuleRunStatus("active");
    setRoute("module");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("module");
    const view = params.get("view");
    if (moduleId) startModuleDirect(moduleId);
    if (view === "library") setRoute("library");
    if (view === "digital-team") setRoute("digitalTeam");
    if (view === "quotation-management") {
      const business = params.get("business");
      const deepTab = params.get("tab");
      setQuotationTarget({
        business: business === "dmpk" ? "dmpk" : "root",
        tab: (["prices", "rules", "parameters", "templates"] as const).find((item) => item === deepTab),
        draft: params.get("draft") ?? undefined,
      });
    }
    /* 深链是一次性的：消费完就把 query 从地址栏抹掉。
       否则参数一直留着，之后每次刷新都会被重新读到，
       从报价规则跳过一次之后，页面就永远停在后台了。 */
    if (moduleId || view) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!highlightedProjectId) return;
    const timer = window.setTimeout(() => setHighlightedProjectId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightedProjectId]);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 1023px)");
    const syncSidebar = (event: MediaQueryList | MediaQueryListEvent) => {
      setCollapsed(event.matches);
    };
    syncSidebar(compactViewport);
    compactViewport.addEventListener("change", syncSidebar);
    return () => compactViewport.removeEventListener("change", syncSidebar);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setCollapsed(true);
  }, [route]);

  useEffect(() => {
    if (collapsed) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && window.matchMedia("(max-width: 1023px)").matches) {
        setCollapsed(true);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [collapsed]);

  /* 你切走的时候，那条还在跑的任务不会跟着停下——agent 继续干，干完了在侧栏
     亮一个蓝点告诉你有新东西。这是「未读」唯一诚实的来源：状态必须在你不看
     它的时候翻转，否则点亮起来的那一刻你正盯着它，等于已读。
     6 秒是演示节奏；真实产品里这个时长由 agent 自己决定。 */
  const runtimeTasksRef = useRef(runtimeTasks);
  runtimeTasksRef.current = runtimeTasks;
  const previousTaskRef = useRef<string | null>(null);
  /* 计时按任务存，不能挂在下面那个 effect 的 cleanup 上。挂上去的话依赖是
     activeTaskId，于是「离开 A、又切去 C」会在切 C 时把 A 的计时清掉——
     只有离开一条之后原地不动，它才等得到自己跑完。 */
  const pendingFinishRef = useRef(new Map<string, number>());
  useEffect(() => {
    const left = previousTaskRef.current;
    previousTaskRef.current = activeTaskId;
    if (!left || left === activeTaskId) return;
    if (pendingFinishRef.current.has(left)) return;
    if (!runtimeTasksRef.current.some((task) => task.id === left && task.status === "running")) return;
    const timer = window.setTimeout(() => {
      pendingFinishRef.current.delete(left);
      setRuntimeTasks((tasks) => tasks.map((task) => task.id === left ? { ...task, status: "done", time: "刚刚" } : task));
      setUnreadTaskIds((ids) => ids.includes(left) ? ids : [...ids, left]);
    }, 6000);
    pendingFinishRef.current.set(left, timer);
  }, [activeTaskId]);

  /* 只在整个工作台卸载时统一清干净。 */
  useEffect(() => {
    const timers = pendingFinishRef.current;
    return () => { timers.forEach((id) => window.clearTimeout(id)); timers.clear(); };
  }, []);

  /* 交接产生工单。这是工单唯一的来源——它不是「新建」出来的,是「交出去」
     那一下留下的凭据,所以第一条流转记录就是交接本身。 */
  const submitHandoff = (payload: HandoffPayload) => {
    const now = "刚刚";
    setTickets((items) => [{
      id: `TK-${2048 + items.length}`,
      title: payload.title,
      kind: payload.kind,
      status: "open",
      project: payload.project,
      from: account.name,
      fromRole: account.roleLabel,
      assignee: payload.assignee,
      assigneeRole: payload.assigneeRole,
      createdAt: now,
      updatedAt: now,
      attachments: payload.attachments,
      moduleId: payload.kind,
      steps: [{ id: `s-${Date.now()}`, at: now, actor: account.name, actorRole: account.roleLabel, action: `交接给${payload.assignee}`, note: payload.note || undefined }],
    }, ...items]);
    setHandoffOpen(false);
  };

  /* 会话里交出去。跟手动交接走同一条产生路径，只是产物和归属由会话自己填——
     所以 QA 驳回/通过之后，那张单立刻就在站内信里等着下一棒，不需要谁去点发送。
     带上 taskId：对方点进去时能直接落回这条会话，而不是从零开一个。 */
  const handoffFromSession = (handoff: SessionHandoff) => {
    const now = "刚刚";
    setTickets((items) => [{
      id: `TK-${2048 + items.length}`,
      title: handoff.title,
      kind: handoff.kind,
      status: "open",
      project: project ?? "未归属项目",
      from: account.name,
      fromRole: account.roleLabel,
      assignee: handoff.to,
      assigneeRole: handoff.toRole ?? "",
      createdAt: now,
      updatedAt: now,
      attachments: (handoff.attachments ?? []).map((file) => ({ id: file.id, name: file.name, kind: "file" as const, meta: file.meta, source: "task-output" as const })),
      taskId: activeTaskId ?? undefined,
      moduleId: handoff.kind,
      steps: [{ id: `s-${Date.now()}`, at: now, actor: account.name, actorRole: account.roleLabel, action: `交接给${handoff.to}`, note: handoff.note || undefined }],
    }, ...items]);
  };

  /* 接手 = 我开始看了，状态落成处理中并记一笔。工单跟邮件的分野就在这里：
     邮件里「我开始看了」这件事没有任何地方知道，工单里它是一条流转记录。
     跳不跳会话是另一回事——DMPK 全程人工，接手之后就地审，不离开站内信。 */
  const acceptTicket = (ticket: Ticket) => {
    setTickets((items) => items.map((item) => item.id !== ticket.id || item.status !== "open" ? item : {
      ...item,
      status: "inProgress",
      updatedAt: "刚刚",
      steps: [...item.steps, { id: `s-${Date.now()}`, at: "刚刚", actor: account.name, actorRole: account.roleLabel, action: "开始审核" }],
    }));
  };

  /* QA 那一类要带到会话里处理：批注有 AI 提的也有人工补的，还要跨版本验证
     上一轮提的问题改没改——这些都得跟数字同事一起看。 */
  const handleTicket = (ticket: Ticket) => {
    acceptTicket(ticket);
    /* 不管有没有关联会话，都走同一条路把工单的说明和产物带进去：
       有关联的接着上次说，没有的（手动交接开的单）新开一条并带上同样的上下文。 */
    startTaskFromTicket({
      subject: ticket.title,
      project: ticket.project,
      context: ticket.steps[ticket.steps.length - 1]?.note ?? ticket.title,
      attachments: ticket.attachments.map((file) => ({ id: file.id, kind: "file" as const, label: file.name, meta: file.meta, origin: "library" as const })),
      moduleId: ticket.moduleId,
      taskId: ticket.taskId,
    });
  };

  const openTask = (task: WorkbenchTask) => {
    /* 回到这条任务就取消它那笔待落地的「跑完」——否则你正看着它的时候它翻成
       未读，而未读的前提是你不在场。 */
    const pending = pendingFinishRef.current.get(task.id);
    if (pending !== undefined) { window.clearTimeout(pending); pendingFinishRef.current.delete(task.id); }
    setUnreadTaskIds((ids) => ids.filter((id) => id !== task.id));
    setProject(task.project); setTaskTitle(task.title); setActiveTaskId(task.id); setInitialRequest(undefined); setHandoffNotice(undefined);
    if (task.moduleId === "bioaz-helper") {
      setActiveModule(null); setActiveCoworkerId("bioaz-helper"); setHelperConversationStarted(true); setRoute("newTask"); return;
    }
    const module = getAgentModule(task.moduleId); if (!module) return;
    setActiveModule(module); setActiveCoworkerId(task.coworkerId); setHelperConversationStarted(false); setModuleRunStatus(/done|完成|交付/.test(task.status) ? "completed" : "active"); setRoute("module");
  };
  /* 从工单开会话。带上工单的说明和随单产物当首轮上下文——不带的话，接手的人
     打开一个空会话，还得回站内信去看这单到底要他干什么。
     用户不用选「新建还是加入已有」：工单自己带着 taskId，系统知道答案。 */
  const startTaskFromTicket = ({ subject, project: contextProject, context, attachments: mailAttachments, moduleId, taskId: joinTaskId }: { subject: string; project?: string; context?: string; attachments?: ComposerAttachment[]; moduleId?: WorkbenchTask["moduleId"]; taskId?: string }) => {
    const targetProject = contextProject && projects.some((item) => item.name === contextProject) ? contextProject : project;
    const module = moduleId ? getAgentModule(moduleId) : null;
    /* 有关联会话就接着上次说，不在侧栏再堆一条同名任务——同一件事来回三轮
       会变成三条任务，而它们本来是一条。

       但只在**同一个工作台**时才接得上。QA 审核工单挂的关联任务是产物的出处
       （那份报告是药效报告任务做出来的），不是审核发生的地方；照着任务的 module
       走，点「进入会话处理」会掉进药效报告工作台，审核台根本进不去。
       规则：工单的类型决定打开哪个工作台，关联任务只说明产物从哪来。 */
    if (joinTaskId && (!moduleId || libraryTasks.find((item) => item.id === joinTaskId)?.moduleId === moduleId)) {
      const target = libraryTasks.find((item) => item.id === joinTaskId);
      if (target) {
        const targetModule = getAgentModule(target.moduleId);
        setProject(target.project);
        setTaskTitle(target.title);
        setActiveTaskId(target.id);
        setActiveModule(targetModule);
        setActiveCoworkerId(target.coworkerId);
        setInitialRequest(context);
        setInitialAttachments(mailAttachments);
        setText("");
        setClarification(null);
        setPendingRequest(null);
        setPendingModule(null);
        setHandoffNotice(undefined);
        setHelperConversationStarted(!targetModule);
        setRoute(targetModule ? "module" : "newTask");
        return;
      }
    }
    const taskId = createRuntimeTask(subject, module, targetProject);
    if (!taskId) return;
    setProject(targetProject ?? null);
    setTaskTitle(subject);
    setActiveTaskId(taskId);
    setActiveModule(module);
    setActiveCoworkerId(module?.suggestedCoworker.id ?? "bioaz-helper");
    setInitialRequest(context);
    setInitialAttachments(mailAttachments);
    setText("");
    setClarification(null);
    setPendingRequest(null);
    setPendingModule(null);
    setHelperConversationStarted(!module);
    setRoute(module ? "module" : "newTask");
  };
  const changeCoworker = (coworkerId: string) => {
    if (coworkerId === "bioaz-helper") return;
    const module = getModuleForCoworker(coworkerId); if (!module || module.moduleId === activeModule?.moduleId) return;
    setHandoffNotice(`已从 ${activeModule?.suggestedCoworker.name ?? "当前数字同事"} 切换至 ${module.suggestedCoworker.name}`);
    setActiveCoworkerId(coworkerId); setActiveModule(module); setInitialRequest(undefined); setModuleRunStatus("active");
    if (activeTaskId) updateRuntimeTask(activeTaskId, module);
  };
  const handleRunStatusChange = useCallback((status: ModuleRunStatus) => {
    setModuleRunStatus(status);
    if (activeTaskId) setRuntimeTasks((tasks) => tasks.map((task) => task.id === activeTaskId ? { ...task, status: status === "completed" ? "done" : "running" } : task));
  }, [activeTaskId]);
  const handleSessionSnapshotChange = useCallback((snapshot: AgentSessionSnapshot) => {
    if (!activeTaskId) return;
    setSessionSnapshots((current) => {
      const taskSnapshots = current[activeTaskId] ?? [];
      return { ...current, [activeTaskId]: [...taskSnapshots.filter((item) => item.moduleId !== snapshot.moduleId), snapshot] };
    });
  }, [activeTaskId]);
  const togglePin = (id: string) => setPinnedItemIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [id, ...items]);
  const createProject = (name: string, type: ProjectType = "client") => {
    const normalized = name.trim();
    if (!normalized || projects.some((item) => item.name === normalized)) return null;
    const nextProject: WorkbenchProject = { id: `project-runtime-${Date.now()}`, name: normalized, type };
    setProjects((items) => [...items, nextProject]);
    setHighlightedProjectId(nextProject.id);
    setLibraryProject(nextProject.name);
    setLibraryFolderId(null);
    setLibraryView("overview");
    setRoute("library");
    return nextProject;
  };
  const renameProject = (projectId: string, name: string) => {
    const previous = projects.find((item) => item.id === projectId)?.name;
    setProjects((items) => items.map((item) => item.id === projectId ? { ...item, name } : item));
    if (previous) setRuntimeTasks((tasks) => tasks.map((task) => task.project === previous ? { ...task, project: name } : task));
    if (project === previous) setProject(name);
  };
  const deleteProject = (projectId: string) => {
    const currentName = projects.find((item) => item.id === projectId)?.name;
    const originalName = workspaceProjects.find((item) => item.id === projectId)?.name;
    setDeletedProjectIds((items) => items.includes(projectId) ? items : [...items, projectId]);
    setPinnedItemIds((items) => items.filter((id) => {
      const staticItem = workspacePinCatalog.find((item) => item.id === id);
      const runtimeItem = runtimeTasks.find((item) => item.id === id);
      const itemProject = runtimeItem?.project ?? staticItem?.project;
      return itemProject !== currentName && itemProject !== originalName;
    }));
    if (project === currentName || project === originalName) {
      openNewTaskHome();
    }
  };
  const renameTask = (taskId: string, title: string) => {
    setRenamedTaskTitles((items) => ({ ...items, [taskId]: title }));
    setRuntimeTasks((tasks) => tasks.map((task) => task.id === taskId ? { ...task, title } : task));
    if (activeTaskId === taskId) setTaskTitle(title);
  };
  const deleteTask = (taskId: string) => {
    setDeletedTaskIds((items) => items.includes(taskId) ? items : [...items, taskId]);
    setPinnedItemIds((items) => items.filter((id) => id !== taskId));
    if (activeTaskId === taskId) {
      setActiveTaskId(null);
      setActiveModule(null);
      setHelperConversationStarted(false);
      setRoute("newTask");
    }
  };

  const shellView = route !== "module";
  const Session = activeModule?.Session;
  const visibleProjects = projects.filter((item) => !deletedProjectIds.includes(item.id));
  // 任务只能挂在客户委托项目下——资料空间没有任务流转，让它出现在选项里
  // 只会制造一条走不通的路
  const visibleProjectOptions = visibleProjects.filter((item) => item.type === "client").map((item) => item.name);
  const libraryTasks = useMemo(() => {
    const currentNameByOriginal = new Map(visibleProjects.map((item) => [
      workspaceProjects.find((original) => original.id === item.id)?.name ?? item.name,
      item.name,
    ]));
    const staticTasks: WorkbenchTask[] = workspacePinCatalog
      .filter((item) => item.type === "task")
      .map((item) => ({
        id: item.id,
        title: renamedTaskTitles[item.id] ?? item.title,
        project: currentNameByOriginal.get(item.project ?? "") ?? item.project ?? "",
        moduleId: item.moduleId ?? "bioaz-helper",
        coworkerId: item.coworkerId ?? "bioaz-helper",
        coworkerName: item.coworkerName ?? "BioAZ Helper",
        time: item.time ?? "",
        status: item.status ?? "",
        priority: item.priority,
      }));
    return [...runtimeTasks, ...staticTasks].filter((task) => !deletedTaskIds.includes(task.id));
  }, [deletedTaskIds, renamedTaskTitles, runtimeTasks, visibleProjects]);
  const account = inboxAccounts.find((item) => item.id === accountId) ?? inboxAccounts[0];
  /* 徽标数只算还没落动作的条目——未读和未处理是两件事。
     口径跟邮箱读同一份数据：之前侧栏按旧的 inboxItems 算、邮箱按自己的
     initialMail 算，两个数字碰巧都是 2，改任一边就会当场对不上。 */
  /* 徽标数 = 待我处理的工单。收件箱这颗图标现在通向站内信，数字必须跟着它指向的东西走。 */
  const inboxCount = tickets.filter((item) => item.assignee === account.name && (item.status === "open" || item.status === "inProgress")).length;
  const activeLibraryFolder = libraryFolders.find((folder) => folder.id === libraryFolderId) ?? null;
  const librarySectionLabel = libraryView === "inputs"
    ? "项目资料"
    : libraryView === "outputs"
      ? "任务产物"
      : libraryView === "trash"
        ? "回收站"
        : libraryView === "folder"
          ? activeLibraryFolder?.name ?? "项目文件"
          : null;
  if (quotationTarget) return <QuotationManagement onBack={() => setQuotationTarget(null)} initialBusiness={quotationTarget.business} initialTab={quotationTarget.tab} initialDraft={quotationTarget.draft} />;
  return <main className={`dmpkShell ${collapsed ? "sidebarCollapsed" : ""} ${shellView ? "workbenchShell" : "moduleSessionShell"} ${activeModule ? `${activeModule.moduleId}ModuleShell` : ""}`}>
    <WorkspaceSidebar collapsed={collapsed} activeRoute={route} activeTaskId={activeTaskId} currentProject={project} projects={projects} runtimeTasks={runtimeTasks} pinnedItemIds={pinnedItemIds} unreadTaskIds={unreadTaskIds} deletedProjectIds={deletedProjectIds} deletedTaskIds={deletedTaskIds} renamedTaskTitles={renamedTaskTitles} libraryFolders={libraryFolders} activeLibraryFolderId={libraryFolderId} activeLibrarySpace={route === "library" ? libraryProject : null} highlightedProjectId={highlightedProjectId} account={account} inboxCount={inboxCount} onAccountChange={setAccountId} onOpenInbox={() => setRoute("inbox")} onOpenLibraryFolder={(projectName, folderId) => { setLibraryProject(projectName); setLibraryFolderId(folderId); setLibraryView(folderId ? "folder" : "overview"); setRoute("library"); }} onCreateProject={createProject} onRenameProject={renameProject} onDeleteProject={deleteProject} onRenameTask={renameTask} onDeleteTask={deleteTask} onTogglePinnedItem={togglePin} onRouteChange={navigateShellRoute} onStartTask={resetNewTask} onOpenTask={openTask} onOpenQuotationManagement={() => setQuotationTarget({ business: "root" })} onToggleCollapsed={() => setCollapsed((value) => !value)} />
    {handoffOpen ? <TicketHandoffDialog currentUser={account.name} projects={visibleProjects.filter((item) => item.type === "client").map((item) => item.name)} defaultProject={project} onSubmit={submitHandoff} onClose={() => setHandoffOpen(false)} /> : null}
    <button className="mobileSidebarBackdrop" type="button" aria-label="关闭侧边栏" onClick={() => setCollapsed(true)} />
    {route === "module" ? <button className="mobileModuleSidebarTrigger" type="button" onClick={() => setCollapsed(false)} aria-label="打开侧边栏"><Menu size={16} /></button> : null}
    {route === "module" && Session && activeModule ? <Session projectName={project ?? "未归属项目"} taskTitle={taskTitle} initialRequest={initialRequest} initialAttachments={initialAttachments} coworkers={coworkerRegistry} activeCoworkerId={activeCoworkerId} onCoworkerChange={changeCoworker} onRunStatusChange={handleRunStatusChange} onBackToNewTask={() => resetNewTask(project)} handoffNotice={handoffNotice} priorSessionSnapshots={(activeTaskId ? sessionSnapshots[activeTaskId] : undefined)?.filter((snapshot) => snapshot.moduleId !== activeModule.moduleId)} onSessionSnapshotChange={handleSessionSnapshotChange} onOpenQuotationManagement={(options) => setQuotationTarget({ business: "dmpk", ...options })} viewerRole={account.role} onHandoff={handoffFromSession} sessionOutcome={activeTaskId ? sessionOutcomes[activeTaskId] ?? null : null} onSessionOutcomeChange={(next) => { if (activeTaskId) setSessionOutcomes((current) => ({ ...current, [activeTaskId]: next })); }} /> : <section className="dmpkWorkspace workbenchMode"><header className="topbar"><div className="topbarPathLayer"><button className="mobileSidebarTrigger" type="button" onClick={() => setCollapsed(false)} aria-label="打开侧边栏"><Menu size={16} /></button><div className="breadcrumb">{route === "tasks" ? <><span>我的待办</span><ChevronRight size={14} /><strong>待处理</strong></> : route === "newTask" && helperConversationStarted ? <><span>{project ?? "未归属项目"}</span><ChevronRight size={14} /><strong>{taskTitle}</strong></> : route === "library" && libraryProject ? <><button type="button" onClick={() => { setLibraryProject(null); setLibraryFolderId(null); setLibraryView("overview"); }}>数据中枢</button><ChevronRight size={14} />{librarySectionLabel ? <><button type="button" onClick={() => { setLibraryFolderId(null); setLibraryView("overview"); }}>{libraryProject}</button><ChevronRight size={14} /><strong>{librarySectionLabel}</strong></> : <strong>{libraryProject}</strong>}</> : <strong>{route === "library" ? "数据中枢" : route === "inbox" ? "站内信" : route === "knowledgeBase" ? "知识库" : route === "digitalTeam" ? "数字团队" : "新建任务"}</strong>}</div><div className="topbarScopeSlot" id="workbench-topbar-scope" /><div className="topbarPrimarySlot" id="workbench-topbar-primary" /></div><div className="topbarSecondRow"><div id="workbench-topbar-tabs" className="topbarTabLayer" /><div id="workbench-topbar-actions" className="topbarToolLayer" /></div></header>{route === "tasks" ? <TaskList pinnedItemIds={pinnedItemIds} onTogglePinnedItem={togglePin} onStartTask={() => resetNewTask()} onOpenTask={openTask} /> : route === "inbox" ? <TicketsPage tickets={tickets} currentUser={account.name} projects={visibleProjects.filter((item) => item.type === "client").map((item) => item.name)} onHandle={handleTicket} onAccept={acceptTicket} /> : route === "library" ? <FileManager projects={visibleProjects} selectedProject={libraryProject} selectedFolderId={libraryFolderId} folders={libraryFolders} view={libraryView} onSelectedProjectChange={(nextProject) => { setLibraryProject(nextProject); if (!nextProject) { setLibraryFolderId(null); setLibraryView("overview"); } }} onSelectedFolderChange={setLibraryFolderId} onViewChange={setLibraryView} onCreateProject={createProject} /> : route === "digitalTeam" ? <DigitalTeamPage projects={visibleProjects} tasks={runtimeTasks.filter((task) => !deletedTaskIds.includes(task.id))} onStartModule={startModuleDirect} onOpenLibrary={() => navigateShellRoute("library")} /> : route === "knowledgeBase" ? <KnowledgeBasePage /> : <NewTaskHome conversationStarted={helperConversationStarted} project={project} text={text} clarification={clarification} pendingRequest={pendingRequest} pendingTaskType={pendingModule?.taskType ?? null} suggestedCoworker={suggestedCoworker} coworkers={coworkerRegistry} activeCoworkerId={activeCoworkerId} quickStarts={quickStarts} projectOptions={visibleProjectOptions} projectNotice={projectNotice} onProjectChange={(nextProject) => { setProject(nextProject); setProjectNotice(null); }} onTextChange={setText} onSubmit={submitIntent} onQuickStart={startModuleDirect} onCoworkerChange={selectPendingCoworker} onConfirm={confirmDispatch} onCancel={cancelDispatch} />}</section>}
  </main>;
}
