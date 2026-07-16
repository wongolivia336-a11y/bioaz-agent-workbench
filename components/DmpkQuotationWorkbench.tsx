"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Pin,
  PinOff,
  Search,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { WorkbenchInspector } from "./workbench-inspector/WorkbenchInspector";
import { getDmpkInspectorPanels } from "./workbench-inspector/dmpkInspectorPanels";

type Stage = "idle" | "thinking" | "collecting" | "ready" | "generating" | "generated";
type GroupId = "assay" | "animal" | "analysis" | "delivery";
type InspectorPanelId = "process" | "materials" | "gaps" | "evidence" | "artifacts" | "review";
type WorkbenchView = "newTask" | "tasks" | "library" | "quotation";
type DigitalCoworkerId = "helper" | "dmpk" | "report" | "qa";
type PinItemType = "project" | "task";
type WorkspaceTask = {
  id: string;
  title: string;
  project: string;
  coworker: string;
  time: string;
  status: string;
};
type FileSpace = "projects" | "rules";
type KnowledgeFile = {
  id: string;
  title: string;
  project: string;
  space: FileSpace;
  kind: string;
  business: string;
  owner: string;
  updated: string;
  status: string;
  agentReady: boolean;
};

function useDismissableLayer<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return ref;
}

const projectOptions = ["XX药业-PD1临床前评价", "YY药业-Balb/c nude评价", "ZZ药业-CT26模型评价", "临时任务"];

type Field = {
  id: string;
  label: string;
  value: string;
  required: boolean;
  group: GroupId;
};

type DraftTab = { fieldId: string; label: string; value: string };
type ChatMessage = { id: string; role: "user" | "agent"; text: string };
type IntentFollowUp = { text: string; question: string };

const groups: Array<{ id: GroupId; title: string }> = [
  { id: "assay", title: "检测类型" },
  { id: "animal", title: "动物实验" },
  { id: "analysis", title: "生物分析" },
  { id: "delivery", title: "报告与报价" },
];

const initialFields: Field[] = [
  { id: "assayType", label: "检测类型", value: "", required: true, group: "assay" },
  { id: "molecule", label: "分子类型", value: "", required: true, group: "assay" },
  { id: "species", label: "动物种属", value: "", required: true, group: "animal" },
  { id: "animalsPerGroup", label: "每组动物数", value: "", required: true, group: "animal" },
  { id: "groupCount", label: "组数", value: "", required: true, group: "animal" },
  { id: "cycle", label: "试验周期", value: "", required: true, group: "animal" },
  { id: "compoundType", label: "化合物类别", value: "", required: true, group: "analysis" },
  { id: "method", label: "分析方法", value: "", required: true, group: "analysis" },
  { id: "sampleType", label: "样品类型", value: "", required: true, group: "analysis" },
  { id: "bloodPoints", label: "采血点数", value: "", required: true, group: "analysis" },
  { id: "analyteCount", label: "待测物数量", value: "", required: true, group: "analysis" },
  { id: "format", label: "报告格式", value: "", required: true, group: "delivery" },
  { id: "language", label: "报告语言", value: "", required: true, group: "delivery" },
  { id: "region", label: "报价区域", value: "", required: true, group: "delivery" },
];

const options: Record<string, string[]> = {
  compoundType: ["普通小分子", "寡核苷酸", "多肽", "抗体"],
  method: ["LC-MS/MS", "ELISA", "qPCR", "LBA"],
  sampleType: ["血浆", "血清", "组织匀浆", "尿液"],
  analyteCount: ["1", "2", "3", "自定义"],
  format: ["Word + Excel", "Word", "Excel"],
  language: ["中文", "英文", "中英双语"],
  region: ["国内", "欧美", "亚太"],
};

const descriptions: Record<GroupId, string> = {
  assay: "确认 DMPK 下的检测业务线与分子类型。",
  animal: "动物数量、组数和周期会直接影响报价规则。",
  analysis: "请补齐分析方法、样品和待测物参数。",
  delivery: "确认交付格式、语言、区域和管理费规则。",
};

const digitalCoworkers: Record<DigitalCoworkerId, { label: string; hint: string; scope: string; owner: string }> = {
  helper: {
    label: "BioAZ Helper",
    hint: "自动识别意图并分配给合适的数字同事",
    scope: "自动识别",
    owner: "全局",
  },
  dmpk: {
    label: "DMPK报价同事",
    hint: "收集报价参数、匹配规则、生成 Word/Excel 报价产物",
    scope: "报价",
    owner: "SD助理可调用",
  },
  report: {
    label: "药效报告同事",
    hint: "撰写批次报告、对齐原始数据、标注异常波动",
    scope: "报告",
    owner: "SD助理可调用",
  },
  qa: {
    label: "QA审核同事",
    hint: "检查交付包完整性、追溯证据、生成复核清单",
    scope: "复核",
    owner: "QA助理可调用",
  },
};

const workspacePinCatalog: Array<{ id: string; type: PinItemType; title: string; time?: string; status?: string; project?: string; coworker?: DigitalCoworkerId }> = [
  { id: "project-xx", type: "project", title: "XX药业-PD1临床前评价" },
  { id: "project-yy", type: "project", title: "YY药业-Balb/c nude评价" },
  { id: "project-zz", type: "project", title: "ZZ药业-CT26模型评价" },
  { id: "task-sample9", type: "task", title: "样本 9 双批次报告", project: "XX药业-PD1临床前评价", coworker: "report", time: "36 分钟前", status: "pending" },
  { id: "task-balbc", type: "task", title: "Balb/c nude 报价", project: "XX药业-PD1临床前评价", coworker: "dmpk", time: "3 天前", status: "done" },
  { id: "task-qa", type: "task", title: "报告交付包 QA复核", project: "XX药业-PD1临床前评价", coworker: "qa", time: "1 小时前", status: "done" },
  { id: "task-new-quote", type: "task", title: "新建报价任务", project: "YY药业-Balb/c nude评价", coworker: "dmpk", time: "刚刚", status: "running" },
  { id: "task-ba", type: "task", title: "Balb/c nude BA 报价", project: "YY药业-Balb/c nude评价", coworker: "dmpk", time: "3 天前", status: "done" },
  { id: "task-ct26", type: "task", title: "报价交付包复核", time: "1 周", status: "done" },
  { id: "task-temp", type: "task", title: "内部试跑报价模型对比", time: "今天", status: "running" },
];

function groupTitle(id: GroupId) {
  return groups.find((group) => group.id === id)?.title ?? "";
}

function detectCoworker(text: string): Exclude<DigitalCoworkerId, "helper"> | null {
  if (/qa|审核|复核|检查|交付包/i.test(text)) return "qa";
  if (/报告|肿瘤|药效|撰写|批次/i.test(text)) return "report";
  if (/dmpk|pk|报价|价格|检测|动物实验/i.test(text)) return "dmpk";
  return null;
}

