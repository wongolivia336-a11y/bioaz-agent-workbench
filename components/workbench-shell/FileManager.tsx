"use client";

import {
  Check,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  MoreHorizontal,
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
type FileSource = "all" | "human" | "agent";

export function FileManager() {
  const [files, setFiles] = useState<KnowledgeFile[]>(initialKnowledgeFiles);
  const [space, setSpace] = useState<FileSpace>("projects");
  const [source, setSource] = useState<FileSource>("all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("全部项目");
  const [business, setBusiness] = useState("全部业务");
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);

  const visible = files.filter(
    (file) =>
      file.space === space &&
      (source === "all" || (source === "human" ? file.owner === "Admin" : file.owner !== "Admin")) &&
      (space === "rules" || project === "全部项目" || file.project === project) &&
      (business === "全部业务" || file.business === business) &&
      file.title.toLowerCase().includes(query.toLowerCase()),
  );
  const selectedContextFiles = files.filter((file) => selectedContextIds.includes(file.id));

  const toggleContextFile = (fileId: string) => {
    setSelectedContextIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId],
    );
  };

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

  return (
    <section className="workbenchView knowledgeBaseView">
      <header>
        <div><h1>文件管理系统</h1></div>
        <label className="primaryButton compact" htmlFor="file-upload"><Upload size={14} />上传文档</label>
        <input className="visuallyHidden" id="file-upload" type="file" multiple onChange={upload} />
      </header>

      <nav className="fileSpaceTabs" aria-label="文件空间">
        <button type="button" className="active" onClick={() => { setSpace("projects"); setBusiness("全部业务"); }}>项目文件</button>
      </nav>

      <div className="knowledgeToolbar">
        <div className="knowledgeSearch"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件" /></div>
        <div className="fileSourceFilters" aria-label="文件来源">
          <button type="button" className={source === "all" ? "active" : ""} onClick={() => setSource("all")}>全部</button>
          <button type="button" className={source === "human" ? "active" : ""} onClick={() => setSource("human")}>人工上传</button>
          <button type="button" className={source === "agent" ? "active" : ""} onClick={() => setSource("agent")}>数字同事产物</button>
        </div>
        {space === "projects" ? <CompactSelect value={project} options={["全部项目", ...projectOptions.filter((item) => item !== "临时任务"), "未归档"]} onChange={setProject} /> : null}
        <CompactSelect value={business} options={["全部业务", "DMPK报价", "药效报告", "未分类"]} onChange={setBusiness} />
      </div>

      {showRoot ? (
        <div className={`projectFolderStrip ${space === "rules" ? "ruleFolderStrip" : ""}`}>
          {folders.map((folder) => (
            <button type="button" key={folder.name} onClick={() => space === "projects" ? setProject(folder.name) : setBusiness(folder.name)}>
              <Folder size={18} /><span><strong>{folder.name}</strong><small>{folder.count} 项</small></span><ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="fileListHeading">
        <strong>
          {space === "projects"
            ? project === "全部项目" ? "最近产出" : project
            : business === "全部业务"
              ? "最近更新"
              : <><button className="folderBackButton" type="button" onClick={() => setBusiness("全部业务")}>规则与模板</button><ChevronRight size={13} />{business}</>}
        </strong>
        <span>{visible.length} 项{selectedContextFiles.length ? ` · 已选 ${selectedContextFiles.length}` : ""}</span>
      </div>

      <div className="knowledgeTable" role="table">
        <div className="knowledgeTableHeader" role="row">
          <span>名称</span><span>{space === "projects" ? "项目" : "业务类型"}</span><span>{space === "projects" ? "业务类型" : "状态"}</span><span>更新</span><span />
        </div>
        {visible.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            space={space}
            previewed={previewFile?.id === file.id}
            contextSelected={selectedContextIds.includes(file.id)}
            onToggleContext={() => toggleContextFile(file.id)}
            onPreview={() => setPreviewFile(file)}
            onReplace={(event) => replace(file.id, event)}
          />
        ))}
        {!visible.length ? <div className="emptyListState">没有符合当前条件的文件</div> : null}
      </div>

      <WorkspaceAssistant context="library" libraryContext={{ project, business, files: selectedContextFiles.map((file) => file.title) }} />
      {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
    </section>
  );
}

function FileRow({
  file,
  space,
  previewed,
  contextSelected,
  onToggleContext,
  onPreview,
  onReplace,
}: {
  file: KnowledgeFile;
  space: FileSpace;
  previewed: boolean;
  contextSelected: boolean;
  onToggleContext: () => void;
  onPreview: () => void;
  onReplace: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLElement>(open, () => setOpen(false));

  return (
    <article
      ref={ref}
      className={`knowledgeFileRow ${previewed ? "selected" : ""} ${contextSelected ? "contextSelected" : ""}`}
      role="row"
      onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}
    >
      <div className="knowledgeFileCell">
        <button className="fileContextToggle" type="button" aria-label={`${contextSelected ? "取消选择" : "选择"}${file.title}作为助手上下文`} aria-pressed={contextSelected} onClick={onToggleContext}>
          {contextSelected ? <Check size={13} strokeWidth={2.4} /> : null}
        </button>
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

function FilePreview({ file, onClose }: { file: KnowledgeFile; onClose: () => void }) {
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
        <footer><button className="secondaryButton compact" type="button" onClick={onClose}>关闭</button></footer>
      </section>
    </div>
  );
}
