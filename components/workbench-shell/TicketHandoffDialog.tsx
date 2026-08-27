"use client";

import { Paperclip, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { PersonPicker } from "../ui";
import { useModalDismiss } from "../ui/useModalDismiss";
import { directory } from "../../lib/workbench/mockInbox";
import type { MailResourceRef } from "../../lib/workbench/mailboxData";
import type { TicketKind } from "../../lib/workbench/ticketData";
import { ticketKindLabel } from "../../lib/workbench/ticketData";
import { CompactSelect } from "./ShellControls";

export type HandoffPayload = {
  title: string;
  kind: TicketKind;
  project: string;
  assignee: string;
  assigneeRole: string;
  note: string;
  attachments: MailResourceRef[];
};

/**
 * 交接对话框。工单的两个产生入口共用它——会话里「交给下一个人」和工单页
 * 「上传并交接」。
 *
 * 措辞是「交接」不是「创建工单」:后者会逼用户先判断「这事该建任务还是开工单」,
 * 而这两件事根本不并列——任务是开始干活时产生的,工单是把活交出去时产生的。
 * 动词说清楚了,就没得选了。
 */
export function TicketHandoffDialog({
  currentUser,
  projects,
  defaultProject,
  defaultTitle,
  defaultKind,
  /** 会话交接时带过来的产物;手动交接时为空,由用户上传 */
  presetAttachments,
  onSubmit,
  onClose,
}: {
  currentUser: string;
  projects: string[];
  defaultProject?: string | null;
  defaultTitle?: string;
  defaultKind?: TicketKind;
  presetAttachments?: MailResourceRef[];
  onSubmit: (payload: HandoffPayload) => void;
  onClose: () => void;
}) {
  const dismiss = useModalDismiss(onClose);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [kind, setKind] = useState<TicketKind>(defaultKind ?? "qa-review");
  const [project, setProject] = useState(defaultProject || projects[0] || "");
  /* 不能交给自己:交接的定义就是球换一只手。范围是整本通讯录,不是那几个
     可切换的演示账号——能交接的人远多于你能站过去看的人。 */
  const candidates = directory.filter((account) => account.name !== currentUser);
  /* 不预选。预选一个人等于替他做了决定,而这一格恰恰是最不该被默认的。 */
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<MailResourceRef[]>(presetAttachments ?? []);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    /* 必须在这儿就把 FileList 摊成数组。它是活对象,调用方紧接着会把 input 的
       value 清空好让同一个文件能再选一次——而函数式更新器是稍后才跑的,
       那时候 list 已经空了,setFiles 会把一个空数组接上去。 */
    const picked = Array.from(list).map((file, index) => ({
      id: `up-${Date.now()}-${index}`,
      name: file.name,
      kind: /\.zip$/i.test(file.name) ? ("package" as const) : ("file" as const),
      meta: `${(file.size / 1024).toFixed(0)} KB`,
      source: "uploaded" as const,
    }));
    setFiles((current) => [...current, ...picked]);
  };

  /* 产物是必填。一张不带东西的工单等于一句「你去处理一下」,接手的人还得回来问
     处理什么——那正是这套东西要消灭的来回。 */
  const ready = Boolean(title.trim() && project && assignee && files.length);
  const assigneeRole = directory.find((account) => account.name === assignee)?.roleLabel ?? "";

  return (
    <div className="modalBackdrop" role="presentation" {...dismiss}>
      <section className="previewModal ticketHandoffModal" role="dialog" aria-modal="true" aria-label="交接">
        <header>
          <div><span>交接</span><h2>把这件事交给下一个人</h2></div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>

        <div className="ticketHandoffBody">
          <label className="ticketHandoffField">
            <span>标题</span>
            <input value={title} placeholder="例如：请审批：样本 9 双批次报告（第三版）" onChange={(event) => setTitle(event.target.value)} />
          </label>

          <div className="ticketHandoffRow">
            <label className="ticketHandoffField">
              <span>类型</span>
              <CompactSelect
                value={ticketKindLabel[kind]}
                options={Object.values(ticketKindLabel)}
                onChange={(value) => setKind((Object.keys(ticketKindLabel) as TicketKind[]).find((key) => ticketKindLabel[key] === value) ?? "qa-review")}
              />
            </label>
            <label className="ticketHandoffField">
              <span>所属项目</span>
              <CompactSelect value={project} options={projects} onChange={setProject} />
            </label>
            <label className="ticketHandoffField">
              <span>交给</span>
              {/* 跟会话里那张交接卡用同一个控件。两处各写各的输入框,
                  改一次交接行为就要同步两遍——而它们问的本来就是同一个问题。 */}
              <PersonPicker
                people={candidates}
                value={assignee}
                onChange={setAssignee}
                placeholder="选择接手的同事"
              />
            </label>
          </div>

          <div className="ticketHandoffField">
            <span>随单产物{files.length ? "" : " · 必填"}</span>
            <div className="ticketHandoffFiles">
              {files.map((file) => (
                <article key={file.id}>
                  <Paperclip size={13} />
                  <div><strong>{file.name}</strong><small>{file.meta}</small></div>
                  <button type="button" aria-label={`移除 ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}><X size={13} /></button>
                </article>
              ))}
              <button className="ticketHandoffUpload" type="button" onClick={() => fileRef.current?.click()}>
                <Upload size={14} />上传文件
              </button>
              {/* 撰写人自己写的文档没经过数字同事,系统里没有它的副本,只能从这儿进来 */}
              <input ref={fileRef} className="visuallyHidden" type="file" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
            </div>
          </div>

          <label className="ticketHandoffField">
            <span>说明</span>
            <textarea value={note} rows={3} placeholder="交接时想让对方先知道的事。驳回理由这类必须写清楚，它会留在流转记录里。" onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>

        <footer className="ticketHandoffFoot">
          <p>交接后这件事归 <strong>{assignee || "——"}</strong>{assigneeRole ? ` · ${assigneeRole}` : ""}，你在「全部状态」里还能查到它。</p>
          <div>
            <button className="secondaryButton compact" type="button" onClick={onClose}>取消</button>
            <button className="primaryButton compact" type="button" disabled={!ready} onClick={() => onSubmit({ title: title.trim(), kind, project, assignee, assigneeRole, note: note.trim(), attachments: files })}>确认交接</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