export default function DmpkQuotationWorkbench() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<WorkbenchView>("newTask");
  const [activeCoworker, setActiveCoworker] = useState<DigitalCoworkerId>("helper");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("新建任务");
  const [pinnedItemIds, setPinnedItemIds] = useState<string[]>(["task-new-quote"]);
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [activeGroup, setActiveGroup] = useState<GroupId>("assay");
  const [openGroups, setOpenGroups] = useState<Record<GroupId, boolean>>({
    assay: true,
    animal: false,
    analysis: false,
    delivery: false,
  });
  const [draftTabs, setDraftTabs] = useState<DraftTab[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "hello",
      role: "agent",
      text: "你好，我是 BioAZ Helper。描述任务后，我会识别意图，并在分派前请你确认数字同事。",
    },
  ]);
  const [composerText, setComposerText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<"word" | "excel" | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(false);
  const [inspectorPanelId, setInspectorPanelId] = useState<InspectorPanelId>("process");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [pendingDispatchText, setPendingDispatchText] = useState<string | null>(null);
  const [dispatchCoworker, setDispatchCoworker] = useState<Exclude<DigitalCoworkerId, "helper">>("dmpk");
  const [intentFollowUp, setIntentFollowUp] = useState<IntentFollowUp | null>(null);

  const missingFields = useMemo(() => fields.filter((field) => field.required && !field.value), [fields]);
  const visibleCardFields = missingFields.filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id));
  const editingField = fields.find((field) => field.id === editingFieldId) ?? null;
  const composerFields = editingField ? [editingField].filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id)) : visibleCardFields;
  const completedCount = fields.filter((field) => field.value).length;
  const totalRequired = fields.filter((field) => field.required).length;
  const hasParameterPanel = activeView === "quotation" && activeCoworker === "dmpk";

  const appendMessage = (role: ChatMessage["role"], text: string) => {
    setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text }]);
  };

  const patchFields = (patch: Record<string, string>) => {
    setFields((items) => items.map((field) => (patch[field.id] ? { ...field, value: patch[field.id] } : field)));
  };

  const handleInitialRequest = (text: string, options: { skipUserMessage?: boolean } = {}) => {
    if (!options.skipUserMessage) appendMessage("user", text);
    setComposerText("");
    setStage("thinking");
    setInspectorPanelId("process");
    window.setTimeout(() => {
      patchFields(parseRequest(text));
      setActiveGroup("analysis");
      setOpenGroups({ assay: false, animal: false, analysis: true, delivery: false });
      setStage("collecting");
      appendMessage(
        "agent",
        "已识别 DMPK / PK 检测、小分子、SD 大鼠、每组 2 只、2 组、试验周期 1 周和 3 个非加班采血点。还需要补充生物分析和报告与报价参数。",
      );
    }, 900);
  };

  const addDraft = (field: Field, value: string) => {
    setDraftTabs((items) => [...items.filter((item) => item.fieldId !== field.id), { fieldId: field.id, label: field.label, value }]);
  };

  const requestFieldEdit = (fieldId: string) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    setEditingFieldId(field.id);
    setDraftTabs((items) => items.filter((item) => item.fieldId !== field.id));
    setActiveGroup(field.group);
    setOpenGroups((current) => ({ ...current, [field.group]: true }));
    setStage("collecting");
    appendMessage("agent", `请问您希望将${field.label}修改为什么？请在下方选择一个新值，发送后我会更新右侧参数。`);
  };

  const sendDraft = () => {
    if (!draftTabs.length) return;
    const sentTabs = draftTabs;
    appendMessage("user", `补充报价参数：\n${sentTabs.map((tab) => `${tab.label}：${tab.value}`).join("\n")}`);
    setStage("thinking");
    setInspectorPanelId("process");

    window.setTimeout(() => {
      setFields((items) =>
        items.map((field) => {
          const draft = sentTabs.find((tab) => tab.fieldId === field.id);
          return draft ? { ...field, value: draft.value } : field;
        }),
      );

      const remaining = fields.filter((field) => field.required && !field.value && !sentTabs.some((tab) => tab.fieldId === field.id));
      const nextGroup = groups.find((group) => remaining.some((field) => field.group === group.id))?.id;
      setDraftTabs([]);
      setEditingFieldId(null);
      if (nextGroup) {
        setActiveGroup(nextGroup);
        setOpenGroups((current) => ({ ...current, [nextGroup]: true }));
        setStage("collecting");
        appendMessage("agent", `已更新报价参数。还需补充 ${remaining.length} 项参数，请继续在下方补全卡中选择。`);
      } else {
        setStage("ready");
        appendMessage("agent", "计价关键字段已齐全。请进行报价前确认，确认后生成 Word 报价单和 Excel 报价明细。");
      }
    }, 700);
  };

  const submitComposer = () => {
    const text = composerText.trim();
    if (draftTabs.length) {
      if (stage === "collecting" && composerFields.length) return;
      sendDraft();
      return;
    }
    if (!text || stage === "thinking" || stage === "generating") return;
    if (activeView === "newTask") {
      const intentText = intentFollowUp ? `${intentFollowUp.text}；补充：${text}` : text;
      const suggestedCoworker = detectCoworker(intentText);
      if (!suggestedCoworker) {
        setIntentFollowUp({ text: intentText, question: "这项工作更接近 DMPK 报价、药效报告撰写，还是交付包 QA 复核？" });
        setComposerText("");
        return;
      }
      setIntentFollowUp(null);
      setDispatchCoworker(suggestedCoworker);
      setPendingDispatchText(intentText);
      setComposerText("");
      return;
    }
    if (stage === "idle" && activeCoworker === "helper") {
      const suggestedCoworker = detectCoworker(text) ?? "dmpk";
      appendMessage("user", text);
      appendMessage("agent", `我理解这是${digitalCoworkers[suggestedCoworker].label}可以处理的任务，请确认分派。`);
      setDispatchCoworker(suggestedCoworker);
      setPendingDispatchText(text);
      setComposerText("");
      return;
    }
    handleInitialRequest(text);
  };

  const confirmDispatch = () => {
    if (!pendingDispatchText) return;
    const text = pendingDispatchText;
    setPendingDispatchText(null);
    setIntentFollowUp(null);
    setActiveCoworker(dispatchCoworker);
    if (activeView === "newTask") {
      const nextProject = selectedProject ?? "临时任务";
      const nextTitle = dispatchCoworker === "dmpk" ? "DMPK 报价任务" : dispatchCoworker === "report" ? "药效报告任务" : "交付包 QA 复核";
      setSelectedProject(nextProject);
      setTaskTitle(nextTitle);
      setMessages([{ id: `user-${Date.now()}`, role: "user", text }]);
      setActiveView("quotation");
      if (dispatchCoworker === "dmpk") handleInitialRequest(text, { skipUserMessage: true });
      else window.setTimeout(() => appendMessage("agent", `已交给${digitalCoworkers[dispatchCoworker].label}。可以继续补充要求或上传项目文件。`), 250);
      return;
    }
    if (dispatchCoworker === "dmpk") {
      handleInitialRequest(text, { skipUserMessage: true });
      return;
    }
    appendMessage("agent", `已交给${digitalCoworkers[dispatchCoworker].label}。当前任务已创建，可以继续补充要求或上传文件。`);
  };

  const togglePinnedItem = (id: string) => {
    setPinnedItemIds((items) => (items.includes(id) ? items.filter((item) => item !== id) : [id, ...items]));
  };

  const startNewTask = (project: string | null = null) => {
    setSelectedProject(project);
    setTaskTitle("新建任务");
    setActiveCoworker("helper");
    setComposerText("");
    setPendingDispatchText(null);
    setIntentFollowUp(null);
    setStage("idle");
    setMessages([{ id: "hello", role: "agent", text: "你好，我是 BioAZ Helper。描述任务后，我会识别意图，并在分派前请你确认数字同事。" }]);
    setActiveView("newTask");
  };

  const openExistingTask = (project: string, title: string, coworker: DigitalCoworkerId = "helper") => {
    setSelectedProject(project);
    setTaskTitle(title);
    setActiveCoworker(coworker);
    setPendingDispatchText(null);
    setIntentFollowUp(null);
    setStage("idle");
    setMessages([{ id: `context-${Date.now()}`, role: "agent", text: `已打开“${title}”。可以继续补充要求或查看相关项目文件。` }]);
    setActiveView("quotation");
  };

  const cancelDispatch = () => {
    if (pendingDispatchText) setComposerText(pendingDispatchText);
    setPendingDispatchText(null);
  };

  const startGeneration = () => {
    setPreviewOpen(false);
    setStage("generating");
    setInspectorPanelId("process");
    appendMessage("user", "确认参数，生成正式报价单。");
    window.setTimeout(() => {
      setStage("generated");
      setInspectorPanelId("artifacts");
      setInspectorOpen(true);
      appendMessage("agent", "报价单已生成。Word 与 Excel 金额校验一致。");
    }, 1800);
  };

  const openInspector = (panelId: InspectorPanelId) => {
    setInspectorPanelId(panelId);
    setInspectorOpen(true);
  };

  const inspectorPanels = getDmpkInspectorPanels({
    stage,
    fields,
    activeGroup,
    projectName: selectedProject ?? "临时任务",
    taskTitle,
    requestText: messages.find((message) => message.role === "user")?.text ?? "",
    onEditField: requestFieldEdit,
    onPreviewArtifact: setArtifactPreview,
    onPreviewQuotation: () => setPreviewOpen(true),
  });

  return (
    <main className={`dmpkShell ${collapsed ? "sidebarCollapsed" : ""} ${!hasParameterPanel ? "workbenchShell" : ""}`}>
      <WorkspaceSidebar collapsed={collapsed} activeView={activeView} pinnedItemIds={pinnedItemIds} onTogglePinnedItem={togglePinnedItem} onViewChange={setActiveView} onStartTask={startNewTask} onOpenTask={openExistingTask} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      <section className={`dmpkWorkspace ${activeView !== "quotation" ? "workbenchMode" : ""}`}>
        <header className="topbar">
          <div className="breadcrumb">
            {activeView === "library" ? <strong>文件管理系统</strong> : activeView === "newTask" ? <strong>新建任务</strong> : activeView === "tasks" ? <><span>我的任务</span><ChevronRight size={15} /><strong>待处理</strong></> : <><span>{selectedProject ?? "临时任务"}</span><ChevronRight size={15} /><strong>{taskTitle}</strong></>}
          </div>
        </header>
        {activeView === "library" ? <KnowledgeBase /> : activeView === "newTask" ? <NewTaskHome project={selectedProject} onProjectChange={setSelectedProject} text={composerText} onTextChange={setComposerText} onSubmit={submitComposer} intentFollowUp={intentFollowUp} pendingDispatchText={pendingDispatchText} dispatchCoworker={dispatchCoworker} onDispatchCoworkerChange={setDispatchCoworker} onConfirmDispatch={confirmDispatch} onCancelDispatch={cancelDispatch} /> : activeView === "tasks" ? <TaskWorkbench pinnedItemIds={pinnedItemIds} onTogglePinnedItem={togglePinnedItem} onStartTask={() => startNewTask()} onOpenTask={(task) => openExistingTask(task.project, task.title, task.coworker.includes("DMPK") ? "dmpk" : task.coworker.includes("QA") ? "qa" : task.coworker.includes("药效") ? "report" : "helper")} /> : <>
        <header className="agentHeader">
          <div className="agentTitle">
            <span className="agentIcon pending">
              <FileSpreadsheet size={18} />
            </span>
          <span>{digitalCoworkers[activeCoworker].label}</span>
          </div>
        </header>

        <div className="dmpkChatScroller">
          <Conversation
            messages={messages}
            stage={stage}
            activeGroup={activeGroup}
            currentMissing={missingFields}
            onOpenInspector={openInspector}
            onArtifactPreview={setArtifactPreview}
          />
        </div>

        <Composer
          stage={stage}
          text={composerText}
          setText={setComposerText}
          activeGroup={activeGroup}
          fields={composerFields}
          mode={editingField ? "edit" : "collect"}
          draftTabs={draftTabs}
          onSelect={addDraft}
          onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))}
          onSend={submitComposer}
          onPreview={() => setPreviewOpen(true)}
          onGenerate={startGeneration}
          onOpenInspector={openInspector}
          activeCoworker={activeCoworker}
          onCoworkerChange={setActiveCoworker}
          pendingDispatchText={pendingDispatchText}
          dispatchCoworker={dispatchCoworker}
          onDispatchCoworkerChange={setDispatchCoworker}
          onConfirmDispatch={confirmDispatch}
          onCancelDispatch={cancelDispatch}
          disabled={
            stage === "thinking" ||
            stage === "generating" ||
            (stage === "collecting" && composerFields.length > 0) ||
            (!draftTabs.length && !composerText.trim())
          }
        />
        </>}
      </section>

      {hasParameterPanel ? (
        <aside className={`dmpkPanel ${inspectorPinned ? "hasPinnedInspector" : ""}`}>
          <ParameterPanel
            fields={fields}
            activeGroup={activeGroup}
            openGroups={openGroups}
            completedCount={completedCount}
            totalRequired={totalRequired}
            stage={stage}
            onToggle={(id) => setOpenGroups((current) => ({ ...current, [id]: !current[id] }))}
            onEdit={requestFieldEdit}
          />
          <WorkbenchInspector
            panels={inspectorPanels}
            activePanelId={inspectorPanelId}
            open={inspectorOpen}
            pinned={inspectorPinned}
            onOpenChange={setInspectorOpen}
            onPinnedChange={setInspectorPinned}
            onPanelChange={(panelId) => setInspectorPanelId(panelId as InspectorPanelId)}
          />
        </aside>
      ) : null}

      {previewOpen ? <QuotationPreviewModal fields={fields} onClose={() => setPreviewOpen(false)} /> : null}
      {artifactPreview ? <ArtifactPreviewModal kind={artifactPreview} onClose={() => setArtifactPreview(null)} /> : null}
    </main>
  );
}

