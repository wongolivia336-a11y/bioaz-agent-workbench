"use client";

import { ArrowUpRight, Check, ChevronDown, CircleAlert, Folder, Send } from "lucide-react";
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { CoworkerDefinition } from "../../modules/types";
import { LogoAwakening } from "../hero/LogoAwakening";
import { ActionCard } from "../ui";
import { DispatchConfirmCard } from "./BioAZHelper";
import { CoworkerSelector } from "./CoworkerSelector";
import { MessageAttachments, WorkbenchComposer } from "./WorkbenchComposer";
import { useDismissableLayer } from "./useDismissableLayer";

export type QuickStartItem = { id: string; label: string; prompt: string; icon: ReactNode; availability?: "available" | "placeholder"; moduleId?: string };

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
  /** project 是当场选的那个：state 要下一次渲染才生效，得直接递过去。 */
  onQuickStart: (id: string, project?: string) => void;
  onCoworkerChange: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function NewTaskHome(props: Props) {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [sentAttachments, setSentAttachments] = useState<ComposerAttachment[]>([]);
  /* 点了哪张卡、但还没定项目；origin 是那张卡当时的屏幕矩形，面板从它长开。 */
  const [pending, setPending] = useState<{ id: string; origin: DOMRect } | null>(null);
  const request = props.clarification?.request ?? props.pendingRequest;
  const helperMessage = props.clarification?.question
    ?? (props.pendingRequest && props.suggestedCoworker
      ? `我建议将这项任务分派给${props.suggestedCoworker.name}，请在下方确认。`
      : "请补充你希望完成的工作，我会识别任务并推荐合适的数字同事。");

  /* 分时高亮：项目是发送的前置条件，没选之前它是全屏最亮的元素，
     选完就退成安静的灰，焦点交给输入框。任何一刻只有一个东西最亮。 */
  const needsProject = !props.conversationStarted && !props.project;

  const submit = () => {
    if (!props.text.trim()) return;
    // 没选项目时 shell 只会弹提示、不会真的发出去，chip 要留在原地
    if (props.project) {
      setSentAttachments(attachments);
      setAttachments([]);
    }
    props.onSubmit();
  };

  return <section className={`newTaskHome introSequenceStarted ${props.conversationStarted ? "introSequenceSettled isConversation" : ""}`}>
    {!props.conversationStarted ? <div className="newTaskIntro">
      <LogoAwakening />
      <div className="newTaskHeading">
        {/* 原来这里还有一行 BIOAZ AGENT WORKBENCH 的 eyebrow，
            和左上角侧边栏的字标重复，删掉后标题区从三层收到两层 */}
        <h1>今天要推进哪项工作？</h1>
        <p>描述目标或从常用流程开始。任务会保留在所属项目中，过程与产物均可追溯。</p>
      </div>
      {/* 快捷入口不再因为「还没选项目」而变灰。
          ----------------------------------------------------------------
          上一版把这个前置条件做成了卡片的灰态，结果是：三张能点的卡跟那张
          「即将接入」长得一模一样（同底色、同标题色），唯一的区别是 1px 边框
          的实线/虚线——投影仪上根本看不见。而解释那句「需要先选择项目」是
          hover 才出现的：**后果常驻，原因藏着。**

          现在换个方向：不解释门槛，取消门槛。没选项目时点卡片，就地把项目
          问出来，选完直接开跑。卡片永远是活的，灰态只留给真正做不了的事。 */}
      <div className="quickStartZone">
        <div className="taskExampleGrid" style={{ "--quick-start-count": Math.min(props.quickStarts.length, 4) } as CSSProperties}>{props.quickStarts.slice(0, 4).map((item) => {
          const placeholder = item.availability === "placeholder";
          return <ActionCard density="default" data-ability={item.id} data-dimmed={pending?.id === item.id ? "true" : undefined} disabled={placeholder} key={item.id} onClick={(event) => {
            if (props.project) { props.onQuickStart(item.id); return; }
            /* 量下这张卡此刻在屏幕上的位置——面板要从这块矩形长开。 */
            const origin = (event.currentTarget as HTMLElement).getBoundingClientRect();
            setPending((current) => current?.id === item.id ? null : { id: item.id, origin });
          }}>
            <span className="taskExampleTop"><span className="taskExampleIcon">{item.icon}</span>{!placeholder ? <ArrowUpRight size={14} /> : null}</span>
            <span className="taskExampleCopy">
              <strong>{item.label}</strong>
              <small>{placeholder ? "即将接入" : "启动标准流程"}</small>
            </span>
          </ActionCard>;
        })}</div>
        {pending ? (
          <QuickStartProjectPrompt
            label={props.quickStarts.find((item) => item.id === pending.id)?.label ?? "这项流程"}
            origin={pending.origin}
            options={props.projectOptions}
            onPick={(option) => {
              props.onProjectChange(option);
              props.onQuickStart(pending.id, option);
              setPending(null);
            }}
            onClose={() => setPending(null)}
          />
        ) : null}
      </div>
    </div> : <div className="helperConversationCanvas" aria-live="polite">
      <div className="helperConversationInner">
        {request ? <div className="helperUserMessage"><span>{request}<MessageAttachments items={sentAttachments} /></span></div> : null}
        <div className="helperAgentMessage"><img src="/logo/bioaz-logo.svg" alt="" /><div><strong>BioAZ Helper</strong><p>{helperMessage}</p></div></div>
      </div>
    </div>}
    <div className={`newTaskComposerDock ${needsProject ? "needsProject" : ""}`}>
      {/* 未选项目时这一格留空：提示语原本写着「或先选择所属项目」，
          和下面那颗写着「选择项目」的按钮说的是同一件事。空槽保留，
          避免选完项目后多出一行把下面的东西顶下去。 */}
      {!props.conversationStarted ? <div className="newTaskWelcomePrompt">{props.project ? <span>{`你想在“${props.project}”中完成什么任务？`}</span> : null}</div> : null}
      {!props.conversationStarted && props.projectNotice ? <div className="newTaskProjectNotice" role="status"><CircleAlert size={14} /><span>{props.projectNotice}</span></div> : null}
      {props.pendingRequest && props.suggestedCoworker ? <DispatchConfirmCard taskType={props.pendingTaskType ?? "待确认任务"} coworker={props.suggestedCoworker} coworkers={props.coworkers.filter((item) => item.id !== "bioaz-helper")} onCoworkerChange={props.onCoworkerChange} onConfirm={props.onConfirm} onCancel={props.onCancel} /> : null}
      {!props.conversationStarted ? <ProjectSelector project={props.project} options={props.projectOptions} invalid={Boolean(props.projectNotice)} onChange={props.onProjectChange} /> : null}
      {props.conversationStarted ? <CoworkerSelector coworkers={props.coworkers} activeCoworkerId={props.activeCoworkerId} onChange={props.onCoworkerChange} /> : null}
      <WorkbenchComposer
        className="newTaskComposer"
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        activeCoworkerId={props.conversationStarted ? props.activeCoworkerId : null}
        project={props.project}
        globalDrop
      >
        <textarea value={props.text} onChange={(event) => props.onTextChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={needsProject ? "先选择上方的项目，再描述任务" : "描述你要完成的任务..."} rows={1} />
        <button className="sendIconButton" type="button" onClick={submit} disabled={!props.text.trim()} aria-label="发送"><Send size={16} /></button>
      </WorkbenchComposer>
    </div>
  </section>;
}

/**
 * 点了快捷入口、但还没定项目时，就地把项目问出来。
 *
 * 「就地」是字面意思：面板从你刚点的那张卡长出来
 * ----------------------------------------------------------------------
 * 这一屏原本的问题不是不好看，是**点了那张卡之后，人不知道刚才那一下有没有
 * 生效**。所以这里用 FLIP：先量出卡片此刻的矩形，把面板反算回那个位置和尺寸，
 * 再放它回到自己的终点——加上被点那张卡同时淡下去，因果关系就写在动作里了，
 * 不需要再补一句文案。
 *
 * 面板是绝对定位的浮层，所以底下的输入框一格都不会动。
 * 内容做等比反向缩放，否则文字会跟着被压扁。
 */
function QuickStartProjectPrompt({ label, origin, options, onPick, onClose }: {
  label: string;
  origin: DOMRect;
  options: string[];
  onPick: (project: string) => void;
  onClose: () => void;
}) {
  const ref = useDismissableLayer<HTMLDivElement>(true, onClose);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    const inner = innerRef.current;
    if (!node || !inner) return;

    /* 落点先算高低。默认跟卡片行顶边齐（-8px 让阴影探出来一点），但矮屏上
       这块面板会伸到输入框上——1366×700 实测压过去 17px。所以先问一句
       「下面还剩多少」，不够就整体上移，且不越过卡片行往上太多。
       这一步必须在量 FLIP 终点之前做完：终点变了，反算的起点也就错了。 */
    const zone = node.offsetParent as HTMLElement | null;
    const dock = document.querySelector<HTMLElement>(".newTaskComposerDock");
    if (zone && dock) {
      const zoneTop = zone.getBoundingClientRect().top;
      const room = dock.getBoundingClientRect().top - 12 - node.offsetHeight - zoneTop;
      node.style.top = `${Math.min(-8, room)}px`;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const to = node.getBoundingClientRect();
    if (!to.width || !to.height) return;
    const sx = origin.width / to.width;
    const sy = origin.height / to.height;

    /* 先钉在起点：关掉过渡，写上反算出来的形变。 */
    for (const [el, transform] of [[node, `translate(${origin.left - to.left}px, ${origin.top - to.top}px) scale(${sx}, ${sy})`], [inner, `scale(${1 / sx}, ${1 / sy})`]] as const) {
      el.style.transition = "none";
      el.style.transformOrigin = "top left";
      el.style.transform = transform;
      el.style.opacity = "0";
    }
    /* 读一次布局，把上面这一帧真正落下去；不读的话浏览器会把两次写合并，
       过渡从来不会发生。 */
    void node.offsetWidth;
    /* 再放手：过渡交回样式表，元素自己走回终点。 */
    for (const el of [node, inner]) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  return (
    <div ref={ref} className="quickStartProjectPrompt" role="dialog" aria-label={`为「${label}」选择项目`}>
      <div className="quickStartPromptInner" ref={innerRef}>
        <p><strong>「{label}」放在哪个项目里？</strong><span>任务会保留在所属项目中，过程与产物均可追溯。</span></p>
        <div className="quickStartProjectList">
          {options.map((option) => (
            <button type="button" key={option} onClick={() => onPick(option)}>
              <Folder size={14} aria-hidden="true" />{option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectSelector({ project, options, invalid, onChange }: { project: string | null; options: string[]; invalid: boolean; onChange: (project: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return <div ref={ref} className={`projectSelector ${open ? "isOpen" : ""} ${invalid ? "hasError" : ""}`}><button type="button" aria-expanded={open} aria-invalid={invalid} onClick={() => setOpen((value) => !value)}><Folder size={14} /><span>{project ?? "选择项目"}</span><ChevronDown size={14} /></button>{open ? <div className="projectSelectorMenu">{options.map((option) => <button type="button" className={project === option ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span><Folder size={14} />{option}</span>{project === option ? <Check size={14} /> : null}</button>)}</div> : null}</div>;
}
