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
import { seededSessionFields, seededSessionHistory } from "../../lib/workbench/seededSessions";
import type { QuoteNote } from "../../lib/workbench/quoteData";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { DigitalTeamPage } from "./DigitalTeamPage";
import { KnowledgeBasePage } from "../knowledge-base/KnowledgeBasePage";
import { DEFAULT_ACCOUNT_ID, inboxAccounts } from "../../lib/workbench/mockInbox";
import { DEFAULT_LENS, demoLensSearch, getDemoLens, readDemoLens, type DemoLens } from "../../lib/workbench/demoLens";
import { seededUnreadTaskIds, workspacePinCatalog, workspaceProjects } from "../../lib/workbench/mockWorkspace";
import type { LibraryFolder, LibraryView } from "../../lib/workbench/shellTypes";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { ProjectType, QuotationManagementTarget, SessionHandoff, SessionOutcome, SessionRework, WorkbenchProject } from "../../modules/types";
import { QuotationManagement } from "../../modules/quotation-management";

/* 会话组件按 taskId 加 key。
   ----------------------------------------------------------------------
   不加 key 的话，从一条 DMPK 报价任务切到另一条，React 看到的是同一个位置上
   同一个组件类型——它会**复用**那个实例，于是上一单的消息、参数、阶段全都
   留在原地。新建一个报价任务，开场却是别人上一单的对话。

   一条任务就是一次会话，换任务就该是新的一次。 */