function parseRequest(text: string): Record<string, string> {
  const patch: Record<string, string> = {};
  if (/pk/i.test(text)) patch.assayType = "PK检测";
  if (/小分子/.test(text)) patch.molecule = "小分子";
  if (/SD\s*大鼠|SD大鼠/i.test(text)) patch.species = "SD大鼠";
  if (/每组\s*2\s*只/.test(text)) patch.animalsPerGroup = "2";
  if (/2\s*组/.test(text)) patch.groupCount = "2";
  if (/1\s*周|一周/.test(text)) patch.cycle = "1周";
  if (/3\s*个/.test(text)) patch.bloodPoints = "3个非加班时间点";
  return patch;
}

function WorkspaceSidebar({ collapsed, activeView, pinnedItemIds, onTogglePinnedItem, onViewChange, onStartTask, onOpenTask, onToggleCollapsed }: { collapsed: boolean; activeView: WorkbenchView; pinnedItemIds: string[]; onTogglePinnedItem: (id: string) => void; onViewChange: (view: WorkbenchView) => void; onStartTask: (project?: string | null) => void; onOpenTask: (project: string, title: string, coworker?: DigitalCoworkerId) => void; onToggleCollapsed: () => void }) {
  const [open, setOpen] = useState({ oncology: true, dmpk: true, qa: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const pinnedItems = pinnedItemIds.map((id) => workspacePinCatalog.find((item) => item.id === id)).filter((item): item is (typeof workspacePinCatalog)[number] => Boolean(item));
  const startTask = (project: string | null = null) => {
    setNewTaskOpen(false);
    onStartTask(project);
  };
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo/bioaz-logo.svg" alt="" />
        <span>BioAZ</span>
        <button className="sidebarCollapseButton" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}>
          <PanelRight size={17} />
        </button>
      </div>
      <div className="sidebarActions">
        {searchOpen ? (
          <div className="sidebarSearch">
            <Search size={15} />
            <input autoFocus placeholder="搜索任务、项目" />
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="关闭搜索">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="newChatWrap" onMouseEnter={() => setNewTaskOpen(true)} onMouseLeave={() => setNewTaskOpen(false)}>
              <button className={`newChat ${activeView === "newTask" ? "active" : ""}`} type="button" aria-expanded={newTaskOpen} onFocus={() => setNewTaskOpen(true)} onClick={() => startTask()}>
                <span>+</span>
                新建任务
              </button>
              {newTaskOpen ? <div className="newChatMenu isOpen">
                <span className="newChatMenuLabel">挂靠到</span>
                <button type="button" onClick={() => startTask("XX药业-PD1临床前评价")}>
                  <Folder size={16} />
                  XX药业-PD1临床前评价
                </button>
                <button type="button" onClick={() => startTask("YY药业-Balb/c nude评价")}>
                  <Folder size={16} />
                  YY药业-Balb/c nude评价
                </button>
                <button type="button" onClick={() => startTask("ZZ药业-CT26模型评价")}>
                  <Folder size={16} />
                  ZZ药业-CT26模型评价
                </button>
                <button type="button" onClick={() => startTask("临时任务")}>
                  <MessageSquare size={16} />
                  临时任务
                </button>
              </div> : null}
            </div>
            <button className="sidebarSearchButton" type="button" onClick={() => setSearchOpen(true)} aria-label="搜索">
              <Search size={17} />
            </button>
          </>
        )}
      </div>
      <nav className="navBlock workspaceViews" aria-label="工作区">
        <button className={`workspaceViewRow ${activeView === "tasks" ? "active" : ""}`} type="button" onClick={() => onViewChange("tasks")}>
          <FileText size={15} strokeWidth={1.8} />
          <span>我的任务</span>
          <small>3</small>
        </button>
        <button className={`workspaceViewRow ${activeView === "library" ? "active" : ""}`} type="button" onClick={() => onViewChange("library")}>
          <Folder size={15} strokeWidth={1.8} />
          <span>文件管理系统</span>
        </button>
      </nav>
      {pinnedItems.length ? (
        <section className="navBlock pinnedBlock" aria-label="置顶">
          <p>置顶</p>
          {pinnedItems.map((item) => item.type === "project" ? (
            <SidebarPinnedProject key={item.id} title={item.title} onClick={() => onStartTask(item.title)} onUnpin={() => onTogglePinnedItem(item.id)} />
          ) : (
            <SidebarChat key={item.id} title={item.title} time={item.time ?? ""} status={item.status ?? "done"} active={item.id === "task-new-quote" && activeView === "quotation"} pinned onClick={() => onOpenTask(item.project ?? "临时任务", item.title, item.coworker)} onPinToggle={() => onTogglePinnedItem(item.id)} />
          ))}
        </section>
      ) : null}
      <nav className="navBlock projectTree" aria-label="项目">
        <p>项目</p>
        <SidebarProject title="XX药业-PD1临床前评价" open={open.oncology} pinned={pinnedItemIds.includes("project-xx")} onTogglePin={() => onTogglePinnedItem("project-xx")} onNewTask={() => startTask("XX药业-PD1临床前评价")} onToggle={() => setOpen({ ...open, oncology: !open.oncology })}>
          <SidebarChat title="样本 9 双批次报告" time="36 分钟前" status="pending" pinned={pinnedItemIds.includes("task-sample9")} onPinToggle={() => onTogglePinnedItem("task-sample9")} onClick={() => onOpenTask("XX药业-PD1临床前评价", "样本 9 双批次报告", "report")} />
          <SidebarChat title="Balb/c nude 报价" time="3 天前" status="done" pinned={pinnedItemIds.includes("task-balbc")} onPinToggle={() => onTogglePinnedItem("task-balbc")} onClick={() => onOpenTask("XX药业-PD1临床前评价", "Balb/c nude 报价", "dmpk")} />
          <SidebarChat title="报告交付包 QA复核" time="1 小时前" status="done" pinned={pinnedItemIds.includes("task-qa")} onPinToggle={() => onTogglePinnedItem("task-qa")} onClick={() => onOpenTask("XX药业-PD1临床前评价", "报告交付包 QA复核", "qa")} />
        </SidebarProject>
        <SidebarProject title="YY药业-Balb/c nude评价" open={open.dmpk} pinned={pinnedItemIds.includes("project-yy")} onTogglePin={() => onTogglePinnedItem("project-yy")} onNewTask={() => startTask("YY药业-Balb/c nude评价")} onToggle={() => setOpen({ ...open, dmpk: !open.dmpk })}>
          <SidebarChat title="新建报价任务" time="刚刚" status="running" active={activeView === "quotation"} pinned={pinnedItemIds.includes("task-new-quote")} onClick={() => onOpenTask("YY药业-Balb/c nude评价", "新建报价任务", "dmpk")} onPinToggle={() => onTogglePinnedItem("task-new-quote")} />
          <SidebarChat title="Balb/c nude BA 报价" time="3 天前" status="done" pinned={pinnedItemIds.includes("task-ba")} onPinToggle={() => onTogglePinnedItem("task-ba")} onClick={() => onOpenTask("YY药业-Balb/c nude评价", "Balb/c nude BA 报价", "dmpk")} />
        </SidebarProject>
        <SidebarProject title="ZZ药业-CT26模型评价" open={open.qa} pinned={pinnedItemIds.includes("project-zz")} onTogglePin={() => onTogglePinnedItem("project-zz")} onNewTask={() => startTask("ZZ药业-CT26模型评价")} onToggle={() => setOpen({ ...open, qa: !open.qa })}>
          <SidebarChat title="报价交付包复核" time="1 周" status="done" pinned={pinnedItemIds.includes("task-ct26")} onPinToggle={() => onTogglePinnedItem("task-ct26")} onClick={() => onOpenTask("ZZ药业-CT26模型评价", "报价交付包复核", "qa")} />
        </SidebarProject>
        <div className="temporaryTasks">
          <p>临时任务</p>
          <SidebarChat title="内部试跑报价模型对比" time="今天" status="running" archiveable pinned={pinnedItemIds.includes("task-temp")} onPinToggle={() => onTogglePinnedItem("task-temp")} onClick={() => onOpenTask("临时任务", "内部试跑报价模型对比", "helper")} />
        </div>
      </nav>
      <div className="account">
        <div className="avatar">A</div>
        <div>
          <strong>Admin</strong>
          <span>admin@example.com</span>
        </div>
      </div>
    </aside>
  );
}

