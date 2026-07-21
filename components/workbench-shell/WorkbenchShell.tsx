"use client";

import { ChevronRight, Menu } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { coworkerRegistry, getAgentModule, getModuleForCoworker, quickStartRegistry, resolveModuleIntent } from "../../modules/registry";
import type { AgentModuleDefinition, AgentSessionSnapshot, ModuleRunStatus, WorkbenchRoute, WorkbenchTask } from "../../modules/types";
import { FileManager } from "./FileManager";
import { NewTaskHome } from "./NewTaskHome";
import { TaskList } from "./TaskList";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { workspaceProjects } from "../../lib/workbench/mockWorkspace";
import type { WorkbenchProject } from "../../modules/types";
import { QuotationManagement } from "../../modules/quotation-management";

export default function WorkbenchShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [route, setRoute] = useState<WorkbenchRoute>("newTask");
  const [project, setProject] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("新建任务");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<AgentModuleDefinition | null>(null);
  const [activeCoworkerId, setActiveCoworkerId] = useState(coworkerRegistry[0]?.id ?? "");
  const [initialRequest, setInitialRequest] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [clarification, setClarification] = useState<{ request: string; question: string } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [pendingModule, setPendingModule] = useState<AgentModuleDefinition | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | undefined>();
  const [pinnedItemIds, setPinnedItemIds] = useState<string[]>([]);
  const [runtimeTasks, setRuntimeTasks] = useState<WorkbenchTask[]>([]);
  const [projects, setProjects] = useState<WorkbenchProject[]>(workspaceProjects);
  const [libraryProject, setLibraryProject] = useState<string | null>(null);
  const [helperConversationStarted, setHelperConversationStarted] = useState(false);
  const [, setModuleRunStatus] = useState<ModuleRunStatus>("active");
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, AgentSessionSnapshot[]>>({});
  const [quotationManagementOpen, setQuotationManagementOpen] = useState(false);

  const quickStarts = useMemo(() => quickStartRegistry.map((item) => { const Icon = item.icon; return { id: item.id, label: item.label, prompt: item.prompt, availability: item.availability, icon: <Icon size={17} /> }; }), []);
  const suggestedCoworker = pendingModule?.suggestedCoworker ?? null;

  const createRuntimeTask = (title: string, module: AgentModuleDefinition | null) => {
    const taskProject = project ?? "临时任务";
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

  const resetNewTask = (nextProject: string | null = null) => {
    setProject(nextProject); setTaskTitle("新建任务"); setActiveTaskId(null); setActiveModule(null); setActiveCoworkerId("bioaz-helper"); setInitialRequest(undefined); setHandoffNotice(undefined); setText(""); setClarification(null); setPendingRequest(null); setPendingModule(null); setHelperConversationStarted(false); setModuleRunStatus("active"); setRoute("newTask");
  };

  const submitIntent = () => {
    const next = text.trim(); if (!next) return;
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
    updateRuntimeTask(taskId, pendingModule);
    setActiveModule(pendingModule);
    setActiveCoworkerId(pendingModule.suggestedCoworker.id);
    setInitialRequest(pendingRequest);
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
    createRuntimeTask(`${module.moduleName}任务`, module);
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
    if (moduleId) startModuleDirect(moduleId);
    if (params.get("view") === "library") setRoute("library");
    if (params.get("view") === "quotation-management") setQuotationManagementOpen(true);
  }, []);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 1199px)");
    const syncSidebar = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) setCollapsed(true);
    };
    syncSidebar(compactViewport);
    compactViewport.addEventListener("change", syncSidebar);
    return () => compactViewport.removeEventListener("change", syncSidebar);
  }, []);

  const openTask = (task: WorkbenchTask) => {
    setProject(task.project); setTaskTitle(task.title); setActiveTaskId(task.id); setInitialRequest(undefined); setHandoffNotice(undefined);
    if (task.moduleId === "bioaz-helper") {
      setActiveModule(null); setActiveCoworkerId("bioaz-helper"); setHelperConversationStarted(true); setRoute("newTask"); return;
    }
    const module = getAgentModule(task.moduleId); if (!module) return;
    setActiveModule(module); setActiveCoworkerId(task.coworkerId); setHelperConversationStarted(false); setModuleRunStatus(/done|完成|交付/.test(task.status) ? "completed" : "active"); setRoute("module");
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
  const createProject = (name: string) => {
    const normalized = name.trim();
    if (!normalized || projects.some((item) => item.name === normalized)) return null;
    const nextProject = { id: `project-runtime-${Date.now()}`, name: normalized };
    setProjects((items) => [...items, nextProject]);
    return nextProject;
  };

  const shellView = route !== "module";
  const Session = activeModule?.Session;
  if (quotationManagementOpen) return <QuotationManagement onBack={() => setQuotationManagementOpen(false)} />;
  return <main className={`dmpkShell ${collapsed ? "sidebarCollapsed" : ""} ${shellView ? "workbenchShell" : "moduleSessionShell"} ${activeModule ? `${activeModule.moduleId}ModuleShell` : ""}`}>
    <WorkspaceSidebar collapsed={collapsed} activeRoute={route} activeTaskId={activeTaskId} currentProject={project} projects={projects} runtimeTasks={runtimeTasks} pinnedItemIds={pinnedItemIds} onCreateProject={createProject} onTogglePinnedItem={togglePin} onRouteChange={setRoute} onStartTask={resetNewTask} onOpenTask={openTask} onOpenQuotationManagement={() => setQuotationManagementOpen(true)} onToggleCollapsed={() => setCollapsed((value) => !value)} />
    {route === "module" && Session && activeModule ? <Session projectName={project ?? "临时任务"} taskTitle={taskTitle} initialRequest={initialRequest} coworkers={coworkerRegistry} activeCoworkerId={activeCoworkerId} onCoworkerChange={changeCoworker} onRunStatusChange={handleRunStatusChange} onBackToNewTask={() => resetNewTask(project)} handoffNotice={handoffNotice} priorSessionSnapshots={(activeTaskId ? sessionSnapshots[activeTaskId] : undefined)?.filter((snapshot) => snapshot.moduleId !== activeModule.moduleId)} onSessionSnapshotChange={handleSessionSnapshotChange} /> : <section className="dmpkWorkspace workbenchMode"><header className="topbar"><button className="mobileSidebarTrigger" type="button" onClick={() => setCollapsed(false)} aria-label="打开侧边栏"><Menu size={18} /></button><div className="breadcrumb">{route === "tasks" ? <><span>我的待办</span><ChevronRight size={15} /><strong>待处理</strong></> : route === "newTask" && helperConversationStarted ? <><span>{project ?? "临时任务"}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></> : route === "library" && libraryProject ? <><button type="button" onClick={() => setLibraryProject(null)}>数据中枢</button><ChevronRight size={15} /><strong>{libraryProject}</strong></> : <strong>{route === "library" ? "数据中枢" : "新建任务"}</strong>}</div></header>{route === "tasks" ? <TaskList pinnedItemIds={pinnedItemIds} onTogglePinnedItem={togglePin} onStartTask={() => resetNewTask()} onOpenTask={openTask} /> : route === "library" ? <FileManager projects={projects} selectedProject={libraryProject} onSelectedProjectChange={setLibraryProject} /> : <NewTaskHome conversationStarted={helperConversationStarted} project={project} text={text} clarification={clarification} pendingRequest={pendingRequest} pendingTaskType={pendingModule?.taskType ?? null} suggestedCoworker={suggestedCoworker} coworkers={coworkerRegistry} quickStarts={quickStarts} projectOptions={[...projects.map((item) => item.name), "临时任务"]} onProjectChange={setProject} onTextChange={setText} onSubmit={submitIntent} onQuickStart={startModuleDirect} onCoworkerChange={selectPendingCoworker} onConfirm={confirmDispatch} onCancel={cancelDispatch} />}</section>}
  </main>;
}