/** 深链认识的 view 取值。不在这张表里的,说明是别人的参数,不该被顺手清掉。 */
const KNOWN_DEEPLINK_VIEWS = ["library", "digital-team", "quotation-management"];

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
  /* 站内信的子级位置放在 shell 上,跟数据中枢的 libraryProject / libraryFolderId
     一个道理:面包屑要能画出「站内信 › TK-2046 › 报价复核」,就得由顶栏够得着
     当前在第几层。留在页面内部的话,顶栏只知道「在站内信」,返回只能靠页内再放
     一个按钮——而那个按钮做的正是面包屑该做的事。 */
  const [inboxTicketId, setInboxTicketId] = useState<string | null>(null);
  const [inboxNoticeTitle, setInboxNoticeTitle] = useState<string | null>(null);
  const [inboxReviewing, setInboxReviewing] = useState(false);
  /* 审批通过时随行的产物。数据中枢建好之前,这里只是留个位置。 */
  const [archivedFiles, setArchivedFiles] = useState<Ticket["attachments"]>([]);
  const [libraryProject, setLibraryProject] = useState<string | null>(null);
  const [libraryFolderId, setLibraryFolderId] = useState<string | null>(null);
  const [libraryFolders] = useState<LibraryFolder[]>([]);
  const [libraryView, setLibraryView] = useState<LibraryView>("overview");
  /* 按 id 取，不按下标。下标会随通讯录增删悄悄换人——加了赵敏之后
     inboxAccounts[1] 就从王林彬变成了林一一，而这种变化不报错。 */
  const [accountId, setAccountId] = useState(DEFAULT_ACCOUNT_ID);
  /* 演示镜头。**脚手架,上线前删。** 由地址栏驱动:不带参数 = DMPK 报价(近期
     要演示的那条线),`?view=qa` 看 QA,`?view=all` 看总览。
     初值不在 useState 里直接读 window——服务端渲染不出同样的值,会 hydration 不匹配。
     跟上面 collapsed 的处理方式一致:先给默认值,挂载后再按地址栏校正。 */
  const [lens, setLens] = useState<DemoLens>(DEFAULT_LENS);
  useEffect(() => { setLens(readDemoLens(window.location.search)); }, []);
  const [helperConversationStarted, setHelperConversationStarted] = useState(false);
  const [, setModuleRunStatus] = useState<ModuleRunStatus>("active");
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, AgentSessionSnapshot[]>>({});
  /* 被退回的那一版,**按任务存**。
     ----------------------------------------------------------------------
     原来这里是一个全局的 rework：从站内信进过一次驳回会话之后，它就再也没被
     清掉。接着在项目里新建一个 DMPK 报价任务，那张退回修订卡和「收到 XX 的
     退回」照样跟着长出来——新会话一开场就卡在别人上一单的驳回里。

     退回属于**那一单**，不属于「工作台当前的状态」。所以跟 sessionOutcomes
     一样按 taskId 存：谁被退回，卡就只长在谁身上；处理完了由会话回调清掉。 */
  const [reworkByTask, setReworkByTask] = useState<Record<string, SessionRework>>({});
  /* 会话结论按任务存。module 会随路由重挂载，结论放在它里面等于切走就没了。 */
  const [sessionOutcomes, setSessionOutcomes] = useState<Record<string, SessionOutcome>>({});
  /* null = 没开。开的时候带上落点，这样从报价会话过去能直接停在规则页并带着草稿，
     不用把参数塞进 URL 再整页刷新。 */
  const [quotationTarget, setQuotationTarget] = useState<QuotationManagementTarget | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);

  const quickStarts = useMemo(() => quickStartRegistry.map((item) => { const Icon = item.icon; return { id: item.id, label: item.label, prompt: item.prompt, availability: item.availability, moduleId: item.moduleId, icon: <Icon size={16} /> }; }), []);
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

  /* projectOverride：首屏点快捷入口时项目是当场选的，而 setProject 要下一次
     渲染才生效——同一个 tick 里读 state 拿到的还是 null，流程会被自己的前置
     校验挡回去。把刚选的那个项目直接递进来。 */
  const startModuleDirect = (moduleId: string, projectOverride?: string) => {
    const module = getAgentModule(moduleId);
    if (!module || module.availability !== "available") return;
    const targetProject = projectOverride ?? project;
    if (!targetProject) { setProjectNotice("请先选择任务所属项目，再启动流程。"); setRoute("newTask"); return; }
    const taskId = createRuntimeTask(`${module.moduleName}任务`, module, targetProject);
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
       从报价规则跳过一次之后，页面就永远停在后台了。

       但只抹**自己认识**的那些。原来写的是「moduleId 或 view 有值就抹掉整个
       pathname 之后的部分」——于是任何别人放在地址栏里的参数都被顺手清掉，
       演示镜头的 ?line= 就是这么每次加载都消失的。
       删只删自己消费掉的键，别人的留着。 */
    const consumed = ["module", "task", "view", "business", "tab", "draft"];
    if (moduleId || KNOWN_DEEPLINK_VIEWS.includes(view ?? "")) {
      const next = new URLSearchParams(window.location.search);
      consumed.forEach((key) => next.delete(key));
      const query = next.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
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

  /* 接手 = 我开始看了，记一笔流转。工单跟邮件的分野就在这里：
     邮件里「我开始看了」这件事没有任何地方知道，工单里它是一条流转记录。

     不再翻状态。开始看并不代表这件事了结了，它还欠着，还是「待处理」——
     「什么时候开始看的」属于流转记录，不属于状态：流转记录说发生过什么，
     状态说现在欠着什么。
     跳不跳会话是另一回事——DMPK 全程人工，接手之后就地审，不离开站内信。 */
  const acceptTicket = (ticket: Ticket) => {
    setTickets((items) => items.map((item) => item.id !== ticket.id || item.status !== "open" ? item : {
      ...item,
      updatedAt: "刚刚",
      steps: [...item.steps, { id: `s-${Date.now()}`, at: "刚刚", actor: account.name, actorRole: account.roleLabel, action: "开始审核" }],
    }));
  };

  /* 驳回 = 打回上一棒。工单里「上一棒」不用猜:提交人就写在单子上,所以处理人
     换回 ticket.from,状态落成已驳回,并记一笔带批注摘要的流转。
     它不是终态——球回到对方手上,他改完还要再交回来,还是同一张单。 */
  const rejectTicket = (ticket: Ticket, summary: string) => {
    setTickets((items) => items.map((item) => item.id !== ticket.id ? item : {
      ...item,
      status: "rejected",
      assignee: ticket.from,
      assigneeRole: ticket.fromRole,
      updatedAt: "刚刚",
      steps: [...item.steps, { id: `s-${Date.now()}`, at: "刚刚", actor: account.name, actorRole: account.roleLabel, action: `退回 ${ticket.from} 修订`, note: summary }],
    }));
  };

  /* 通过 = 审完了,交回提交人。
     这里原本叫「归档」:状态落成 done,产物落进数据中枢。但数据中枢还没建好,
     而且它**根本没改 assignee**——单子停在审批人名下就没了下文,
     弹窗上写着「交接给 数据中枢」却没有真的交给任何人。那是一句空头承诺。

     现在诚实一点:通过之后 assignee 换回提交人,他在站内信收到「已通过」,
     能预览、能下载,后续动作发生在这个系统之外。这是终态——不计徽标、
     不进待办。等数据中枢建好,再谈把产物落库和真正的归档。 */
  const approveTicket = (ticket: Ticket) => {
    setTickets((items) => items.map((item) => item.id !== ticket.id ? item : {
      ...item,
      status: "done",
      assignee: ticket.from,
      assigneeRole: ticket.fromRole,
      updatedAt: "刚刚",
      steps: [...item.steps, { id: `s-${Date.now()}`, at: "刚刚", actor: account.name, actorRole: account.roleLabel, action: "审批通过", note: ticket.attachments.map((file) => file.name).join("、") || undefined }],
    }));
    setArchivedFiles((files) => [
      ...ticket.attachments.filter((file) => !files.some((item) => item.id === file.id)).map((file) => ({ ...file })),
      ...files,
    ]);
  };

  /* QA 那一类要带到会话里处理：批注有 AI 提的也有人工补的，还要跨版本验证
     上一轮提的问题改没改——这些都得跟数字同事一起看。 */
  const handleTicket = (ticket: Ticket, notes: QuoteNote[] = []) => {
    acceptTicket(ticket);
    /* 被退回的那一版:把驳回理由和逐条批注一起带进会话。
       只把人送回会话是不够的——要改什么必须在眼前,否则他还得切回站内信
       逐条读、记住哪几行、再切回来改。 */
    const rejectedStep = [...ticket.steps].reverse().find((step) => step.action.includes("退回") || step.action.includes("驳回"));
    const rework: SessionRework | null = ticket.status === "rejected" ? {
      reason: rejectedStep?.note,
      by: `${rejectedStep?.actor ?? ticket.from} · ${rejectedStep?.actorRole ?? ""}`.trim().replace(/ · $/, ""),
      at: rejectedStep?.at ?? ticket.updatedAt,
      notes,
      attachmentName: ticket.attachments[0]?.name,
    } : null;
    /* 不管有没有关联会话，都走同一条路把工单的说明和产物带进去：
       有关联的接着上次说，没有的（手动交接开的单）新开一条并带上同样的上下文。

       被退回的那一版例外:不把驳回理由塞成首轮请求。那句话是审批人说的,
       塞进去会渲染成撰写人自己的一条消息——他打开会话看到自己"说"了一句
       从没说过的话。理由归退回修订卡,那儿才写着是谁说的。 */
    const landedTaskId = startTaskFromTicket({
      subject: ticket.title,
      project: ticket.project,
      context: ticket.status === "rejected" ? undefined : (ticket.steps[ticket.steps.length - 1]?.note ?? ticket.title),
      attachments: ticket.attachments.map((file) => ({ id: file.id, kind: "file" as const, label: file.name, meta: file.meta, origin: "library" as const })),
      moduleId: ticket.moduleId,
      taskId: ticket.taskId,
    });
    /* 挂到刚落地的那条任务上,而不是挂在工作台上。 */
    if (rework && landedTaskId) setReworkByTask((current) => ({ ...current, [landedTaskId]: rework }));
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
  const startTaskFromTicket = ({ subject, project: contextProject, context, attachments: mailAttachments, moduleId, taskId: joinTaskId }: { subject: string; project?: string; context?: string; attachments?: ComposerAttachment[]; moduleId?: WorkbenchTask["moduleId"]; taskId?: string }): string | undefined => {
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
        return target.id;
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
    return taskId;
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
  /* 面包屑显示主题,不显示编号。编号是内部凭据,不该占着导航这种高频位置——
     而且「TK-2046」对读的人零信息量,他要认的是「哪一份报价」。 */
  /* 被退回、球在我手上的那些任务。侧栏用「要你动手」那颗点提示——
     被驳回的事最容易被漏掉:它不在收件箱首屏最上面,而人多半是从侧栏进任务的。 */
  const attentionTaskIds = tickets
    .filter((item) => item.assignee === account.name && item.status === "rejected" && item.taskId)
    .map((item) => item.taskId!);
  const inboxTicketLabel = inboxTicketId ? tickets.find((item) => item.id === inboxTicketId)?.title ?? inboxTicketId : null;

  /* 演示镜头把三样东西一起收敛:侧栏任务、收件箱工单、可切换账号。
     只收敛其中一样是不够的——演示 DMPK 那条线时,侧栏里挂着的 QA 任务
     和收件箱里的 QA 工单都会在旁边晃。**脚手架,上线前删。** */
  const activeLens = getDemoLens(lens);
  const lensTasks = activeLens.moduleId
    ? libraryTasks.filter((task) => task.moduleId === activeLens.moduleId)
    : libraryTasks;
  const lensAccounts = activeLens.accountIds.length
    ? inboxAccounts.filter((item) => activeLens.accountIds.includes(item.id))
    : inboxAccounts;
  /* 首屏的快捷入口**不跟镜头收敛**。镜头是演示脚手架，它收敛的是「你手上
     有哪些活」（侧栏、收件箱）；而首屏这四张卡说的是「这个工作台能做什么」，
     那是产品的能力清单，四条业务线一样重要，肿瘤报价接入后也在其中。
     少列一张，读到的就不是「现在不看它」，而是「它不存在」。 */
  /* 切镜头时当前账号可能不在这条线上(比如站在林一一的位置切到 DMPK),
     那就落到这条线的第一个人身上,否则会停在一个看不到任何东西的账号里。 */
  useEffect(() => {
    if (lensAccounts.some((item) => item.id === accountId)) return;
    const fallback = lensAccounts[0]?.id;
    if (fallback) setAccountId(fallback);
  }, [lens, accountId, lensAccounts]);

  /* 换镜头、换账号都先回首页。
     ----------------------------------------------------------------------
     换账号是换了一个人：停在上一个人的会话里，看的是他的对话、他的参数，
     而侧栏和收件箱已经换成了你的——一屏之内两个人。
     换镜头收敛的是「看哪条业务线」：留在原地的话，当前这条会话多半已经
     不在侧栏的树里了，人会以为任务被删了。

     顺手把站内信的层级位置也清掉：上一个账号打开着的那封信不该跟着过来。 */
  const leaveToHome = () => {
    setInboxTicketId(null);
    setInboxNoticeTitle(null);
    setInboxReviewing(false);
    openNewTaskHome();
  };

  const changeLens = (next: DemoLens) => {
    setLens(next);
    window.history.replaceState(null, "", demoLensSearch(next, window.location.href));
    leaveToHome();
  };

  const changeAccount = (nextId: string) => {
    setAccountId(nextId);
    leaveToHome();
  };
  const inboxCount = tickets.filter((item) => item.assignee === account.name && item.status !== "done" && item.status !== "dropped").length;
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
    <WorkspaceSidebar collapsed={collapsed} activeRoute={route} activeTaskId={activeTaskId} currentProject={project} projects={projects} runtimeTasks={runtimeTasks} pinnedItemIds={pinnedItemIds} unreadTaskIds={unreadTaskIds} attentionTaskIds={attentionTaskIds} deletedProjectIds={deletedProjectIds} deletedTaskIds={deletedTaskIds} renamedTaskTitles={renamedTaskTitles} libraryFolders={libraryFolders} activeLibraryFolderId={libraryFolderId} activeLibrarySpace={route === "library" ? libraryProject : null} highlightedProjectId={highlightedProjectId} account={account} inboxCount={inboxCount} lens={lens} onLensChange={changeLens} switchableAccounts={lensAccounts} onAccountChange={changeAccount} onOpenInbox={() => setRoute("inbox")} onOpenLibraryFolder={(projectName, folderId) => { setLibraryProject(projectName); setLibraryFolderId(folderId); setLibraryView(folderId ? "folder" : "overview"); setRoute("library"); }} onCreateProject={createProject} onRenameProject={renameProject} onDeleteProject={deleteProject} onRenameTask={renameTask} onDeleteTask={deleteTask} onTogglePinnedItem={togglePin} onRouteChange={navigateShellRoute} onStartTask={resetNewTask} onOpenTask={openTask} onOpenQuotationManagement={() => setQuotationTarget({ business: "root" })} onToggleCollapsed={() => setCollapsed((value) => !value)} />
    {handoffOpen ? <TicketHandoffDialog currentUser={account.name} projects={visibleProjects.filter((item) => item.type === "client").map((item) => item.name)} defaultProject={project} onSubmit={submitHandoff} onClose={() => setHandoffOpen(false)} /> : null}
    <button className="mobileSidebarBackdrop" type="button" aria-label="关闭侧边栏" onClick={() => setCollapsed(true)} />
    {route === "module" ? <button className="mobileModuleSidebarTrigger" type="button" onClick={() => setCollapsed(false)} aria-label="打开侧边栏"><Menu size={16} /></button> : null}
    {route === "module" && Session && activeModule ? <Session key={activeTaskId ?? "session"} projectName={project ?? "未归属项目"} taskTitle={taskTitle} initialRequest={initialRequest} initialAttachments={initialAttachments} coworkers={coworkerRegistry} activeCoworkerId={activeCoworkerId} onCoworkerChange={changeCoworker} onRunStatusChange={handleRunStatusChange} onBackToNewTask={() => resetNewTask(project)} handoffNotice={handoffNotice} priorSessionSnapshots={(activeTaskId ? sessionSnapshots[activeTaskId] : undefined)?.filter((snapshot) => snapshot.moduleId !== activeModule.moduleId)} onSessionSnapshotChange={handleSessionSnapshotChange} onOpenQuotationManagement={(options) => setQuotationTarget({ business: "dmpk", ...options })} viewerRole={account.role} viewerName={account.name} rework={activeTaskId ? reworkByTask[activeTaskId] : undefined} onReworkResolved={() => { if (activeTaskId) setReworkByTask((current) => { const next = { ...current }; delete next[activeTaskId]; return next; }); }} initialHistory={activeTaskId ? seededSessionHistory[activeTaskId] : undefined} initialFields={activeTaskId ? seededSessionFields[activeTaskId] : undefined} onHandoff={handoffFromSession} sessionOutcome={activeTaskId ? sessionOutcomes[activeTaskId] ?? null : null} onSessionOutcomeChange={(next) => { if (activeTaskId) setSessionOutcomes((current) => ({ ...current, [activeTaskId]: next })); }} /> : <section className="dmpkWorkspace workbenchMode"><header className="topbar"><div className="topbarPathLayer"><button className="mobileSidebarTrigger" type="button" onClick={() => setCollapsed(false)} aria-label="打开侧边栏"><Menu size={16} /></button><div className="breadcrumb">{route === "tasks" ? <><span>我的待办</span><ChevronRight size={14} /><strong>待处理</strong></> : route === "newTask" && helperConversationStarted ? <><span>{project ?? "未归属项目"}</span><ChevronRight size={14} /><strong>{taskTitle}</strong></> : route === "inbox" && (inboxTicketId || inboxNoticeTitle) ? <><button type="button" onClick={() => { setInboxTicketId(null); setInboxNoticeTitle(null); setInboxReviewing(false); }}>站内信</button><ChevronRight size={14} />{inboxReviewing && inboxTicketId ? <><button type="button" onClick={() => setInboxReviewing(false)}>{inboxTicketLabel}</button><ChevronRight size={14} /><strong>报价复核</strong></> : <strong>{inboxTicketLabel ?? inboxNoticeTitle}</strong>}</> : route === "library" && libraryProject ? <><button type="button" onClick={() => { setLibraryProject(null); setLibraryFolderId(null); setLibraryView("overview"); }}>数据中枢</button><ChevronRight size={14} />{librarySectionLabel ? <><button type="button" onClick={() => { setLibraryFolderId(null); setLibraryView("overview"); }}>{libraryProject}</button><ChevronRight size={14} /><strong>{librarySectionLabel}</strong></> : <strong>{libraryProject}</strong>}</> : <strong>{route === "library" ? "数据中枢" : route === "inbox" ? "站内信" : route === "knowledgeBase" ? "知识库" : route === "digitalTeam" ? "数字团队" : "新建任务"}</strong>}</div><div className="topbarScopeSlot" id="workbench-topbar-scope" /><div className="topbarPrimarySlot" id="workbench-topbar-primary" /></div><div className="topbarSecondRow"><div id="workbench-topbar-tabs" className="topbarTabLayer" /><div id="workbench-topbar-actions" className="topbarToolLayer" /></div></header>{route === "tasks" ? <TaskList pinnedItemIds={pinnedItemIds} onTogglePinnedItem={togglePin} onStartTask={() => resetNewTask()} onOpenTask={openTask} /> : route === "inbox" ? <TicketsPage tickets={tickets} currentUser={account.name} projects={visibleProjects.filter((item) => item.type === "client").map((item) => item.name)} onHandle={handleTicket} onAccept={acceptTicket} reviewerRole={account.roleLabel} onReject={rejectTicket} onArchive={approveTicket} lensKind={activeLens.kindLabel} openTicketId={inboxTicketId} onOpenTicketChange={setInboxTicketId} openNoticeTitle={inboxNoticeTitle} onOpenNoticeChange={setInboxNoticeTitle} reviewing={inboxReviewing} onReviewingChange={setInboxReviewing} /> : route === "library" ? <FileManager projects={visibleProjects} selectedProject={libraryProject} selectedFolderId={libraryFolderId} folders={libraryFolders} view={libraryView} onSelectedProjectChange={(nextProject) => { setLibraryProject(nextProject); if (!nextProject) { setLibraryFolderId(null); setLibraryView("overview"); } }} onSelectedFolderChange={setLibraryFolderId} onViewChange={setLibraryView} onCreateProject={createProject} /> : route === "digitalTeam" ? <DigitalTeamPage projects={visibleProjects} tasks={runtimeTasks.filter((task) => !deletedTaskIds.includes(task.id))} onStartModule={startModuleDirect} onOpenLibrary={() => navigateShellRoute("library")} /> : route === "knowledgeBase" ? <KnowledgeBasePage /> : <NewTaskHome conversationStarted={helperConversationStarted} project={project} text={text} clarification={clarification} pendingRequest={pendingRequest} pendingTaskType={pendingModule?.taskType ?? null} suggestedCoworker={suggestedCoworker} coworkers={coworkerRegistry} activeCoworkerId={activeCoworkerId} quickStarts={quickStarts} projectOptions={visibleProjectOptions} projectNotice={projectNotice} onProjectChange={(nextProject) => { setProject(nextProject); setProjectNotice(null); }} onTextChange={setText} onSubmit={submitIntent} onQuickStart={startModuleDirect} onCoworkerChange={selectPendingCoworker} onConfirm={confirmDispatch} onCancel={cancelDispatch} />}</section>}
  </main>;
}