function SidebarPinnedProject({ title, onClick, onUnpin }: { title: string; onClick: () => void; onUnpin: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="pinnedProjectRow">
      <button type="button" onClick={onClick}><Folder size={15} /><strong>{title}</strong></button>
      <button type="button" aria-label="置顶项目操作" onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={14} /></button>
      {menuOpen ? <div className="sidebarMenu"><button type="button" onClick={onUnpin}><PinOff size={14} />取消置顶</button></div> : null}
    </div>
  );
}

function SidebarProject({ title, open, pinned, onTogglePin, onNewTask, onToggle, children }: { title: string; open: boolean; pinned: boolean; onTogglePin: () => void; onNewTask: () => void; onToggle: () => void; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const openMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(true);
  };
  return (
    <div className="projectGroup">
      <div ref={menuRef} className={`projectRowWrap ${menuOpen ? "menuOpen" : ""}`} onContextMenu={openMenu}>
        <button className="projectRow" type="button" onClick={onToggle}>
          <Folder size={15} strokeWidth={1.8} />
          <strong>{title}</strong>
          <ChevronRight className={open ? "isOpen" : ""} size={14} strokeWidth={1.8} />
        </button>
        <div className="projectHoverActions isActionOnly">
          <button type="button" aria-label="项目操作" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }}>
            <MoreHorizontal size={14} strokeWidth={1.8} />
          </button>
          {menuOpen ? <div className="sidebarMenu projectMenu">
            <button type="button" onClick={() => { onTogglePin(); setMenuOpen(false); }}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}{pinned ? "取消置顶" : "置顶项目"}</button>
            <button type="button" onClick={() => { onNewTask(); setMenuOpen(false); }}><MessageSquare size={14} />新建任务</button>
          </div> : null}
        </div>
      </div>
      {open ? <div className="chatTree">{children}</div> : null}
    </div>
  );
}

function SidebarChat({ title, time, status, active = false, pinned = false, archiveable = false, onClick, onPinToggle }: { title: string; time: string; status: string; active?: boolean; pinned?: boolean; archiveable?: boolean; onClick?: () => void; onPinToggle?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(menuOpen, () => {
    setMenuOpen(false);
    setArchiveOpen(false);
  });
  const openMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(true);
  };
  return (
    <div ref={menuRef} className={`chatRow status-${status} ${active ? "active" : ""} ${pinned ? "isPinnedShortcut" : ""} ${menuOpen ? "menuOpen" : ""}`} onContextMenu={openMenu}>
      <button className="chatRowMain" type="button" onClick={onClick}>
        <FileText className="sidebarIcon" size={15} strokeWidth={1.8} />
        <strong>{title}</strong>
        <small>{time}</small>
      </button>
      <button className="chatMoreButton" type="button" aria-label={`${title}更多操作`} aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }}><MoreHorizontal size={14} /></button>
      {menuOpen ? <div className="sidebarMenu chatMenu">
        <button type="button" onClick={() => { onPinToggle?.(); setMenuOpen(false); }}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}{pinned ? "取消置顶" : "置顶任务"}</button>
        <button type="button" onClick={() => { onClick?.(); setMenuOpen(false); }}><Eye size={14} />打开任务</button>
        {archiveable ? <button type="button" onClick={() => setArchiveOpen((value) => !value)}><Folder size={14} />归档到项目<ChevronRight size={13} /></button> : null}
        {archiveable && archiveOpen ? <div className="archiveSubmenu">
          {["XX药业-PD1临床前评价", "YY药业-Balb/c nude评价", "ZZ药业-CT26模型评价"].map((project) => <button type="button" key={project} onClick={() => { setArchiveOpen(false); setMenuOpen(false); }}>{project}</button>)}
        </div> : null}
      </div> : null}
    </div>
  );
}

function Conversation({
  messages,
  stage,
  activeGroup,
  currentMissing,
  onOpenInspector,
  onArtifactPreview,
}: {
  messages: ChatMessage[];
  stage: Stage;
  activeGroup: GroupId;
  currentMissing: Field[];
  onOpenInspector: (panelId: InspectorPanelId) => void;
  onArtifactPreview: (kind: "word" | "excel") => void;
}) {
  return (
    <div className="dmpkConversation">
      {messages.map((message) => (message.role === "agent" ? <AgentReply key={message.id}>{message.text}</AgentReply> : <UserBubble key={message.id} text={message.text} />))}
      {stage !== "idle" ? (
        <ActivityChain
          title={stage === "generated" ? "已完成报价生成过程" : stage === "thinking" ? "正在处理报价参数" : "已更新报价参数"}
          steps={
            stage === "generating" || stage === "generated"
              ? ["检查计价关键字段", "匹配 PK 动物实验价格规则", "匹配生物分析价格规则", "生成 Word / Excel 报价单", "校验页面与文件金额一致"]
              : ["读取用户输入", "识别 DMPK / PK 业务线", currentMissing.length ? `还缺 ${currentMissing.length} 项报价参数` : "当前阶段参数已齐全"]
          }
          running={stage === "thinking" || stage === "generating"}
          onOpenInspector={onOpenInspector}
        />
      ) : null}
      {stage === "generated" ? <ArtifactCards onPreview={onArtifactPreview} onOpenInspector={onOpenInspector} /> : null}
    </div>
  );
}

