"use client";

import { ArrowUpRight, Check, ChevronDown, CircleAlert, Folder, Send, Settings2 } from "lucide-react";
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { CoworkerDefinition } from "../../modules/types";
import { LogoAwakening } from "../hero/LogoAwakening";
import { OverviewMotif } from "../hero/OverviewMotif";
import { RoleMotif } from "../hero/RoleMotif";
import { SpaceMark } from "../hero/SpaceMark";
import { ActionCard } from "../ui";
import { DispatchConfirmCard } from "./BioAZHelper";
import { CoworkerSelector } from "./CoworkerSelector";
import { SpaceCoworkerDialog } from "./SpaceCoworkerDialog";
import { MessageAttachments, WorkbenchComposer } from "./WorkbenchComposer";
import { useDismissableLayer } from "./useDismissableLayer";

export type QuickStartItem = {
  id: string; label: string; prompt: string; icon: ReactNode; availability?: "available" | "placeholder"; moduleId?: string; coworkerId?: string;
  /** 这条流程是哪位数字同事的——空间首页上卡片就是「本空间的专家」，名字写在卡上 */
  coworkerName?: string;
  /** 空间首页 hover 时那张介绍卡念的：做什么、分几步、交出什么。全局首页不用。 */
  intro?: { description: string; stages: string[]; artifacts: string[] };
};

