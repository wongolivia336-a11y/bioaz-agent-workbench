"use client";

import { Check, ChevronRight, Link2, Paperclip, Play, Plus, Search, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  type ComposerAttachment,
  type ComposerOption,
  type ComposerOptionGroup,
  type ComposerSessionAction,
  connectorGroups,
  fileAttachmentFromUpload,
  knowledgeFileOptions,
  libraryFileOptions,
  skillGroups,
} from "../../lib/workbench/composerAttachments";
import { useDismissableLayer } from "./useDismissableLayer";

type SectionId = "file" | "skill" | "connector";

const sections: Array<{ id: SectionId; label: string; icon: typeof Paperclip }> = [
  { id: "file", label: "添加文件", icon: Paperclip },
  { id: "skill", label: "技能", icon: Sparkles },
  { id: "connector", label: "连接器", icon: Link2 },
];

type Props = {
  attachments: ComposerAttachment[];
  onAdd: (attachment: ComposerAttachment) => void;
  onRemove: (id: string) => void;
  onLocalFiles: (files: File[]) => void;
  activeCoworkerId?: string | null;
  project?: string | null;
  disabled?: boolean;
  /* 会话里的两种形态（首页不传，照旧是「挑一项挂成 chip」）：
     技能 = 让数字同事现在就做的一件事，点了就跑；数字同事自带的那几项只列出来说明「在自动跑」。
     连接器 = 这条会话在读哪些源，只看不挂——单价从计价规则库来、材料从项目文件库来，
     人得知道，但不需要每条消息都「带上」它们。 */
  sessionActions?: ComposerSessionAction[];
  connectorsReadOnly?: boolean;
};