function AgentReply({ children }: { children: React.ReactNode }) {
  return (
    <div className="agentReply">
      <span className="replyLogoMark">
        <img src="/logo/bioaz-logo.svg" alt="" />
      </span>
      <p>{children}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return <div className="userBubble">{text}</div>;
}

function BluePanelLink({ panelId, children, onOpenInspector }: { panelId: InspectorPanelId; children: React.ReactNode; onOpenInspector: (panelId: InspectorPanelId) => void }) {
  return (
    <button className="bluePanelLink" type="button" onMouseEnter={() => onOpenInspector(panelId)} onFocus={() => onOpenInspector(panelId)} onClick={() => onOpenInspector(panelId)}>
      {children}
    </button>
  );
}

function ActivityChain({ title, steps, running, onOpenInspector }: { title: string; steps: string[]; running: boolean; onOpenInspector: (panelId: InspectorPanelId) => void }) {
  return (
    <details className="activityChain" open={running}>
      <summary>
        <span className={running ? "agentLogoMark isThinking" : "agentLogoMark isMuted"}>
          <img src="/logo/bioaz-logo.svg" alt="" />
        </span>
        <strong>{title}</strong>
        <span>·</span>
        <BluePanelLink panelId="process" onOpenInspector={onOpenInspector}>查看过程</BluePanelLink>
        <em>{running ? "处理中" : "4s"}</em>
      </summary>
      <div className="activityChainPanel">
        <header>
          <span className={running ? "agentLogoMark isThinking" : "agentLogoMark"}>
            <img src="/logo/bioaz-logo.svg" alt="" />
          </span>
          <strong>{title.replace("已完成", "")}</strong>
          <em>{running ? "处理中" : "4s"}</em>
        </header>
        <div className="activitySteps">
        {steps.map((step, index) => (
          <p key={step} style={{ animationDelay: `${index * 70}ms` }}>
            <i />
            <span>
              <strong>{step}</strong>
              <small>{processStepDetail(step)}</small>
            </span>
          </p>
        ))}
        </div>
      </div>
    </details>
  );
}

function processStepDetail(step: string) {
  if (step.includes("读取")) return "解析自然语言中的检测类型、动物信息、周期和采血点。";
  if (step.includes("识别")) return "匹配 DMPK / PK 业务线，并定位需要补齐的字段组。";
  if (step.includes("检查")) return "确认必填计价字段是否齐全，拦截缺字段出报价。";
  if (step.includes("匹配 PK")) return "根据动物种属、数量、周期和采样点匹配动物实验规则。";
  if (step.includes("匹配生物")) return "根据分析方法、样品类型和待测物数量匹配生物分析规则。";
  if (step.includes("生成")) return "生成 Word 报价单和 Excel 报价明细。";
  if (step.includes("校验")) return "校验页面、Word 和 Excel 的金额一致性。";
  return "同步结构化报价参数台账。";
}

function ParameterTaskCard({ activeGroup, fields, draftTabs, mode, onSelect }: { activeGroup: GroupId; fields: Field[]; draftTabs: DraftTab[]; mode: "collect" | "edit"; onSelect: (field: Field, value: string) => void }) {
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(() => Math.max(0, groups.findIndex((group) => group.id === activeGroup)));
  const pageCount = groups.length;
  const safePage = Math.min(page, pageCount - 1);
  const pageGroup = groups[safePage];
  const pageFields = mode === "edit" ? fields : fields.filter((field) => field.group === pageGroup.id);

  const commitCustom = (field: Field) => {
    const value = customValues[field.id]?.trim();
    if (!value) {
      setEditingCustom(null);
      return;
    }
    onSelect(field, value);
    setEditingCustom(null);
  };

  if (!fields.length) return null;
  return (
    <section className="warningDecision parameterTaskCard">
      <header className="warningDecisionHeader">
        <div>
          <span>参数补全</span>
          <strong>{mode === "edit" ? `修改${fields[0]?.label ?? "参数"}` : "请一次补全报价参数"}</strong>
          <p>{mode === "edit" ? "选择新值后会写入下方参数 tab，发送后更新右侧参数。" : "按检测类型、动物实验、生物分析、报告与报价分页选择；全部补齐后统一发送给 Agent。"}</p>
        </div>
        <small>还需 {fields.length} 项</small>
      </header>
      {mode === "collect" ? (
        <div className="parameterPages">
          {groups.map((group, index) => (
            <button className={index === safePage ? "active" : ""} type="button" key={group.id} onClick={() => setPage(index)}>
              {group.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="warningDecisionList">
        {pageFields.length ? pageFields.map((field, index) => {
          const selected = draftTabs.find((tab) => tab.fieldId === field.id);
          return (
            <article className={`decisionRow ${selected ? "done" : ""}`} key={field.id}>
              <span className="decisionIndex">{selected ? <Check size={17} /> : index + 1}</span>
              <div className="decisionCopy">
                <span>{field.required ? "必填 · 计价关键字段" : "可选"}</span>
                <strong>{field.label}</strong>
                <div className="optionGrid">
                  {(options[field.id] ?? ["1", "2", "3"]).map((option) =>
                    option === "自定义" && editingCustom === field.id ? (
                      <input
                        autoFocus
                        className="customOptionInput"
                        key={option}
                        onBlur={() => commitCustom(field)}
                        onChange={(event) => setCustomValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitCustom(field);
                          if (event.key === "Escape") setEditingCustom(null);
                        }}
                        placeholder="输入"
                        value={customValues[field.id] ?? ""}
                      />
                    ) : (
                      <button
                        className={selected?.value === option ? "selected" : ""}
                        type="button"
                        key={option}
                        onClick={() => {
                          if (option === "自定义") {
                            setEditingCustom(field.id);
                            return;
                          }
                          onSelect(field, option);
                        }}
                      >
                        {option}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </article>
          );
        }) : <p className="emptyPageNote">{pageGroup.title}参数已齐全，可切换下一页继续补全。</p>}
      </div>
      <div className="parameterPager">
        <p className="responsibilityNote">选择会先写入下方参数 tab，全部补齐后才正式更新右侧参数台账。</p>
        {mode === "collect" ? (
          <div>
            <span>{safePage + 1}/{pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={safePage === 0}>
              上一页
            </button>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={safePage >= pageCount - 1}>
              下一页
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TaskWorkbench({ pinnedItemIds, onTogglePinnedItem, onStartTask, onOpenTask }: { pinnedItemIds: string[]; onTogglePinnedItem: (id: string) => void; onStartTask: () => void; onOpenTask: (task: WorkspaceTask) => void }) {
  const actionTasks: WorkspaceTask[] = [
    { id: "task-qa", title: "报告交付包 QA复核 · 等你审核", project: "XX药业-PD1临床前评价", coworker: "QA审核同事", time: "2小时前", status: "待我处理" },
    { id: "task-balbc", title: "Balb/c nude 报价 · 需要补充参数", project: "YY药业-Balb/c nude评价", coworker: "DMPK报价同事", time: "昨天", status: "待补充" },
    { id: "task-ct26", title: "CT26 交付包 · 待确认最终版", project: "ZZ药业-CT26模型评价", coworker: "QA审核同事", time: "3天前", status: "待确认" },
  ];
  const allTasks: WorkspaceTask[] = [
    { id: "task-sample9", title: "样本9 双批次报告", project: "XX药业-PD1临床前评价", coworker: "药效报告同事", time: "36分钟前", status: "处理中" },
    { id: "task-ba", title: "Balb/c nude BA 报价", project: "YY药业-Balb/c nude评价", coworker: "DMPK报价同事", time: "3天前", status: "已完成" },
    { id: "task-qa", title: "报告交付包 QA复核", project: "XX药业-PD1临床前评价", coworker: "QA审核同事", time: "1小时前", status: "待审核" },
    { id: "task-temp", title: "内部试跑报价模型对比", project: "临时任务", coworker: "BioAZ Helper", time: "今天", status: "临时任务" },
  ];
  const [projectFilter, setProjectFilter] = useState("全部项目");
  const [coworkerFilter, setCoworkerFilter] = useState("全部同事");
  const [statusFilter, setStatusFilter] = useState("全部状态");
  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(null);
  const filteredTasks = allTasks.filter((task) =>
    (projectFilter === "全部项目" || task.project === projectFilter) &&
    (coworkerFilter === "全部同事" || task.coworker === coworkerFilter) &&
    (statusFilter === "全部状态" || task.status === statusFilter),
  );
  return (
    <section className="workbenchView taskWorkbenchView">
      <header>
        <div>
          <h1>我的任务</h1>
        </div>
        <button className="primaryButton compact" type="button" onClick={onStartTask}>新建任务</button>
      </header>
      <div className="taskQueueShell">
        <section className="taskQueueSection">
          <h2>待我处理 · 3</h2>
          <div className="workbenchTaskList">
            {actionTasks.map((task) => (
              <TaskRow key={task.id} task={task} actionRequired pinned={pinnedItemIds.includes(task.id)} onPin={() => onTogglePinnedItem(task.id)} onPreview={() => setSelectedTask(task)} onEnter={() => onOpenTask(task)} />
            ))}
          </div>
        </section>
        <section className="taskQueueSection">
          <div className="taskSectionHeader">
            <h2>全部任务</h2>
            <div className="taskFilters">
              <CompactSelect value={projectFilter} options={["全部项目", "XX药业-PD1临床前评价", "YY药业-Balb/c nude评价", "临时任务"]} onChange={setProjectFilter} />
              <CompactSelect value={coworkerFilter} options={["全部同事", "药效报告同事", "DMPK报价同事", "QA审核同事", "BioAZ Helper"]} onChange={setCoworkerFilter} />
              <CompactSelect value={statusFilter} options={["全部状态", "处理中", "已完成", "待审核", "临时任务"]} onChange={setStatusFilter} />
            </div>
          </div>
          <div className="workbenchTaskList allTaskList">
            {filteredTasks.map((task) => <TaskRow key={task.id} task={task} pinned={pinnedItemIds.includes(task.id)} onPin={() => onTogglePinnedItem(task.id)} onPreview={() => setSelectedTask(task)} onEnter={() => onOpenTask(task)} />)}
            {!filteredTasks.length ? <div className="emptyListState">没有符合当前筛选条件的任务</div> : null}
          </div>
        </section>
      </div>
      <WorkspaceAssistant context="tasks" onOpenQuotation={onStartTask} />
      {selectedTask ? <TaskPreviewDialog task={selectedTask} onClose={() => setSelectedTask(null)} onOpenTask={onOpenTask} /> : null}
    </section>
  );
}

function TaskRow({ task, actionRequired = false, pinned, onPin, onPreview, onEnter }: { task: WorkspaceTask; actionRequired?: boolean; pinned: boolean; onPin: () => void; onPreview: () => void; onEnter: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLElement>(menuOpen, () => setMenuOpen(false));
  const openMenu = (event: React.MouseEvent) => { event.preventDefault(); setMenuOpen(true); };
  return (
    <article ref={menuRef} className={`workbenchTaskCard ${actionRequired ? "actionRequired" : ""} ${menuOpen ? "selected" : ""}`} onContextMenu={openMenu}>
      <button className="taskRowMain" type="button" onClick={onPreview}>
        <FileText size={16} strokeWidth={1.8} />
        <span><strong>{task.title}</strong><small>{task.project} · {task.coworker} · {task.time}</small></span>
      </button>
      <em>{task.status}</em>
      <button className="rowMoreButton" type="button" aria-label={`${task.title}更多操作`} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={15} /></button>
      {menuOpen ? <div className="rowActionMenu">
        <button type="button" onClick={() => { onPreview(); setMenuOpen(false); }}><Eye size={14} />预览任务</button>
        <button type="button" onClick={() => { onPin(); setMenuOpen(false); }}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}{pinned ? "取消置顶" : "置顶任务"}</button>
        <button type="button" onClick={() => { onEnter(); setMenuOpen(false); }}><MessageSquare size={14} />进入会话</button>
      </div> : null}
    </article>
  );
}

function TaskPreviewDialog({ task, onClose, onOpenTask }: { task: WorkspaceTask; onClose: () => void; onOpenTask: (task: WorkspaceTask) => void }) {
  const enterTask = () => {
    onOpenTask(task);
    onClose();
  };
  return (
    <div className="modalBackdrop taskPreviewBackdrop" role="dialog" aria-modal="true">
      <section className="taskPreviewDialog">
        <header><div><span>{task.project}</span><h2>{task.title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header>
        <div className="taskPreviewBody">
          <dl><div><dt>状态</dt><dd>{task.status}</dd></div><div><dt>数字同事</dt><dd>{task.coworker}</dd></div><div><dt>最近更新</dt><dd>{task.time}</dd></div></dl>
          <section><h3>最近进展</h3><p>已完成任务信息整理，当前等待下一步处理或确认。</p><p>相关项目文件已连接到任务上下文。</p></section>
        </div>
        <footer><button className="secondaryButton compact" type="button" onClick={onClose}>关闭</button><button className="primaryButton compact" type="button" onClick={enterTask}>进入任务会话</button></footer>
      </section>
    </div>
  );
}

function CompactSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={menuRef} className={`compactSelect ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{value}<ChevronDown size={13} /></button>{open ? <div className="compactSelectMenu">{options.map((option) => <button type="button" className={option === value ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option}</span>{option === value ? <Check size={13} /> : null}</button>)}</div> : null}</div>;
}

function NewTaskHome({ project, onProjectChange, text, onTextChange, onSubmit, intentFollowUp, pendingDispatchText, dispatchCoworker, onDispatchCoworkerChange, onConfirmDispatch, onCancelDispatch }: { project: string | null; onProjectChange: (project: string) => void; text: string; onTextChange: (value: string) => void; onSubmit: () => void; intentFollowUp: IntentFollowUp | null; pendingDispatchText: string | null; dispatchCoworker: Exclude<DigitalCoworkerId, "helper">; onDispatchCoworkerChange: (coworker: Exclude<DigitalCoworkerId, "helper">) => void; onConfirmDispatch: () => void; onCancelDispatch: () => void }) {
  const examples = [
    { title: "发起 DMPK 报价", prompt: "我要发起一份 DMPK 报价", icon: <FileSpreadsheet size={17} /> },
    { title: "撰写药效报告", prompt: "我要撰写一份肿瘤药效报告", icon: <FileText size={17} /> },
    { title: "复核交付包", prompt: "我要复核一份报告交付包", icon: <Check size={17} /> },
  ];
  return <section className="newTaskHome">
    <div className="newTaskIntro">
      <span className="newTaskMark"><img src="/logo/bioaz-logo.svg" alt="BioAZ" /></span>
      <h1>今天要处理什么？</h1>
      <div className="taskExampleGrid">{examples.map((example) => <button type="button" key={example.title} onClick={() => onTextChange(example.prompt)}>{example.icon}<strong>{example.title}</strong></button>)}</div>
    </div>
    <div className="newTaskComposerDock">
      <div className="newTaskIntentConversation">
        {intentFollowUp || pendingDispatchText ? <p>{intentFollowUp?.text ?? pendingDispatchText}</p> : null}
        <div><img src="/logo/bioaz-logo.svg" alt="" /><span>{intentFollowUp?.question ?? (pendingDispatchText ? `我建议交给${digitalCoworkers[dispatchCoworker].label}，请确认后开始任务。` : project ? `你想在“${project}”中完成什么任务？` : "你想完成什么任务？也可以先选择所属项目。")}</span></div>
      </div>
      {pendingDispatchText ? <DispatchConfirmCard coworker={dispatchCoworker} onCoworkerChange={onDispatchCoworkerChange} onConfirm={onConfirmDispatch} onCancel={onCancelDispatch} /> : null}
      <ProjectSelector project={project} onChange={onProjectChange} />
      <div className="newTaskComposer">
        <textarea value={text} onChange={(event) => onTextChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} placeholder="描述你要完成的任务..." rows={2} />
        <button type="button" onClick={onSubmit} disabled={!text.trim()} aria-label="发送"><Send size={18} /></button>
      </div>
    </div>
  </section>;
}

function ProjectSelector({ project, onChange }: { project: string | null; onChange: (project: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={menuRef} className={`projectSelector ${open ? "isOpen" : ""}`}>
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Folder size={15} /><span>{project ?? "选择项目"}</span><ChevronDown size={14} /></button>
    {open ? <div className="projectSelectorMenu">{projectOptions.map((option) => <button type="button" className={project === option ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option === "临时任务" ? <MessageSquare size={15} /> : <Folder size={15} />}{option}</span>{project === option ? <Check size={14} /> : null}</button>)}</div> : null}
  </div>;
}

function KnowledgeBase() {
  const [files, setFiles] = useState<KnowledgeFile[]>([
    { id: "file-quote", title: "Balbc_nude_报价单.xlsx", project: "YY药业-Balb/c nude评价", space: "projects", kind: "交付产物", business: "DMPK报价", owner: "DMPK报价同事", updated: "3天前", status: "已交付", agentReady: true },
    { id: "file-report", title: "样本9_双批次报告_v3.docx", project: "XX药业-PD1临床前评价", space: "projects", kind: "交付产物", business: "药效报告", owner: "药效报告同事", updated: "36分钟前", status: "待确认", agentReady: true },
    { id: "file-brief", title: "DMPK_报价需求说明.pdf", project: "YY药业-Balb/c nude评价", space: "projects", kind: "过程文件", business: "DMPK报价", owner: "Admin", updated: "昨天", status: "使用中", agentReady: true },
    { id: "file-raw", title: "batch9_raw.xlsx", project: "XX药业-PD1临床前评价", space: "projects", kind: "原始数据", business: "药效报告", owner: "Admin", updated: "36分钟前", status: "已归档", agentReady: true },
    { id: "file-rule", title: "DMPK_报价规则_2026.docx", project: "组织规则", space: "rules", kind: "业务规则", business: "DMPK报价", owner: "规则管理员", updated: "6月28日", status: "已发布", agentReady: true },
    { id: "file-dmpk-dict", title: "DMPK_报价参数字典.xlsx", project: "组织规则", space: "rules", kind: "参数字典", business: "DMPK报价", owner: "规则管理员", updated: "7月8日", status: "已发布", agentReady: true },
    { id: "file-dmpk-template", title: "DMPK_报价单模板.docx", project: "组织规则", space: "rules", kind: "产出模板", business: "DMPK报价", owner: "规则管理员", updated: "7月6日", status: "已发布", agentReady: true },
    { id: "file-template", title: "肿瘤药效报告模板.docx", project: "组织规则", space: "rules", kind: "报告模板", business: "药效报告", owner: "规则管理员", updated: "7月5日", status: "已发布", agentReady: true },
    { id: "file-report-map", title: "药效报告数据映射.xlsx", project: "组织规则", space: "rules", kind: "字段映射", business: "药效报告", owner: "规则管理员", updated: "7月9日", status: "已发布", agentReady: true },
    { id: "file-report-anomaly", title: "异常波动标注规则.docx", project: "组织规则", space: "rules", kind: "业务规则", business: "药效报告", owner: "规则管理员", updated: "7月3日", status: "已发布", agentReady: true },
    { id: "file-qa", title: "QA_交付包检查清单.xlsx", project: "组织规则", space: "rules", kind: "审核清单", business: "QA审核", owner: "QA审核同事", updated: "7月2日", status: "已发布", agentReady: true },
    { id: "file-qa-evidence", title: "QA_证据追溯要求.docx", project: "组织规则", space: "rules", kind: "审核规则", business: "QA审核", owner: "QA审核同事", updated: "7月7日", status: "已发布", agentReady: true },
    { id: "file-qa-output", title: "QA_复核结果模板.xlsx", project: "组织规则", space: "rules", kind: "产出模板", business: "QA审核", owner: "QA审核同事", updated: "7月4日", status: "已发布", agentReady: true },
  ]);
  const [space, setSpace] = useState<FileSpace>("projects");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("全部项目");
  const [business, setBusiness] = useState("全部业务");
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);
  const visibleFiles = files.filter((file) => file.space === space && (space === "rules" || project === "全部项目" || file.project === project) && (business === "全部业务" || file.business === business) && file.title.toLowerCase().includes(query.toLowerCase()));
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    setFiles((items) => [...selected.map((file, index) => ({ id: `upload-${Date.now()}-${index}`, title: file.name, project: space === "projects" && project !== "全部项目" ? project : space === "rules" ? "组织规则" : "未归档", space, kind: space === "rules" ? "待分类规则" : "原始数据", business: business === "全部业务" ? "未分类" : business, owner: "Admin", updated: "刚刚", status: "待整理", agentReady: space === "projects" && project !== "全部项目" })), ...items]);
    if (space === "rules" && business === "全部业务") setBusiness("未分类");
    event.target.value = "";
  };
  const handleReplace = (fileId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const replacement = event.target.files?.[0];
    if (!replacement) return;
    setFiles((items) => items.map((file) => file.id === fileId ? { ...file, title: replacement.name, updated: "刚刚", status: "待发布" } : file));
    event.target.value = "";
  };
  const projectFolders = projectOptions.filter((item) => item !== "临时任务").map((name) => ({ name, count: files.filter((file) => file.space === "projects" && file.project === name).length }));
  const ruleFolders = ["DMPK报价", "药效报告", "QA审核", "未分类"].map((name) => ({ name, count: files.filter((file) => file.space === "rules" && file.business === name).length })).filter((folder) => folder.count > 0);
  const showRuleRoot = space === "rules" && business === "全部业务" && !query;
  return (
    <section className="workbenchView knowledgeBaseView">
      <header>
        <div><h1>文件管理系统</h1></div>
        <label className="primaryButton compact" htmlFor="knowledge-file-upload"><Upload size={14} /> 上传文档</label>
        <input className="visuallyHidden" id="knowledge-file-upload" type="file" multiple onChange={handleUpload} />
      </header>
      <nav className="fileSpaceTabs" aria-label="文件空间">
        <button type="button" className={space === "projects" ? "active" : ""} onClick={() => { setSpace("projects"); setBusiness("全部业务"); }}>项目文件</button>
        <button type="button" className={space === "rules" ? "active" : ""} onClick={() => { setSpace("rules"); setProject("全部项目"); setBusiness("全部业务"); }}>规则与模板</button>
      </nav>
      <div className="knowledgeToolbar">
        <div className="knowledgeSearch"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件" /></div>
        {space === "projects" ? <CompactSelect value={project} options={["全部项目", ...projectOptions.filter((item) => item !== "临时任务"), "未归档"]} onChange={setProject} /> : null}
        <CompactSelect value={business} options={["全部业务", "DMPK报价", "药效报告", "QA审核", "未分类"]} onChange={setBusiness} />
      </div>
      {space === "projects" && project === "全部项目" && !query ? <div className="projectFolderStrip">{projectFolders.map((folder) => <button type="button" key={folder.name} onClick={() => setProject(folder.name)}><Folder size={18} /><span><strong>{folder.name}</strong><small>{folder.count} 个文件</small></span><ChevronRight size={15} /></button>)}</div> : null}
      {showRuleRoot ? <div className="projectFolderStrip ruleFolderStrip">{ruleFolders.map((folder) => <button type="button" key={folder.name} onClick={() => setBusiness(folder.name)}><Folder size={18} /><span><strong>{folder.name}</strong><small>{folder.count} 个规则与模板</small></span><ChevronRight size={15} /></button>)}</div> : null}
      {!showRuleRoot ? <div className="fileListHeading"><strong>{space === "projects" ? project === "全部项目" ? "最近产出" : project : <><button className="folderBackButton" type="button" onClick={() => setBusiness("全部业务")}>规则与模板</button><ChevronRight size={13} />{business}</>}</strong><span>{visibleFiles.length} 项</span></div> : null}
      {!showRuleRoot ? <div className="knowledgeTable" role="table">
        <div className="knowledgeTableHeader" role="row"><span>名称</span><span>{space === "projects" ? "项目" : "业务类型"}</span><span>{space === "projects" ? "业务类型" : "状态"}</span><span>更新</span><span /></div>
        {visibleFiles.map((file) => <KnowledgeFileRow key={file.id} file={file} space={space} selected={selectedFile?.id === file.id} onPreview={() => setSelectedFile(file)} onReplace={(event) => handleReplace(file.id, event)} />)}
        {!visibleFiles.length ? <div className="emptyListState">没有符合当前条件的文件</div> : null}
      </div> : null}
      <WorkspaceAssistant context="library" />
      {selectedFile ? <KnowledgeFilePreview file={selectedFile} onClose={() => setSelectedFile(null)} /> : null}
    </section>
  );
}

function KnowledgeFileRow({ file, space, selected, onPreview, onReplace }: { file: KnowledgeFile; space: FileSpace; selected: boolean; onPreview: () => void; onReplace: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLElement>(menuOpen, () => setMenuOpen(false));
  return <article ref={menuRef} className={`knowledgeFileRow ${selected ? "selected" : ""}`} role="row" onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
    <button className="knowledgeFileMain" type="button" onClick={onPreview}><span className="knowledgeFileIcon">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={17} /> : <FileText size={17} />}</span><span><strong>{file.title}</strong><small>{file.owner} · {file.status}</small></span></button>
    <span>{space === "projects" ? file.project : file.business}</span><span>{space === "projects" ? file.business : file.status}</span><span>{file.updated}</span>
    <button className="rowMoreButton" type="button" aria-label={`${file.title}更多操作`} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={15} /></button>
    {menuOpen ? <div className="rowActionMenu knowledgeRowMenu"><button type="button" onClick={() => { onPreview(); setMenuOpen(false); }}><Eye size={14} />预览</button>{space === "rules" ? <><label htmlFor={`replace-${file.id}`}><Upload size={14} />上传新版本</label><input className="visuallyHidden" id={`replace-${file.id}`} type="file" onChange={(event) => { onReplace(event); setMenuOpen(false); }} /></> : null}</div> : null}
  </article>;
}

function KnowledgeFilePreview({ file, onClose }: { file: KnowledgeFile; onClose: () => void }) {
  return <div className="modalBackdrop knowledgePreviewBackdrop" role="dialog" aria-modal="true"><section className="knowledgePreviewDialog"><header><div><span>{file.kind}</span><h2>{file.title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="knowledgePreviewMeta"><span>{file.project}</span><span>{file.owner}</span><span>{file.updated}</span></div><div className="knowledgeDocumentPreview"><div className="documentPreviewMark">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={24} /> : <FileText size={24} />}</div><h3>{file.title.replace(/\.[^.]+$/, "")}</h3><p>{file.space === "rules" ? "供数字同事执行任务时调用的业务规则或模板。" : file.kind === "交付产物" ? "项目产出文件，可供成员预览和继续协作。" : "项目工作文件，默认可供本项目数字同事在任务中调用。"}</p><PreviewTable title="文件信息" rows={[["类型", file.kind, file.business], ["归属", file.project, file.status], ["维护者", file.owner, file.agentReady ? "项目内可用" : `更新于${file.updated}`]]} /></div><footer><button className="secondaryButton compact" type="button" onClick={onClose}>关闭</button></footer></section></div>;
}

function WorkspaceAssistant({ context, onOpenQuotation }: { context: "tasks" | "library"; onOpenQuotation?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const suggestions = context === "tasks"
    ? ["列出我待处理的任务", "按项目整理当前任务", "发起一份 DMPK 报价"]
    : ["查找样本9相关文件", "找到最新 DMPK 报价规则", "整理当前项目交付物"];

  const submit = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setQuestion(next);
    setText("");
    if (next.includes("DMPK") && next.includes("报价")) onOpenQuotation?.();
  };

  return (
    <div className={`workspaceAssistant ${open ? "isOpen" : ""}`}>
      {open ? (
        <section className="workspaceAssistantPanel" aria-label="BioAZ Helper">
          <header>
            <div>
              <span className="assistantMark"><Sparkles size={15} /></span>
              <strong>BioAZ Helper</strong>
            </div>
            <button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={16} /></button>
          </header>
          <div className="workspaceAssistantBody">
            {question ? (
              <div className="assistantExchange">
                <p>{question}</p>
                <div><Sparkles size={14} /><span>{context === "tasks" ? "我已经按最近更新时间检查了任务，可先处理顶部 3 项待办。" : "我已经在知识库中检索相关产物、规则和原始数据。"}</span></div>
              </div>
            ) : (
              <div className="assistantWelcome">
                <strong>你好，我是 BioAZ Helper</strong>
                <p>{context === "tasks" ? "我可以帮你找任务、查进度或发起新工作。" : "我可以帮你查找文件、规则和项目产物。"}</p>
              </div>
            )}
            <div className="assistantSuggestions">
              {suggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => submit(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
          <form className="workspaceAssistantComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="给 BioAZ Helper 发消息..." aria-label="给 BioAZ Helper 发消息" />
            <button type="submit" aria-label="发送" disabled={!text.trim()}><Send size={16} /></button>
          </form>
        </section>
      ) : null}
      <button className="workspaceAssistantLauncher" type="button" aria-label={open ? "收起 BioAZ Helper" : "打开 BioAZ Helper"} onClick={() => setOpen((value) => !value)}>
        {open ? <X size={19} /> : <MessageSquare size={19} />}
      </button>
    </div>
  );
}

function CoworkerSelector({ activeCoworker, onCoworkerChange }: { activeCoworker: DigitalCoworkerId; onCoworkerChange: (coworker: DigitalCoworkerId) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  const coworker = digitalCoworkers[activeCoworker];
  const coworkerIcons: Record<DigitalCoworkerId, React.ReactNode> = {
    helper: <Sparkles size={16} strokeWidth={1.9} />,
    report: <FileText size={16} strokeWidth={1.9} />,
    dmpk: <FileSpreadsheet size={16} strokeWidth={1.9} />,
    qa: <Check size={16} strokeWidth={1.9} />,
  };
  return (
    <div ref={menuRef} className={`roleSelector ${open ? "isOpen" : ""}`}>
      <button className="roleSelectorCurrent" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {coworkerIcons[activeCoworker]}
        <span>{coworker.label}</span>
        <small>{activeCoworker === "helper" ? "（自动识别）" : ""}</small>
        <ChevronDown size={14} strokeWidth={1.8} />
      </button>
      {open ? <div className="roleSelectorMenu isOpen">
        {(["helper", "report", "dmpk", "qa"] as DigitalCoworkerId[]).map((coworkerId) => {
          const item = digitalCoworkers[coworkerId];
          return (
            <button className={coworkerId === activeCoworker ? "active" : ""} type="button" key={coworkerId} onClick={() => { onCoworkerChange(coworkerId); setOpen(false); }}>
              {coworkerIcons[coworkerId]}
              <strong>{item.label}</strong>
              {coworkerId === activeCoworker ? <Check size={14} /> : coworkerId === "helper" ? <span>自动识别</span> : null}
            </button>
          );
        })}
      </div> : null}
    </div>
  );
}
function Composer({
  stage,
  text,
  setText,
  activeGroup,
  fields,
  mode,
  draftTabs,
  onSelect,
  onRemove,
  onSend,
  onPreview,
  onGenerate,
  onOpenInspector,
  activeCoworker,
  onCoworkerChange,
  pendingDispatchText,
  dispatchCoworker,
  onDispatchCoworkerChange,
  onConfirmDispatch,
  onCancelDispatch,
  disabled,
}: {
  stage: Stage;
  text: string;
  setText: (value: string) => void;
  activeGroup: GroupId;
  fields: Field[];
  mode: "collect" | "edit";
  draftTabs: DraftTab[];
  onSelect: (field: Field, value: string) => void;
  onRemove: (fieldId: string) => void;
  onSend: () => void;
  onPreview: () => void;
  onGenerate: () => void;
  onOpenInspector: (panelId: InspectorPanelId) => void;
  activeCoworker: DigitalCoworkerId;
  onCoworkerChange: (coworker: DigitalCoworkerId) => void;
  pendingDispatchText: string | null;
  dispatchCoworker: Exclude<DigitalCoworkerId, "helper">;
  onDispatchCoworkerChange: (coworker: Exclude<DigitalCoworkerId, "helper">) => void;
  onConfirmDispatch: () => void;
  onCancelDispatch: () => void;
  disabled: boolean;
}) {
  return (
    <footer className="dmpkComposerWrap">
      {stage === "collecting" ? <ParameterTaskCard activeGroup={activeGroup} fields={fields} draftTabs={draftTabs} mode={mode} onSelect={onSelect} /> : null}
      {stage === "ready" ? <FinalConfirmCard onPreview={onPreview} onGenerate={onGenerate} onOpenInspector={onOpenInspector} /> : null}
      {pendingDispatchText ? <DispatchConfirmCard coworker={dispatchCoworker} onCoworkerChange={onDispatchCoworkerChange} onConfirm={onConfirmDispatch} onCancel={onCancelDispatch} /> : null}
      <CoworkerSelector activeCoworker={activeCoworker} onCoworkerChange={onCoworkerChange} />
      <div className="dmpkComposer">
        <div className="composerInputStack">
          {draftTabs.length ? (
            <div className="draftTabs">
              {draftTabs.map((tab) => (
                <button type="button" key={tab.fieldId} onClick={() => onRemove(tab.fieldId)}>
                  {tab.label}：{tab.value}
                  <X size={13} />
                </button>
              ))}
            </div>
          ) : null}
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSend();
            }}
            placeholder={draftTabs.length ? "" : stage === "idle" ? "例如：PK小分子，SD大鼠，每组2只，2组，试验周期1周，周期内3个非加班时间点" : ""}
          />
        </div>
        <button className="sendIconButton" type="button" onClick={onSend} disabled={disabled} aria-label="发送">
          <Send size={18} />
        </button>
      </div>
    </footer>
  );
}

function DispatchConfirmCard({ coworker, onCoworkerChange, onConfirm, onCancel }: { coworker: Exclude<DigitalCoworkerId, "helper">; onCoworkerChange: (coworker: Exclude<DigitalCoworkerId, "helper">) => void; onConfirm: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="dispatchConfirmCard">
      <div>
        <span>建议分派</span>
        <strong>{digitalCoworkers[coworker].label}</strong>
        <p>{digitalCoworkers[coworker].hint}</p>
      </div>
      <div className={`dispatchCoworkerSelect ${open ? "isOpen" : ""}`}>
        <button type="button" onClick={() => setOpen((value) => !value)}>更换 <ChevronDown size={13} /></button>
        {open ? (
          <div className="dispatchCoworkerMenu">
            {(["dmpk", "report", "qa"] as Array<Exclude<DigitalCoworkerId, "helper">>).map((id) => (
              <button type="button" key={id} onClick={() => { onCoworkerChange(id); setOpen(false); }}>
                <span>{digitalCoworkers[id].label}</span>
                {id === coworker ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" onClick={onCancel}>取消</button>
      <button className="primaryButton compact" type="button" onClick={onConfirm}>确认分派</button>
    </section>
  );
}

function FinalConfirmCard({ onPreview, onGenerate, onOpenInspector }: { onPreview: () => void; onGenerate: () => void; onOpenInspector: (panelId: InspectorPanelId) => void }) {
  return (
    <section className="warningDecision">
      <header className="warningDecisionHeader">
        <div>
          <span>报价前确认</span>
          <strong>参数已齐全，可以生成正式报价单</strong>
          <p>
            请先预览完整参数和计价规则，也可以
            <BluePanelLink panelId="evidence" onOpenInspector={onOpenInspector}>查看规则证据</BluePanelLink>
            。确认后将生成 Word 报价单与 Excel 报价明细。
          </p>
        </div>
        <small>待确认</small>
      </header>
      <div className="warningActions">
        <button className="previewIconOnlyButton" type="button" onClick={onPreview} aria-label="预览全部参数">
          <Eye size={16} />
        </button>
        <button className="primaryButton compact" type="button" onClick={onGenerate}>
          生成报价单
        </button>
      </div>
    </section>
  );
}

function ArtifactCards({ onPreview, onOpenInspector }: { onPreview: (kind: "word" | "excel") => void; onOpenInspector: (panelId: InspectorPanelId) => void }) {
  return (
    <section className="artifactCards">
      <div className="agentReply artifactReply">
        <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
        <p>
          报价单已生成。你可以
          <BluePanelLink panelId="artifacts" onOpenInspector={onOpenInspector}>查看产物列表</BluePanelLink>
          ，或直接预览下方文件。
        </p>
      </div>
      {(["word", "excel"] as const).map((kind) => (
        <article className="artifactCard" key={kind}>
          <span className="artifactFileIcon">{kind === "word" ? <FileText size={24} /> : <FileSpreadsheet size={24} />}</span>
          <div>
            <strong>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</strong>
            <p>{kind === "word" ? "DMPK PK 检测正式报价单，包含项目范围、报价条目、管理费和交付说明。" : "报价明细表，包含计价项、数量、单价、管理费和金额一致性校验。"}</p>
            <span>{kind === "word" ? "Document · DOCX · 管理费 30%" : "Spreadsheet · XLSX · 管理费 15%"}</span>
          </div>
          <button className="artifactActionButton" type="button" onClick={() => onPreview(kind)} aria-label="预览">
            <Eye size={16} />
            <span>预览</span>
          </button>
        </article>
      ))}
    </section>
  );
}

function ParameterPanel({ fields, activeGroup, openGroups, completedCount, totalRequired, stage, onToggle, onEdit }: { fields: Field[]; activeGroup: GroupId; openGroups: Record<GroupId, boolean>; completedCount: number; totalRequired: number; stage: Stage; onToggle: (id: GroupId) => void; onEdit: (id: string) => void }) {
  const hasArtifacts = stage === "generated";
  return (
    <section className="rightPanelCard pinnedParamCard">
      <header>
        <div>
          <FileSpreadsheet size={20} />
          <strong>报价参数收集</strong>
        </div>
        <span>{completedCount}/{totalRequired}</span>
      </header>
      <div className={hasArtifacts ? "paramGroups compact" : "paramGroups"}>
        {groups.map((group) => {
          const groupFields = fields.filter((field) => field.group === group.id);
          const missing = groupFields.filter((field) => !field.value).length;
          const done = missing === 0;
          const shouldOpen = hasArtifacts ? false : openGroups[group.id];
          return (
            <section className="paramGroup" key={group.id}>
              <button className="paramGroupHeader" type="button" onClick={() => onToggle(group.id)}>
                <i className={done ? "done" : group.id === activeGroup ? "active" : ""} />
                <strong>{group.title}</strong>
                <span>{done ? "已完成" : group.id === activeGroup ? "进行中" : "未开始"}</span>
                <ChevronDown size={16} />
              </button>
              {shouldOpen ? (
                <div className="paramRows">
                  {groupFields.map((field) => (
                    <div className="paramRow" key={field.id}>
                      <span>{field.label}</span>
                      <strong className={field.value ? "" : "empty"}>{field.value || "待填写"}</strong>
                      <button type="button" onClick={() => onEdit(field.id)} aria-label={`修改${field.label}`}>
                        <Edit3 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function QuotationPreviewModal({ fields, onClose }: { fields: Field[]; onClose: () => void }) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="previewModal">
        <header>
          <div>
            <span>报价前确认</span>
            <h2>完整参数与计价规则预览</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="previewBody">
          <div className="previewContent">
            <PreviewTable title="报价参数" rows={fields.map((field) => [groupTitle(field.group), field.label, field.value])} />
            <div className="previewNotice">
              <Check size={17} />
              <span>计价关键字段已齐全。Word 报价单使用 30% 管理费，Excel 报价明细使用 15% 管理费，生成后将进行金额一致性校验。</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ArtifactPreviewModal({ kind, onClose }: { kind: "word" | "excel"; onClose: () => void }) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="previewModal artifactPreviewModal">
        <header>
          <div>
            <span>产物预览</span>
            <h2>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="previewContent">
          <PreviewTable
            title={kind === "word" ? "Word 报价单预览" : "Excel 报价明细预览"}
            rows={[
              ["检测类型", "PK检测", "DMPK 业务线已确认"],
              ["动物实验", "SD大鼠 · 2组 · 每组2只 · 1周", "已匹配动物实验计价规则"],
              ["生物分析", "LC-MS/MS · 血浆 · 3点 · 1个待测物", "已匹配生物分析计价规则"],
              ["金额校验", "页面 / Word / Excel 一致", kind === "word" ? "中文编码与表格边框已校验" : "管理费 15% 已应用"],
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function PreviewTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="previewTableWrap">
      <h3>{title}</h3>
      <table className="previewTable">
        <thead>
          <tr>
            <th>类别</th>
            <th>项目</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")}>
              <td>{row[0]}</td>
              <td>{row[1]}</td>
              <td>{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