/** 空间首页那条计数：这个空间里有多少文件、产物、任务。 */
export type SpaceStats = { files: number; artifacts: number; tasks: number };

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
  /* 进了某个空间时才有：空间首页 = 全局首页 + 这两样。
     没进空间（全局首页）不传，页面跟原来一模一样。 */
  spaceStats?: SpaceStats | null;
  /** 空间是客户委托还是资料空间——顶上那枚标签写的。 */
  spaceKind?: "client" | "library";
  onOpenSpaceFiles?: () => void;
  /** 点「产物」落到数据中枢里这个空间的「任务产物」那一道，不是文件总览。 */
  onOpenSpaceArtifacts?: () => void;
  /** 点「任务」：把侧栏里这个空间的树展开——任务本来就在那儿，不另开一页。 */
  onOpenSpaceTasks?: () => void;
  /* 空间首页眉题旁那颗「配置专家」：跟侧栏 … 菜单里的「设置空间专家」是同一张弹窗。
     三样都传了才显示——全局首页没有"本空间"，也就没有这颗。 */
  spaceCoworkerOptions?: CoworkerDefinition[];
  spaceCoworkerIds?: string[];
  onSetSpaceCoworkers?: (ids: string[]) => void;
  projectOptions: string[];
  projectNotice: string | null;
  onProjectChange: (project: string) => void;
  onTextChange: (value: string) => void;
  /** 随这句话一起发出去的附件。壳层要把它们带进会话——传一份方案再让人到会话里再传一次，是明知故问。 */
  onSubmit: (attachments: ComposerAttachment[]) => void;
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
  const [coworkersOpen, setCoworkersOpen] = useState(false);
  const request = props.clarification?.request ?? props.pendingRequest;
  const helperMessage = props.clarification?.question
    ?? (props.pendingRequest && props.suggestedCoworker
      ? `我建议将这项任务分派给${props.suggestedCoworker.name}，请在下方确认。`
      : "请补充你希望完成的工作，我会识别任务并推荐合适的数字同事。");

  /* 分时高亮：项目是发送的前置条件，没选之前它是全屏最亮的元素，
     选完就退成安静的灰，焦点交给输入框。任何一刻只有一个东西最亮。 */
  const needsProject = !props.conversationStarted && !props.project;
  /* 这一页此刻是空间首页（从侧栏进了某个空间），不是"先选空间"的全局首页。
     两者共用一份骨架，差别只在：主角是空间不是 logo、没有空间选择器、多一条概览。 */
  const isSpaceHome = !props.conversationStarted && Boolean(props.project && props.spaceStats);
  const canConfigureCoworkers = isSpaceHome && Boolean(props.spaceCoworkerOptions && props.spaceCoworkerIds && props.onSetSpaceCoworkers);

  const submit = () => {
    if (!props.text.trim()) return;
    // 没选项目时 shell 只会弹提示、不会真的发出去，chip 要留在原地
    if (props.project) {
      setSentAttachments(attachments);
      setAttachments([]);
    }
    props.onSubmit(props.project ? attachments : []);
  };

  return <section className={`newTaskHome introSequenceStarted ${props.conversationStarted ? "introSequenceSettled isConversation" : ""}`}>
    {!props.conversationStarted ? <div className={`newTaskIntro ${isSpaceHome ? "isSpaceHome" : ""}`}>
      {/* 主角：全局首页是 BioAZ（logo），空间首页是这个空间（插画 + 一枚标签）。 */}
      {isSpaceHome ? (
        <>
          <SpaceMark />
          <span className="spaceKindChip">
            {props.spaceKind === "library" ? "资料空间" : "客户空间"}
            {props.spaceStats?.tasks ? <em>· {props.spaceStats.tasks} 个任务</em> : null}
          </span>
        </>
      ) : <LogoAwakening />}
      <div className="newTaskHeading">
        {/* 原来这里还有一行 BIOAZ AGENT WORKBENCH 的 eyebrow，
            和左上角侧边栏的字标重复，删掉后标题区从三层收到两层 */}
        {/* 进了空间，标题就说这个空间——这一页此时是空间首页（beta5 点空间进的那个入口），
            不再是"先选项目"的全局首页。 */}
        {isSpaceHome ? (
          <>
            {/* 空间名在顶栏面包屑里，这儿不再念一遍——念了 h1 会折成两行。 */}
            <h1>要在这个空间里推进哪项工作？</h1>
            <p>从这个空间的专家开始，或直接描述任务。任务和产物都留在这个空间里。</p>
          </>
        ) : (
          <>
            <h1>今天要推进哪项工作？</h1>
            <p>描述目标或从常用流程开始。任务会保留在所属空间中，过程与产物均可追溯。</p>
          </>
        )}
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
        {/* 空间首页上这一组卡片就是「本空间的专家」，给它一个名字——四张卡和下面的概览
            才分得出谁是动作、谁是说明。全局首页照旧不写：那里的卡是流程，不是谁的。 */}
        {isSpaceHome ? (
          <div className="quickStartEyebrowRow" style={{ "--quick-start-count": Math.min(props.quickStarts.length, 4) } as CSSProperties}>
            <span className="quickStartEyebrow">本空间的专家</span>
            {/* 专家是这个空间可以配的——配置的门就开在专家旁边，不用回侧栏找那个 … 菜单。 */}
            {canConfigureCoworkers ? (
              <button type="button" className="quickStartConfigure" onClick={() => setCoworkersOpen(true)}>
                <Settings2 size={12} aria-hidden="true" />配置专家
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="taskExampleGrid" style={{ "--quick-start-count": Math.min(props.quickStarts.length, 4) } as CSSProperties}>{props.quickStarts.slice(0, 4).map((item) => {
          const placeholder = item.availability === "placeholder";
          return <ActionCard density="default" data-ability={item.id} data-dimmed={pending?.id === item.id ? "true" : undefined} disabled={placeholder} key={item.id} onClick={(event) => {
            if (props.project) { props.onQuickStart(item.id); return; }
            /* 量下这张卡此刻在屏幕上的位置——面板要从这块矩形长开。 */
            const origin = (event.currentTarget as HTMLElement).getBoundingClientRect();
            setPending((current) => current?.id === item.id ? null : { id: item.id, origin });
          }}>
            {/* 右下角一张极淡的角色底纹——这张卡在讲什么活。图标在左上角管"是谁"，底纹管"做什么"。 */}
            <RoleMotif kind={item.moduleId ?? item.id} />
            <span className="taskExampleTop"><span className="taskExampleIcon">{item.icon}</span>{!placeholder ? <ArrowUpRight size={14} /> : null}</span>
            <span className="taskExampleCopy">
              <strong>{item.label}</strong>
              {/* 空间首页上卡片就是「本空间的专家」：小字写是谁，不另开一块专家列表——
                  一件事一个门。全局首页照旧写「启动标准流程」。 */}
              <small>{placeholder ? "即将接入" : isSpaceHome && item.coworkerName ? item.coworkerName : "启动标准流程"}</small>
            </span>
            {/* 空间首页 hover 时从卡顶长出来的介绍卡：这位专家做什么、分几步、交出什么。
                pointer-events: none——它只是说明，鼠标挪上去不该算 hover 到别的东西。
                在 button 里用 span 而不是 div：button 里只能放短语内容。 */}
            {isSpaceHome && !placeholder && item.intro ? (
              <span className="expertIntro" aria-hidden="true">
                <span className="expertIntroHead">
                  <RoleMotif kind={item.moduleId ?? item.id} />
                  <span className="expertIntroTitle"><strong>{item.coworkerName ?? item.label}</strong><small>{item.intro.description}</small></span>
                </span>
                <span className="expertIntroRow"><em>流程</em><span className="expertIntroChain">{item.intro.stages.map((stage, index) => <span key={stage} style={{ "--i": index } as CSSProperties}>{stage}</span>)}</span></span>
                {item.intro.artifacts.length ? <span className="expertIntroRow"><em>产出</em><span className="expertIntroList">{item.intro.artifacts.join(" · ")}</span></span> : null}
              </span>
            ) : null}
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
      {/* 空间首页上没有这两样：面包屑已经写着在哪个空间，选择器和那句「你想在 X 中完成什么」
          是把同一件事说三遍。要换空间去侧栏。 */}
      {!props.conversationStarted && !isSpaceHome ? <div className="newTaskWelcomePrompt">{props.project ? <span>{`你想在“${props.project}”中完成什么任务？`}</span> : null}</div> : null}
      {!props.conversationStarted && props.projectNotice ? <div className="newTaskProjectNotice" role="status"><CircleAlert size={14} /><span>{props.projectNotice}</span></div> : null}
      {props.pendingRequest && props.suggestedCoworker ? <DispatchConfirmCard taskType={props.pendingTaskType ?? "待确认任务"} coworker={props.suggestedCoworker} coworkers={props.coworkers.filter((item) => item.id !== "bioaz-helper")} onCoworkerChange={props.onCoworkerChange} onConfirm={props.onConfirm} onCancel={props.onCancel} /> : null}
      {!props.conversationStarted && !isSpaceHome ? <ProjectSelector project={props.project} options={props.projectOptions} invalid={Boolean(props.projectNotice)} onChange={props.onProjectChange} /> : null}
      {props.conversationStarted ? <CoworkerSelector coworkers={props.coworkers} activeCoworkerId={props.activeCoworkerId} onChange={props.onCoworkerChange} /> : null}
      <WorkbenchComposer
        className="newTaskComposer"
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        activeCoworkerId={props.conversationStarted ? props.activeCoworkerId : null}
        project={props.project}
        globalDrop
      >
        <textarea value={props.text} onChange={(event) => props.onTextChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={needsProject ? "先选择上方的空间，再描述任务" : "描述你要完成的任务..."} rows={1} />
        <button className="sendIconButton" type="button" onClick={submit} disabled={!props.text.trim()} aria-label="发送"><Send size={16} /></button>
      </WorkbenchComposer>
    </div>
    {/* 空间概览：这个空间里有什么。放在输入框**下面**——先动作、再输入、最后才是
        「里面有什么」，它是次要信息，不该夹在动作和输入之间。
        三张小卡跟上面的快捷卡同一副边框、圆角、字号，不再是一行裸文字。
        任务那张不跳转：侧栏那棵树就在旁边，点它只是把树展开。 */}
    {/* 概览比专家卡低一级，但不再是一条裸横条：三张矮卡，浅底、无图标方块、无边框重线，
        右侧各一张线稿说明这一格是什么。数字是主角，说明文字是配角，箭头 hover 才出来。
        第二版做成三张跟专家卡同款的小卡——七张卡一样重；第三版压成横条——又太没存在感。 */}
    {isSpaceHome && props.spaceStats ? (
      <section className="spaceOverview" aria-label="空间概览">
        <span className="spaceOverviewEyebrow">空间概览</span>
        <div className="spaceOverviewCards">
          <button type="button" className="spaceOverviewCard" data-kind="files" onClick={props.onOpenSpaceFiles} disabled={!props.onOpenSpaceFiles}>
            <OverviewMotif kind="files" />
            <span className="spaceOverviewNum"><strong>{props.spaceStats.files}</strong><span>文件</span></span>
            <small>方案、清单与往来材料</small>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
          <button type="button" className="spaceOverviewCard" data-kind="artifacts" onClick={props.onOpenSpaceArtifacts ?? props.onOpenSpaceFiles} disabled={!props.onOpenSpaceArtifacts && !props.onOpenSpaceFiles}>
            <OverviewMotif kind="artifacts" />
            <span className="spaceOverviewNum"><strong>{props.spaceStats.artifacts}</strong><span>产物</span></span>
            <small>任务交出的报价和报告</small>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
          <button type="button" className="spaceOverviewCard" data-kind="tasks" onClick={props.onOpenSpaceTasks} disabled={!props.onOpenSpaceTasks}>
            <OverviewMotif kind="tasks" />
            <span className="spaceOverviewNum"><strong>{props.spaceStats.tasks}</strong><span>任务</span></span>
            <small>在侧栏里展开这个空间</small>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </div>
      </section>
    ) : null}
    {coworkersOpen && canConfigureCoworkers && props.project ? (
      <SpaceCoworkerDialog
        title={props.project}
        options={props.spaceCoworkerOptions!}
        value={props.spaceCoworkerIds!}
        onSave={(ids) => { props.onSetSpaceCoworkers!(ids); setCoworkersOpen(false); }}
        onClose={() => setCoworkersOpen(false)}
      />
    ) : null}
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
    <div ref={ref} className="quickStartProjectPrompt" role="dialog" aria-label={`为「${label}」选择空间`}>
      <div className="quickStartPromptInner" ref={innerRef}>
        <p><strong>「{label}」放在哪个空间里？</strong><span>任务会保留在所属空间中，过程与产物均可追溯。</span></p>
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
  return <div ref={ref} className={`projectSelector ${open ? "isOpen" : ""} ${invalid ? "hasError" : ""}`}><button type="button" aria-expanded={open} aria-invalid={invalid} onClick={() => setOpen((value) => !value)}><Folder size={14} /><span>{project ?? "选择空间"}</span><ChevronDown size={14} /></button>{open ? <div className="projectSelectorMenu">{options.map((option) => <button type="button" className={project === option ? "active" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}><span><Folder size={14} />{option}</span>{project === option ? <Check size={14} /> : null}</button>)}</div> : null}</div>;
}