export function ComposerAttachMenu({ attachments, onAdd, onRemove, onLocalFiles, activeCoworkerId = null, project = null, disabled, sessionActions, connectorsReadOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionId | null>(null);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layerRef = useDismissableLayer<HTMLDivElement>(open, () => { setOpen(false); setSection(null); setQuery(""); });

  const inSession = Boolean(sessionActions);
  const groups = useMemo<ComposerOptionGroup[]>(() => {
    if (section === "skill") {
      /* 会话里：数字同事自带的技能只列「已具备」那组，作为「自动运行中」的说明；
         「其他可用」在会话里没有意义——这一单对面是谁已经定了。 */
      const all = skillGroups(activeCoworkerId);
      return inSession ? all.filter((group) => group.id === "owned").map((group) => ({ ...group, id: "running", label: "自动运行中" })) : all;
    }
    if (section === "connector") {
      const all = connectorGroups(activeCoworkerId);
      /* 只读时不再按「已具备 / 其他可用」分，按「在读 / 未接」分——问题从「要不要带上」变成「它读得到什么」。 */
      if (!connectorsReadOnly) return all;
      /* 在读 = 这位数字同事用着的、已连接的；其余已连接的对这条会话没用（PubMed 对报价没用），
         单列一组说清楚；没接上的另起一组。 */
      const owned = all.find((group) => group.id === "owned")?.options ?? [];
      const others = all.filter((group) => group.id !== "owned").flatMap((group) => group.options);
      const live = owned.filter((option) => !option.disabled);
      const idle = others.filter((option) => !option.disabled);
      const off = [...owned, ...others].filter((option) => option.disabled);
      return [
        ...(live.length ? [{ id: "live", label: "本会话在读", options: live }] : []),
        ...(idle.length ? [{ id: "idle", label: "已连接 · 本会话不用", options: idle }] : []),
        ...(off.length ? [{ id: "off", label: "未接入", options: off }] : []),
      ];
    }
    if (section === "file") {
      const library = libraryFileOptions(project);
      const knowledge = knowledgeFileOptions();
      return [
        ...(library.length ? [{ id: "library", label: "项目文件库", options: library }] : []),
        ...(knowledge.length ? [{ id: "knowledge", label: "知识库", options: knowledge }] : []),
      ];
    }
    return [];
  }, [activeCoworkerId, connectorsReadOnly, inSession, project, section]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return groups;
    return groups
      .map((group) => ({ ...group, options: group.options.filter((option) => `${option.label}${option.meta ?? ""}`.toLowerCase().includes(keyword)) }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);
  const filteredActions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (sessionActions ?? []).filter((action) => !keyword || `${action.label}${action.meta ?? ""}`.toLowerCase().includes(keyword));
  }, [query, sessionActions]);
  /* 这一节里有没有能点的东西——只读的连接器、自动运行中的技能都不算 */
  const inert = (section === "connector" && connectorsReadOnly) || (section === "skill" && inSession);

  const openSection = (next: SectionId) => {
    setSection((current) => (current === next ? null : next));
    setQuery("");
  };

  const pick = (option: ComposerOption, group: ComposerOptionGroup) => {
    if (option.disabled) return;
    const attached = attachments.some((item) => item.id === option.id);
    if (attached) { onRemove(option.id); return; }
    onAdd({
      id: option.id,
      kind: section === "skill" ? "skill" : section === "connector" ? "connector" : "file",
      label: option.label,
      meta: option.meta,
      origin: section === "file" ? (group.id === "knowledge" ? "knowledge" : "library") : undefined,
      borrowed: group.id === "other",
    });
  };

  return (
    <div ref={layerRef} className={`composerAttachMenu ${open ? "isOpen" : ""}`}>
      <button
        type="button"
        className="composerAddButton"
        aria-label="添加文件、技能或连接器"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => { setOpen((value) => !value); setSection(null); setQuery(""); }}
      >
        <Plus size={16} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="composerFileInput"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (!files.length) return;
          onLocalFiles(files);
          setOpen(false);
          setSection(null);
        }}
      />
      {open ? (
        <div className="composerAttachPanel" role="menu">
          {sections.map((item) => {
            const Icon = item.icon;
            const expanded = section === item.id;
            return (
              <div className={`composerAttachRow ${expanded ? "isOpen" : ""}`} key={item.id} onMouseEnter={() => { setSection(item.id); setQuery(""); }}>
                <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={expanded} onClick={() => openSection(item.id)}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                  <ChevronRight size={14} />
                </button>
                {expanded ? (
                  <div className="composerAttachSubmenu">
                    {item.id === "file" ? (
                      <button type="button" className="composerAttachUpload" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={14} />
                        <span>本地文件</span>
                        <small>也可以直接把文件拖进来</small>
                      </button>
                    ) : null}
                    <label className="composerAttachSearch">
                      <Search size={14} />
                      <input
                        value={query}
                        autoFocus
                        placeholder={item.id === "skill" ? "搜索技能" : item.id === "connector" ? "搜索连接器" : "搜索文件"}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <div className="composerAttachList">
                      {/* 会话里的技能：先是「让它做」——点了就跑、菜单收起 */}
                      {item.id === "skill" && sessionActions ? (
                        filteredActions.length ? (
                          <div className="composerAttachGroup">
                            <span className="composerAttachGroupLabel">让数字同事做</span>
                            {filteredActions.map((action) => (
                              <button
                                type="button"
                                key={action.id}
                                className="composerAttachOption isAction"
                                disabled={action.disabled}
                                title={action.disabled ? action.disabledReason : undefined}
                                onClick={() => { action.run(); setOpen(false); setSection(null); setQuery(""); }}
                              >
                                <Play size={12} aria-hidden="true" />
                                <span className="composerAttachOptionCopy">
                                  <strong>{action.label}</strong>
                                  {action.meta ? <small>{action.meta}</small> : null}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null
                      ) : null}
                      {filtered.length ? filtered.map((group) => (
                        <div className="composerAttachGroup" key={group.id}>
                          {group.label ? <span className="composerAttachGroupLabel">{group.label}</span> : null}
                          {group.options.map((option) => {
                            const attached = attachments.some((entry) => entry.id === option.id);
                            /* 只读行：不是按钮，不勾选，右边一个状态词 */
                            if (inert) {
                              /* 规划中的技能不能标「运行中」——它还没有 */
                              const planned = item.id === "skill" && Boolean(option.meta?.includes("规划中"));
                              const off = option.disabled || planned;
                              return (
                                <div className={`composerAttachOption isInert ${off ? "isOff" : ""}`} key={option.id} title={option.disabled ? option.disabledReason : undefined}>
                                  <span className="composerAttachOptionCopy">
                                    <strong>{option.label}</strong>
                                    {option.meta ? <small>{option.meta}</small> : null}
                                  </span>
                                  <em>{item.id === "skill" ? (planned ? "规划中" : "运行中") : option.disabled ? option.disabledReason : group.id === "idle" ? "不用" : "在读"}</em>
                                </div>
                              );
                            }
                            return (
                              <button
                                type="button"
                                key={option.id}
                                className={`composerAttachOption ${attached ? "isAttached" : ""}`}
                                disabled={option.disabled}
                                title={option.disabled ? option.disabledReason : undefined}
                                onClick={() => pick(option, group)}
                              >
                                <span className="composerAttachOptionCopy">
                                  <strong>{option.label}</strong>
                                  {option.meta ? <small>{option.meta}</small> : null}
                                </span>
                                {attached ? <Check size={14} /> : null}
                              </button>
                            );
                          })}
                        </div>
                      )) : (item.id === "skill" && filteredActions.length) ? null : <p className="composerAttachEmpty">没有匹配的结果</p>}
                      {inert && item.id === "connector" ? <p className="composerAttachNote">单价从计价规则库来，材料从项目文件库来。接入与授权在「数字团队 › 连接器」里管。</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export { fileAttachmentFromUpload };
