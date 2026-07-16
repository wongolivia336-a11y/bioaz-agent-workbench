"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { coworkerRegistry, getAgentModule, getModuleForCoworker, quickStartRegistry, resolveModuleIntent } from "../../modules/registry";
import type { AgentModuleDefinition, WorkbenchRoute, WorkbenchTask } from "../../modules/types";
import { FileManager } from "./FileManager";
import { NewTaskHome } from "./NewTaskHome";
import { TaskList } from "./TaskList";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

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
  const [pinnedItemIds, setPinnedItemIds] = useState<string[]>(["task-new-quote"]);

  const quickStarts = useMemo(() => quickStartRegistry.map((item) => { const Icon = item.icon; return { id: item.id, label: item.label, prompt: item.prompt, availability: item.availability, icon: <Icon size={17} /> }; }), []);
  const suggestedCoworker = pendingModule?.suggestedCoworker ?? null;

  const resetNewTask = (nextProject: string | null = null) => {
    setProject(nextProject); setTaskTitle("新建任务"); setActiveTaskId(null); setActiveModule(null); setActiveCoworkerId("bioaz-helper"); setInitialRequest(undefined); setHandoffNotice(undefined); setText(""); setClarification(null); setPendingRequest(null); setPendingModule(null); setRoute("newTask");
  };

  const submitIntent = () => {
    const next = text.trim(); if (!next) return;
    const request = clarification ? `${clarification.request}；补充：${next}` : next;
    const manuallySelectedModule = activeCoworkerId === "bioaz-helper" ? null : getModuleForCoworker(activeCoworkerId);
    if (manuallySelectedModule) {
      setText(""); setProject((current) => current ?? "临时任务"); setTaskTitle(`${manuallySelectedModule.moduleName}任务`); setActiveModule(manuallySelectedModule); setInitialRequest(request); setActiveTaskId(null); setRoute("module"); return;
    }
    const resolution = resolveModuleIntent(request);
    setText("");
    if (!resolution.module) { setClarification({ request, question: resolution.clarification ?? "请再补充一点任务目标。" }); return; }
    setClarification(null); setPendingRequest(request); setPendingModule(resolution.module); setActiveCoworkerId(resolution.module.suggestedCoworker.id);
  };

  const selectPendingCoworker = (coworkerId: string) => { const module = getModuleForCoworker(coworkerId); if (!module) return; setActiveCoworkerId(coworkerId); setPendingModule(module); };
  const confirmDispatch = () => { if (!pendingModule || !pendingRequest) return; setProject((current) => current ?? "临时任务"); setTaskTitle(`${pendingModule.moduleName}任务`); setActiveModule(pendingModule); setActiveCoworkerId(pendingModule.suggestedCoworker.id); setInitialRequest(pendingRequest); setHandoffNotice(`BioAZ Helper 已将任务分派给${pendingModule.suggestedCoworker.name}`); setActiveTaskId(null); setPendingModule(null); setPendingRequest(null); setRoute("module"); };
  const cancelDispatch = () => { setText(pendingRequest ?? ""); setPendingRequest(null); setPendingModule(null); };

  const startModuleDirect = (moduleId: string) => {
    const module = getAgentModule(moduleId);
    if (!module || module.availability !== "available") return;
    setProject((current) => current ?? "临时任务");
    setTaskTitle(`${module.moduleName}任务`);
    setActiveTaskId(null);
    setActiveModule(module);
    setActiveCoworkerId(module.suggestedCoworker.id);
    setInitialRequest(undefined);
    setHandoffNotice(undefined);
    setText("");
    setClarification(null);
    setPendingRequest(null);
    setPendingModule(null);
    setRoute("module");
  };

  const openTask = (task: WorkbenchTask) => { const module = getAgentModule(task.moduleId); if (!module) return; setProject(task.project); setTaskTitle(task.title); setActiveTaskId(task.id); setActiveModule(module); setActiveCoworkerId(task.coworkerId); setInitialRequest(undefined); setHandoffNotice(undefined); setRoute("module"); };
  const changeCoworker = (coworkerId: string) => {
    if (coworkerId === "bioaz-helper") { resetNewTask(project); return; }
    const module = getModuleForCoworker(coworkerId); if (!module || module.moduleId === activeModule?.moduleId) return;
    setHandoffNotice(`已从${activeModule?.suggestedCoworker.name ?? "当前数字同事"}切换至${module.suggestedCoworker.name}`);
    setActiveCoworkerId(coworkerId); setActiveModule(module); setTaskTitle(`${module.moduleName}任务`); setInitialRequest(undefined);
  };
  const togglePin = (id: string) => setPinnedItemIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [id, ...items]);

  const shellView = route !== "module";
  const Session = activeModule?.Session;
  return <main className={`dmpkShell ${collapsed ? "sidebarCollapsed" : ""} ${shellView ? "workbenchShell" : "moduleSessionShell"}`}>
    <WorkspaceSidebar collapsed={collapsed} activeRoute={route} activeTaskId={activeTaskId} pinnedItemIds={pinnedItemIds} onTogglePinnedItem={togglePin} onRouteChange={setRoute} onStartTask={resetNewTask} onOpenTask={openTask} onToggleCollapsed={() => setCollapsed((value) => !value)} />
    {route === "module" && Session && activeModule ? <Session projectName={project ?? "临时任务"} taskTitle={taskTitle} initialRequest={initialRequest} coworkers={coworkerRegistry} activeCoworkerId={activeCoworkerId} onCoworkerChange={changeCoworker} onBackToNewTask={() => resetNewTask(project)} handoffNotice={handoffNotice} /> : <section className="dmpkWorkspace workbenchMode"><header className="topbar"><div className="breadcrumb">{route === "tasks" ? <><span>我的任务</span><ChevronRight size={15} /><strong>待处理</strong></> : <strong>{route === "library" ? "文件管理系统" : "新建任务"}</strong>}</div></header>{route === "tasks" ? <TaskList pinnedItemIds={pinnedItemIds} onTogglePinnedItem={togglePin} onStartTask={() => resetNewTask()} onOpenTask={openTask} /> : route === "library" ? <FileManager /> : <NewTaskHome project={project} text={text} clarification={clarification} pendingRequest={pendingRequest} suggestedCoworker={suggestedCoworker} coworkers={coworkerRegistry} quickStarts={quickStarts} onProjectChange={setProject} onTextChange={setText} onSubmit={submitIntent} onQuickStart={startModuleDirect} onCoworkerChange={selectPendingCoworker} onConfirm={confirmDispatch} onCancel={cancelDispatch} />}</section>}
  </main>;
}
