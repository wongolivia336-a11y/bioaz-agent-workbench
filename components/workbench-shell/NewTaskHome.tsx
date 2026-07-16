"use client";

import { Check, ChevronDown, Folder, MessageSquare, Send } from "lucide-react";
import { type ReactNode, useState } from "react";
import { projectOptions } from "../../lib/workbench/mockWorkspace";
import type { CoworkerDefinition } from "../../modules/types";
import { DispatchConfirmCard } from "./BioAZHelper";
import { CoworkerSelector } from "./CoworkerSelector";
import { useDismissableLayer } from "./useDismissableLayer";

export type QuickStartItem = { id: string; label: string; prompt: string; icon: ReactNode; availability?: "available" | "placeholder" };

type Props = {
  project: string | null;
  text: string;
  clarification: { request: string; question: string } | null;
  pendingRequest: string | null;
  suggestedCoworker: CoworkerDefinition | null;
  coworkers: CoworkerDefinition[];
  activeCoworkerId: string;
  quickStarts: QuickStartItem[];
  onProjectChange: (project: string) => void;
  onTextChange: (value: string) => void;
  onSubmit: () => void;
  onActiveCoworkerChange: (id: string) => void;
  onCoworkerChange: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function NewTaskHome(props: Props) {
  return <section className="newTaskHome">
    <div className="newTaskIntro"><span className="newTaskMark"><img src="/logo/bioaz-logo.svg" alt="BioAZ" /></span><h1>今天要处理什么？</h1><div className="taskExampleGrid">{props.quickStarts.slice(0, 4).map((item) => <button type="button" disabled={item.availability === "placeholder"} key={item.id} onClick={() => props.onTextChange(item.prompt)}>{item.icon}<strong>{item.label}</strong>{item.availability === "placeholder" ? <small>即将接入</small> : null}</button>)}</div></div>
    <div className="newTaskComposerDock">
      <div className="newTaskIntentConversation">{props.clarification || props.pendingRequest ? <p>{props.clarification?.request ?? props.pendingRequest}</p> : null}<div><img src="/logo/bioaz-logo.svg" alt="" /><span>{props.clarification?.question ?? (props.pendingRequest && props.suggestedCoworker ? `我建议交给${props.suggestedCoworker.name}，请确认后开始任务。` : props.project ? `你想在“${props.project}”中完成什么任务？` : "你想完成什么任务？也可以先选择所属项目。")}</span></div></div>
      {props.pendingRequest && props.suggestedCoworker ? <DispatchConfirmCard coworker={props.suggestedCoworker} coworkers={props.coworkers.filter((item) => item.id !== "bioaz-helper")} project={props.project ?? "临时任务"} onCoworkerChange={props.onCoworkerChange} onConfirm={props.onConfirm} onCancel={props.onCancel} /> : null}
      <ProjectSelector project={props.project} onChange={props.onProjectChange} />
      <CoworkerSelector coworkers={props.coworkers} activeCoworkerId={props.activeCoworkerId} onChange={props.onActiveCoworkerChange} />
      <div className="newTaskComposer"><textarea value={props.text} onChange={(event) => props.onTextChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); props.onSubmit(); } }} placeholder="描述你要完成的任务..." rows={2} /><button type="button" onClick={props.onSubmit} disabled={!props.text.trim()} aria-label="发送"><Send size={18} /></button></div>
    </div>
  </section>;
}

function ProjectSelector({ project, onChange }: { project: string | null; onChange: (project: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`projectSelector ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Folder size={15} /><span>{project ?? "选择项目"}</span><ChevronDown size={14} /></button>{open ? <div className="projectSelectorMenu">{projectOptions.map((option) => <button type="button" className={project === option ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option === "临时任务" ? <MessageSquare size={15} /> : <Folder size={15} />}{option}</span>{project === option ? <Check size={14} /> : null}</button>)}</div> : null}</div>;
}
