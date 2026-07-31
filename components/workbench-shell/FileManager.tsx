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
import type { KnowledgeFile, LibraryFolder, LibraryView } from "../../lib/workbench/shellTypes";
import type { WorkbenchProject, WorkbenchTask } from "../../modules/types";
import { ProjectActivityTab } from "./ProjectActivityTab";
import { ProjectPlanTab } from "./ProjectPlanTab";
import { WorkspaceAssistant } from "./ShellControls";
import { useDismissableLayer } from "./useDismissableLayer";

type ProjectTab = "activity" | "plan" | "data";
type SortKey = "updated" | "kind" | "name" | "source";
type TimeBucket = "all" | "today" | "week" | "month" | "earlier";

const projectTabs: Array<{ id: ProjectTab; label: string }> = [
  { id: "activity", label: "动态" },
  { id: "plan", label: "计划" },
  { id: "data", label: "资料与产物" },
];

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
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>("data");
  const [topbarActionHost, setTopbarActionHost] = useState<HTMLElement | null>(null);
  const [topbarTabHost, setTopbarTabHost] = useState<HTMLElement | null>(null);
  const project = selectedProject ?? "全部项目";

  useEffect(() => {
    setTopbarActionHost(document.getElementById("workbench-topbar-actions"));
    setTopbarTabHost(document.getElementById("workbench-topbar-tabs"));
  }, []);

  useEffect(() => {
    setQuery("");
    setDetailFile(null);
    setSelectedIds([]);
  }, [selectedFolderId, selectedProject, view]);

  useEffect(() => {
    setActiveProjectTab("data");
  }, [selectedProject]);

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
  const recentFiles = activeFiles
    .filter((file) => file.space === "projects" && file.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length || !selectedProject) return;
    setFiles((items) => [
      ...selectedFiles.map((file, index): KnowledgeFile => ({
        id: `upload-${Date.now()}-${index}`,
        title: file.name,
        project: selectedProject,
        space: "projects",
        kind: "项目资料",
        business: business === "全部业务" ? "未分类" : business,
        owner: "Admin",
        updated: "刚刚",
        status: "已添加",
        agentReady: true,
        folderId: selectedFolderId ?? undefined,
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
    if (!onCreateProject(projectDraft)) return;
    setProjectDraft("");
    setProjectCreateOpen(false);
  };

  const cancelProjectCreate = () => {
    setProjectDraft("");
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

  if (!selectedProject) {
    const projectCards = projects
      .map((item) => ({ name: item.name, count: activeFiles.filter((file) => file.space === "projects" && file.project === item.name).length }))
      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
    return (
      <section className="workbenchView knowledgeBaseView knowledgeRootView">
        {topbarActionHost ? createPortal(
          <div className="libraryToolLayer">
            <LibrarySearch value={query} onChange={setQuery} placeholder="搜索项目与文件..." />
            <button className="primaryButton compact topbarCreateProjectButton" type="button" onClick={() => setProjectCreateOpen(true)}><Plus size={15} />新建项目</button>
          </div>,
          topbarActionHost,
        ) : null}

        {projectCreateOpen ? (
          <div className="libraryProjectCreateRow">
            <Folder size={15} />
            <input
              autoFocus
              value={projectDraft}
              onChange={(event) => setProjectDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") commitProject(); if (event.key === "Escape") cancelProjectCreate(); }}
              placeholder="项目名称，按 Enter 创建"
              aria-label="项目名称"
            />
            <button type="button" disabled={!projectDraft.trim()} onClick={commitProject} aria-label="确认新建项目"><Check size={14} /></button>
            <button type="button" onClick={cancelProjectCreate} aria-label="取消"><X size={13} /></button>
          </div>
        ) : null}

        {projectCards.length ? (
          <div className="projectFolderStrip">
            {projectCards.map((item) => (
              <button type="button" key={item.name} onClick={() => openProject(item.name)}>
                <Folder size={18} /><span><strong>{item.name}</strong><small>{item.count} 项</small></span><ChevronRight size={15} />
              </button>
            ))}
          </div>
        ) : projects.length ? (
          <EmptyState title="没有匹配的项目" description={`未找到与「${query}」相关的项目`} />
        ) : (
          <EmptyState
            title="暂无项目"
            description="创建项目来开始组织你的工作"
            action={<button className="primaryButton compact" type="button" onClick={() => setProjectCreateOpen(true)}><Plus size={15} />新建项目</button>}
          />
        )}

        <section className="rootRecentOutputs">
          <div className="fileListHeading"><strong>最近更新</strong><span>{recentFiles.length} 项</span></div>
          <FileTable files={recentFiles} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
        </section>

        <WorkspaceAssistant context="library" libraryContext={{ project: "全部项目", business: "全部业务" }} />
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
      {topbarActionHost && activeProjectTab === "data" ? createPortal(
        <div className="libraryToolLayer">
          <LibrarySearch value={query} onChange={setQuery} placeholder={inTrash ? "搜索回收站文件..." : "搜索当前项目文件..."} />
          {inTrash ? null : (
            <>
              <ToolMenu icon={<Filter size={16} />} label="筛选" active={Boolean(kindFilter || sourceFilter || timeFilter !== "all")}>
                <MenuGroup label="文件类型">
                  {kindOptions.map((kind) => <MenuItem key={kind} active={kindFilter === kind} onSelect={() => setKindFilter(kindFilter === kind ? null : kind)}>{kind}</MenuItem>)}
                </MenuGroup>
                <MenuGroup label="来源">
                  {sourceOptions.map((source) => <MenuItem key={source} active={sourceFilter === source} onSelect={() => setSourceFilter(sourceFilter === source ? null : source)}>{source}</MenuItem>)}
                </MenuGroup>
                <MenuGroup label="更新时间">
                  {timeOptions.map((option) => <MenuItem key={option.id} active={timeFilter === option.id} onSelect={() => setTimeFilter(option.id)}>{option.label}</MenuItem>)}
                </MenuGroup>
              </ToolMenu>
              <ToolMenu icon={<ArrowUpDown size={16} />} label="排序" active={sortBy !== "updated"}>
                {sortOptions.map((option) => <MenuItem key={option.id} active={sortBy === option.id} onSelect={() => setSortBy(option.id)}>{option.label}</MenuItem>)}
              </ToolMenu>
              <ToolMenu icon={<Briefcase size={16} />} label="切换业务" active={business !== "全部业务"}>
                {businessOptions.map((option) => <MenuItem key={option} active={business === option} onSelect={() => setBusiness(option)}>{option}</MenuItem>)}
              </ToolMenu>
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
          {inTrash ? null : <label className="primaryButton compact topbarFileAction" htmlFor="project-file-upload"><Upload size={15} />上传文件</label>}
        </div>,
        topbarActionHost,
      ) : null}

      {topbarTabHost ? createPortal(
        <div className="projectSpaceTabs" role="tablist" aria-label="项目空间">
          {projectTabs.map((tab) => (
            <button
              key={tab.id}
              className={`projectSpaceTab ${activeProjectTab === tab.id ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeProjectTab === tab.id}
              onClick={() => setActiveProjectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>,
        topbarTabHost,
      ) : null}

      {activeProjectTab === "activity" ? <ProjectActivityTab project={project} /> : null}
      {activeProjectTab === "plan" ? <ProjectPlanTab project={project} /> : null}

      {activeProjectTab === "data" ? (
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
                <div className="projectFileLanes projectOverviewLanes">
                  <OverviewLane title="项目资料" icon={<FolderInput size={18} />} description={`提供给数字同事的项目上下文 · ${projectInputs.length} 项`} files={projectInputs.slice(0, 5)} onOpenAll={() => onViewChange("inputs")} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
                  <OverviewLane title="任务产物" icon={<FolderOutput size={18} />} description={`由项目任务生成 · ${projectOutputs.length} 项`} files={projectOutputs.slice(0, 5)} onOpenAll={() => onViewChange("outputs")} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
                </div>
              ) : (
                <EmptyState
                  title="暂无文件"
                  description="上传项目资料或发起任务生成产物"
                  action={<label className="primaryButton compact" htmlFor="project-file-upload"><Upload size={15} />上传文件</label>}
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
                    : <label className="primaryButton compact" htmlFor="project-file-upload"><Upload size={15} />上传文件</label>}
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
                  <button className="primaryButton compact" type="button" onClick={() => restore(activeSelection)}><RotateCcw size={15} />恢复</button>
                  <button className="secondaryButton compact" type="button" onClick={() => deleteForever(activeSelection)}><Trash2 size={15} />永久删除</button>
                </>
              ) : (
                <>
                  {view === "outputs" ? <button className="primaryButton compact" type="button"><PackageCheck size={15} />创建交付包</button> : null}
                  <button className="secondaryButton compact" type="button"><Download size={15} />导出</button>
                  <button className="secondaryButton compact" type="button" onClick={() => { activeSelection.forEach((id) => { const file = selectionScope.find((item) => item.id === id); if (file) softDelete(file); }); }}><Trash2 size={15} />删除</button>
                </>
              )}
            />
          ) : null}
        </>
      ) : null}

      <WorkspaceAssistant context="library" libraryContext={{ project, business }} />
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
  onSelectedProjectChange: (project: string | null) => void;
  onSelectedFolderChange: (folderId: string | null) => void;
  onViewChange: (view: LibraryView) => void;
  onCreateProject: (name: string) => WorkbenchProject | null;
};

function LibrarySearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="knowledgeSearch libraryToolSearch">
      <Search size={15} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value ? <button type="button" onClick={() => onChange("")} aria-label="清除搜索"><X size={13} /></button> : null}
    </div>
  );
}

function ToolMenu({ icon, label, active, children }: { icon: ReactNode; label: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="toolMenuWrap">
      <button
        className={`toolIconButton ${active ? "active" : ""}`}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
      </button>
      {open ? <div className="toolMenu" onClick={() => setOpen(false)}>{children}</div> : null}
    </div>
  );
}

function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="toolMenuGroup"><span>{label}</span>{children}</div>;
}

function MenuItem({ active, onSelect, children }: { active: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button className={`toolMenuItem ${active ? "active" : ""}`} type="button" onClick={onSelect}>
      <span>{children}</span>
      {active ? <Check size={13} /> : null}
    </button>
  );
}

function BatchActionBar({ count, actions, onClear }: { count: number; actions: ReactNode; onClear: () => void }) {
  return (
    <div className="batchActionBar" role="region" aria-label="批量操作">
      <span className="batchCount">已选 {count} 项</span>
      <div className="batchActions">{actions}</div>
      <button className="iconButton" type="button" onClick={onClear} aria-label="取消选择"><X size={15} /></button>
    </div>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="libraryEmptyState">
      <span className="libraryEmptyIcon" aria-hidden="true"><Folder size={22} /></span>
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

function OverviewLane({ title, icon, description, files, onOpenAll, onPreview, onDetail, onDelete }: { title: string; icon: ReactNode; description: string; files: KnowledgeFile[]; onOpenAll: () => void; onPreview: (file: KnowledgeFile) => void; onDetail: (file: KnowledgeFile) => void; onDelete: (file: KnowledgeFile) => void }) {
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
      </div>
      <button className="overviewViewAll" type="button" onClick={onOpenAll}>查看全部 <ChevronRight size={14} /></button>
    </section>
  );
}

function FileTable({ files, selectable = false, selectedIds = [], onToggle, onToggleAll, onPreview, onDetail, onDelete }: { files: KnowledgeFile[]; selectable?: boolean; selectedIds?: string[]; onToggle?: (id: string) => void; onToggleAll?: () => void; onPreview: (file: KnowledgeFile) => void; onDetail: (file: KnowledgeFile) => void; onDelete: (file: KnowledgeFile) => void }) {
  const allSelected = Boolean(files.length) && files.every((file) => selectedIds.includes(file.id));
  return (
    <div className={`knowledgeTable ${selectable ? "isSelectable" : ""}`} role="table">
      <div className="knowledgeTableHeader" role="row">
        <span className="knowledgeHeadName">
          {selectable ? <SelectToggle checked={allSelected} label={allSelected ? "取消全选" : "全选"} onToggle={() => onToggleAll?.()} /> : null}
          名称
        </span>
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

function FileRow({ file, selectable, selected, onToggle, onPreview, onDetail, onDelete }: { file: KnowledgeFile; selectable: boolean; selected: boolean; onToggle: () => void; onPreview: () => void; onDetail: () => void; onDelete: () => void }) {
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
          <span><strong>{file.title}</strong><small>{file.kind}</small></span>
        </button>
      </div>
      <span>{file.kind}</span>
      <span>{sourceOf(file)}</span>
      <span>{file.updated}</span>
      <div className="rowActions">
        <button className="rowActionButton" type="button" aria-label={`预览${file.title}`} onClick={onPreview}><Eye size={15} /></button>
        <button className="rowMoreButton" type="button" aria-label={`${file.title}更多操作`} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={15} /></button>
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
  return <div className="modalBackdrop knowledgePreviewBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="knowledgePreviewDialog" role="dialog" aria-modal="true" aria-labelledby="knowledge-preview-title"><header><div><span>{file.kind}</span><h2 id="knowledge-preview-title">{file.title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="knowledgeDocumentPreview"><div className="documentPreviewMark">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={24} /> : <FileText size={24} />}</div><h3>{file.title.replace(/\.[^.]+$/, "")}</h3><p>文件预览区域。当前原型保留现有 Modal 结构，并为后续真实文档渲染预留空间。</p></div><footer><span className="previewContextChip">当前文件：{file.title}</span><button className="secondaryButton compact" type="button">询问此文件</button><button className="primaryButton compact" type="button" onClick={onClose}>完成</button></footer></section></div>;
}

function FileDetails({ file, onClose }: { file: KnowledgeFile; onClose: () => void }) {
  return <aside className="knowledgeDetailPanel" aria-label={`${file.title}详情`}><header><div><span>文件详情</span><strong>{file.title}</strong></div><button type="button" onClick={onClose} aria-label="关闭详情"><X size={16} /></button></header><dl><div><dt>文件类型</dt><dd>{file.kind}</dd></div><div><dt>所属项目</dt><dd>{file.project}</dd></div>{file.owner !== "Admin" ? <div><dt>来源任务</dt><dd>{file.business}</dd></div> : null}<div><dt>当前版本</dt><dd>v1</dd></div><div><dt>更新时间</dt><dd>{file.updated}</dd></div></dl></aside>;
}
