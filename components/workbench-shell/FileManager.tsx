"use client";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { initialKnowledgeFiles } from "../../lib/workbench/mockWorkspace";
import type { KnowledgeFile, LibraryFolder, LibraryView } from "../../lib/workbench/shellTypes";
import type { WorkbenchProject } from "../../modules/types";
import { CompactSelect, WorkspaceAssistant } from "./ShellControls";
import { useDismissableLayer } from "./useDismissableLayer";

type Props = {
  projects: WorkbenchProject[];
  selectedProject: string | null;
  selectedFolderId: string | null;
  folders: LibraryFolder[];
  view: LibraryView;
  onSelectedProjectChange: (project: string | null) => void;
  onSelectedFolderChange: (folderId: string | null) => void;
  onFoldersChange: (folders: LibraryFolder[]) => void;
  onViewChange: (view: LibraryView) => void;
};

export function FileManager({
  projects,
  selectedProject,
  selectedFolderId,
  folders,
  view,
  onSelectedProjectChange,
  onSelectedFolderChange,
  onFoldersChange,
  onViewChange,
}: Props) {
  const [files, setFiles] = useState<KnowledgeFile[]>(initialKnowledgeFiles);
  const [query, setQuery] = useState("");
  const [business, setBusiness] = useState("全部业务");
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);
  const [detailFile, setDetailFile] = useState<KnowledgeFile | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deliverySelection, setDeliverySelection] = useState<string[]>([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [folderProject, setFolderProject] = useState(projects[0]?.name ?? "");
  const [pinFolder, setPinFolder] = useState(true);
  const [topbarActionHost, setTopbarActionHost] = useState<HTMLElement | null>(null);
  const project = selectedProject ?? "全部项目";

  useEffect(() => {
    setTopbarActionHost(document.getElementById("workbench-topbar-actions"));
  }, []);

  useEffect(() => {
    setQuery("");
    setDetailFile(null);
  }, [selectedFolderId, selectedProject]);

  const activeFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const activeFiles = useMemo(() => files.filter((file) => !deletedIds.includes(file.id)), [deletedIds, files]);
  const projectFiles = activeFiles.filter((file) => file.space === "projects" && file.project === project);
  const projectInputs = projectFiles.filter((file) => file.owner === "Admin");
  const projectOutputs = projectFiles.filter((file) => file.owner !== "Admin");
  const trashFiles = files.filter((file) => deletedIds.includes(file.id) && file.project === project);
  const filteredFiles = (view === "inputs"
    ? projectInputs
    : view === "outputs"
      ? projectOutputs
      : view === "folder"
        ? projectFiles.filter((file) => file.folderId === selectedFolderId)
        : [])
    .filter((file) => (business === "全部业务" || file.business === business) && file.title.toLowerCase().includes(query.toLowerCase()));
  const recentFiles = activeFiles.filter((file) => file.space === "projects").slice(0, 5);

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

  const createFolder = () => {
    const name = folderDraft.trim();
    const targetProject = selectedProject ?? folderProject;
    if (!name || !targetProject) return;
    const nextFolder: LibraryFolder = {
      id: `folder-${Date.now()}`,
      name,
      project: targetProject,
      pinned: pinFolder,
    };
    onFoldersChange([...folders, nextFolder]);
    setFolderDraft("");
    setPinFolder(true);
    setFolderDialogOpen(false);
    onSelectedProjectChange(targetProject);
    onSelectedFolderChange(nextFolder.id);
    onViewChange("folder");
  };

  const softDelete = (file: KnowledgeFile) => {
    setDeletedIds((ids) => ids.includes(file.id) ? ids : [...ids, file.id]);
    setDetailFile((current) => current?.id === file.id ? null : current);
  };

  if (!selectedProject) {
    const projectFolders = projects.map((item) => ({
      name: item.name,
      count: activeFiles.filter((file) => file.space === "projects" && file.project === item.name).length,
    }));
    return (
      <section className="workbenchView knowledgeBaseView knowledgeRootView">
        {topbarActionHost ? createPortal(<div className="projectLibraryActions"><button className="primaryButton compact topbarCreateFolderButton" type="button" onClick={() => { setFolderProject(projects[0]?.name ?? ""); setFolderDialogOpen(true); }}><Plus size={15} />新建文件夹</button></div>, topbarActionHost) : null}
        <div className="projectFolderStrip">
          {projectFolders.map((folder) => (
            <button type="button" key={folder.name} onClick={() => openProject(folder.name)}>
              <Folder size={18} /><span><strong>{folder.name}</strong><small>{folder.count} 项</small></span><ChevronRight size={15} />
            </button>
          ))}
        </div>
        <section className="rootRecentOutputs">
          <div className="fileListHeading"><strong>最近更新</strong><span>{recentFiles.length} 项</span></div>
          <FileTable files={recentFiles} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
        </section>
        <WorkspaceAssistant context="library" libraryContext={{ project: "全部项目", business: "全部业务" }} />
        {folderDialogOpen ? <FolderDialog name={folderDraft} pinned={pinFolder} project={folderProject} projects={projects.map((item) => item.name)} onNameChange={setFolderDraft} onProjectChange={setFolderProject} onPinnedChange={setPinFolder} onCancel={() => setFolderDialogOpen(false)} onConfirm={createFolder} /> : null}
        {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
        {detailFile ? <FileDetails file={detailFile} onClose={() => setDetailFile(null)} /> : null}
      </section>
    );
  }

  const listTitle = view === "inputs" ? "项目资料" : view === "outputs" ? "任务产物" : view === "trash" ? "回收站" : activeFolder?.name ?? "项目文件";

  return (
    <section className="workbenchView knowledgeBaseView projectLibraryView">
      <input className="visuallyHidden" id="project-file-upload" type="file" multiple onChange={upload} />
      {topbarActionHost ? createPortal(
        <div className="projectLibraryActions">
          <label className="primaryButton compact topbarFileAction" htmlFor="project-file-upload"><Upload size={15} />上传文件</label>
          <button className={`libraryTrashButton topbarFileAction ${trashFiles.length ? "hasItems" : ""}`} type="button" onClick={() => onViewChange("trash")}><Trash2 size={15} />回收站{trashFiles.length ? ` · ${trashFiles.length}` : ""}</button>
        </div>,
        topbarActionHost,
      ) : null}

      {view === "overview" ? (
        <>
          {folders.filter((folder) => folder.project === project).length ? <div className="libraryFolderChips">{folders.filter((folder) => folder.project === project).map((folder) => <button type="button" key={folder.id} onClick={() => { onSelectedFolderChange(folder.id); onViewChange("folder"); }}><Folder size={14} />{folder.name}{folder.pinned ? <span>已固定</span> : null}</button>)}</div> : null}
          <div className="projectFileLanes projectOverviewLanes">
            <OverviewLane title="项目资料" description={`提供给数字同事的项目上下文 · ${projectInputs.length} 项`} files={projectInputs.slice(0, 5)} onOpenAll={() => onViewChange("inputs")} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
            <OverviewLane title="任务产物" description={`由项目任务生成 · ${projectOutputs.length} 项`} files={projectOutputs.slice(0, 5)} onOpenAll={() => onViewChange("outputs")} onPreview={setPreviewFile} onDetail={setDetailFile} onDelete={softDelete} />
          </div>
        </>
      ) : view === "trash" ? (
        <section className="libraryListSurface trashListSurface">
          <div className="libraryListIntro"><strong>项目回收站</strong><span>删除的项目资料和任务产物会暂存在这里。</span></div>
          <TrashTable
            files={trashFiles}
            onRestore={(file) => setDeletedIds((ids) => ids.filter((id) => id !== file.id))}
            onDeleteForever={(file) => {
              setFiles((items) => items.filter((item) => item.id !== file.id));
              setDeletedIds((ids) => ids.filter((id) => id !== file.id));
            }}
          />
        </section>
      ) : (
        <section className="libraryListSurface">
          <div className="knowledgeToolbar projectKnowledgeToolbar">
            <div className="knowledgeSearch"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${listTitle}`} /></div>
            <CompactSelect value={business} options={["全部业务", "DMPK报价", "药效报告", "未分类"]} onChange={setBusiness} />
            {view === "outputs"
              ? <button className={`${deliverySelection.length ? "primaryButton" : "secondaryButton"} compact deliveryPackageAction`} type="button" aria-disabled={!deliverySelection.length}><PackageCheck size={15} />创建交付包{deliverySelection.length ? <span>{deliverySelection.length}</span> : null}</button>
              : null}
          </div>
          <FileTable
            files={filteredFiles}
            selectable={view === "outputs"}
            selectedIds={deliverySelection}
            onToggle={(id) => setDeliverySelection((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
            onPreview={setPreviewFile}
            onDetail={setDetailFile}
            onDelete={softDelete}
          />
        </section>
      )}

      <WorkspaceAssistant context="library" libraryContext={{ project, business }} />
      {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
      {detailFile ? <FileDetails file={detailFile} onClose={() => setDetailFile(null)} /> : null}
    </section>
  );
}

function OverviewLane({ title, description, files, onOpenAll, onPreview, onDetail, onDelete }: { title: string; description: string; files: KnowledgeFile[]; onOpenAll: () => void; onPreview: (file: KnowledgeFile) => void; onDetail: (file: KnowledgeFile) => void; onDelete: (file: KnowledgeFile) => void }) {
  return <section className="projectFileLane overviewFileLane"><div className="projectLaneHeader"><button className="overviewLaneTitle" type="button" onClick={onOpenAll}><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={16} /></button></div><div className="overviewFileViewport"><FileTable files={files} onPreview={onPreview} onDetail={onDetail} onDelete={onDelete} />{files.length ? <div className="overviewFade" aria-hidden="true" /> : null}</div><button className="overviewViewAll" type="button" onClick={onOpenAll}>查看全部 <ChevronRight size={14} /></button></section>;
}

function FileTable({ files, selectable = false, selectedIds = [], onToggle, onPreview, onDetail, onDelete }: { files: KnowledgeFile[]; selectable?: boolean; selectedIds?: string[]; onToggle?: (id: string) => void; onPreview: (file: KnowledgeFile) => void; onDetail: (file: KnowledgeFile) => void; onDelete: (file: KnowledgeFile) => void }) {
  return <div className="knowledgeTable" role="table"><div className="knowledgeTableHeader" role="row"><span>名称</span><span>文件类型</span><span>来源</span><span>更新</span><span /></div>{files.map((file) => <FileRow key={file.id} file={file} selectable={selectable} selected={selectedIds.includes(file.id)} onToggle={() => onToggle?.(file.id)} onPreview={() => onPreview(file)} onDetail={() => onDetail(file)} onDelete={() => onDelete(file)} />)}{!files.length ? <div className="emptyListState">暂无文件</div> : null}</div>;
}

function FileRow({ file, selectable, selected, onToggle, onPreview, onDetail, onDelete }: { file: KnowledgeFile; selectable: boolean; selected: boolean; onToggle: () => void; onPreview: () => void; onDetail: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLElement>(open, () => setOpen(false));
  return <article ref={ref} className="knowledgeFileRow" role="row" onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}><div className={`knowledgeFileCell ${selectable ? "hasSelection" : ""}`}>{selectable ? <button className="deliveryToggle" type="button" aria-label={`${selected ? "取消" : "选择"}${file.title}`} aria-pressed={selected} onClick={onToggle}>{selected ? <Check size={12} /> : null}</button> : null}<button className="knowledgeFileMain" type="button" onClick={onPreview}><span className="knowledgeFileIcon">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={17} /> : <FileText size={17} />}</span><span><strong>{file.title}</strong><small>{file.kind}</small></span></button></div><span>{file.kind}</span><span>{file.owner === "Admin" ? "项目资料" : file.business}</span><span>{file.updated}</span><button className="rowMoreButton" type="button" aria-label={`${file.title}更多操作`} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={15} /></button>{open ? <div className="rowActionMenu knowledgeRowMenu"><button type="button" onClick={() => { onPreview(); setOpen(false); }}><Eye size={14} />预览</button><button type="button" onClick={() => { onDetail(); setOpen(false); }}><FileText size={14} />查看详情</button><button type="button" onClick={() => { onDelete(); setOpen(false); }}><Trash2 size={14} />删除</button></div> : null}</article>;
}

function TrashTable({ files, onRestore, onDeleteForever }: { files: KnowledgeFile[]; onRestore: (file: KnowledgeFile) => void; onDeleteForever: (file: KnowledgeFile) => void }) {
  return <div className="knowledgeTable trashTable"><div className="knowledgeTableHeader"><span>名称</span><span>原分类</span><span>删除前更新</span><span /></div>{files.map((file) => <article className="knowledgeFileRow" key={file.id}><div className="knowledgeFileMain"><span className="knowledgeFileIcon"><FileText size={17} /></span><span><strong>{file.title}</strong><small>{file.kind}</small></span></div><span>{file.owner === "Admin" ? "项目资料" : "任务产物"}</span><span>{file.updated}</span><div className="trashRowActions"><button type="button" onClick={() => onRestore(file)}><ArrowLeft size={14} />恢复</button><button type="button" onClick={() => onDeleteForever(file)}><Trash2 size={14} />永久删除</button></div></article>)}{!files.length ? <div className="emptyListState">回收站为空</div> : null}</div>;
}

function FolderDialog({ name, pinned, project, projects, onNameChange, onProjectChange, onPinnedChange, onCancel, onConfirm }: { name: string; pinned: boolean; project: string; projects: string[]; onNameChange: (name: string) => void; onProjectChange: (project: string) => void; onPinnedChange: (pinned: boolean) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modalBackdrop" role="presentation"><section className="folderCreateDialog" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title"><header><div><span>数据中枢</span><h2 id="folder-dialog-title">新建文件夹</h2><p>文件夹会归属到所选项目，并可作为侧边栏快捷入口。</p></div><button className="iconButton" type="button" onClick={onCancel} aria-label="关闭"><X size={17} /></button></header><div className="folderDialogBody"><div className="folderDialogFields"><label><span>所属项目</span><select value={project} onChange={(event) => onProjectChange(event.target.value)}>{projects.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>文件夹名称</span><input autoFocus value={name} onChange={(event) => onNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onConfirm(); }} placeholder="例如：原始实验数据" /></label></div><button className="folderPinChoice" type="button" aria-pressed={pinned} onClick={() => onPinnedChange(!pinned)}><span>{pinned ? <Check size={13} /> : null}</span><div><strong>固定到项目侧边栏</strong><small>仅展示一级文件夹，便于快速进入</small></div></button></div><footer><button className="secondaryButton compact" type="button" onClick={onCancel}>取消</button><button className="primaryButton compact" type="button" disabled={!name.trim() || !project} onClick={onConfirm}>创建文件夹</button></footer></section></div>;
}

function FilePreview({ file, onClose }: { file: KnowledgeFile; onClose: () => void }) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]);
  return <div className="modalBackdrop knowledgePreviewBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="knowledgePreviewDialog" role="dialog" aria-modal="true" aria-labelledby="knowledge-preview-title"><header><div><span>{file.kind}</span><h2 id="knowledge-preview-title">{file.title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="knowledgeDocumentPreview"><div className="documentPreviewMark">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={24} /> : <FileText size={24} />}</div><h3>{file.title.replace(/\.[^.]+$/, "")}</h3><p>文件预览区域。当前原型保留现有 Modal 结构，并为后续真实文档渲染预留空间。</p></div><footer><span className="previewContextChip">当前文件：{file.title}</span><button className="secondaryButton compact" type="button">询问此文件</button><button className="primaryButton compact" type="button" onClick={onClose}>完成</button></footer></section></div>;
}

function FileDetails({ file, onClose }: { file: KnowledgeFile; onClose: () => void }) {
  return <aside className="knowledgeDetailPanel" aria-label={`${file.title}详情`}><header><div><span>文件详情</span><strong>{file.title}</strong></div><button type="button" onClick={onClose} aria-label="关闭详情"><X size={16} /></button></header><dl><div><dt>文件类型</dt><dd>{file.kind}</dd></div><div><dt>所属项目</dt><dd>{file.project}</dd></div>{file.owner !== "Admin" ? <div><dt>来源任务</dt><dd>{file.business}</dd></div> : null}<div><dt>当前版本</dt><dd>v1</dd></div><div><dt>更新时间</dt><dd>{file.updated}</dd></div></dl></aside>;
}
