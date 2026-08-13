"use client";

import {
  ArrowUpDown,
  Briefcase,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Folder,
  FolderInput,
  FolderOutput,
  Library,
  LoaderCircle,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { initialKnowledgeFiles } from "../../lib/workbench/mockWorkspace";
import type { InboxAccount } from "../../lib/workbench/mockInbox";
import type { KnowledgeFile, LibraryFolder, LibraryView } from "../../lib/workbench/shellTypes";
import type { ProjectType, WorkbenchProject, WorkbenchTask } from "../../modules/types";
import { InboxTodoPanel } from "./InboxTodoPanel";
import { ProjectActivityTab } from "./ProjectActivityTab";
import { ProjectPlanTab } from "./ProjectPlanTab";
import { KnowledgeAsk } from "./KnowledgeAsk";
import { Menu, MenuGroup, MenuItem, NavTabs } from "../ui";
import { WorkspaceAssistant } from "./ShellControls";
import { useDismissableLayer } from "./useDismissableLayer";

/* 项目中枢的四个 tab。层级在这里翻转了：以前必须先选一个项目才能看到
   动态/计划/资料，所以待办天生跨不了项目。现在 tab 在上、项目在下，
   项目从"必经路径"降级成"一个筛选维度"，默认全部项目。 */
export type HubTab = "todo" | "activity" | "plan" | "data";

type SortKey = "updated" | "kind" | "name" | "source";
type TimeBucket = "all" | "today" | "week" | "month" | "earlier";

const clientHubTabs: Array<{ id: HubTab; label: string }> = [
  { id: "todo", label: "待我处理" },
  { id: "activity", label: "动态" },
  { id: "plan", label: "计划" },
  { id: "data", label: "资料" },
];

// 资料空间没有任务、没有流转，动态和计划对它是空的——空 tab 会教用户
// 怀疑所有 tab，所以按类型直接不给。
const libraryHubTabs: Array<{ id: HubTab; label: string }> = [{ id: "data", label: "资料" }];

const sortOptions: Array<{ id: SortKey; label: string }> = [
  { id: "updated", label: "按更新时间" },
  { id: "kind", label: "按文件类型" },
  { id: "name", label: "按名称" },
  { id: "source", label: "按来源" },
];

const timeOptions: Array<{ id: TimeBucket; label: string }> = [
  { id: "all", label: "全部时间" },
  { id: "today", label: "今天" },
  { id: "week", label: "本周" },
  { id: "month", label: "本月" },
  { id: "earlier", label: "更早" },
];

const businessOptions = ["全部业务", "DMPK报价", "药效报告", "未分类"];

// mock 数据的 updated 是「36分钟前 / 昨天 / 3天前」这类相对文案，这里按文案归档到时间桶。
function timeBucketOf(updated: string): Exclude<TimeBucket, "all"> {
  if (/刚刚|分钟前|小时前/.test(updated)) return "today";
  if (/昨天/.test(updated)) return "week";
  const days = Number(updated.match(/(\d+)\s*天前/)?.[1]);
  if (Number.isFinite(days)) {
    if (days <= 7) return "week";
    if (days <= 30) return "month";
  }
  return "earlier";
}

function sourceOf(file: KnowledgeFile) {
  return file.owner === "Admin" ? "项目资料" : file.business;
}

export function FileManager({
  projects,
  selectedProject,
  selectedFolderId,
  folders,
  view,
  hubTab,
  onHubTabChange,
  account,
  resolvedInbox,
  onResolveInbox,
  onOpenReview,
  onSelectedProjectChange,
  onSelectedFolderChange,
  onViewChange,
  onCreateProject,
}: Props) {
  const [files, setFiles] = useState<KnowledgeFile[]>(initialKnowledgeFiles);
  const [query, setQuery] = useState("");
  const [business, setBusiness] = useState("全部业务");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeBucket>("all");
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);
  const [detailFile, setDetailFile] = useState<KnowledgeFile | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rootKind, setRootKind] = useState<string | null>(null);
  const [rootProject, setRootProject] = useState<string | null>(null);
  const [rootSource, setRootSource] = useState<string | null>(null);
  const [rootTime, setRootTime] = useState<TimeBucket>("all");
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [projectDraftType, setProjectDraftType] = useState<ProjectType>("client");
  const [topbarActionHost, setTopbarActionHost] = useState<HTMLElement | null>(null);
  const [topbarTabHost, setTopbarTabHost] = useState<HTMLElement | null>(null);
  const project = selectedProject ?? "全部项目";
  const selectedType: ProjectType | null = selectedProject
    ? projects.find((item) => item.name === selectedProject)?.type ?? "client"
    : null;
  const isLibrarySpace = selectedType === "library";
  const hubTabs = isLibrarySpace ? libraryHubTabs : clientHubTabs;
  // 落到一个不存在的 tab（比如从项目切到资料空间时停在「计划」）就退回资料
  const activeHubTab: HubTab = hubTabs.some((tab) => tab.id === hubTab) ? hubTab : "data";

  useEffect(() => {
    setTopbarActionHost(document.getElementById("workbench-topbar-actions"));
    setTopbarTabHost(document.getElementById("workbench-topbar-tabs"));
  }, []);

  useEffect(() => {
    setQuery("");
    setDetailFile(null);
    setSelectedIds([]);
  }, [selectedFolderId, selectedProject, view]);


  const resetFilters = () => {
    setBusiness("全部业务");
    setKindFilter(null);
    setSourceFilter(null);
    setTimeFilter("all");
  };

  const activeFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const activeFiles = useMemo(() => files.filter((file) => !deletedIds.includes(file.id)), [deletedIds, files]);
  const projectFiles = activeFiles.filter((file) => file.space === "projects" && file.project === project);
  const projectInputs = projectFiles.filter((file) => file.owner === "Admin");
  const projectOutputs = projectFiles.filter((file) => file.owner !== "Admin");
  const trashFiles = files.filter((file) => deletedIds.includes(file.id) && file.project === project);
  const kindOptions = useMemo(() => projectFiles.map((file) => file.kind).filter((kind, index, list) => list.indexOf(kind) === index), [projectFiles]);
  const sourceOptions = useMemo(() => projectFiles.map(sourceOf).filter((source, index, list) => list.indexOf(source) === index), [projectFiles]);

  const activeFilters = [
    business !== "全部业务" ? { key: "business", label: "业务", value: business, clear: () => setBusiness("全部业务") } : null,
    kindFilter ? { key: "kind", label: "类型", value: kindFilter, clear: () => setKindFilter(null) } : null,
    sourceFilter ? { key: "source", label: "来源", value: sourceFilter, clear: () => setSourceFilter(null) } : null,
    timeFilter !== "all" ? { key: "time", label: "更新", value: timeOptions.find((item) => item.id === timeFilter)?.label ?? "", clear: () => setTimeFilter("all") } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const matchesFilters = (file: KnowledgeFile) => (
    (business === "全部业务" || file.business === business)
    && (!kindFilter || file.kind === kindFilter)
    && (!sourceFilter || sourceOf(file) === sourceFilter)
    && (timeFilter === "all" || timeBucketOf(file.updated) === timeFilter)
    && file.title.toLowerCase().includes(query.toLowerCase())
  );

  const sortFiles = (list: KnowledgeFile[]) => [...list].sort((a, b) => {
    if (sortBy === "name") return a.title.localeCompare(b.title, "zh-Hans-CN");
    if (sortBy === "kind") return a.kind.localeCompare(b.kind, "zh-Hans-CN");
    if (sortBy === "source") return sourceOf(a).localeCompare(sourceOf(b), "zh-Hans-CN");
    return 0;
  });

  const listSource = view === "inputs"
    ? projectInputs
    : view === "outputs"
      ? projectOutputs
      : view === "folder"
        ? projectFiles.filter((file) => file.folderId === selectedFolderId)
        : [];
  const filteredFiles = sortFiles(listSource.filter(matchesFilters));
  const visibleTrashFiles = trashFiles.filter((file) => file.title.toLowerCase().includes(query.toLowerCase()));
  const rootFiles = activeFiles.filter((file) => file.space === "projects");
  const rootKindOptions = rootFiles.map((file) => file.kind).filter((kind, index, list) => list.indexOf(kind) === index);
  const rootProjectOptions = rootFiles.map((file) => file.project).filter((name, index, list) => list.indexOf(name) === index);
  const rootSourceOptions = rootFiles.map(sourceOf).filter((source, index, list) => list.indexOf(source) === index);
  const rootFilterActive = Boolean(rootKind || rootProject || rootSource || rootTime !== "all");
  const allRootFiles = sortFiles(rootFiles.filter((file) => (
    file.title.toLowerCase().includes(query.toLowerCase())
    && (!rootKind || file.kind === rootKind)
    && (!rootProject || file.project === rootProject)
    && (!rootSource || sourceOf(file) === rootSource)
    && (rootTime === "all" || timeBucketOf(file.updated) === rootTime)
    && (business === "全部业务" || file.business === business)
  )));

  /* 上传的位置决定归属，用户一次都不用选：在项目里传就带这个项目、仅成员可见；
     在「资料」总库里传就落公共资料、全员可见。要改再改，但默认必须给对——
     CRO 同时服务竞对，让用户在上传时做选择题，早晚会有人选错。 */
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;
    const target = selectedProject ?? "公共资料";
    setFiles((items) => [
      ...selectedFiles.map((file, index): KnowledgeFile => ({
        id: `upload-${Date.now()}-${index}`,
        title: file.name,
        project: target,
        space: "projects",
        kind: "项目资料",
        business: business === "全部业务" ? "未分类" : business,
        owner: "Admin",
        updated: "刚刚",
        status: "已添加",
        agentReady: true,
        folderId: selectedFolderId ?? undefined,
        // 刚传进来一定还在解析，这个状态必须露出来——否则用户传完立刻去问，
        // 助手说没找到，他的结论会是"这 AI 不行"
        parseState: "parsing",
      })),
      ...items,
    ]);
    event.target.value = "";
  };

  const openProject = (name: string) => {
    onSelectedProjectChange(name);
    onSelectedFolderChange(null);
    onViewChange("overview");
  };

  const commitProject = () => {
    if (!onCreateProject(projectDraft, projectDraftType)) return;
    setProjectDraft("");
    setProjectDraftType("client");
    setProjectCreateOpen(false);
  };

  const cancelProjectCreate = () => {
    setProjectDraft("");
    setProjectDraftType("client");
    setProjectCreateOpen(false);
  };

  const softDelete = (file: KnowledgeFile) => {
    setDeletedIds((ids) => ids.includes(file.id) ? ids : [...ids, file.id]);
    setDetailFile((current) => current?.id === file.id ? null : current);
    setSelectedIds((ids) => ids.filter((id) => id !== file.id));
  };

  const restore = (ids: string[]) => {
    setDeletedIds((current) => current.filter((id) => !ids.includes(id)));
    setSelectedIds([]);
  };

  const deleteForever = (ids: string[]) => {
    setFiles((items) => items.filter((item) => !ids.includes(item.id)));
    setDeletedIds((current) => current.filter((id) => !ids.includes(id)));
    setSelectedIds([]);
  };

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = (ids: string[]) => setSelectedIds((current) => ids.every((id) => current.includes(id)) ? [] : ids);

  /* tab 栏在所有视角下都渲染——它现在是项目中枢的顶层，不再是"进了某个项目
     之后才出现的东西"。这是层级翻转的落点。 */
  const tabsPortal = topbarTabHost ? createPortal(
    <div className="hubTabLayer">
      <NavTabs items={hubTabs} value={activeHubTab} onChange={onHubTabChange} label="项目中枢" />
      {/* 新建收进筛选器菜单：你打开它本来就是在想「我要哪个项目」，
          「没有我要的？建一个」正好接在这句话末尾。摆到顶栏当常驻按钮的话，
          它会让人以为「在计划页建的项目」和「在动态页建的」有区别——
          新建是容器级动作，不属于任何一个 tab。 */}
      <ProjectScopePicker
        projects={projects}
        value={selectedProject}
        onChange={(name) => { onSelectedProjectChange(name); onSelectedFolderChange(null); onViewChange("overview"); }}
      />
      <ContainerCreateMenu
        onCreate={(type) => {
          // 新建表单住在「资料 · 全部项目」那一屏，所以这个动作要把人带过去，
          // 否则在待我处理页点了新建什么都不会发生
          onSelectedProjectChange(null);
          onSelectedFolderChange(null);
          onViewChange("overview");
          onHubTabChange("data");
          setProjectDraftType(type);
          setProjectCreateOpen(true);
        }}
      />
    </div>,
    topbarTabHost,
  ) : null;

  if (activeHubTab !== "data") {
    return (
      <section className="workbenchView hubView">
        {tabsPortal}
        {activeHubTab === "todo" ? (
          <InboxTodoPanel
            account={account}
            projectFilter={selectedProject}
            resolved={resolvedInbox}
            onResolve={onResolveInbox}
            onOpenReview={onOpenReview}
          />
        ) : null}
        {activeHubTab === "activity" ? <ProjectActivityTab project={project} account={account} /> : null}
        {activeHubTab === "plan" ? <ProjectPlanTab project={project} /> : null}
      </section>
    );
  }

  if (!selectedProject) {
    return (
      <section className="workbenchView knowledgeBaseView knowledgeRootView">
        {tabsPortal}
        <input className="visuallyHidden" id="hub-file-upload" type="file" multiple onChange={upload} />
        {topbarActionHost ? createPortal(
          <div className="libraryToolLayer">
            <LibrarySearch value={query} onChange={setQuery} placeholder="搜索全部资料..." />
            <label className="primaryButton compact topbarFileAction" htmlFor="hub-file-upload"><Upload size={14} />上传文件</label>
          </div>,
          topbarActionHost,
        ) : null}

        {/* 类型在菜单里已经选过了，这里只问名字 */}
        {projectCreateOpen ? (
          <div className="libraryProjectCreateBlock">
            <div className="libraryProjectCreateRow">
              {projectDraftType === "client" ? <Folder size={14} /> : <Library size={14} />}
              <input
                autoFocus
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") commitProject(); if (event.key === "Escape") cancelProjectCreate(); }}
                placeholder={projectDraftType === "client" ? "项目名称，按 Enter 创建" : "资料空间名称，按 Enter 创建"}
                aria-label="名称"
              />
              <button type="button" disabled={!projectDraft.trim()} onClick={commitProject} aria-label="确认新建"><Check size={14} /></button>
              <button type="button" onClick={cancelProjectCreate} aria-label="取消"><X size={12} /></button>
            </div>
          </div>
        ) : null}

        {/* 跨项目视角的主角是问答，不是文件列表。用户来这儿是要一个答案，
            文件列表退到下面当"我在这些资料里问"的范围说明。

            这里原本还有一条项目卡片带（点进某个项目），已删——顶栏那个筛选器
            干的是同一件事。同一个动作给两个入口，用户就得先判断该点哪个。
            "哪个项目有多少份"改由下面表格的「所属」列回答。 */}
        <KnowledgeAsk projects={projects} files={rootFiles} onOpenFile={setPreviewFile} />

        {!projects.length ? (
          <EmptyState
            title="暂无项目"
            description="创建项目来开始组织你的工作"
            action={<button className="primaryButton compact" type="button" onClick={() => setProjectCreateOpen(true)}><Plus size={14} />新建项目</button>}
          />
        ) : null}

        <section className="rootRecentOutputs rootAllFiles">
          <div className="sectionBar">
            <strong>全部文件</strong>
            <span>{allRootFiles.length} 项</span>
            <div className="sectionBarActions">
              <Menu icon={<Filter size={16} />} label="筛选" active={rootFilterActive}>
                <MenuGroup label="所属项目">
                  <MenuItem active={!rootProject} onSelect={() => setRootProject(null)}>全部项目</MenuItem>
                  {rootProjectOptions.map((name) => <MenuItem key={name} active={rootProject === name} onSelect={() => setRootProject(rootProject === name ? null : name)}>{name}</MenuItem>)}
                </MenuGroup>
                <MenuGroup label="文件类型">
                  <MenuItem active={!rootKind} onSelect={() => setRootKind(null)}>全部类型</MenuItem>
                  {rootKindOptions.map((kind) => <MenuItem key={kind} active={rootKind === kind} onSelect={() => setRootKind(rootKind === kind ? null : kind)}>{kind}</MenuItem>)}
                </MenuGroup>
                <MenuGroup label="来源">
                  <MenuItem active={!rootSource} onSelect={() => setRootSource(null)}>全部来源</MenuItem>
                  {rootSourceOptions.map((source) => <MenuItem key={source} active={rootSource === source} onSelect={() => setRootSource(rootSource === source ? null : source)}>{source}</MenuItem>)}
                </MenuGroup>
                <MenuGroup label="更新时间">
                  {timeOptions.map((option) => <MenuItem key={option.id} active={rootTime === option.id} onSelect={() => setRootTime(option.id)}>{option.label}</MenuItem>)}
                </MenuGroup>
              </Menu>
              <Menu icon={<ArrowUpDown size={16} />} label="排序" active={sortBy !== "updated"}>
                {sortOptions.map((option) => <MenuItem key={option.id} active={sortBy === option.id} onSelect={() => setSortBy(option.id)}>{option.label}</MenuItem>)}
              </Menu>
              <Menu icon={<Briefcase size={16} />} label="切换业务" active={business !== "全部业务"}>
                {businessOptions.map((option) => <MenuItem key={option} active={business === option} onSelect={() => setBusiness(option)}>{option}</MenuItem>)}
              </Menu>
            </div>
          </div>
          {/* 跨项目视角要回答「这份属于谁」，所以多一列所属；项目内不需要，
              整张表都在同一个项目里。 */}
          <FileTable files={allRootFiles} showOwnerScope onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
        </section>

        {/* 跨项目视角的问答已经是页面主角（KnowledgeAsk），不再挂角落那颗胶囊，
            否则同一件事有两个入口 */}
        {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
        {detailFile ? <FileDetails file={detailFile} onClose={() => setDetailFile(null)} /> : null}
      </section>
    );
  }

  const listTitle = view === "inputs" ? "项目资料" : view === "outputs" ? "任务产物" : view === "trash" ? "回收站" : activeFolder?.name ?? "项目文件";
  const inTrash = view === "trash";
  const selectionScope = inTrash ? visibleTrashFiles : filteredFiles;
  const activeSelection = selectedIds.filter((id) => selectionScope.some((file) => file.id === id));

  return (
    <section className="workbenchView knowledgeBaseView projectLibraryView">
      <input className="visuallyHidden" id="project-file-upload" type="file" multiple onChange={upload} />
      {tabsPortal}
      {topbarActionHost ? createPortal(
        <div className="libraryToolLayer">
          <LibrarySearch value={query} onChange={setQuery} placeholder={inTrash ? "搜索回收站文件..." : "搜索当前项目文件..."} />
          {inTrash ? null : (
            <>
              <Menu icon={<Filter size={16} />} label="筛选" active={Boolean(kindFilter || sourceFilter || timeFilter !== "all")}>
                <MenuGroup label="文件类型">
                  {kindOptions.map((kind) => <MenuItem key={kind} active={kindFilter === kind} onSelect={() => setKindFilter(kindFilter === kind ? null : kind)}>{kind}</MenuItem>)}
                </MenuGroup>
                <MenuGroup label="来源">
                  {sourceOptions.map((source) => <MenuItem key={source} active={sourceFilter === source} onSelect={() => setSourceFilter(sourceFilter === source ? null : source)}>{source}</MenuItem>)}
                </MenuGroup>
                <MenuGroup label="更新时间">
                  {timeOptions.map((option) => <MenuItem key={option.id} active={timeFilter === option.id} onSelect={() => setTimeFilter(option.id)}>{option.label}</MenuItem>)}
                </MenuGroup>
              </Menu>
              <Menu icon={<ArrowUpDown size={16} />} label="排序" active={sortBy !== "updated"}>
                {sortOptions.map((option) => <MenuItem key={option.id} active={sortBy === option.id} onSelect={() => setSortBy(option.id)}>{option.label}</MenuItem>)}
              </Menu>
              <Menu icon={<Briefcase size={16} />} label="切换业务" active={business !== "全部业务"}>
                {businessOptions.map((option) => <MenuItem key={option} active={business === option} onSelect={() => setBusiness(option)}>{option}</MenuItem>)}
              </Menu>
            </>
          )}
          <button
            className={`toolIconButton ${inTrash ? "active" : ""}`}
            type="button"
            title="回收站"
            aria-label="回收站"
            aria-pressed={inTrash}
            onClick={() => onViewChange(inTrash ? "overview" : "trash")}
          >
            <Trash2 size={16} />
            {trashFiles.length ? <span className="toolBadge">{trashFiles.length}</span> : null}
          </button>
          {inTrash ? null : <label className="primaryButton compact topbarFileAction" htmlFor="project-file-upload"><Upload size={14} />上传文件</label>}
        </div>,
        topbarActionHost,
      ) : null}

      {/* 这里原来有一句「资料空间 · 全员可见。它跟项目共用同一套文件与助手…」，
          已删。那是讲给设计评审听的，不是讲给每天用它的人听的。 */}
      <>
          {activeFilters.length && !inTrash ? (
            <div className="filterChips">
              {activeFilters.map((filter) => (
                <span className="filterChip" key={filter.key}>
                  {filter.label}：{filter.value}
                  <button type="button" onClick={filter.clear} aria-label={`清除${filter.label}筛选`}><X size={12} /></button>
                </span>
              ))}
              <button className="clearAllChips" type="button" onClick={resetFilters}>清除全部</button>
            </div>
          ) : null}

          {view === "overview" ? (
            <>
              {folders.filter((folder) => folder.project === project).length ? (
                <div className="libraryFolderChips">
                  {folders.filter((folder) => folder.project === project).map((folder) => (
                    <button type="button" key={folder.id} onClick={() => { onSelectedFolderChange(folder.id); onViewChange("folder"); }}>
                      <Folder size={14} />{folder.name}{folder.pinned ? <span>已固定</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {projectFiles.length ? (
                // 资料空间没有任务，「任务产物」那一栏永远是空的。又一根死柱子——
                // 用户见过一次"这里永远没东西"，就会开始怀疑别处的空栏是不是也没用。
                isLibrarySpace ? (
                  <section className="libraryListSurface">
                    <div className="libraryListIntro"><strong>全部资料</strong><span>{projectFiles.length} 项</span></div>
                    <FileTable files={sortFiles(projectFiles.filter(matchesFilters))} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
                  </section>
                ) : (
                <div className="projectFileLanes projectOverviewLanes">
                  <OverviewLane title="项目资料" icon={<FolderInput size={16} />} description={`提供给数字同事的项目上下文 · ${projectInputs.length} 项`} total={projectInputs.length} files={projectInputs.slice(0, 10)} onOpenAll={() => onViewChange("inputs")} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
                  <OverviewLane title="任务产物" icon={<FolderOutput size={16} />} description={`由项目任务生成 · ${projectOutputs.length} 项`} total={projectOutputs.length} files={projectOutputs.slice(0, 10)} onOpenAll={() => onViewChange("outputs")} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
                </div>
                )
              ) : (
                <EmptyState
                  title="暂无文件"
                  description="上传项目资料或发起任务生成产物"
                  action={<label className="primaryButton compact" htmlFor="project-file-upload"><Upload size={14} />上传文件</label>}
                />
              )}
            </>
          ) : inTrash ? (
            <section className="libraryListSurface">
              {visibleTrashFiles.length ? (
                <TrashTable
                  files={visibleTrashFiles}
                  selectedIds={activeSelection}
                  onToggle={toggleSelected}
                  onToggleAll={() => toggleAll(visibleTrashFiles.map((file) => file.id))}
                  onRestore={(file) => restore([file.id])}
                  onDeleteForever={(file) => deleteForever([file.id])}
                />
              ) : (
                <EmptyState
                  title="回收站为空"
                  description="删除的文件会暂存在这里"
                  action={<button className="secondaryButton compact" type="button" onClick={() => onViewChange("overview")}>返回项目文件</button>}
                />
              )}
            </section>
          ) : (
            <section className="libraryListSurface">
              <div className="libraryListIntro"><strong>{listTitle}</strong><span>{filteredFiles.length} 项</span></div>
              {filteredFiles.length ? (
                <FileTable
                  files={filteredFiles}
                  selectable
                  selectedIds={activeSelection}
                  onToggle={toggleSelected}
                  onToggleAll={() => toggleAll(filteredFiles.map((file) => file.id))}
                  onPreview={setPreviewFile}
                  onDetail={setDetailFile}
                  onDelete={softDelete}
                />
              ) : (
                <EmptyState
                  title={query || activeFilters.length ? "没有匹配的文件" : "暂无文件"}
                  description={query || activeFilters.length ? "试试调整搜索词或清除筛选条件" : "上传项目资料或发起任务生成产物"}
                  action={query || activeFilters.length
                    ? <button className="secondaryButton compact" type="button" onClick={() => { setQuery(""); resetFilters(); }}>清除筛选</button>
                    : <label className="primaryButton compact" htmlFor="project-file-upload"><Upload size={14} />上传文件</label>}
                />
              )}
            </section>
          )}

          {activeSelection.length ? (
            <BatchActionBar
              count={activeSelection.length}
              onClear={() => setSelectedIds([])}
              actions={inTrash ? (
                <>
                  <button className="primaryButton compact" type="button" onClick={() => restore(activeSelection)}><RotateCcw size={14} />恢复</button>
                  <button className="secondaryButton compact" type="button" onClick={() => deleteForever(activeSelection)}><Trash2 size={14} />永久删除</button>
                </>
              ) : (
                <>
                  {view === "outputs" ? <button className="primaryButton compact" type="button"><PackageCheck size={14} />创建交付包</button> : null}
                  <button className="secondaryButton compact" type="button"><Download size={14} />导出</button>
                  <button className="secondaryButton compact" type="button" onClick={() => { activeSelection.forEach((id) => { const file = selectionScope.find((item) => item.id === id); if (file) softDelete(file); }); }}><Trash2 size={14} />删除</button>
                </>
              )}
            />
          ) : null}
      </>

      {/* 跟跨项目视角同一个组件，只是停在底部。原来这里是另一颗写死「当前项目」
          的胶囊——同一件事两套控件两套词，用户还得分别学一遍。 */}
      <KnowledgeAsk projects={projects} files={activeFiles} onOpenFile={setPreviewFile} dock="floating" defaultScope={project} />
      {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
      {detailFile ? <FileDetails file={detailFile} onClose={() => setDetailFile(null)} /> : null}
    </section>
  );
}

type Props = {
  projects: WorkbenchProject[];
  selectedProject: string | null;
  selectedFolderId: string | null;
  folders: LibraryFolder[];
  view: LibraryView;
  hubTab: HubTab;
  onHubTabChange: (tab: HubTab) => void;
  account: InboxAccount;
  resolvedInbox: Record<string, string>;
  onResolveInbox: (itemId: string, note: string) => void;
  onOpenReview: (docTitle: string, project: string) => void;
  onSelectedProjectChange: (project: string | null) => void;
  onSelectedFolderChange: (folderId: string | null) => void;
  onViewChange: (view: LibraryView) => void;
  onCreateProject: (name: string, type: ProjectType) => WorkbenchProject | null;
};

/* 项目筛选器。层级翻转之后，项目不再是必须先走的那条路，而是这一个控件——
   默认「全部项目」，收窄到某个项目时下面的视图退回你熟悉的两列形式。 */
function ProjectScopePicker({ projects, value, onChange }: { projects: WorkbenchProject[]; value: string | null; onChange: (project: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  const clients = projects.filter((item) => item.type === "client");
  const libraries = projects.filter((item) => item.type === "library");
  return (
    <div ref={ref} className="hubScopePicker">
      <button type="button" className={value ? "isNarrowed" : ""} aria-expanded={open} aria-label="切换项目范围" onClick={() => setOpen((current) => !current)}>
        <Folder size={13} />
        <span>{value ?? "全部项目"}</span>
        <ChevronRight size={12} />
      </button>
      {open ? (
        <div className="toolMenu hubScopeMenu" role="menu">
          <button className={`toolMenuItem ${value ? "" : "active"}`} type="button" onClick={() => { onChange(null); setOpen(false); }}>
            <span>全部项目</span>{value ? null : <Check size={12} />}
          </button>
          {clients.length ? <p className="hubScopeGroup">项目</p> : null}
          {clients.map((item) => (
            <button className={`toolMenuItem ${value === item.name ? "active" : ""}`} type="button" key={item.id} onClick={() => { onChange(item.name); setOpen(false); }}>
              <span>{item.name}</span>{value === item.name ? <Check size={12} /> : null}
            </button>
          ))}
          {libraries.length ? <p className="hubScopeGroup">资料空间</p> : null}
          {libraries.map((item) => (
            <button className={`toolMenuItem ${value === item.name ? "active" : ""}`} type="button" key={item.id} onClick={() => { onChange(item.name); setOpen(false); }}>
              <span>{item.name}</span>{value === item.name ? <Check size={12} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* 顶栏的新建入口。紧挨着范围选择器，因为它们是同一类东西——容器动作靠左跟着
   scope 走，内容动作（搜索/筛选/上传）靠右，两类不混在一起。
   这里没有位置暗示类型，所以给两条明确的菜单项，而不是先开表单再问类型。 */
function ContainerCreateMenu({ onCreate }: { onCreate: (type: ProjectType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="hubCreateMenu">
      <button type="button" aria-label="新建项目或资料空间" title="新建项目或资料空间" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Plus size={14} />
      </button>
      {open ? (
        <div className="toolMenu" role="menu">
          <button className="toolMenuItem" type="button" onClick={() => { onCreate("client"); setOpen(false); }}>
            <Folder size={13} /><span>新建项目</span>
          </button>
          <button className="toolMenuItem" type="button" onClick={() => { onCreate("library"); setOpen(false); }}>
            <Library size={13} /><span>新建资料空间</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LibrarySearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="knowledgeSearch libraryToolSearch">
      <Search size={14} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value ? <button type="button" onClick={() => onChange("")} aria-label="清除搜索"><X size={12} /></button> : null}
    </div>
  );
}

function BatchActionBar({ count, actions, onClear }: { count: number; actions: ReactNode; onClear: () => void }) {
  return (
    <div className="batchActionBar" role="region" aria-label="批量操作">
      <span className="batchCount">已选 {count} 项</span>
      <div className="batchActions">{actions}</div>
      <button className="iconButton" type="button" onClick={onClear} aria-label="取消选择"><X size={14} /></button>
    </div>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="libraryEmptyState">
      <span className="libraryEmptyIcon" aria-hidden="true"><Folder size={20} /></span>
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}

function SelectToggle({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="deliveryToggle" type="button" aria-label={label} aria-pressed={checked} onClick={onToggle}>
      {checked ? <Check size={12} /> : null}
    </button>
  );
}

function OverviewLane({ title, icon, description, total, files, onOpenAll, onPreview, onDetail, onDelete }: { title: string; icon: ReactNode; description: string; total: number; files: KnowledgeFile[]; onOpenAll: () => void; onPreview: (file: KnowledgeFile) => void; onDetail: (file: KnowledgeFile) => void; onDelete: (file: KnowledgeFile) => void }) {
  return (
    <section className="projectFileLane overviewFileLane">
      <div className="projectLaneHeader">
        <button className="overviewLaneTitle" type="button" onClick={onOpenAll}>
          <span className="overviewLaneTitleText">{icon}<strong>{title}</strong><small>{description}</small></span>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="overviewFileViewport">
        <FileTable files={files} onPreview={onPreview} onDetail={onDetail} onDelete={onDelete} />
        <button className="overviewViewAll" type="button" onClick={onOpenAll}>
          <span>查看全部 {total} 项</span><ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}

function FileTable({ files, selectable = false, showOwnerScope = false, selectedIds = [], onToggle, onToggleAll, onPreview, onDetail, onDelete }: { files: KnowledgeFile[]; selectable?: boolean; showOwnerScope?: boolean; selectedIds?: string[]; onToggle?: (id: string) => void; onToggleAll?: () => void; onPreview: (file: KnowledgeFile) => void; onDetail: (file: KnowledgeFile) => void; onDelete: (file: KnowledgeFile) => void }) {
  const allSelected = Boolean(files.length) && files.every((file) => selectedIds.includes(file.id));
  return (
    <div className={`knowledgeTable ${selectable ? "isSelectable" : ""} ${showOwnerScope ? "hasOwnerScope" : ""}`} role="table">
      <div className="knowledgeTableHeader" role="row">
        <span className="knowledgeHeadName">
          {selectable ? <SelectToggle checked={allSelected} label={allSelected ? "取消全选" : "全选"} onToggle={() => onToggleAll?.()} /> : null}
          文件名称
        </span>
        {showOwnerScope ? <span>所属</span> : null}
        <span>文件类型</span>
        <span>来源</span>
        <span>更新</span>
        <span />
      </div>
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          selectable={selectable}
          showOwnerScope={showOwnerScope}
          selected={selectedIds.includes(file.id)}
          onToggle={() => onToggle?.(file.id)}
          onPreview={() => onPreview(file)}
          onDetail={() => onDetail(file)}
          onDelete={() => onDelete(file)}
        />
      ))}
      {!files.length ? <div className="emptyListState">暂无文件</div> : null}
    </div>
  );
}

function FileRow({ file, selectable, showOwnerScope = false, selected, onToggle, onPreview, onDetail, onDelete }: { file: KnowledgeFile; selectable: boolean; showOwnerScope?: boolean; selected: boolean; onToggle: () => void; onPreview: () => void; onDetail: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLElement>(open, () => setOpen(false));
  return (
    <article
      ref={ref}
      className={`knowledgeFileRow ${selected ? "selected" : ""} ${open ? "menuOpen" : ""}`}
      role="row"
      onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}
    >
      <div className={`knowledgeFileCell ${selectable ? "hasSelection" : ""}`}>
        {selectable ? <SelectToggle checked={selected} label={`${selected ? "取消选择" : "选择"}${file.title}`} onToggle={onToggle} /> : null}
        <button className="knowledgeFileMain" type="button" onClick={onPreview}>
          <span className="knowledgeFileIcon">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={16} /> : <FileText size={16} />}</span>
          <span>
            <strong>{file.title}</strong>
            <small>{file.kind}</small>
          </span>
        </button>
        {/* 解析成功什么都不显示。只有解析中和失败才占用户注意力——成功是默认
            预期，报了就是噪音；失败不报，这份文件就是死的。

            标签放在按钮外面：.knowledgeFileMain 是「图标 + 文件名」两列的网格，
            塞进去只会掉到第三格里被压成 32px；而且「重试」是可点的，
            按钮里套按钮本身也不成立。 */}
        {file.parseState === "parsing" ? (
          <em className="fileParseChip isParsing"><LoaderCircle size={11} />解析中</em>
        ) : file.parseState === "failed" ? (
          <em className="fileParseChip isFailed">解析失败<button type="button">重试</button></em>
        ) : null}
      </div>
      {showOwnerScope ? <span className="knowledgeScopeCell">{file.project}</span> : null}
      <span>{file.kind}</span>
      <span>{sourceOf(file)}</span>
      <span>{file.updated}</span>
      <div className="rowActions">
        <button className="rowActionButton" type="button" aria-label={`预览${file.title}`} onClick={onPreview}><Eye size={14} /></button>
        <button className="rowMoreButton" type="button" aria-label={`${file.title}更多操作`} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={14} /></button>
      </div>
      {open ? (
        <div className="rowActionMenu knowledgeRowMenu">
          <button type="button" onClick={() => { onPreview(); setOpen(false); }}><Eye size={14} />预览</button>
          <button type="button" onClick={() => { onDetail(); setOpen(false); }}><FileText size={14} />查看详情</button>
          <button type="button" onClick={() => setOpen(false)}><Download size={14} />下载</button>
          <button type="button" onClick={() => { onDelete(); setOpen(false); }}><Trash2 size={14} />删除</button>
        </div>
      ) : null}
    </article>
  );
}

function TrashTable({ files, selectedIds, onToggle, onToggleAll, onRestore, onDeleteForever }: { files: KnowledgeFile[]; selectedIds: string[]; onToggle: (id: string) => void; onToggleAll: () => void; onRestore: (file: KnowledgeFile) => void; onDeleteForever: (file: KnowledgeFile) => void }) {
  const allSelected = Boolean(files.length) && files.every((file) => selectedIds.includes(file.id));
  return (
    <div className="knowledgeTable trashTable isSelectable">
      <div className="knowledgeTableHeader">
        <span className="knowledgeHeadName">
          <SelectToggle checked={allSelected} label={allSelected ? "取消全选" : "全选"} onToggle={onToggleAll} />
          名称
        </span>
        <span>原分类</span>
        <span>删除前更新</span>
        <span />
      </div>
      {files.map((file) => (
        <article className={`knowledgeFileRow ${selectedIds.includes(file.id) ? "selected" : ""}`} key={file.id}>
          <div className="knowledgeFileCell hasSelection">
            <SelectToggle checked={selectedIds.includes(file.id)} label={`选择${file.title}`} onToggle={() => onToggle(file.id)} />
            <div className="knowledgeFileMain">
              <span className="knowledgeFileIcon"><FileText size={16} /></span>
              <span><strong>{file.title}</strong><small>{file.kind}</small></span>
            </div>
          </div>
          <span>{file.owner === "Admin" ? "项目资料" : "任务产物"}</span>
          <span>{file.updated}</span>
          <div className="trashRowActions">
            <button type="button" onClick={() => onRestore(file)}><RotateCcw size={14} />恢复</button>
            <button type="button" onClick={() => onDeleteForever(file)}><Trash2 size={14} />永久删除</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function FilePreview({ file, onClose }: { file: KnowledgeFile; onClose: () => void }) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]);
  return <div className="modalBackdrop knowledgePreviewBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="knowledgePreviewDialog" role="dialog" aria-modal="true" aria-labelledby="knowledge-preview-title"><header><div><span>{file.kind}</span><h2 id="knowledge-preview-title">{file.title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button></header><div className="knowledgeDocumentPreview"><div className="documentPreviewMark">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={24} /> : <FileText size={24} />}</div><h3>{file.title.replace(/\.[^.]+$/, "")}</h3><p>文件预览区域。当前原型保留现有 Modal 结构，并为后续真实文档渲染预留空间。</p></div><footer><span className="previewContextChip">当前文件：{file.title}</span><button className="secondaryButton compact" type="button">询问此文件</button><button className="primaryButton compact" type="button" onClick={onClose}>完成</button></footer></section></div>;
}

function FileDetails({ file, onClose }: { file: KnowledgeFile; onClose: () => void }) {
  return <aside className="knowledgeDetailPanel" aria-label={`${file.title}详情`}><header><div><span>文件详情</span><strong>{file.title}</strong></div><button type="button" onClick={onClose} aria-label="关闭详情"><X size={16} /></button></header><dl><div><dt>文件类型</dt><dd>{file.kind}</dd></div><div><dt>所属项目</dt><dd>{file.project}</dd></div>{file.owner !== "Admin" ? <div><dt>来源任务</dt><dd>{file.business}</dd></div> : null}<div><dt>当前版本</dt><dd>v1</dd></div><div><dt>更新时间</dt><dd>{file.updated}</dd></div></dl></aside>;
}
