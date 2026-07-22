"use client";

import { ArrowUpRight, Check, ChevronDown, CircleAlert, Folder, Plus, Send } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { CoworkerDefinition } from "../../modules/types";
import { LogoAwakening } from "../hero/LogoAwakening";
import { DispatchConfirmCard } from "./BioAZHelper";
import { CoworkerSelector } from "./CoworkerSelector";
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
  activeCoworkerId: string;
  quickStarts: QuickStartItem[];
  projectOptions: string[];
  projectNotice: string | null;
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

  return <section className={`newTaskHome introSequenceStarted ${props.conversationStarted ? "introSequenceSettled isConversation" : ""}`}>
    {!props.conversationStarted ? <div className="newTaskIntro">
      <LogoAwakening />
      <div className="newTaskHeading">
        <span>BioAZ Agent Workbench</span>
        <h1>今天要推进哪项工作？</h1>
        <p>描述目标或从常用流程开始。任务会保留在所属项目中，过程与产物均可追溯。</p>
      </div>
      <div className="taskExampleGrid">{props.quickStarts.slice(0, 4).map((item) => <button type="button" data-ability={item.id} disabled={item.availability === "placeholder"} key={item.id} onClick={() => props.onQuickStart(item.id)}>
        <span className="taskExampleTop"><span className="taskExampleIcon">{item.icon}</span>{item.availability !== "placeholder" ? <ArrowUpRight size={15} /> : null}</span>
        <span className="taskExampleCopy"><strong>{item.label}</strong><small>{item.availability === "placeholder" ? "即将接入" : "启动标准流程"}</small></span>
      </button>)}</div>
    </div> : <div className="helperConversationCanvas" aria-live="polite">
      <div className="helperConversationInner">
        {request ? <div className="helperUserMessage"><span>{request}</span></div> : null}
        <div className="helperAgentMessage"><img src="/logo/bioaz-logo.svg" alt="" /><div><strong>BioAZ Helper</strong><p>{helperMessage}</p></div></div>
      </div>
    </div>}
    <div className="newTaskComposerDock">
      {!props.conversationStarted ? <div className="newTaskWelcomePrompt"><span>{props.project ? `你想在“${props.project}”中完成什么任务？` : "描述任务，或先选择所属项目。"}</span></div> : null}
      {!props.conversationStarted && props.projectNotice ? <div className="newTaskProjectNotice" role="status"><CircleAlert size={14} /><span>{props.projectNotice}</span></div> : null}
      {props.pendingRequest && props.suggestedCoworker ? <DispatchConfirmCard taskType={props.pendingTaskType ?? "待确认任务"} coworker={props.suggestedCoworker} coworkers={props.coworkers.filter((item) => item.id !== "bioaz-helper")} onCoworkerChange={props.onCoworkerChange} onConfirm={props.onConfirm} onCancel={props.onCancel} /> : null}
      {!props.conversationStarted ? <ProjectSelector project={props.project} options={props.projectOptions} invalid={Boolean(props.projectNotice)} onChange={props.onProjectChange} /> : null}
      {props.conversationStarted ? <CoworkerSelector coworkers={props.coworkers} activeCoworkerId={props.activeCoworkerId} onChange={props.onCoworkerChange} /> : null}
      <div className="newTaskComposer workbenchComposer">
        <label className="composerAddButton" aria-label="上传文件"><Plus size={18} /><input type="file" multiple /></label>
        <textarea value={props.text} onChange={(event) => props.onTextChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); props.onSubmit(); } }} placeholder="描述你要完成的任务..." rows={1} />
        <button className="sendIconButton" type="button" onClick={props.onSubmit} disabled={!props.text.trim()} aria-label="发送"><Send size={18} /></button>
      </div>
    </div>
  </section>;
}

function ProjectSelector({ project, options, invalid, onChange }: { project: string | null; options: string[]; invalid: boolean; onChange: (project: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`projectSelector ${open ? "isOpen" : ""} ${invalid ? "hasError" : ""}`}><button type="button" aria-expanded={open} aria-invalid={invalid} onClick={() => setOpen((value) => !value)}><Folder size={15} /><span>{project ?? "选择项目"}</span><ChevronDown size={14} /></button>{open ? <div className="projectSelectorMenu">{options.map((option) => <button type="button" className={project === option ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span><Folder size={15} />{option}</span>{project === option ? <Check size={14} /> : null}</button>)}</div> : null}</div>;
}
