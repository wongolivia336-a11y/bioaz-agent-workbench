"use client";

import { Link2, Paperclip, Plus, Sparkles, X } from "lucide-react";
import { type DragEvent as ReactDragEvent, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  type ComposerAttachment,
  fileAttachmentFromUpload,
  mergeAttachments,
} from "../../lib/workbench/composerAttachments";
import { ComposerAttachMenu } from "./ComposerAttachMenu";

const kindIcon = { file: Paperclip, skill: Sparkles, connector: Link2 } as const;

type Props = {
  /** 保持既有骨架：这一层仍然是 .workbenchComposer 本体，外部布局与配色不变 */
  className?: string;
  as?: "div" | "form";
  attachments: ComposerAttachment[];
  onAttachmentsChange: (next: ComposerAttachment[]) => void;
  activeCoworkerId?: string | null;
  project?: string | null;
  /** 窄抽屉里关掉二级菜单，只保留上传 */
  menu?: boolean;
  /** 是否在整页范围内接收拖拽；同屏只应有一个 composer 打开它 */
  globalDrop?: boolean;
  disabled?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
};

export function WorkbenchComposer({
  className = "",
  as = "div",
  attachments,
  onAttachmentsChange,
  activeCoworkerId = null,
  project = null,
  menu = true,
  globalDrop = false,
  disabled,
  onSubmit,
  children,
}: Props) {
  const [dropActive, setDropActive] = useState(false);
  const depth = useRef(0);

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    onAttachmentsChange(mergeAttachments(attachments, files.map(fileAttachmentFromUpload)));
  }, [attachments, onAttachmentsChange]);

  // 全局监听要拿到最新的 addFiles，但不能因为 attachments 变化就反复解绑重绑。
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  useEffect(() => {
    if (!globalDrop || disabled) return;
    const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const reset = () => { depth.current = 0; setDropActive(false); };
    const handleEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDropActive(true);
    };
    const handleOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      // 不拦掉默认行为，浏览器会直接打开这个文件，页面等于被替换掉
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const handleLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDropActive(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      reset();
      addFilesRef.current(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", handleEnter);
    window.addEventListener("dragover", handleOver);
    window.addEventListener("dragleave", handleLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragenter", handleEnter);
      window.removeEventListener("dragover", handleOver);
      window.removeEventListener("dragleave", handleLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [disabled, globalDrop]);

  const shared = {
    className: `workbenchComposer ${className} ${dropActive ? "isDropTarget" : ""}`.replace(/\s+/g, " ").trim(),
    onDragOver: (event: ReactDragEvent<HTMLElement>) => { if (!globalDrop && !disabled) event.preventDefault(); },
    onDrop: (event: ReactDragEvent<HTMLElement>) => {
      if (globalDrop || disabled) return;
      event.preventDefault();
      addFiles(Array.from(event.dataTransfer?.files ?? []));
    },
  };

  const body = (
    <>
      {attachments.length ? (
        <ComposerChipRow items={attachments} onRemove={(id) => onAttachmentsChange(attachments.filter((item) => item.id !== id))} />
      ) : null}
      {menu ? (
        <ComposerAttachMenu
          attachments={attachments}
          activeCoworkerId={activeCoworkerId}
          project={project}
          disabled={disabled}
          onAdd={(attachment) => onAttachmentsChange(mergeAttachments(attachments, [attachment]))}
          onRemove={(id) => onAttachmentsChange(attachments.filter((item) => item.id !== id))}
          onLocalFiles={addFiles}
        />
      ) : (
        <label className="composerAddButton" aria-label="上传文件">
          <Plus size={18} />
          <input type="file" multiple className="composerFileInput" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; addFiles(files); }} />
        </label>
      )}
      {children}
      {dropActive ? <span className="composerDropHint" aria-hidden="true">松手以添加到对话</span> : null}
    </>
  );

  return as === "form" ? <form {...shared} onSubmit={onSubmit}>{body}</form> : <div {...shared}>{body}</div>;
}

function ComposerChipRow({ items, onRemove }: { items: ComposerAttachment[]; onRemove: (id: string) => void }) {
  return (
    <div className="composerChipRow">
      {items.map((item) => {
        const Icon = kindIcon[item.kind];
        return (
          <span className={`composerChip ${item.borrowed ? "isBorrowed" : ""}`} key={item.id}>
            <Icon size={13} strokeWidth={1.9} />
            <span className="composerChipLabel">{item.label}</span>
            {item.borrowed ? <em>本次临时启用</em> : null}
            <button type="button" aria-label={`移除 ${item.label}`} onClick={() => onRemove(item.id)}><X size={12} /></button>
          </span>
        );
      })}
    </div>
  );
}

/**
 * 发送后跟在用户消息气泡里的只读附件条。
 * 用 span 作根，因为它要嵌在气泡的 <span>/<p> 里，div 放进去是非法嵌套。
 */
export function MessageAttachments({ items }: { items?: ComposerAttachment[] }) {
  if (!items?.length) return null;
  return (
    <span className="messageAttachments">
      {items.map((item) => {
        const Icon = kindIcon[item.kind];
        return (
          <span className="messageAttachment" key={item.id}>
            <Icon size={12} strokeWidth={1.9} />
            <span>{item.label}</span>
            {item.borrowed ? <em>临时启用</em> : null}
          </span>
        );
      })}
    </span>
  );
}
