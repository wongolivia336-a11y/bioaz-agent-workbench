"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Circle,
  Edit3,
  Download,
  Eye,
  FileArchive,
  FileCheck,
  FileJson,
  Folder,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  SearchCheck,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  expertProfiles,
  generationActionsBase,
  generationGroups,
  initialReviews,
  initialWarnings,
  reviewActionsBase,
  traceReferences,
  validationActionsBase,
} from "./legacy-mock-data";
import type {
  ActionStep,
  ArtifactPreviewKind,
  FollowupState,
  InspectorTopic,
  PreviewKind,
  PreviewSection,
  ReviewItem,
  Stage,
  UploadedFile,
  UserEvent,
  WarningItem,
} from "./legacy-types";
import { classifyFile, formatSize, makeSteps } from "./legacy-workflow";
import type { AgentModuleSessionProps } from "../types";
import { CoworkerSelector } from "../../components/workbench-shell/CoworkerSelector";
import { ContextDivider, CoworkerSwitchCard, PriorSessionHistory } from "../../components/workbench-shell/BioAZHelper";

export default function LegacyTumorReportWorkbench({ projectName, taskTitle, initialRequest, coworkers, activeCoworkerId, onCoworkerChange, onRunStatusChange, handoffNotice, priorSessionSnapshots, onSessionSnapshotChange }: AgentModuleSessionProps) {
  const [stage, setStage] = useState<Stage>("empty");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [validationProgress, setValidationProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState({
    validation: true,
    generation: true,
    review: false,
  });
  const [warnings, setWarnings] = useState<WarningItem[]>(initialWarnings);
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [inspectorPinned, setInspectorPinned] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTopic, setInspectorTopic] = useState<InspectorTopic>("process");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("validation");
  const [previewSection, setPreviewSection] = useState<PreviewSection>("recognized");
  const [artifactPreviewOpen, setArtifactPreviewOpen] = useState(false);
  const [artifactPreviewKind, setArtifactPreviewKind] = useState<ArtifactPreviewKind>("word");
  const [composerText, setComposerText] = useState("");
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);
  const [followupState, setFollowupState] = useState<FollowupState>("idle");
  const [pendingCoworkerId, setPendingCoworkerId] = useState<string | null>(null);
  const businessCoworkers = coworkers.filter((coworker) => coworker.id !== "bioaz-helper");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const chatScrollerRef = useRef<HTMLDivElement>(null);

  const protocolCount = files.filter((file) => file.kind === "protocol").length;
  const dataCount = files.filter((file) => file.kind === "data").length;
  const canStart = protocolCount >= 1 && dataCount >= 1;
  const allWarningsAccepted = warnings.every((item) => item.accepted);
  const allReviewsConfirmed = reviews.every((item) => item.status === "confirmed");

  const validationSteps = useMemo(
    () => makeSteps(validationActionsBase, validationProgress, stage === "validating"),
    [stage, validationProgress],
  );
  const generationSteps = useMemo(
    () => makeSteps(generationActionsBase, generationProgress, stage === "generating"),
    [stage, generationProgress],
  );
  const reviewSteps = useMemo(() => {
    if (stage === "review" || stage === "exported") {
      return reviewActionsBase.map((step) => ({ ...step, status: "done" as const }));
    }
    return makeSteps(reviewActionsBase, reviewProgress, stage === "reviewing");
  }, [reviewProgress, stage]);
  const openWorkflowPreview = (kind: PreviewKind, section: PreviewSection = "issues") => {
    setPreviewKind(kind);
    setPreviewSection(section);
    setPreviewOpen(true);
  };
  const openArtifactPreview = (kind: ArtifactPreviewKind) => {
    setArtifactPreviewKind(kind);
    setArtifactPreviewOpen(true);
  };

  useEffect(() => {
    if (stage !== "validating") return;

    setValidationProgress(0);
    setExpandedThinking((current) => ({ ...current, validation: true }));

    const timer = window.setInterval(() => {
      setValidationProgress((current) => {
        const next = current + 1;
        if (next >= validationActionsBase.length) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setStage("warning");
            setExpandedThinking((value) => ({ ...value, validation: false }));
            setInspectorTopic("warnings");
          }, 450);
        }
        return Math.min(next, validationActionsBase.length);
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "generating") return;

    setGenerationProgress(0);
    setExpandedThinking((current) => ({ ...current, generation: true }));

    const timer = window.setInterval(() => {
      setGenerationProgress((current) => {
        const next = current + 1;
        if (next >= generationActionsBase.length) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setStage("generated");
            setExpandedThinking((value) => ({ ...value, generation: false }));
            setInspectorTopic("artifacts");
            setInspectorOpen(true);
          }, 450);
        }
        return Math.min(next, generationActionsBase.length);
      });
    }, 950);

    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "reviewing") return;

    setReviewProgress(0);
    setExpandedThinking((current) => ({ ...current, review: true }));

    const timer = window.setInterval(() => {
      setReviewProgress((current) => {
        const next = current + 1;
        if (next >= reviewActionsBase.length) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setStage("review");
            setExpandedThinking((value) => ({ ...value, review: false }));
            setInspectorTopic("review");
            setInspectorOpen(true);
          }, 450);
        }
        return Math.min(next, reviewActionsBase.length);
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage === "warning" && allWarningsAccepted) {
      const timer = window.setTimeout(() => {
        setStage("generating");
        setInspectorTopic("generation");
      }, 420);

      return () => window.clearTimeout(timer);
    }
  }, [allWarningsAccepted, stage]);

  useEffect(() => {
    if (stage === "review" && allReviewsConfirmed) {
      const timer = window.setTimeout(() => {
        setStage("exported");
        setInspectorTopic("artifacts");
      }, 420);
      return () => window.clearTimeout(timer);
    }
  }, [allReviewsConfirmed, stage]);

  useEffect(() => {
    onRunStatusChange(stage === "exported" ? "completed" : "active");
  }, [onRunStatusChange, stage]);

  useEffect(() => {
    onSessionSnapshotChange?.({
      moduleId: "tumor-report",
      coworkerName: "肿瘤报告同事",
      stageLabel: stage === "exported" ? "报告已交付" : stage === "review" || stage === "reviewing" ? "专家审核中" : stage === "generated" || stage === "generating" ? "报告生成中" : stage === "warning" ? "风险确认中" : "材料与校验阶段",
      entries: [
        ...(initialRequest ? [{ id: "tumor-initial", role: "user" as const, text: initialRequest }] : []),
        ...userEvents.map((event) => ({ id: event.id, role: "user" as const, text: event.text })),
      ],
      facts: [
        { label: "材料", value: `${files.length} 个文件` },
        { label: "风险", value: `${warnings.filter((item) => item.accepted).length}/${warnings.length} 已确认` },
        { label: "审核", value: `${reviews.filter((item) => item.status === "confirmed").length}/${reviews.length} 已确认` },
      ],
    });
  }, [files.length, initialRequest, onSessionSnapshotChange, reviews, stage, userEvents, warnings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      chatScrollerRef.current?.scrollTo({
        top: chatScrollerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [stage, validationProgress, generationProgress, userEvents, followupState]);

  const onFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    const nextFiles = Array.from(selected).map((file, index) => ({
      id: `${file.name}-${file.size}-${index}`,
      name: file.name,
      size: formatSize(file.size),
      kind: classifyFile(file),
    }));
    setFiles((current) => {
      const incomingProtocol = nextFiles.filter((file) => file.kind === "protocol").slice(-1);
      const incomingData = nextFiles.filter((file) => file.kind === "data");
      const incomingIds = new Set(nextFiles.map((file) => file.id));
      const retained = current.filter((file) => {
        if (incomingIds.has(file.id)) return false;
        if (file.kind === "protocol" && incomingProtocol.length) return false;
        return true;
      });
      return [...retained, ...incomingProtocol, ...incomingData];
    });
    setStage(nextFiles.length > 0 ? "uploaded" : "empty");
    setWarnings(initialWarnings);
    setReviews(initialReviews);
    setUserEvents([]);
    setFollowupState("idle");
    setValidationProgress(0);
    setGenerationProgress(0);
    setReviewProgress(0);
    setInspectorTopic("process");
  };

  const onFilesDropped = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    onFilesSelected(event.dataTransfer.files);
  };

  const addUserEvent = (after: UserEvent["after"], text: string) => {
    setUserEvents((items) => [
      ...items,
      {
        id: `${after}-${Date.now()}-${items.length}`,
        after,
        text,
      },
    ]);
  };

  const removeFile = (fileId: string) => {
    const next = files.filter((file) => file.id !== fileId);
    setFiles(next);
    setStage(next.length ? "uploaded" : "empty");
  };

  const startValidation = () => {
    if (!canStart) return;
    addUserEvent("upload", "开始校验");
    setStage("validating");
    setInspectorTopic("process");
  };

  const acceptAllWarnings = () => {
    addUserEvent("warning", "已确认风险并继续生成。");
    setWarnings((items) => items.map((item) => ({ ...item, accepted: true })));
    setStage("generating");
    setInspectorTopic("generation");
  };

  const acceptWarning = (id: string) => {
    setWarnings((items) => {
      const next = items.map((item) => (item.id === id ? { ...item, accepted: true } : item));
      if (!items.every((item) => item.accepted) && next.every((item) => item.accepted)) {
        addUserEvent("warning", "已确认风险并继续生成。");
        setStage("generating");
        setInspectorTopic("generation");
      }
      return next;
    });
  };

  const rejectWarnings = () => {
    addUserEvent("warning", "不接受当前 warning，返回替换文件");
    setStage("uploaded");
    setWarnings(initialWarnings);
    setValidationProgress(0);
    setGenerationProgress(0);
    setReviewProgress(0);
  };

  const startReview = () => {
    addUserEvent("review", "发起专家小队审核");
    setStage("reviewing");
    setInspectorTopic("review");
    setInspectorOpen(true);
  };

  const confirmReview = (id: string) => {
    setReviews((items) => {
      const next = items.map((item) =>
        item.id === id ? { ...item, status: "confirmed" as const } : item,
      );
      if (
        !items.every((item) => item.status === "confirmed") &&
        next.every((item) => item.status === "confirmed")
      ) {
        addUserEvent("review", "已确认全部专家建议，进入最终放行准备。");
      }
      return next;
    });
  };

  const confirmAllReviews = () => {
    addUserEvent("review", "已确认全部专家建议，进入最终放行准备。");
    setReviews((items) => items.map((item) => ({ ...item, status: "confirmed" })));
  };

  const askFollowup = () => {
    setComposerText("请解释这些专家建议中仍需人工确认的依据，并列出我需要补充的证据。");
    window.setTimeout(() => composerInputRef.current?.focus(), 0);
  };

  const sendComposerMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addUserEvent(
      ["generated", "reviewing", "review", "exported"].includes(stage) ? "review" : "warning",
      trimmed,
    );
    setComposerText("");

    if (stage === "review" || stage === "exported") {
      setFollowupState("thinking");
      window.setTimeout(() => setFollowupState("answered"), 900);
    }
  };

  return (
    <>
      <section className="workspace legacyTumorWorkspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{projectName}</span>
            <ChevronRight size={15} />
            <strong>{taskTitle}</strong>
          </div>
        </header>

        <header className="agentHeader">
          <div className="agentTitle">
            <span className="agentIcon pending">
              <FileCheck size={18} />
            </span>
            <span>肿瘤报告数字同事</span>
          </div>
        </header>

        <div className="chatScroller" ref={chatScrollerRef}>
          <PriorSessionHistory snapshots={priorSessionSnapshots} />
          {handoffNotice ? <ContextDivider>{handoffNotice}</ContextDivider> : null}
          {stage === "empty" && initialRequest ? <div className="legacyInitialRequest"><p>{initialRequest}</p></div> : null}
          {stage === "empty" ? <div className="legacyTumorOpening"><img src="/logo/bioaz-logo.svg" alt="" /><p>你好，我是肿瘤报告数字同事。我会先检查实验方案和原始数据，再完成风险确认、报告生成与专家审核。请通过下方加号上传方案 DOCX 和数据 XLSX。</p></div> : null}
          {stage === "uploaded" ? <div className="legacyTumorOpening isCompact uploadReadyNotice"><img src="/logo/bioaz-logo.svg" alt="" /><div><strong>文件已就绪 · {files.length} 个</strong><p>可在下方检查、移除或替换材料；满足要求后即可开始校验。</p><button type="button" onClick={() => fileInputRef.current?.click()}>继续添加文件</button></div></div> : null}
          {stage !== "empty" && stage !== "uploaded" ? (
            <Conversation
              files={files}
              userEvents={userEvents}
              stage={stage}
              validationSteps={validationSteps}
              generationSteps={generationSteps}
              reviewSteps={reviewSteps}
              expandedThinking={expandedThinking}
              setExpandedThinking={setExpandedThinking}
              expandedTech={expandedTech}
              setExpandedTech={setExpandedTech}
              reviews={reviews}
              followupState={followupState}
              onPreviewArtifact={openArtifactPreview}
              onInspector={(topic) => {
                setInspectorTopic(topic);
                setInspectorOpen(true);
              }}
            />
          ) : null}
        </div>

        <div className="legacyComposerStack">
          {pendingCoworkerId ? <CoworkerSwitchCard from={businessCoworkers.find((item) => item.id === activeCoworkerId)?.name ?? "当前数字同事"} to={businessCoworkers.find((item) => item.id === pendingCoworkerId)?.name ?? "新数字同事"} endingCurrentFlow={stage !== "exported"} onConfirm={() => { onCoworkerChange(pendingCoworkerId); setPendingCoworkerId(null); }} onCancel={() => setPendingCoworkerId(null)} /> : null}
          {!["warning", "review"].includes(stage) ? <CoworkerSelector coworkers={businessCoworkers} activeCoworkerId={activeCoworkerId} locked={stage !== "exported"} onChange={(id) => id !== activeCoworkerId && setPendingCoworkerId(id)} /> : null}
          <Composer
            stage={stage}
            files={files}
            protocolCount={protocolCount}
            dataCount={dataCount}
            canStart={canStart}
            warnings={warnings}
            reviews={reviews}
            onRemoveFile={removeFile}
            onStartValidation={startValidation}
            onAcceptWarnings={acceptAllWarnings}
            onAcceptWarning={acceptWarning}
            onRejectWarnings={rejectWarnings}
            onPreview={() => openWorkflowPreview("validation", "issues")}
            onStartReview={startReview}
            onConfirmReview={confirmReview}
            onConfirmAllReviews={confirmAllReviews}
            onAskFollowup={askFollowup}
            onSendMessage={sendComposerMessage}
            onUpload={() => fileInputRef.current?.click()}
            composerText={composerText}
            setComposerText={setComposerText}
            inputRef={composerInputRef}
            onOpenInspector={(topic) => {
              setInspectorTopic(topic);
              setInspectorOpen(true);
            }}
            onPreviewReview={() => openWorkflowPreview("review", "issues")}
          />
        </div>

        <input
          ref={fileInputRef}
          className="fileInput"
          type="file"
          multiple
          accept=".docx,.xlsx"
          onChange={(event) => onFilesSelected(event.target.files)}
        />
      </section>

      <div
        className="inspectorHotZone"
        onMouseEnter={() => setInspectorOpen(true)}
        aria-hidden="true"
      />
      <HoverInspector
        open={inspectorOpen || inspectorPinned}
        pinned={inspectorPinned}
        topic={inspectorTopic}
        stage={stage}
        validationSteps={validationSteps}
        generationSteps={generationSteps}
        warnings={warnings}
        reviews={reviews}
        onMouseEnter={() => setInspectorOpen(true)}
        onMouseLeave={() => {
          if (!inspectorPinned) setInspectorOpen(false);
        }}
        onSelectTopic={setInspectorTopic}
        onPin={() => setInspectorPinned((current) => !current)}
        onPreviewArtifact={openArtifactPreview}
        onPreviewWorkflow={openWorkflowPreview}
      />

      {previewOpen ? (
        <ValidationPreviewModal
          kind={previewKind}
          section={previewSection}
          setSection={setPreviewSection}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      {artifactPreviewOpen ? (
        <ArtifactPreviewModal
          kind={artifactPreviewKind}
          setKind={setArtifactPreviewKind}
          onClose={() => setArtifactPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

function WorkspaceSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({
    oncology: true,
    dmpk: false,
    qa: false,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedChats, setPinnedChats] = useState<Record<string, boolean>>({
    sample9: true,
  });

  const toggleProject = (id: string) => {
    setOpenProjects((current) => ({ ...current, [id]: !current[id] }));
  };

  const togglePinned = (id: string) => {
    setPinnedChats((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo/bioaz-logo.svg" alt="" />
        <span>BioAZ</span>
        <button
          className="sidebarCollapseButton"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          <PanelRight size={17} />
        </button>
      </div>

      <div className="sidebarActions">
        {searchOpen ? (
          <div className="sidebarSearch">
            <Search size={15} />
            <input autoFocus placeholder="搜索对话" />
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="关闭搜索">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="newChatWrap">
              <button className="newChat" type="button">
                <MessageSquare size={15} />
                新建对话
              </button>
              <div className="newChatMenu">
                <button type="button">新建报告任务</button>
                <button type="button">新建报价任务</button>
                <button type="button">新建 QA 审核</button>
              </div>
            </div>
            <button className="sidebarSearchButton" type="button" onClick={() => setSearchOpen(true)} aria-label="搜索">
              <Search size={17} />
            </button>
          </>
        )}
      </div>

      <nav className="navBlock projectTree" aria-label="项目">
        <p>项目</p>
        <ProjectGroup
          id="oncology"
          title="肿瘤药效报告"
          open={openProjects.oncology}
          onToggle={() => toggleProject("oncology")}
          chats={[
            {
              id: "sample9",
              title: "样本 9 双批次报告",
              time: "36 分钟前",
              status: "pending",
              active: true,
            },
            {
              id: "sample5",
              title: "样本 5 批次缺失阻断",
              time: "2 周",
              status: "blocked",
            },
            {
              id: "sample7",
              title: "样本 7 单批次回归",
              time: "2 周",
              status: "done",
            },
            {
              id: "ct26",
              title: "CT26 交付包复核",
              time: "1 小时前",
              status: "running",
            },
          ]}
          pinnedChats={pinnedChats}
          onTogglePinned={togglePinned}
        />
        <ProjectGroup
          id="dmpk"
          title="DMPK 报价"
          open={openProjects.dmpk}
          onToggle={() => toggleProject("dmpk")}
          chats={[
            {
              id: "dmpk-quote",
              title: "Balb/c nude 报价整理",
              time: "3 天前",
              status: "running",
            },
          ]}
          pinnedChats={pinnedChats}
          onTogglePinned={togglePinned}
        />
        <ProjectGroup
          id="qa"
          title="QA 审核"
          open={openProjects.qa}
          onToggle={() => toggleProject("qa")}
          chats={[
            {
              id: "qa-package",
              title: "报告交付包 QA 复核",
              time: "1 周",
              status: "done",
            },
          ]}
          pinnedChats={pinnedChats}
          onTogglePinned={togglePinned}
        />
      </nav>

      <div className="account">
        <div className="avatar">A</div>
        <div>
          <strong>Admin</strong>
          <span>admin@example.com</span>
        </div>
        <button type="button" aria-label="账户更多操作">
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}

type SidebarChat = {
  id: string;
  title: string;
  time: string;
  status: "pending" | "blocked" | "done" | "running";
  active?: boolean;
};

function ProjectGroup({
  title,
  open,
  chats,
  pinnedChats,
  onToggle,
  onTogglePinned,
}: {
  id: string;
  title: string;
  open: boolean;
  chats: SidebarChat[];
  pinnedChats: Record<string, boolean>;
  onToggle: () => void;
  onTogglePinned: (id: string) => void;
}) {
  return (
    <div className={`projectGroup ${open ? "isOpen" : ""}`}>
      <div className="projectRowWrap">
        <button className="projectRow" type="button" onClick={onToggle}>
          <Folder size={16} />
          <strong>{title}</strong>
          <ChevronRight className={open ? "isOpen" : ""} size={15} />
        </button>
        <div className="projectHoverActions">
          <div className="menuWrap">
            <button type="button" aria-label={`${title} 更多操作`}>
              <MoreHorizontal size={15} />
            </button>
            <div className="sidebarMenu">
              <button type="button">
                <Pin size={14} />
                置顶项目
              </button>
              <button type="button">
                <MessageSquare size={14} />
                新建对话
              </button>
              <button type="button">
                <ShieldCheck size={14} />
                成员与权限
              </button>
              <button type="button">
                <Edit3 size={14} />
                重命名项目
              </button>
              <button type="button">
                <FileText size={14} />
                查看操作记录
              </button>
              <button type="button">
                <X size={14} />
                归入回收站
              </button>
            </div>
          </div>
          <button type="button" aria-label={`在 ${title} 下新建对话`}>
            <Edit3 size={15} />
          </button>
        </div>
      </div>

      {open ? (
        <div className="chatTree">
          {chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              pinned={Boolean(pinnedChats[chat.id])}
              onTogglePinned={() => onTogglePinned(chat.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatRow({
  chat,
  pinned,
  onTogglePinned,
}: {
  chat: SidebarChat;
  pinned: boolean;
  onTogglePinned: () => void;
}) {
  return (
    <div
      className={`chatRow ${chat.active ? "active" : ""} status-${chat.status}`}
      title={chat.title}
      role="button"
      tabIndex={0}
    >
      <span className={`sidebarIcon ${chat.status}`}>
        <FileText size={16} />
      </span>
      <strong>{chat.title}</strong>
      <small>{chat.time}</small>
      <span className="chatHoverActions">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePinned();
          }}
          aria-label={pinned ? "取消置顶对话" : "置顶对话"}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        <span className="menuWrap">
          <button type="button" aria-label={`${chat.title} 更多操作`} onClick={(event) => event.stopPropagation()}>
            <MoreHorizontal size={14} />
          </button>
          <span className="sidebarMenu chatMenu">
            <button type="button">
              <Edit3 size={14} />
              重命名对话
            </button>
            <button type="button">
              <SearchCheck size={14} />
              查看 warning / 证据
            </button>
            <button type="button">
              <FileText size={14} />
              查看操作记录
            </button>
            <button type="button">
              <X size={14} />
              归入回收站
            </button>
          </span>
        </span>
      </span>
      {pinned ? <Pin className="pinnedMarker" size={13} /> : null}
    </div>
  );
}

function SidebarRow({
  icon,
  title,
  meta,
  status,
  statusLabel,
  active,
  open,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  status?: "pending" | "blocked" | "done" | "running";
  statusLabel?: string;
  active?: boolean;
  open?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`sidebarRow ${active ? "active" : ""} ${status ? `status-${status}` : ""}`}
      type="button"
      title={statusLabel}
      onClick={onClick}
    >
      <span className={`sidebarIcon ${status ?? ""}`}>{icon}</span>
      <span>
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
      {status ? <i className={`sidebarStatusDot ${status}`} /> : <ChevronRight className={open ? "isOpen" : ""} size={15} />}
      {status ? (
        <span className="sidebarMore">
          <MoreHorizontal size={15} />
        </span>
      ) : null}
    </button>
  );
}

function UploadEmptyState({
  files,
  protocolCount,
  dataCount,
  canStart,
  onUpload,
  onRemoveFile,
  onStartValidation,
  onDrop,
}: {
  files: UploadedFile[];
  protocolCount: number;
  dataCount: number;
  canStart: boolean;
  onUpload: () => void;
  onRemoveFile: (id: string) => void;
  onStartValidation: () => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
}) {
  const protocolFiles = files.filter((file) => file.kind === "protocol");
  const dataFiles = files.filter((file) => file.kind === "data");

  if (files.length) {
    return (
      <section className="emptyState">
        <div
          className={`uploadReadyPanel ${canStart ? "ready" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <div className="uploadReadyHeader">
            <span className="altarMark">
              <img src="/logo/bioaz-logo.svg" alt="" />
            </span>
            <div>
              <span className="altarEyebrow">文件准备</span>
              <strong>检查上传文件，确认后开始校验</strong>
              <small>文件满足要求后，会创建校验任务并进入对话流。</small>
            </div>
            <span className={`readySignal ${canStart ? "ok" : ""}`}>
              <i />
              {canStart ? "文件已满足要求" : "等待补齐文件"}
            </span>
          </div>

          <div className="readyFileGroups">
            <ReadyFileGroup
              title="方案 DOCX"
              emptyText="还需要 1 个方案 DOCX"
              files={protocolFiles}
              icon="protocol"
              onRemoveFile={onRemoveFile}
            />
            <ReadyFileGroup
              title="数据 XLSX"
              emptyText="还需要 1 个以上数据 XLSX"
              files={dataFiles}
              icon="data"
              onRemoveFile={onRemoveFile}
            />
          </div>

          <div className="readyPanelActions">
            <button className="secondaryButton compact" type="button" onClick={onUpload}>
              <Paperclip size={15} />
              继续上传
            </button>
            <button className="primaryButton compact" type="button" disabled={!canStart} onClick={onStartValidation}>
              <Send size={15} />
              开始校验
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="emptyState">
      <button
        className={`documentAltar ${canStart ? "ready" : ""}`}
        type="button"
        onClick={onUpload}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <span className="altarMark">
          <img src="/logo/bioaz-logo.svg" alt="" />
        </span>
        <span className="altarEyebrow">报告任务</span>
        <strong>拖入方案和数据，开始一份报告任务</strong>
        <small>先得到可生成性判断，再进入 warning 确认、生成和专家检查。</small>
        <span className="altarSlots">
          <span className={`altarSlot ${protocolCount ? "filled" : ""}`}>
            <FileText size={20} />
            <span>
              <strong>方案 DOCX</strong>
              <small>{protocolCount ? "已就绪" : "试验方案、人员、材料与流程"}</small>
            </span>
          </span>
          <span className={`altarSlot ${dataCount ? "filled" : ""}`}>
            <FileSpreadsheet size={20} />
            <span>
              <strong>数据 XLSX</strong>
              <small>{dataCount ? "已就绪" : "实验数据、统计汇总和图表来源"}</small>
            </span>
          </span>
        </span>
        <span className="altarActions">
          <span>
            <Paperclip size={15} />
            选择文件
          </span>
          <span className={canStart ? "ok" : ""}>
            {canStart ? "文件已满足要求" : "需要 1 个 DOCX 和 1 个以上 XLSX"}
          </span>
        </span>
      </button>

      {files.length ? (
        <div className="altarFileList">
          {files.map((file) => (
            <span key={file.id}>
              {file.kind === "data" ? <FileSpreadsheet size={14} /> : <FileText size={14} />}
              {file.name}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReadyFileGroup({
  title,
  emptyText,
  files,
  icon,
  onRemoveFile,
}: {
  title: string;
  emptyText: string;
  files: UploadedFile[];
  icon: "protocol" | "data";
  onRemoveFile: (id: string) => void;
}) {
  return (
    <section className="readyFileGroup">
      <div className="readyFileGroupTitle">
        {icon === "data" ? <FileSpreadsheet size={17} /> : <FileText size={17} />}
        <strong>{title}</strong>
      </div>
      {files.length ? (
        files.map((file) => (
          <div className="readyFileRow" key={file.id}>
            {icon === "data" ? <FileSpreadsheet size={17} /> : <FileText size={17} />}
            <span>{file.name}</span>
            <small>{file.size}</small>
            <button type="button" onClick={() => onRemoveFile(file.id)} aria-label="移除文件">
              <X size={16} />
            </button>
          </div>
        ))
      ) : (
        <div className="readyFileRow empty">
          <Circle size={16} />
          <span>{emptyText}</span>
        </div>
      )}
    </section>
  );
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest.toString().padStart(2, "0")}s`;
}

function useStageTimer(running: boolean, reset: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (reset) {
      setSeconds(0);
      return;
    }

    if (!running) return;

    setSeconds(0);
    const timer = window.setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reset, running]);

  return formatElapsed(seconds);
}

function Conversation({
  files,
  userEvents,
  stage,
  validationSteps,
  generationSteps,
  reviewSteps,
  expandedThinking,
  setExpandedThinking,
  expandedTech,
  setExpandedTech,
  reviews,
  followupState,
  onPreviewArtifact,
  onInspector,
}: {
  files: UploadedFile[];
  userEvents: UserEvent[];
  stage: Stage;
  validationSteps: ActionStep[];
  generationSteps: ActionStep[];
  reviewSteps: ActionStep[];
  expandedThinking: { validation: boolean; generation: boolean; review: boolean };
  setExpandedThinking: React.Dispatch<
    React.SetStateAction<{ validation: boolean; generation: boolean; review: boolean }>
  >;
  expandedTech: string | null;
  setExpandedTech: (value: string | null) => void;
  reviews: ReviewItem[];
  followupState: FollowupState;
  onPreviewArtifact: (kind: ArtifactPreviewKind) => void;
  onInspector: (topic: InspectorTopic) => void;
}) {
  const validationVisible = [
    "validating",
    "warning",
    "generating",
    "generated",
    "reviewing",
    "review",
    "exported",
  ].includes(stage);
  const generationVisible = ["generating", "generated", "reviewing", "review", "exported"].includes(stage);
  const artifactsVisible = ["generated", "reviewing", "review", "exported"].includes(stage);
  const reviewVisible = ["reviewing", "review", "exported"].includes(stage);
  const validationElapsed = useStageTimer(stage === "validating", stage === "empty" || stage === "uploaded");
  const generationElapsed = useStageTimer(stage === "generating", stage === "warning");
  const reviewElapsed = useStageTimer(stage === "reviewing", stage === "generated");

  return (
    <section className="conversation">
      <div className="userBubble">
        <div className="attachedFiles">
          {files.map((file) => (
            <span key={file.id}>
              {file.kind === "data" ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
              {file.name}
            </span>
          ))}
        </div>
        <p>开始</p>
      </div>
      <UserEventBubbles events={userEvents} after="upload" />

      {validationVisible ? (
        <section className="phaseBlock">
          <ThinkingCard
            running={stage === "validating"}
            elapsed={validationElapsed}
            steps={validationSteps}
            expanded={stage === "validating" || expandedThinking.validation}
            title="校验过程"
            collapsedLabel="已完成校验过程 · 查看过程"
            expandedTech={expandedTech}
            setExpandedTech={setExpandedTech}
            onPreviewArtifact={onPreviewArtifact}
            onToggle={() =>
              setExpandedThinking((current) => ({
                ...current,
                validation: !current.validation,
              }))
            }
            onInspector={() => onInspector("process")}
          />
          {["warning", "generating", "generated", "reviewing", "review", "exported"].includes(stage) ? (
            <AgentReply
              title="校验完成。"
              tone="warning"
              actionLabel="查看 warning 证据"
              onAction={() => onInspector("warnings")}
            >
              可以继续，但需要先确认 warning。我已完成文件识别、统计上下文检查和 QA 初筛；当前没有 blocking 问题，但有 3 条 warning 需要授权用户确认。确认风险只表示允许进入生成流程，不等于最终科学结论放行。
            </AgentReply>
          ) : null}
          <UserEventBubbles events={userEvents} after="warning" />
        </section>
      ) : null}

      {generationVisible ? (
        <section className="phaseBlock">
          <ThinkingCard
            running={stage === "generating"}
            elapsed={generationElapsed}
            steps={generationSteps}
            expanded={stage === "generating" || expandedThinking.generation}
            title="生成过程"
            collapsedLabel="已完成生成过程 · 查看过程"
            expandedTech={expandedTech}
            setExpandedTech={setExpandedTech}
            onPreviewArtifact={onPreviewArtifact}
            onToggle={() =>
              setExpandedThinking((current) => ({
                ...current,
                generation: !current.generation,
              }))
            }
            onInspector={() => onInspector("generation")}
          />

          {artifactsVisible ? (
            <AgentReply
              title="报告草稿和交付包已生成。"
              tone="success"
              actionLabel="打开产物面板"
              onAction={() => onInspector("artifacts")}
            >
              我已基于冻结的校验事实生成 Word 报告、交付包、Prism 源文件、图片和 QC 结果。主对话只保留 Word 报告和交付包，其余过程产物与业务证据可在右侧面板查看；最终放行仍需完成专家检查与用户确认。
            </AgentReply>
          ) : null}

          {artifactsVisible ? (
            <section className="artifactStack">
              <ArtifactCard
                icon={<FileText size={28} />}
                title="Word 报告"
                name="研究受试物对人小细胞肺癌 NCI-H82 细胞株在 BALB c nude 小鼠皮下异位移植瘤生长的作用报告.docx"
                meta="Document · DOCX · 2.06 MB"
                onPreview={() => onPreviewArtifact("word")}
              />
              <ArtifactCard
                icon={<FileArchive size={28} />}
                title="交付包"
                name="研究受试物对人小细胞肺癌 NCI-H82 细胞株在 BALB c nude 小鼠皮下异位移植瘤生长的作用报告-交付包.zip"
                meta="Package · ZIP · 2.68 MB"
                onPreview={() => onPreviewArtifact("package")}
                downloadable
              />
            </section>
          ) : null}
        </section>
      ) : null}

      {reviewVisible ? (
        <section className="phaseBlock">
          {stage === "reviewing" ? (
            <AgentReply title="专家小队审核已发起。" tone="neutral">
              审核小队正在从数据溯源、统计口径、安全性和图表版式几个方向检查报告。审核建议生成前，产物保持可预览状态。
            </AgentReply>
          ) : null}
          <ThinkingCard
            running={stage === "reviewing"}
            elapsed={reviewElapsed}
            steps={reviewSteps}
            expanded={stage === "reviewing" || expandedThinking.review}
            title="专家检查过程"
            collapsedLabel="已完成专家检查过程 · 查看过程"
            expandedTech={expandedTech}
            setExpandedTech={setExpandedTech}
            onPreviewArtifact={onPreviewArtifact}
            onToggle={() =>
              setExpandedThinking((current) => ({
                ...current,
                review: !current.review,
              }))
            }
            onInspector={() => onInspector("review")}
          />
          <UserEventBubbles events={userEvents} after="review" />
          {followupState !== "idle" ? <FollowupAnswer state={followupState} /> : null}
          {stage !== "reviewing" && reviews.every((item) => item.status === "confirmed") ? (
            <section className="artifactStack">
              <ArtifactCard
                icon={<FileCheck size={26} />}
                title="专家建议文档"
                name="专家建议确认与补充证据摘要.md"
                meta="Review · 3 items · confirmed"
                onPreview={() => onPreviewArtifact("review-doc")}
              />
            </section>
          ) : null}
          {stage !== "reviewing" ? (
            <AgentReply
              title={
                reviews.every((item) => item.status === "confirmed")
                  ? "专家建议已确认完成。"
                  : "专家检查完成。"
              }
              tone={reviews.every((item) => item.status === "confirmed") ? "success" : "neutral"}
              actionLabel="查看审核问题列表"
              onAction={() => onInspector("review")}
            >
              {reviews.every((item) => item.status === "confirmed")
                ? "专家建议已形成文档，可作为最终放行前的审核材料。当前报告已满足进入最终放行的前置条件，最终是否通过仍由 SD / QA / 统计角色签核决定。"
                : `当前还有 ${reviews.filter((item) => item.status === "pending").length} 条建议需要人工确认或补充证据。最终是否通过由 SD / QA / 统计角色签核决定，处理完下方确认列表后才能进入最终放行。`}
            </AgentReply>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function AgentReply({
  title,
  tone = "neutral",
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  tone?: "neutral" | "success" | "warning";
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className={`agentReply ${tone}`}>
      <div className="agentReplyBubble">
        <p>
          <strong>{title}</strong> {children}{" "}
          {actionLabel && onAction ? (
            <button className="inlineTextLink" type="button" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </p>
      </div>
    </article>
  );
}

function UserEventBubbles({
  events,
  after,
}: {
  events: UserEvent[];
  after: UserEvent["after"];
}) {
  const scoped = events.filter((event) => event.after === after);
  if (!scoped.length) return null;

  return (
    <>
      {scoped.map((event) => (
        <div className="userActionBubble" key={event.id}>
          {event.text}
        </div>
      ))}
    </>
  );
}

function SquadThinkingStrip() {
  const experts = [
    { name: "数据核对专家 D", task: "核对报告与 Excel 来源" },
    { name: "统计复核专家 C", task: "复核统计口径和结论措辞" },
    { name: "安全性专家 S", task: "检查异常事件与人道终点" },
    { name: "图表版式专家 G", task: "检查图表、目录和交付格式" },
    { name: "终审专家 F", task: "合并建议并给出放行判断" },
  ];

  return (
    <article className="squadThinking">
      <span>专家检查</span>
      <div className="squadSteps">
        {experts.map((expert) => (
          <span className="squadStep" key={expert.name}>
            <i />
            <ExpertName name={expert.name} task={expert.task} />
          </span>
        ))}
      </div>
    </article>
  );
}

function artifactKindFromName(name: string): ArtifactPreviewKind {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("package") || lowerName.includes("zip")) return "package";
  if (lowerName.includes("prism")) return "prism";
  if (lowerName.includes("png") || lowerName.includes("figure")) return "figure";
  if (lowerName.includes("qc")) return "qc";
  if (lowerName.includes("manifest") || lowerName.includes("摘要")) return "evidence";
  if (lowerName.includes("专家建议") || lowerName.includes("review")) return "review-doc";
  return "word";
}

function ThinkingCard({
  running,
  elapsed,
  steps,
  expanded,
  title,
  collapsedLabel,
  expandedTech,
  setExpandedTech,
  onPreviewArtifact,
  onToggle,
  onInspector,
}: {
  running: boolean;
  elapsed: string;
  steps: ActionStep[];
  expanded: boolean;
  title: string;
  collapsedLabel: string;
  expandedTech: string | null;
  setExpandedTech: (value: string | null) => void;
  onPreviewArtifact: (kind: ArtifactPreviewKind) => void;
  onToggle: () => void;
  onInspector: () => void;
}) {
  const visibleSteps = running ? steps.filter((step) => step.status !== "pending") : steps;
  const headerTitle = running || expanded ? title : collapsedLabel;

  return (
    <article className={`agentRun ${running ? "running" : "settled"} ${!expanded ? "collapsed" : ""}`}>
      <button
        className="runHeader"
        type="button"
        onClick={running ? onInspector : onToggle}
      >
        <span className={`motionLogo ${running ? "running" : ""}`}>
          <img src="/logo/bioaz-logo.svg" alt="" />
          <span />
        </span>
        <strong>{headerTitle}</strong>
        <small>{elapsed}</small>
      </button>
      {expanded ? (
        <div className="timeline">
          {visibleSteps.map((step, index) => (
            <div className={`timelineItem ${step.status}`} key={step.label}>
              <span className="timelineDot" />
              <div className="timelineContent">
                <div className="timelineTitle">
                  <strong>{step.label}</strong>
                  {step.status === "active" ? <span>进行中</span> : null}
                </div>
                <p>{step.detail}</p>
                {step.artifacts?.length ? (
                  <span className="artifactHover">
                    {step.artifacts.length} 个中间产物
                    <span className="artifactPopover">
                      <strong>{step.label}</strong>
                      {step.artifacts.map((artifact) => (
                        <button
                          type="button"
                          key={artifact}
                          onClick={() => onPreviewArtifact(artifactKindFromName(artifact))}
                        >
                          <Eye size={13} />
                          {artifact}
                        </button>
                      ))}
                    </span>
                  </span>
                ) : null}
                <button
                  className="textButton"
                  type="button"
                  onClick={() =>
                    setExpandedTech(expandedTech === step.label ? null : step.label)
                  }
                >
                  技术详情
                </button>
                {expandedTech === step.label ? (
                  <pre className="techBlock">
                    {step.tech}
                    {"\n"}job_id=job_99aa8e49e24742f6a2f1ca5a7be4b0ad
                    {"\n"}trace_id=trc_pengli_76f6c877
                  </pre>
                ) : null}
              </div>
              {index < visibleSteps.length - 1 ? <span className="timelineLine" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Composer({
  stage,
  files,
  protocolCount,
  dataCount,
  canStart,
  warnings,
  reviews,
  onRemoveFile,
  onStartValidation,
  onAcceptWarnings,
  onAcceptWarning,
  onRejectWarnings,
  onPreview,
  onStartReview,
  onConfirmReview,
  onConfirmAllReviews,
  onAskFollowup,
  onSendMessage,
  onUpload,
  composerText,
  setComposerText,
  inputRef,
  onOpenInspector,
  onPreviewReview,
}: {
  stage: Stage;
  files: UploadedFile[];
  protocolCount: number;
  dataCount: number;
  canStart: boolean;
  warnings: WarningItem[];
  reviews: ReviewItem[];
  onRemoveFile: (id: string) => void;
  onStartValidation: () => void;
  onAcceptWarnings: () => void;
  onAcceptWarning: (id: string) => void;
  onRejectWarnings: () => void;
  onPreview: () => void;
  onStartReview: () => void;
  onConfirmReview: (id: string) => void;
  onConfirmAllReviews: () => void;
  onAskFollowup: () => void;
  onSendMessage: (text: string) => void;
  onUpload: () => void;
  composerText: string;
  setComposerText: (value: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  onOpenInspector: (topic: InspectorTopic) => void;
  onPreviewReview: () => void;
}) {
  const pendingReviews = reviews.filter((item) => item.status === "pending").slice(0, 3);
  const [expandedDecision, setExpandedDecision] = useState<"warning" | "review" | null>(null);

  return (
    <footer className="composerShell">
      {stage === "warning" ? (
        <WarningDecisionPanel
          warnings={warnings}
          onAcceptAll={onAcceptWarnings}
          onAcceptOne={onAcceptWarning}
          onReject={onRejectWarnings}
          onPreview={onPreview}
          expanded={expandedDecision === "warning"}
          onToggleExpanded={() =>
            setExpandedDecision((current) => (current === "warning" ? null : "warning"))
          }
        />
      ) : null}

      {stage === "generated" ? (
        <ReviewLaunchPanel
          onStartReview={onStartReview}
          onOpenArtifacts={() => onOpenInspector("artifacts")}
        />
      ) : null}

      {stage === "review" && pendingReviews.length > 0 ? (
        <ReviewDecisionPanel
          reviews={reviews}
          onConfirmOne={onConfirmReview}
          onConfirmAll={onConfirmAllReviews}
          onAskFollowup={onAskFollowup}
          onPreviewEvidence={onPreviewReview}
          expanded={expandedDecision === "review"}
          onToggleExpanded={() =>
            setExpandedDecision((current) => (current === "review" ? null : "review"))
          }
        />
      ) : null}

      {stage === "empty" || stage === "uploaded" ? (
        <div className="filePrep">
          <div className={`requirementChip ${protocolCount ? "ok" : ""}`}>
            方案 Word {protocolCount}/1
          </div>
          <div className={`requirementChip ${dataCount ? "ok" : ""}`}>
            实验 Excel {dataCount}/1+
          </div>
          <div className={`requirementChip ${canStart ? "ok" : ""}`}>
            {canStart ? "文件已满足要求" : "等待上传"}
          </div>
        </div>
      ) : null}

      {files.length > 0 && (stage === "empty" || stage === "uploaded") ? (
        <div className="fileRows">
          {files.map((file) => (
            <div className="fileRow" key={file.id}>
              {file.kind === "data" ? <FileSpreadsheet size={17} /> : <FileText size={17} />}
              <span>{file.name}</span>
              <small>{file.size}</small>
              <button type="button" onClick={() => onRemoveFile(file.id)} aria-label="移除文件">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="composer workbenchComposer">
        <button className="attachIconButton" type="button" onClick={onUpload} aria-label="上传文件">
          <Plus size={18} />
        </button>
        <input
          ref={inputRef}
          aria-label="补充报告要求"
          value={composerText}
          onChange={(event) => setComposerText(event.target.value)}
          placeholder={
            stage === "empty" || stage === "uploaded"
              ? "补充本次报告要求，或直接上传文件开始"
              : "输入补充说明，或查看当前任务详情"
          }
        />
        <button
          className="sendIconButton"
          type="button"
          disabled={(stage === "empty" || stage === "uploaded") && !canStart && !composerText.trim()}
          onClick={() => {
            if (composerText.trim()) {
              onSendMessage(composerText);
              return;
            }
            if (stage === "empty" || stage === "uploaded") {
              onStartValidation();
              return;
            }
            if (stage === "generated") {
              onOpenInspector("artifacts");
              return;
            }
            if (stage === "reviewing" || stage === "review" || stage === "exported") {
              onOpenInspector("review");
              return;
            }
            onOpenInspector("process");
          }}
          aria-label={stage === "empty" || stage === "uploaded" ? "开始校验" : "发送"}
        >
          <Send size={17} />
        </button>
      </div>
    </footer>
  );
}

function warningEvidence(id: string) {
  const details: Record<
    string,
    {
      status: string;
      shortEvidence: string;
      shortImpact: string;
      evidence: string[];
      impact: string;
      trace: string;
    }
  > = {
    "W-01": {
      status: "需 SD 确认",
      shortEvidence: "数据 XLSX / tumor-volume / Day 28",
      shortImpact: "TGI 统计快照、终点日描述",
      evidence: [
        "文件：脱敏数据6.xlsx / Sheet：tumor-volume / 列：Tumor volume (mm3)",
        "位置：Day 28 / Group B / Mouse B-03，终点日肿瘤体积为空值",
        "对照依据：脱敏试验方案6.docx / 第 3 页 / 2.1 终点日定义",
      ],
      impact: "影响 TGI 表格快照、终点日趋势描述和 Figure 2 caption；不阻断报告生成，但最终放行前需要 SD 确认。",
      trace: "validation-report.json",
    },
    "W-02": {
      status: "需 QA 放行",
      shortEvidence: "方案 DOCX + 数据 XLSX / AE log",
      shortImpact: "体重/安全性描述、QA 放行",
      evidence: [
        "文件：脱敏数据6.xlsx / Sheet：AE log / 字段：closed、resolved",
        "位置：Mouse C-07 / Day 24，异常事件记录缺少 closed / resolved 状态",
        "对照依据：脱敏试验方案6.docx / 第 5 页 / Safety Observation",
      ],
      impact: "影响体重/安全性模块描述和 QA lineage completeness；最终导出前需要 QA 在模块审核中补充注记。",
      trace: "recognized-context.json",
    },
    "W-03": {
      status: "需统计确认",
      shortEvidence: "统计说明 / p-value method",
      shortImpact: "统计口径、结论措辞",
      evidence: [
        "文件：脱敏数据6.xlsx / Sheet：Group summary / 字段：p-value method",
        "位置：TGI summary / Day 28，统计方法来源未绑定到原始统计说明",
        "对照依据：脱敏试验方案6.docx / 第 7 页 / Statistical Analysis",
      ],
      impact: "影响统计口径和结论措辞边界；不阻断报告生成，但最终放行前需要统计确认显著性描述口径。",
      trace: "recognized-context.json",
    },
  };

  return details[id] ?? details["W-01"];
}

function reviewEvidence(id: string) {
  const details: Record<
    string,
    {
      shortEvidence: string;
      shortImpact: string;
      evidence: string[];
      impact: string;
      trace: string;
    }
  > = {
    "R-01": {
      shortEvidence: "QC report / TGI trend / Day 28 endpoint",
      shortImpact: "结论措辞与 SD 最终签核口径",
      evidence: [
        "来源：qc-report.md / Statistics review / TGI wording",
        "位置：Day 28 TGI summary，TV/TGI 显著性描述与瘤重结论存在口径差异",
        "对照：validation-report.json 中 W-01 的终点日缺失值说明",
      ],
      impact:
        "报告产物已生成，不阻塞后续 Agent 动作；建议 SD 在最终放行前确认结论措辞，必要时修改 Word 报告中的结论段、TGI 表格脚注和 Figure 2 caption。",
      trace: "qc-report.md",
    },
    "R-02": {
      shortEvidence: "Validation report / AE log / humane endpoint",
      shortImpact: "安全性模块修订与 QA 放行记录",
      evidence: [
        "来源：validation-report.json / Safety review / AE closure",
        "位置：AE log / Mouse C-07 / Day 24，closed / resolved 字段仍需人工补充",
        "对照：方案文件 Safety Observation 章节与 W-02 的异常事件闭环 warning",
      ],
      impact:
        "报告产物已生成，不影响当前交付物预览；建议 QA 或 SD 补充异常事件处置依据，再决定是否修订体重/安全性模块描述和审核备注。",
      trace: "validation-report.json",
    },
    "R-03": {
      shortEvidence: "Recognized context / p-value method / Prism QC",
      shortImpact: "统计方法说明与交付格式复核",
      evidence: [
        "来源：recognized-context.json / Statistical Analysis / p-value method",
        "位置：Group summary / TGI summary，p-value method 未绑定到原始统计说明",
        "对照：qc-report.md 中 Prism/OLE 依赖和导出格式复核项",
      ],
      impact:
        "报告产物已生成，不回退生成流程；建议统计角色补充方法来源或脚本依据，并在最终归档前复核 Word 目录、图表编号和 Prism 源文件依赖。",
      trace: "recognized-context.json",
    },
  };

  return details[id] ?? details["R-01"];
}

function ReviewLaunchPanel({
  onStartReview,
  onOpenArtifacts,
}: {
  onStartReview: () => void;
  onOpenArtifacts: () => void;
}) {
  return (
    <article className="warningDecision reviewDecision">
      <div className="warningDecisionHeader">
        <div>
          <span>专家小队审核</span>
          <strong>报告产物已生成，可以发起专家小队审核</strong>
        </div>
        <small>待发起</small>
      </div>
      <p className="responsibilityNote">
        专家小队会检查数据溯源、统计口径、安全性和图表版式；审核完成后，再汇总需要人工确认或补充证据的建议。
      </p>
      <div className="warningActions">
        <button className="decisionIcon" type="button" onClick={onOpenArtifacts} aria-label="查看产物">
          <Eye size={16} />
        </button>
        <button className="primaryButton compact" type="button" onClick={onStartReview}>
          发起专家小队审核
        </button>
      </div>
    </article>
  );
}

function WarningDecisionPanel({
  warnings,
  onAcceptAll,
  onAcceptOne,
  onReject,
  onPreview,
  expanded,
  onToggleExpanded,
}: {
  warnings: WarningItem[];
  onAcceptAll: () => void;
  onAcceptOne: (id: string) => void;
  onReject: () => void;
  onPreview: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const acceptedCount = warnings.filter((item) => item.accepted).length;
  const pendingWarnings = warnings.filter((item) => !item.accepted);

  return (
    <article className={`warningDecision stackDecision ${expanded ? "isPinned" : ""}`}>
      <button className="warningDecisionHeader decisionExpandHeader" type="button" aria-expanded={expanded} onClick={onToggleExpanded}>
        <div>
          <span>需要确认的 warning</span>
          <strong>校验可继续，但需要授权用户接受风险</strong>
        </div>
        <small>{acceptedCount}/{warnings.length}<ChevronRight size={14} /></small>
      </button>
      <div className="warningDecisionList">
        {pendingWarnings.slice(0, 3).map((item, index) => {
          const detail = warningEvidence(item.id);
          return (
          <div
            className="decisionRow"
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={onPreview}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onPreview();
            }}
          >
            <span className="decisionIndex">
              {index + 1}
            </span>
            <div className="decisionCopy">
              <span>{item.owner}</span>
              <strong>{item.title}</strong>
              <p>证据：{detail.shortEvidence}</p>
              <p>影响：{detail.shortImpact}</p>
            </div>
            <div className="decisionInlineActions">
              <button className="decisionIcon" type="button" onClick={onPreview} aria-label={`${item.title}预览证据`}>
                <Eye size={15} />
              </button>
              <button
                className="decisionPrimary"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAcceptOne(item.id);
                }}
              >
                确认此项
              </button>
            </div>
          </div>
          );
        })}
      </div>
      <div className="warningActions">
        <button className="decisionIcon" type="button" onClick={onPreview} aria-label="查看校验预览">
          <Eye size={16} />
        </button>
        <button className="primaryButton compact" type="button" onClick={onAcceptAll}>
          确认风险并继续生成
        </button>
        <button className="secondaryButton compact" type="button" onClick={onReject}>
          退回并替换文件
        </button>
      </div>
      <p className="responsibilityNote">
        确认 warning 只表示接受这些风险进入生成流程，不等于确认最终科学结论放行。
      </p>
    </article>
  );
}

function ReviewDecisionPanel({
  reviews,
  onConfirmOne,
  onConfirmAll,
  onAskFollowup,
  onPreviewEvidence,
  expanded,
  onToggleExpanded,
}: {
  reviews: ReviewItem[];
  onConfirmOne: (id: string) => void;
  onConfirmAll: () => void;
  onAskFollowup: () => void;
  onPreviewEvidence: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const confirmedCount = reviews.filter((item) => item.status === "confirmed").length;
  const pendingReviews = reviews.filter((item) => item.status === "pending").slice(0, 3);

  return (
    <article className={`warningDecision reviewDecision stackDecision ${expanded ? "isPinned" : ""}`}>
      <button className="warningDecisionHeader decisionExpandHeader" type="button" aria-expanded={expanded} onClick={onToggleExpanded}>
        <div>
          <span>专家建议确认</span>
          <strong>专家小队已完成检查，需要你处理关键建议</strong>
        </div>
        <small>{confirmedCount}/{reviews.length}<ChevronRight size={14} /></small>
      </button>
      <div className="warningDecisionList">
        {pendingReviews.map((item, index) => {
          const detail = reviewEvidence(item.id);
          return (
          <div
            className="decisionRow"
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={onPreviewEvidence}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onPreviewEvidence();
            }}
          >
            <span className="decisionIndex">
              {index + 1}
            </span>
            <div className="decisionCopy">
              <span>{item.owner}</span>
              <strong>{item.title}</strong>
              <p>
                <ExpertName name={expertNameFromSource(item.source)} /> {stripExpertPrefix(item.source)}
                {" "}
                <TraceReference label={detail.trace} />
              </p>
              <p>证据：{detail.shortEvidence}</p>
              <p>影响：{detail.shortImpact}</p>
            </div>
            <div className="decisionInlineActions">
              <button
                className="decisionIcon"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPreviewEvidence();
                }}
                aria-label={`${item.title}预览建议依据`}
              >
                <Eye size={15} />
              </button>
              <button
                className="decisionPrimary"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onConfirmOne(item.id);
                }}
              >
                确认此项
              </button>
            </div>
          </div>
          );
        })}
      </div>
      <div className="warningActions">
        <button className="decisionIcon" type="button" onClick={onPreviewEvidence} aria-label="查看专家建议预览">
          <Eye size={16} />
        </button>
        <button className="primaryButton compact" type="button" onClick={onConfirmAll}>
          全部确认
        </button>
        <button className="secondaryButton compact" type="button" onClick={onAskFollowup}>
          补充问询
        </button>
      </div>
    </article>
  );
}

function FollowupAnswer({ state }: { state: FollowupState }) {
  if (state === "thinking") {
    return (
      <article className="agentRun collapsed">
        <button className="runHeader" type="button">
          <span className="motionLogo running">
            <img src="/logo/bioaz-logo.svg" alt="" />
            <span />
          </span>
          <strong>Thinking...</strong>
          <small>12s</small>
        </button>
      </article>
    );
  }

  return (
    <article className="agentResult followupAnswer">
      <div className="resultIcon">
        <SearchCheck size={18} />
      </div>
      <div>
        <h2>已整理需人工确认的依据</h2>
        <p>
          目前仍需用户确认的重点是结论措辞边界、人道终点处置记录和统计路径复核。Agent
          已把证据收敛到可核查项，最终确认仍由 SD / QA / 统计角色负责。
        </p>
        <ul>
          <li>
            结论措辞：请补充 SD 对 TV/TGI 显著但瘤重 p 值不显著时的表述口径。
            <TraceReference label="qc-report.md" />
          </li>
          <li>
            安全性闭环：请补充 TV 超阈值、BWL 超阈值个体是否触发停药或安乐死记录。
            <TraceReference label="validation-report.json" />
          </li>
          <li>
            统计路径：请补充原始统计脚本或确认 ANOVA / Dunnett / p 值边界输出规则。
            <TraceReference label="recognized-context.json" />
          </li>
        </ul>
      </div>
    </article>
  );
}

function TraceReference({ label }: { label: string }) {
  const reference = traceReferences.find((item) => item.label === label) ?? traceReferences[0];

  return (
    <span className="traceRef">
      {reference.label}
      <span className="traceTooltip">
        <strong>{reference.label}</strong>
        <span>{reference.detail}</span>
        <button type="button">
          <Eye size={12} />
          预览
        </button>
        <button type="button">
          <Download size={12} />
          下载
        </button>
      </span>
    </span>
  );
}

function ExpertName({ name, task }: { name: string; task?: string }) {
  const profile = expertProfiles[name] ?? expertProfiles["终审专家 F"];

  return (
    <span className="expertHover">
      {name}
      <span className="expertTooltip">
        <strong>{name}</strong>
        <small>{task ?? profile.role}</small>
        <span>{profile.finding}</span>
      </span>
    </span>
  );
}

function expertNameFromSource(source: string) {
  if (source.includes("统计")) return "统计复核专家 C";
  if (source.includes("QA")) return "安全性专家 S";
  if (source.includes("图表")) return "图表版式专家 G";
  if (source.includes("数据")) return "数据核对专家 D";
  return "终审专家 F";
}

function stripExpertPrefix(source: string) {
  return source
    .replace("统计检查 Agent", "")
    .replace("QA 检查 Agent", "")
    .replace("图表检查 Agent", "")
    .replace("数据核对 Agent", "")
    .trim();
}

function ArtifactCard({
  icon,
  title,
  name,
  meta,
  onPreview,
  downloadable = false,
}: {
  icon: React.ReactNode;
  title: string;
  name: string;
  meta: string;
  onPreview?: () => void;
  downloadable?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="artifactCard">
      <div className="artifactIcon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{name}</p>
        <span>{meta}</span>
      </div>
      <div className="artifactActions">
        <button type="button" onClick={onPreview} aria-label={`预览 ${title}`}>
          <Eye size={16} />
          预览
        </button>
        {downloadable ? (
          <button type="button">
            <Download size={16} />
            下载
          </button>
        ) : null}
        <div className="moreMenuWrap">
          <button type="button" aria-label="更多" onClick={() => setMenuOpen((value) => !value)}>
            <MoreHorizontal size={18} />
          </button>
          {menuOpen ? (
            <div className="moreMenu">
              <button type="button">用其他方式打开</button>
              <button type="button">导出副本</button>
              <button type="button">查看业务证据</button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function HoverInspector({
  open,
  pinned,
  topic,
  stage,
  validationSteps,
  generationSteps,
  warnings,
  reviews,
  onMouseEnter,
  onMouseLeave,
  onSelectTopic,
  onPin,
  onPreviewArtifact,
  onPreviewWorkflow,
}: {
  open: boolean;
  pinned: boolean;
  topic: InspectorTopic;
  stage: Stage;
  validationSteps: ActionStep[];
  generationSteps: ActionStep[];
  warnings: WarningItem[];
  reviews: ReviewItem[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSelectTopic: (topic: InspectorTopic) => void;
  onPin: () => void;
  onPreviewArtifact: (kind: ArtifactPreviewKind) => void;
  onPreviewWorkflow: (kind: PreviewKind, section?: PreviewSection) => void;
}) {
  const processSteps = topic === "generation" ? generationSteps : validationSteps;
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const panelOptions = inspectorPanels(stage);
  const activeTopic: InspectorTopic = panelOptions.some((panel) => panel.id === topic)
    ? topic
    : (panelOptions[0]?.id ?? "process");
  const activePanel = panelOptions.find((panel) => panel.id === activeTopic) ?? panelOptions[0];

  return (
    <aside
      className={`inspector ${open ? "open" : ""} ${pinned ? "pinned" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-hidden={!open}
    >
      <header>
        <div className="workbenchPanelSelector">
          <button
            className="workbenchPanelSelectorTrigger"
            type="button"
            onClick={() => setPanelMenuOpen((current) => !current)}
            aria-expanded={panelMenuOpen}
          >
            <FileText size={16} />
            <span>{activePanel?.label ?? "过程"}</span>
            <ChevronRight className={panelMenuOpen ? "isOpen" : ""} size={15} />
          </button>
          {panelMenuOpen ? (
            <div className="workbenchPanelSelectorMenu">
              {panelOptions.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => {
                    onSelectTopic(panel.id);
                    setPanelMenuOpen(false);
                  }}
                >
                  <FileText size={16} />
                  <span>{panel.label}</span>
                  {activeTopic === panel.id ? <Check size={17} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="inspectorControls">
          <button type="button" onClick={onPin} aria-label={pinned ? "取消固定" : "固定"}>
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        </div>
      </header>

      {activeTopic === "process" || activeTopic === "generation" ? (
        <div className="inspectorSection">
          {processSteps.map((step) => (
            <div className="inspectorStep" key={step.label}>
              <span className={step.status}>
                {step.status === "done" ? <Check size={12} /> : null}
              </span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activeTopic === "warnings" ? (
        <div className="inspectorSection">
          <div className="panelIntro">
            <strong>风险回看</strong>
            <p>确认后的风险项保留在这里，可在最终放行前回看来源证据和影响范围。</p>
          </div>
          {warnings.map((item) => {
            const detail = warningEvidence(item.id);
            return (
              <div className="issueRow compact issueRowWithAction" key={item.id}>
                <div className="issueRowMain">
                  <span className={item.accepted ? "statusChip confirmed" : "statusChip pending"}>
                    {item.id}
                  </span>
                  <strong>{item.title}</strong>
                  <p className="issueMeta">证据：{detail.shortEvidence}</p>
                  <p className="issueMeta">影响：{detail.shortImpact}</p>
                </div>
                <div className="deliverableActions">
                  <button
                    type="button"
                    aria-label={`${item.title}预览校验问题`}
                    onClick={() => onPreviewWorkflow("validation", "issues")}
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {activeTopic === "review" ? (
        <div className="inspectorSection">
          <div className="panelIntro">
            <strong>{stage === "generated" ? "等待发起审核" : stage === "reviewing" ? "专家小队审核中" : "审核建议确认"}</strong>
            <p>
              {stage === "generated"
                ? "报告产物已生成，发起专家小队审核后才会生成审核建议。"
                : stage === "reviewing"
                  ? "专家小队正在检查报告产物，审核完成后会在这里展示需要确认的建议。"
                  : "展示需要人工确认或补充证据的专家建议，方便在最终放行前逐项回看。"}
            </p>
          </div>
          {stage === "generated" || stage === "reviewing" ? null : reviews.map((item) => {
            const detail = reviewEvidence(item.id);
            return (
            <div className="issueRow compact issueRowWithAction" key={item.id}>
              <div className="issueRowMain">
                <span className={item.status === "confirmed" ? "statusChip confirmed" : "statusChip pending"}>
                  {item.id}
                </span>
                <strong>{item.title}</strong>
                <p className="issueMeta">{stripExpertPrefix(item.source)}</p>
                <p className="issueMeta">影响：{detail.shortImpact}</p>
              </div>
              <div className="deliverableActions">
                <button
                  type="button"
                  aria-label={`${item.title}预览专家建议`}
                  onClick={() => onPreviewWorkflow("review", "issues")}
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      ) : null}

      {activeTopic === "artifacts" ? (
        <div className="inspectorSection">
          <div className="panelIntro">
            <strong>交付产物</strong>
            <p>核心交付在主对话中展示，其余过程产物和证据在这里预览或打开。</p>
          </div>
          {generationGroups.map((group) => (
            <div className="artifactMini deliverable" key={group.title}>
              <span className="deliverableIcon">{artifactIcon(group.kind)}</span>
              <div>
                <strong>{group.title}</strong>
                <p>{group.meta}</p>
                <small>{group.count}</small>
              </div>
              <div className="deliverableActions">
                <button
                  type="button"
                  aria-label={`预览${group.title}`}
                  onClick={() => onPreviewArtifact(group.kind as ArtifactPreviewKind)}
                >
                  <Eye size={14} />
                </button>
                {group.kind === "package" ? (
                  <button type="button" aria-label={`下载${group.title}`}>
                    <Download size={14} />
                  </button>
                ) : null}
                <div className="moreMenuWrap">
                  <button type="button" aria-label={`${group.title}更多操作`}>
                    <MoreHorizontal size={14} />
                  </button>
                  <div className="moreMenu small">
                    <button type="button">用其他方式打开</button>
                    <button type="button">查看业务证据</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="panelDivider" />
          <div className="panelIntro compact">
            <strong>风险回看</strong>
            <p>确认后的风险项保留在这里，可在最终放行前回看来源证据和影响范围。</p>
          </div>
          {warnings.map((item) => {
            const detail = warningEvidence(item.id);
            return (
              <div className="issueRow compact issueRowWithAction" key={item.id}>
                <div className="issueRowMain">
                  <span className={item.accepted ? "statusChip confirmed" : "statusChip pending"}>{item.id}</span>
                  <strong>{item.title}</strong>
                  <p className="issueMeta">证据：{detail.shortEvidence}</p>
                </div>
                <div className="deliverableActions">
                  <button
                    type="button"
                    aria-label={`${item.title}预览校验问题`}
                    onClick={() => onPreviewWorkflow("validation", "issues")}
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="panelDivider" />
          <div className="panelIntro compact">
            <strong>专家建议摘要</strong>
          </div>
          {reviews.slice(0, 3).map((item) => (
            <div className="issueRow compact issueRowWithAction" key={item.id}>
              <div className="issueRowMain">
                <span className={item.status === "confirmed" ? "statusChip confirmed" : "statusChip pending"}>{item.id}</span>
                <strong>{item.title}</strong>
                <p className="issueMeta">{stripExpertPrefix(item.source)}</p>
              </div>
              <div className="deliverableActions">
                <button
                  type="button"
                  aria-label={`${item.title}预览专家建议`}
                  onClick={() => onPreviewWorkflow("review", "issues")}
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="auditNote">
            <ShieldCheck size={17} />
            <span>下载会先经过 CECH 项目权限校验。</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
function inspectorPanels(stage: Stage): Array<{ id: InspectorTopic; label: string }> {
  if (stage === "generated" || stage === "reviewing" || stage === "review" || stage === "exported") {
    return [
      { id: "artifacts", label: "产物" },
      { id: "warnings", label: "风险回看" },
      { id: "review", label: "审核建议" },
    ];
  }

  if (stage === "warning" || stage === "generating") {
    return [
      { id: "warnings", label: "风险回看" },
      { id: "artifacts", label: "产物" },
    ];
  }

  return [{ id: "process", label: "处理过程" }];
}

function artifactIcon(kind: string) {
  if (kind === "package") return <FileArchive size={18} />;
  if (kind === "prism" || kind === "qc" || kind === "evidence") return <FileJson size={18} />;
  if (kind === "figure") return <Sparkles size={18} />;
  if (kind === "word") return <FileCheck size={18} />;
  return <FileText size={18} />;
}

function ValidationPreviewModal({
  kind,
  section,
  setSection,
  onClose,
}: {
  kind: PreviewKind;
  section: PreviewSection;
  setSection: (section: PreviewSection) => void;
  onClose: () => void;
}) {
  const isReview = kind === "review";
  const sections: Array<{ id: PreviewSection; label: string; desc: string }> = isReview
    ? [
        { id: "issues", label: "建议列表", desc: "问题类型、专家、处理建议" },
        { id: "recognized", label: "专家分工", desc: "各专家检查范围" },
        { id: "qa", label: "放行影响", desc: "是否影响最终交付" },
        { id: "context", label: "补充证据", desc: "用户需要补充的材料" },
      ]
    : [
        { id: "recognized", label: "识别结果", desc: "方案、分组、时间点、指标" },
        { id: "issues", label: "校验问题", desc: "warning 影响和处理建议" },
        { id: "qa", label: "QA 检查", desc: "Pre-QA 和证据状态" },
        { id: "context", label: "分析上下文", desc: "允许 Agent 解释的事实" },
      ];

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="previewModal">
        <header>
          <div>
            <span>{isReview ? "专家建议" : "校验预览"}</span>
            <h2>{isReview ? "专家建议预览" : "校验预览"}</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="previewBody">
          <nav className="previewNav" aria-label="校验预览目录">
            {sections.map((item) => (
              <button
                key={item.id}
                className={section === item.id ? "active" : ""}
                type="button"
                onClick={() => setSection(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </nav>
          <div className="previewContent">
            {isReview ? (
              <>
                {section === "recognized" ? <ReviewExpertsTable /> : null}
                {section === "issues" ? <ReviewIssueCards /> : null}
                {section === "qa" ? <ReviewGateTable /> : null}
                {section === "context" ? <ReviewEvidenceTable /> : null}
              </>
            ) : (
              <>
                {section === "recognized" ? <RecognizedTable /> : null}
                {section === "issues" ? <IssueTable /> : null}
                {section === "qa" ? <QaTable /> : null}
                {section === "context" ? <ContextTable /> : null}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function RecognizedTable() {
  return (
    <PreviewTable
      title="识别结果"
      rows={[
        ["方案文件", "脱敏试验方案6.docx", "已识别项目背景、动物品系和给药流程"],
        ["数据文件", "脱敏数据6.xlsx", "识别 Raw data、Group summary、Study design"],
        ["结果模块", "5 个", "肿瘤体积、RTV、TGI、瘤重、体重/安全性"],
        ["时间点", "Day 0 - Day 28", "终点日需要关注缺失值和异常事件"],
      ]}
    />
  );
}

function IssueTable() {
  const warningIds = ["W-01", "W-02", "W-03"];

  return (
    <div className="warningEvidenceList">
      <h3>校验问题</h3>
      {warningIds.map((id) => {
        const detail = warningEvidence(id);
        const title =
          id === "W-01"
            ? "终点日肿瘤体积存在 1 处缺失"
            : id === "W-02"
              ? "异常事件闭环证据不完整"
              : "p-value 方法来源需复核";

        return (
          <article className="warningEvidenceCard" key={id}>
            <header>
              <span>{id}</span>
              <div>
                <strong>{title}</strong>
                <small>{detail.status}</small>
              </div>
            </header>
            <div className="warningEvidenceGrid">
              <section>
                <span>来源证据</span>
                {detail.evidence.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <TraceReference label={detail.trace} />
              </section>
              <section>
                <span>影响范围</span>
                <p>{detail.impact}</p>
              </section>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function QaTable() {
  return (
    <PreviewTable
      title="QA 检查结果"
      rows={[
        ["source hash", "通过", "方案与数据文件 digest 已绑定"],
        ["lineage completeness", "warning", "终点日缺失值需要 SD 确认"],
        ["date / deviation", "warning", "异常事件闭环证据不完整"],
        ["Word unauthorized number", "待 generation", "生成后进入 QC"],
      ]}
    />
  );
}

function ContextTable() {
  return (
    <PreviewTable
      title="分析上下文"
      rows={[
        ["allowed facts", "已计算事实", "Agent 可解释，不可重算数字"],
        ["next action", "接受 warning 或替换文件", "用户决定是否进入 generation"],
        ["责任边界", "人类确认", "warning 确认不等于科学结论签字"],
      ]}
    />
  );
}

function ReviewIssueCards() {
  return (
    <div className="warningEvidenceList">
      <h3>专家建议列表</h3>
      {initialReviews.map((item) => {
        const detail = reviewEvidence(item.id);
        return (
          <article className="warningEvidenceCard reviewEvidenceCard" key={item.id}>
            <header>
              <span>{item.id}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.owner}</small>
              </div>
            </header>
            <div className="warningEvidenceGrid">
              <section>
                <span>来源证据</span>
                {detail.evidence.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <TraceReference label={detail.trace} />
              </section>
              <section>
                <span>影响范围</span>
                <p>{detail.impact}</p>
              </section>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ReviewIssueTable() {
  return (
    <PreviewTable
      title="专家建议列表"
      rows={[
        ["R-01 / 统计口径", "统计复核专家 C", "TV/TGI 显著措辞需要 SD 确认，避免与瘤重结论口径冲突"],
        ["R-02 / 安全性闭环", "安全性专家 S", "异常事件与人道终点处置证据需要补充或确认"],
        ["R-03 / 交付格式", "图表版式专家 G", "图表编号、目录链接和 Prism/OLE 依赖需要复核"],
      ]}
    />
  );
}

function ReviewExpertsTable() {
  return (
    <PreviewTable
      title="专家分工"
      rows={[
        ["数据核对专家 D", "数据溯源", "核对报告、Excel、方案之间的来源一致性"],
        ["统计复核专家 C", "统计口径", "复核公式、p-value、显著性描述和结论边界"],
        ["安全性专家 S", "安全性闭环", "检查异常事件、人道终点、停药与动物福利记录"],
        ["图表版式专家 G", "交付格式", "检查图表、目录、外链、版式和交付包完整性"],
        ["终审专家 F", "建议收口", "合并多专家意见并输出用户需要处理的建议"],
      ]}
    />
  );
}

function ReviewGateTable() {
  return (
    <PreviewTable
      title="放行影响"
      rows={[
        ["是否阻断", "暂不阻断生成", "但最终导出前需要完成用户确认和 QA 门禁"],
        ["影响范围", "结论措辞 / 安全性描述 / 交付格式", "建议按类型逐条确认或补充证据"],
        ["责任边界", "用户确认", "专家建议不替代 SD / QA / 统计角色的最终签核"],
      ]}
    />
  );
}

function ReviewEvidenceTable() {
  return (
    <PreviewTable
      title="需要补充的证据"
      rows={[
        ["统计口径", "原始统计脚本或 SD 确认", "用于确认 TV/TGI 显著措辞是否可进入终稿"],
        ["安全性闭环", "异常事件和人道终点处置记录", "用于确认体重/安全性模块是否需要补充描述"],
        ["交付格式", "Word 打开后的目录和图表检查", "用于确认最终交付件是否可归档"],
      ]}
    />
  );
}

function ArtifactPreviewModal({
  kind,
  setKind,
  onClose,
}: {
  kind: ArtifactPreviewKind;
  setKind: (kind: ArtifactPreviewKind) => void;
  onClose: () => void;
}) {
  const sections: Array<{ id: ArtifactPreviewKind; label: string; desc: string }> = [
    { id: "word", label: "Word 报告", desc: "核心交付稿预览" },
    { id: "package", label: "交付包", desc: "最终 ZIP 构成" },
    { id: "prism", label: "Prism 源文件", desc: "统计与作图源文件" },
    { id: "figure", label: "Figure 图片", desc: "报告图与高清图" },
    { id: "qc", label: "QC 报告", desc: "导出前质量门禁" },
    { id: "evidence", label: "业务证据摘要", desc: "校验与确认依据" },
    { id: "review-doc", label: "专家建议文档", desc: "用户确认后的审核交付" },
  ];

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="previewModal artifactPreviewModal">
        <header>
          <div>
            <span>产物预览</span>
            <h2>{sections.find((item) => item.id === kind)?.label ?? "产物预览"}</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="previewBody">
          <nav className="previewNav" aria-label="产物预览目录">
            {sections.map((item) => (
              <button
                key={item.id}
                className={kind === item.id ? "active" : ""}
                type="button"
                onClick={() => setKind(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </nav>
          <div className="previewContent">
            {kind === "word" ? <WordArtifactPreview /> : null}
            {kind === "package" ? <PackageArtifactPreview /> : null}
            {kind === "prism" ? <PrismArtifactPreview /> : null}
            {kind === "figure" ? <FigureArtifactPreview /> : null}
            {kind === "qc" ? <QcArtifactPreview /> : null}
            {kind === "evidence" ? <EvidenceArtifactPreview /> : null}
            {kind === "review-doc" ? <ReviewDocArtifactPreview /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function WordArtifactPreview() {
  return (
    <div className="artifactPreviewReader">
      <aside className="docOutline">
        <strong>报告目录</strong>
        <span>1. 实验目的</span>
        <span>2. 材料与方法</span>
        <span>3. 结果与分析</span>
        <span>4. 结论</span>
        <span>5. 附件</span>
      </aside>
      <article className="docPage">
        <span className="docEyebrow">Word 报告 · DOCX · 2.06 MB</span>
        <h3>研究受试物对人小细胞肺癌 NCI-H82 细胞株在 BALB c nude 小鼠皮下异位移植瘤生长的作用报告</h3>
        <p>
          本预览展示报告成稿的核心结构和可读摘要。完整 Word 下载前仍需完成专家建议确认、QC / Pre-QA 门禁和项目权限校验。
        </p>
        <div className="docSection">
          <strong>结果摘要</strong>
          <p>已写入肿瘤体积、相对肿瘤体积、TGI、瘤重和体重/安全性模块。统计值来自冻结的 validation 事实，不由 LLM 重新计算。</p>
        </div>
        <div className="docSection muted">
          <strong>待确认提示</strong>
          <p>TV/TGI 结论措辞、人道终点闭环和部分图表格式仍需用户确认后进入最终放行。</p>
        </div>
      </article>
    </div>
  );
}

function PackageArtifactPreview() {
  const groups = [
    ["核心交付", "Word 报告成稿、完整 report-package.zip"],
    ["源文件", "4 个 Prism 源文件：body-weight、tumor-volume、RTV、tumor-weight"],
    ["图片", "5 张 Figure PNG：96dpi / 300dpi"],
    ["质量材料", "QC report、QC JSON、业务证据摘要"],
  ];

  return (
    <div className="packagePreview">
      <div className="previewNotice">
        <ShieldCheck size={17} />
        <span>所有下载会先经过 CECH 项目权限校验；预览不暴露临时 URL 或内部 bucket 路径。</span>
      </div>
      {groups.map(([title, detail]) => (
        <div className="packageGroup" key={title}>
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
      ))}
    </div>
  );
}

function PrismArtifactPreview() {
  return (
    <PreviewTable
      title="Prism 源文件"
      rows={[
        ["body-weight.prism", "161.7 KB", "体重与安全性趋势图源文件"],
        ["tumor-volume.prism", "163.0 KB", "肿瘤体积趋势图源文件"],
        ["relative-tumor-volume.prism", "163.6 KB", "RTV 统计与作图源文件"],
        ["tumor-weight.prism", "167.5 KB", "终点瘤重与 TGI 图源文件"],
      ]}
    />
  );
}

function FigureArtifactPreview() {
  return (
    <div className="figurePreview">
      <div className="figureCanvas">
        <span>Figure Preview</span>
        <strong>肿瘤体积趋势图 · 300dpi</strong>
        <div className="chartLine" />
      </div>
      <div className="figureThumbs">
        {["tumor-volume-300dpi.png", "body_weight-300dpi.png", "relative_tumor_volume-300dpi.png", "tumor_weight-300dpi.png"].map(
          (name) => (
            <button type="button" key={name}>
              <FileText size={15} />
              {name}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function QcArtifactPreview() {
  return (
    <div className="qcPreview">
      <div className="qcGate">
        <i />
        <div>
          <strong>QC 暂未阻断最终放行</strong>
          <p>仍需用户确认专家建议后，再执行最终导出门禁。</p>
        </div>
      </div>
      <PreviewTable
        title="QC 摘要"
        rows={[
          ["Word 未授权数字", "0 个高置信问题", "生成内容基于冻结 validation 事实"],
          ["Prism 数据一致性", "待最终复核", "与 Word 表格和 Figure 保持联动检查"],
          ["相对链接完整性", "通过", "交付包内部路径可解析"],
          ["manifest integrity", "摘要通过", "全量 manifest 默认不展示给业务用户"],
        ]}
      />
    </div>
  );
}

function EvidenceArtifactPreview() {
  return (
    <PreviewTable
      title="业务证据摘要"
      rows={[
        ["校验依据", "recognized-context / validation-report", "用于解释 warning 的来源和影响范围"],
        ["表格快照", "report-table-snapshot", "保留关键统计表、模块数据和确认边界"],
        ["用户确认", "warning accepted + review confirmed", "只表示接受风险或处理建议，不等同最终科学结论签字"],
        ["隐藏信息", "job id / sha / trace / full manifest", "默认折叠，仅技术详情中查看"],
      ]}
    />
  );
}

function ReviewDocArtifactPreview() {
  return (
    <PreviewTable
      title="专家建议文档"
      rows={[
        ["结论措辞", "需 SD 确认", "TV/TGI 显著措辞是否可进入最终汇总句"],
        ["安全性闭环", "需 QA 放行", "异常事件、人道终点和备用动物处置记录需补充或确认"],
        ["交付格式", "需格式复核", "目录断链、图注 SEM 表述、Prism/OLE 依赖进入最终检查清单"],
        ["放行边界", "用户确认后进入导出", "专家建议不替代 SD / QA / 统计角色最终签核"],
      ]}
    />
  );
}

function PreviewTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="previewTableWrap">
      <h3>{title}</h3>
      <table className="previewTable">
        <thead>
          <tr>
            <th>项目</th>
            <th>结果</th>
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
