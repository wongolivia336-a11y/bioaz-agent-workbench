"use client";

import { Check, ChevronRight, Link2, Paperclip, Plus, Search, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  type ComposerAttachment,
  type ComposerOption,
  type ComposerOptionGroup,
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
};

export function ComposerAttachMenu({ attachments, onAdd, onRemove, onLocalFiles, activeCoworkerId = null, project = null, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionId | null>(null);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layerRef = useDismissableLayer<HTMLDivElement>(open, () => { setOpen(false); setSection(null); setQuery(""); });

  const groups = useMemo<ComposerOptionGroup[]>(() => {
    if (section === "skill") return skillGroups(activeCoworkerId);
    if (section === "connector") return connectorGroups(activeCoworkerId);
    if (section === "file") {
      const library = libraryFileOptions(project);
      const knowledge = knowledgeFileOptions();
      return [
        ...(library.length ? [{ id: "library", label: "项目文件库", options: library }] : []),
        ...(knowledge.length ? [{ id: "knowledge", label: "知识库", options: knowledge }] : []),
      ];
    }
    return [];
  }, [activeCoworkerId, project, section]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return groups;
    return groups
      .map((group) => ({ ...group, options: group.options.filter((option) => `${option.label}${option.meta ?? ""}`.toLowerCase().includes(keyword)) }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

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
                      {filtered.length ? filtered.map((group) => (
                        <div className="composerAttachGroup" key={group.id}>
                          {group.label ? <span className="composerAttachGroupLabel">{group.label}</span> : null}
                          {group.options.map((option) => {
                            const attached = attachments.some((entry) => entry.id === option.id);
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
                      )) : <p className="composerAttachEmpty">没有匹配的结果</p>}
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
