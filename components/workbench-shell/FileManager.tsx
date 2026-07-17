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
  Search,
  Upload,
  X,
} from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { initialKnowledgeFiles, projectOptions } from "../../lib/workbench/mockWorkspace";
import type { KnowledgeFile } from "../../lib/workbench/shellTypes";
import { CompactSelect, WorkspaceAssistant } from "./ShellControls";
import { useDismissableLayer } from "./useDismissableLayer";

type FileSpace = "projects" | "rules";

export function FileManager() {
  const [files, setFiles] = useState<KnowledgeFile[]>(initialKnowledgeFiles);
  const [space, setSpace] = useState<FileSpace>("projects");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("全部项目");
  const [business, setBusiness] = useState("全部业务");
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);
  const [deliverySelection, setDeliverySelection] = useState<string[]>([]);

  const visible = files.filter(
    (file) =>
      file.space === space &&
      (space === "rules" || project === "全部项目" || file.project === project) &&
      (business === "全部业务" || file.business === business) &&
      file.title.toLowerCase().includes(query.toLowerCase()),
  );
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;
    setFiles((items) => [
      ...selectedFiles.map(
        (file, index): KnowledgeFile => ({
          id: `upload-${Date.now()}-${index}`,
          title: file.name,
          project: space === "rules" ? "组织规则" : project === "全部项目" ? "未归档" : project,
          space,
          kind: space === "rules" ? "待分类规则" : "原始数据",
          business: business === "全部业务" ? "未分类" : business,
          owner: "Admin",
          updated: "刚刚",
          status: "待整理",
          agentReady: false,
        }),
      ),
      ...items,
    ]);
    event.target.value = "";
  };

  const replace = (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFiles((items) =>
      items.map((item) =>
        item.id === id ? { ...item, title: file.name, updated: "刚刚", status: "待发布" } : item,
      ),
    );
    event.target.value = "";
  };

  const folders = space === "projects"
    ? projectOptions
        .filter((item) => item !== "临时任务")
        .map((name) => ({
          name,
          count: files.filter((file) => file.space === "projects" && file.project === name).length,
        }))
    : ["DMPK报价", "药效报告", "未分类"]
        .map((name) => ({
          name,
          count: files.filter((file) => file.space === "rules" && file.business === name).length,
        }))
        .filter((item) => item.count);
  const showRoot = !query && (space === "projects" ? project === "全部项目" : business === "全部业务");
  const recentOutputs = files.filter((file) => file.space === "projects" && file.owner !== "Admin").slice(0, 5);
  const projectFiles = visible.filter((file) => file.project === project);
  const projectInputs = projectFiles.filter((file) => file.owner === "Admin");
  const projectOutputs = projectFiles.filter((file) => file.owner !== "Admin");
  const outputBusinesses = Array.from(new Set(projectOutputs.map((file) => file.business)));

  return (
    <section className="workbenchView knowledgeBaseView">
      <header>
        <div>{!showRoot ? <button className="folderBackButton projectBackButton" type="button" onClick={() => { setProject("全部项目"); setBusiness("全部业务"); setQuery(""); }}><ArrowLeft size={15} />返回项目</button> : null}<h1>{showRoot ? "文件管理系统" : project}</h1></div>
        {!showRoot ? <label className="primaryButton compact" htmlFor="file-upload"><Upload size={14} />上传项目资料</label> : null}
        <input className="visuallyHidden" id="file-upload" type="file" multiple onChange={upload} />
      </header>

      {!showRoot ? <div className="knowledgeToolbar projectKnowledgeToolbar">
        <div className="knowledgeSearch"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件" /></div>
        <CompactSelect value={business} options={["全部业务", "DMPK报价", "药效报告", "未分类"]} onChange={setBusiness} />
      </div> : null}

      {showRoot ? (
        <div className={`projectFolderStrip ${space === "rules" ? "ruleFolderStrip" : ""}`}>
          {folders.map((folder) => (
            <button type="button" key={folder.name} onClick={() => space === "projects" ? setProject(folder.name) : setBusiness(folder.name)}>
              <Folder size={18} /><span><strong>{folder.name}</strong><small>{folder.count} 项</small></span><ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : null}

      {showRoot ? <section className="rootRecentOutputs"><div className="fileListHeading"><strong>最近产出</strong><span>{recentOutputs.length} 项</span></div><FileTable files={recentOutputs} previewFile={previewFile} onPreview={setPreviewFile} onReplace={replace} /></section> : <div className="projectFileLanes"><section className="projectFileLane"><div className="projectLaneHeader"><div><strong>项目资料</strong><span>提供给数字同事的项目上下文</span></div><small>{projectInputs.length} 项</small></div><FileTable files={projectInputs} previewFile={previewFile} onPreview={setPreviewFile} onReplace={replace} /></section><section className="projectFileLane outputLane"><div className="projectLaneHeader"><div><strong>任务产物</strong><span>按业务任务整理，可选择创建客户交付包</span></div><button className="primaryButton compact" type="button" disabled={!deliverySelection.length}><PackageCheck size={14} />创建交付包{deliverySelection.length ? ` · ${deliverySelection.length}` : ""}</button></div>{outputBusinesses.map((outputBusiness) => <div className="businessOutputGroup" key={outputBusiness}><h3>{outputBusiness}</h3><FileTable files={projectOutputs.filter((file) => file.business === outputBusiness)} previewFile={previewFile} selectable selectedIds={deliverySelection} onToggle={(id) => setDeliverySelection((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onPreview={setPreviewFile} onReplace={replace} /></div>)}</section></div>}

      <WorkspaceAssistant context="library" libraryContext={{ project, business }} />
      {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} onOpenProject={() => { setProject(previewFile.project); setBusiness("全部业务"); setPreviewFile(null); }} /> : null}
    </section>
  );
}

function FileTable({ files, previewFile, selectable = false, selectedIds = [], onToggle, onPreview, onReplace }: { files: KnowledgeFile[]; previewFile: KnowledgeFile | null; selectable?: boolean; selectedIds?: string[]; onToggle?: (id: string) => void; onPreview: (file: KnowledgeFile) => void; onReplace: (id: string, event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="knowledgeTable" role="table"><div className="knowledgeTableHeader" role="row"><span>名称</span><span>项目</span><span>业务类型</span><span>更新</span><span /></div>{files.map((file) => <FileRow key={file.id} file={file} space="projects" previewed={previewFile?.id === file.id} selectable={selectable} selected={selectedIds.includes(file.id)} onToggle={() => onToggle?.(file.id)} onPreview={() => onPreview(file)} onReplace={(event) => onReplace(file.id, event)} />)}{!files.length ? <div className="emptyListState">暂无文件</div> : null}</div>;
}

function FileRow({
  file,
  space,
  previewed,
  selectable = false,
  selected = false,
  onToggle,
  onPreview,
  onReplace,
}: {
  file: KnowledgeFile;
  space: FileSpace;
  previewed: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  onPreview: () => void;
  onReplace: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLElement>(open, () => setOpen(false));

  return (
    <article
      ref={ref}
      className={`knowledgeFileRow ${previewed ? "selected" : ""}`}
      role="row"
      onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}
    >
      <div className={`knowledgeFileCell ${selectable ? "hasSelection" : ""}`}>
        {selectable ? <button className="fileContextToggle deliveryToggle" type="button" aria-label={`${selected ? "取消" : "选择"}${file.title}加入交付包`} aria-pressed={selected} onClick={onToggle}>{selected ? <Check size={12} strokeWidth={2.4} /> : null}</button> : null}
        <button className="knowledgeFileMain" type="button" onClick={onPreview}>
          <span className="knowledgeFileIcon">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={17} /> : <FileText size={17} />}</span>
          <span><strong>{file.title}</strong><small>{file.owner} · {file.status}</small></span>
        </button>
      </div>
      <span>{space === "projects" ? file.project : file.business}</span>
      <span>{space === "projects" ? file.business : file.status}</span>
      <span>{file.updated}</span>
      <button className="rowMoreButton" type="button" aria-label={`${file.title}更多操作`} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={15} /></button>
      {open ? (
        <div className="rowActionMenu knowledgeRowMenu">
          <button type="button" onClick={() => { onPreview(); setOpen(false); }}><Eye size={14} />预览</button>
          {space === "rules" ? <><label htmlFor={`replace-${file.id}`}><Upload size={14} />上传新版本</label><input className="visuallyHidden" id={`replace-${file.id}`} type="file" onChange={(event) => { onReplace(event); setOpen(false); }} /></> : null}
        </div>
      ) : null}
    </article>
  );
}

function FilePreview({ file, onClose, onOpenProject }: { file: KnowledgeFile; onClose: () => void; onOpenProject: () => void }) {
  return (
    <div className="modalBackdrop knowledgePreviewBackdrop" role="dialog" aria-modal="true">
      <section className="knowledgePreviewDialog">
        <header><div><span>{file.kind}</span><h2>{file.title}</h2></div><button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header>
        <div className="knowledgePreviewMeta"><span>{file.project}</span><span>{file.owner}</span><span>{file.updated}</span></div>
        <div className="knowledgeDocumentPreview">
          <div className="documentPreviewMark">{file.title.endsWith(".xlsx") ? <FileSpreadsheet size={24} /> : <FileText size={24} />}</div>
          <h3>{file.title.replace(/\.[^.]+$/, "")}</h3>
          <p>{file.space === "rules" ? "数字同事执行任务时调用的业务规则、字段字典或产出模板。" : file.kind === "交付产物" ? "项目产出文件，可供成员预览和继续协作。" : "项目工作文件，可作为当前项目任务上下文。"}</p>
          <dl className="knowledgePreviewFacts"><div><dt>类型</dt><dd>{file.kind}</dd></div><div><dt>业务</dt><dd>{file.business}</dd></div><div><dt>状态</dt><dd>{file.status}</dd></div></dl>
        </div>
        <footer><button className="secondaryButton compact" type="button" onClick={onClose}>关闭</button><button className="primaryButton compact" type="button" onClick={onOpenProject}>进入所属项目</button></footer>
      </section>
    </div>
  );
}
