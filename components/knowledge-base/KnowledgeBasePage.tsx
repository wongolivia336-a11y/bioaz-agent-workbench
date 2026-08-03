"use client";

import {
  ArrowUpDown,
  Bot,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Folder,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { digitalTeamData } from "../../lib/workbench/digitalTeamData";
import {
  folderTrail,
  formatFileSize,
  mockKbFiles,
  mockKbFolders,
  type KnowledgeBaseFile,
} from "../../lib/workbench/knowledgeBaseData";
import { InlineSelect } from "../workbench-shell/InlineSelect";
import { Button, Dialog, Drawer, Menu, MenuGroup, MenuItem, StatusChip, type StatusTone } from "../ui";
import { WorkspaceAssistant } from "../workbench-shell/ShellControls";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";

const PAGE_SIZE = 10;

const statusLabel: Record<KnowledgeBaseFile["status"], string> = {
  parsed: "解析成功",
  parsing: "解析中",
  failed: "解析失败",
};

const statusTone: Record<KnowledgeBaseFile["status"], StatusTone> = {
  parsed: "success",
  parsing: "running",
  failed: "danger",
};

const businessOptions = ["全部业务", "肿瘤报告", "DMPK报价", "通用"];
const sortOptions = [
  { id: "updated", label: "按更新时间" },
  { id: "name", label: "按名称" },
  { id: "size", label: "按大小" },
] as const;

type SortKey = (typeof sortOptions)[number]["id"];

export function KnowledgeBasePage() {
  const [files, setFiles] = useState<KnowledgeBaseFile[]>(mockKbFiles);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [business, setBusiness] = useState("全部业务");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<KnowledgeBaseFile | null>(null);
  const [moveFor, setMoveFor] = useState<KnowledgeBaseFile | null>(null);
  const [topbarHost, setTopbarHost] = useState<HTMLElement | null>(null);

  useEffect(() => { setTopbarHost(document.getElementById("workbench-topbar-actions")); }, []);
  useEffect(() => { setPage(1); }, [folderId, query, business, tagFilter, sortBy]);

  const trail = folderTrail(mockKbFolders, folderId);
  const childFolders = mockKbFolders.filter((folder) => folder.parentId === folderId);
  const allTags = useMemo(() => files.flatMap((file) => file.tags).filter((tag, index, list) => list.indexOf(tag) === index), [files]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const list = files.filter((file) => (
      file.folderId === folderId
      && (business === "全部业务" || file.business === business)
      && (!tagFilter.length || tagFilter.every((tag) => file.tags.includes(tag)))
      && (!keyword || file.title.toLowerCase().includes(keyword))
    ));
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title, "zh-Hans-CN");
      if (sortBy === "size") return b.size - a.size;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [business, files, folderId, query, sortBy, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageFiles = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const detailFile = files.find((file) => file.id === detailId) ?? null;

  const stats = {
    total: files.length,
    parsed: files.filter((file) => file.status === "parsed").length,
    failed: files.filter((file) => file.status === "failed").length,
    assigned: files.filter((file) => file.assignedTo.length > 0).length,
  };

  const assign = (fileId: string, coworkerIds: string[]) => {
    setFiles((items) => items.map((item) => item.id === fileId ? { ...item, assignedTo: coworkerIds } : item));
    setAssignFor(null);
  };

  const move = (fileId: string, nextFolderId: string | null) => {
    setFiles((items) => items.map((item) => item.id === fileId ? { ...item, folderId: nextFolderId } : item));
    setMoveFor(null);
  };

  const remove = (fileId: string) => {
    setFiles((items) => items.filter((item) => item.id !== fileId));
    setDetailId((current) => current === fileId ? null : current);
  };

  return (
    <section className="workbenchView knowledgeBaseView knowledgeHubView" aria-label="知识库">
      {topbarHost ? createPortal(
        <div className="libraryToolLayer">
          <div className="knowledgeSearch libraryToolSearch">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识库文件..." aria-label="搜索知识库文件" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="清除搜索"><X size={13} /></button> : null}
          </div>
        </div>,
        topbarHost,
      ) : null}

      <div className="kbStatRow">
        <KbStat label="文件总数" value={stats.total} />
        <KbStat label="解析成功" value={stats.parsed} />
        <KbStat label="解析失败" value={stats.failed} tone={stats.failed ? "alert" : undefined} />
        <KbStat label="已指派同事" value={stats.assigned} />
      </div>

      {/* 面包屑与全部操作同处一行，避免上下堆多条分隔线 */}
      <div className="sectionBar kbActionBar">
        <div className="kbBreadcrumb">
          <button type="button" onClick={() => setFolderId(null)}>知识库</button>
          {trail.map((folder) => (
            <span key={folder.id}>
              <ChevronRight size={14} />
              <button type="button" onClick={() => setFolderId(folder.id)}>{folder.name}</button>
            </span>
          ))}
        </div>
        <div className="sectionBarActions">
          {/* 标签是多选，选完不关闭 */}
          <Menu icon={<Filter size={16} />} label="筛选" active={business !== "全部业务" || tagFilter.length > 0} closeOnSelect={false}>
            <MenuGroup label="业务">
              {businessOptions.map((option) => <MenuItem key={option} active={business === option} onSelect={() => setBusiness(option)}>{option}</MenuItem>)}
            </MenuGroup>
            <MenuGroup label="标签">
              {allTags.map((tag) => (
                <MenuItem key={tag} active={tagFilter.includes(tag)} onSelect={() => setTagFilter((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>{tag}</MenuItem>
              ))}
            </MenuGroup>
          </Menu>
          <Menu icon={<ArrowUpDown size={16} />} label="排序" active={sortBy !== "updated"}>
            {sortOptions.map((option) => <MenuItem key={option.id} active={sortBy === option.id} onSelect={() => setSortBy(option.id)}>{option.label}</MenuItem>)}
          </Menu>
          <button className="secondaryButton compact" type="button"><Plus size={15} />新建文件夹</button>
          <label className="primaryButton compact" htmlFor="kb-upload"><Upload size={15} />上传文件</label>
          <input className="visuallyHidden" id="kb-upload" type="file" multiple />
        </div>
      </div>

      {(business !== "全部业务" || tagFilter.length > 0) ? (
        <div className="filterChips">
          {business !== "全部业务" ? (
            <span className="filterChip">业务：{business}<button type="button" onClick={() => setBusiness("全部业务")} aria-label="清除业务筛选"><X size={12} /></button></span>
          ) : null}
          {tagFilter.map((tag) => (
            <span className="filterChip" key={tag}>标签：{tag}<button type="button" onClick={() => setTagFilter((current) => current.filter((item) => item !== tag))} aria-label={`清除标签${tag}`}><X size={12} /></button></span>
          ))}
          <button className="clearAllChips" type="button" onClick={() => { setBusiness("全部业务"); setTagFilter([]); }}>清除全部</button>
        </div>
      ) : null}

      {childFolders.length ? (
        <div className="kbFolderStrip">
          {childFolders.map((folder) => (
            <button type="button" key={folder.id} onClick={() => setFolderId(folder.id)}>
              <Folder size={16} /><span>{folder.name}</span>
              <small>{files.filter((file) => file.folderId === folder.id).length} 项</small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="knowledgeTable kbTable">
        <div className="knowledgeTableHeader">
          <span className="knowledgeHeadName">名称</span>
          <span>状态</span>
          <span>业务</span>
          <span>指派给</span>
          <span>更新时间</span>
          <span />
        </div>
        {pageFiles.map((file) => (
          <KbFileRow
            key={file.id}
            file={file}
            onPreview={() => setDetailId(file.id)}
            onDetail={() => setDetailId(file.id)}
            onAssign={() => setAssignFor(file)}
            onAssignDirect={(ids) => setFiles((items) => items.map((item) => item.id === file.id ? { ...item, assignedTo: ids } : item))}
            onMove={() => setMoveFor(file)}
            onDelete={() => remove(file.id)}
          />
        ))}
        {!pageFiles.length ? (
          <div className="libraryEmptyState">
            <span className="libraryEmptyIcon" aria-hidden="true"><Folder size={22} /></span>
            <strong>{query || tagFilter.length || business !== "全部业务" ? "没有匹配的文件" : "这个文件夹还是空的"}</strong>
            <span>{query || tagFilter.length || business !== "全部业务" ? "试试调整搜索词或清除筛选条件" : "上传资料来扩展数字同事的专业能力"}</span>
            <label className="primaryButton compact" htmlFor="kb-upload"><Upload size={15} />上传文件</label>
          </div>
        ) : null}
      </div>

      {filtered.length > PAGE_SIZE ? (
        <div className="kbPagination">
          <span>共 {filtered.length} 条</span>
          <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>上一页</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
            <button key={item} className={item === safePage ? "active" : ""} type="button" onClick={() => setPage(item)}>{item}</button>
          ))}
          <button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>下一页</button>
        </div>
      ) : null}

      {detailFile ? <KbDetailPanel file={detailFile} onClose={() => setDetailId(null)} onAssign={() => setAssignFor(detailFile)} /> : null}
      {assignFor ? <AssignDialog file={assignFor} onClose={() => setAssignFor(null)} onConfirm={(ids) => assign(assignFor.id, ids)} /> : null}
      {moveFor ? <MoveDialog file={moveFor} onClose={() => setMoveFor(null)} onConfirm={(target) => move(moveFor.id, target)} /> : null}

      <WorkspaceAssistant context="knowledgeBase" scopeLabel={trail.length ? trail[trail.length - 1].name : "全部知识库"} />
    </section>
  );
}

function KbStat({ label, value, tone }: { label: string; value: number; tone?: "alert" }) {
  return (
    <div className={`kbStat ${tone === "alert" ? "isAlert" : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function KbFileRow({ file, onPreview, onDetail, onAssign, onAssignDirect, onMove, onDelete }: { file: KnowledgeBaseFile; onPreview: () => void; onDetail: () => void; onAssign: () => void; onAssignDirect: (ids: string[]) => void; onMove: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLElement>(open, () => setOpen(false));
  const nameById = new Map(digitalTeamData.map((item) => [item.id, item.displayName]));
  return (
    <article ref={ref} className={`knowledgeFileRow ${open ? "menuOpen" : ""}`}>
      <div className="knowledgeFileCell">
        <button className="knowledgeFileMain" type="button" onClick={onPreview}>
          <span className="knowledgeFileIcon">{file.type === "xlsx" ? <FileSpreadsheet size={16} /> : <FileText size={16} />}</span>
          <span><strong>{file.title}</strong><small>{formatFileSize(file.size)}</small></span>
        </button>
      </div>
      <span><StatusChip tone={statusTone[file.status]}>{statusLabel[file.status]}</StatusChip></span>
      <span>{file.business}</span>
      <span>
        <InlineSelect
          label={`修改${file.title}的可用范围`}
          triggerClassName="kbAssignTrigger"
          trigger={<span>{file.assignedTo.length ? file.assignedTo.map((id) => nameById.get(id) ?? id).join("、") : "全部同事"}</span>}
        >
          {(close) => (
            <>
              <button className={`toolMenuItem ${file.assignedTo.length ? "" : "active"}`} type="button" onClick={() => { onAssignDirect([]); close(); }}>
                <span>全部数字同事可用</span>{file.assignedTo.length ? null : <Check size={13} />}
              </button>
              {digitalTeamData.map((coworker) => {
                const picked = file.assignedTo.includes(coworker.id);
                return (
                  <button
                    className={`toolMenuItem ${picked ? "active" : ""}`}
                    type="button"
                    key={coworker.id}
                    onClick={() => onAssignDirect(picked ? file.assignedTo.filter((id) => id !== coworker.id) : [...file.assignedTo, coworker.id])}
                  >
                    <span><Bot size={13} />{coworker.displayName}</span>
                    {picked ? <Check size={13} /> : null}
                  </button>
                );
              })}
            </>
          )}
        </InlineSelect>
      </span>
      <span>{file.updatedAt}</span>
      <div className="rowActions">
        <button className="rowActionButton" type="button" aria-label={`预览${file.title}`} onClick={onPreview}><Eye size={15} /></button>
        <button className="rowMoreButton" type="button" aria-label={`${file.title}更多操作`} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={15} /></button>
      </div>
      {open ? (
        <div className="rowActionMenu knowledgeRowMenu">
          <button type="button" onClick={() => { onPreview(); setOpen(false); }}><Eye size={14} />预览</button>
          <button type="button" onClick={() => { onDetail(); setOpen(false); }}><FileText size={14} />查看详情</button>
          <button type="button" onClick={() => { onAssign(); setOpen(false); }}><Bot size={14} />指派给数字同事</button>
          <button type="button" onClick={() => { onMove(); setOpen(false); }}><Folder size={14} />改文件夹</button>
          <button type="button" onClick={() => setOpen(false)}><Download size={14} />下载</button>
          <button type="button" onClick={() => { onDelete(); setOpen(false); }}><Trash2 size={14} />删除</button>
        </div>
      ) : null}
    </article>
  );
}

function KbDetailPanel({ file, onClose, onAssign }: { file: KnowledgeBaseFile; onClose: () => void; onAssign: () => void }) {
  const nameById = new Map(digitalTeamData.map((item) => [item.id, item.displayName]));
  return (
    <Drawer className="kbDetailPanel" eyebrow="文件详情" title={file.title} onClose={onClose}>
      <dl>
        <div><dt>解析状态</dt><dd><StatusChip tone={statusTone[file.status]}>{statusLabel[file.status]}</StatusChip></dd></div>
        <div><dt>文件类型</dt><dd>{file.type.toUpperCase()}</dd></div>
        <div><dt>文件大小</dt><dd>{formatFileSize(file.size)}</dd></div>
        <div><dt>所属业务</dt><dd>{file.business}</dd></div>
        <div><dt>上传用户</dt><dd>{file.uploadedBy}</dd></div>
        <div><dt>更新时间</dt><dd>{file.updatedAt}</dd></div>
        <div><dt>向量化</dt><dd>{file.vectorized ? "已完成" : "未完成"}</dd></div>
      </dl>
      <section className="kbDetailSection">
        <div className="kbDetailSectionHead">
          <strong>文件可用范围</strong>
          <button type="button" onClick={onAssign}>修改</button>
        </div>
        <div className={`kbScopeOption ${file.assignedTo.length ? "" : "active"}`}>
          当前工作空间全部数字同事可用{file.assignedTo.length ? null : <Check size={15} />}
        </div>
        <div className={`kbScopeOption ${file.assignedTo.length ? "active" : ""}`}>
          指定数字同事可用{file.assignedTo.length ? <Check size={15} /> : null}
        </div>
        {file.assignedTo.length ? (
          <div className="kbAssignedList">
            {file.assignedTo.map((id) => <span key={id}><Bot size={13} />{nameById.get(id) ?? id}</span>)}
          </div>
        ) : null}
      </section>
      <section className="kbDetailSection">
        <div className="kbDetailSectionHead"><strong>标签</strong></div>
        <div className="kbTagList">
          {file.tags.length ? file.tags.map((tag) => <span key={tag}>{tag}</span>) : <small>暂无标签</small>}
        </div>
      </section>
    </Drawer>
  );
}

function AssignDialog({ file, onClose, onConfirm }: { file: KnowledgeBaseFile; onClose: () => void; onConfirm: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(file.assignedTo);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <Dialog
      title="指派给数字同事"
      description={`选择可以使用「${file.title}」的数字同事，不选则全部同事可用。`}
      size="compact"
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={() => onConfirm(selected)}>保存</Button>
      </>}
    >
      <div className="kbAssignOptions">
        {digitalTeamData.map((coworker) => (
          <button key={coworker.id} className={selected.includes(coworker.id) ? "active" : ""} type="button" onClick={() => toggle(coworker.id)}>
            <span className="kbAssignMark"><Bot size={15} /></span>
            <span><strong>{coworker.displayName}</strong><small>{coworker.domain}</small></span>
            {selected.includes(coworker.id) ? <Check size={15} /> : null}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function MoveDialog({ file, onClose, onConfirm }: { file: KnowledgeBaseFile; onClose: () => void; onConfirm: (folderId: string | null) => void }) {
  const [target, setTarget] = useState<string | null>(file.folderId);
  return (
    <Dialog
      title="改文件夹"
      description={`把「${file.title}」移动到其他文件夹。`}
      size="compact"
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={() => onConfirm(target)}>移动</Button>
      </>}
    >
      <div className="kbAssignOptions">
        <button className={target === null ? "active" : ""} type="button" onClick={() => setTarget(null)}>
          <span className="kbAssignMark"><Folder size={15} /></span>
          <span><strong>知识库根目录</strong></span>
          {target === null ? <Check size={15} /> : null}
        </button>
        {mockKbFolders.map((folder) => (
          <button key={folder.id} className={target === folder.id ? "active" : ""} type="button" onClick={() => setTarget(folder.id)}>
            <span className="kbAssignMark"><Folder size={15} /></span>
            <span><strong>{folder.name}</strong><small>{folderTrail(mockKbFolders, folder.id).map((item) => item.name).join(" / ")}</small></span>
            {target === folder.id ? <Check size={15} /> : null}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export default KnowledgeBasePage;
