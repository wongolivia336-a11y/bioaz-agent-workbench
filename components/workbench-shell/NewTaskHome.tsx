"use client";

import { Check, ChevronDown, Folder, MessageSquare, Send } from "lucide-react";
import { type ReactNode, useState } from "react";
import { projectOptions } from "../../lib/workbench/mockWorkspace";
import type { CoworkerDefinition } from "../../modules/types";
import { DispatchConfirmCard } from "./BioAZHelper";
import { useDismissableLayer } from "./useDismissableLayer";

export type QuickStartItem = { id: string; label: string; prompt: string; icon: ReactNode; availability?: "available" | "placeholder" };

type Props = {
  conversationStarted: boolean;
  project: string | null;
  text: string;
  clarification: { request: string; question: string } | null;
  pendingRequest: string | null;
  pendingTaskType: string | null;
  suggestedCoworker: CoworkerDefinition | null;
  coworkers: CoworkerDefinition[];
  quickStarts: QuickStartItem[];
  onProjectChange: (project: string) => void;
  onTextChange: (value: string) => void;
  onSubmit: () => void;
  onQuickStart: (id: string) => void;
  onCoworkerChange: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function NewTaskHome(props: Props) {
  const request = props.clarification?.request ?? props.pendingRequest;
  const helperMessage = props.clarification?.question
    ?? (props.pendingRequest && props.suggestedCoworker
      ? `我建议将这项任务分派给${props.suggestedCoworker.name}，请在下方确认。`
      : "请补充你希望完成的工作，我会识别任务并推荐合适的数字同事。");

  return <section className={`newTaskHome ${props.conversationStarted ? "isConversation" : ""}`}>
    {!props.conversationStarted ? <div className="newTaskIntro">
      <span className="newTaskMark"><img src="/logo/bioaz-logo.svg" alt="BioAZ" /></span>
      <h1>今天要处理什么？</h1>
      <div className="taskExampleGrid">{props.quickStarts.slice(0, 4).map((item) => <button type="button" disabled={item.availability === "placeholder"} key={item.id} onClick={() => props.onQuickStart(item.id)}>
        <span className="taskExampleIcon">{item.icon}</span>
        <span className="taskExampleCopy"><strong>{item.label}</strong><small>{item.availability === "placeholder" ? "即将接入" : "直接开始"}</small></span>
      </button>)}</div>
    </div> : <div className="helperConversationCanvas" aria-live="polite">
      <div className="helperConversationInner">
        {request ? <div className="helperUserMessage"><span>{request}</span></div> : null}
        <div className="helperAgentMessage"><img src="/logo/bioaz-logo.svg" alt="" /><div><strong>BioAZ Helper</strong><p>{helperMessage}</p></div></div>
      </div>
    </div>}
    <div className="newTaskComposerDock">
      {!props.conversationStarted ? <div className="newTaskWelcomePrompt"><img src="/logo/bioaz-logo.svg" alt="" /><span>{props.project ? `你想在“${props.project}”中完成什么任务？` : "描述任务，或先选择所属项目。"}</span></div> : null}
      {props.pendingRequest && props.suggestedCoworker ? <DispatchConfirmCard taskType={props.pendingTaskType ?? "待确认任务"} coworker={props.suggestedCoworker} coworkers={props.coworkers.filter((item) => item.id !== "bioaz-helper")} project={props.project ?? "临时任务"} onCoworkerChange={props.onCoworkerChange} onConfirm={props.onConfirm} onCancel={props.onCancel} /> : null}
      <ProjectSelector project={props.project} onChange={props.onProjectChange} />
      <div className="newTaskComposer workbenchComposer"><textarea value={props.text} onChange={(event) => props.onTextChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); props.onSubmit(); } }} placeholder="描述你要完成的任务..." rows={2} /><button className="sendIconButton" type="button" onClick={props.onSubmit} disabled={!props.text.trim()} aria-label="发送"><Send size={18} /></button></div>
    </div>
  </section>;
}

function ProjectSelector({ project, onChange }: { project: string | null; onChange: (project: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`projectSelector ${open ? "isOpen" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Folder size={15} /><span>{project ?? "选择项目"}</span><ChevronDown size={14} /></button>{open ? <div className="projectSelectorMenu">{projectOptions.map((option) => <button type="button" className={project === option ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option === "临时任务" ? <MessageSquare size={15} /> : <Folder size={15} />}{option}</span>{project === option ? <Check size={14} /> : null}</button>)}</div> : null}</div>;
}
