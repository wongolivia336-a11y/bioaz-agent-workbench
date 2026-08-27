import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { ComposerAttachment } from "../lib/workbench/composerAttachments";

export type ModuleAvailability = "available" | "placeholder";
export type ModuleRunStatus = "active" | "completed";
/* 收件箱承载跨任务的正式文件流转，因此是独立路由；邮件上的行动请求才进入待办。 */
/* 没有独立的 tickets 路由:工单不再是一级入口,而是站内信点进去的下一级。
   一个门——第二个队列就是第二个会被忘记去看的地方。 */
export type WorkbenchRoute = "newTask" | "tasks" | "inbox" | "library" | "knowledgeBase" | "module" | "digitalTeam";

/* 容器类型。两者共用同一套实现（文件 + 助手 + 成员），只在「显示哪些 tab」
   和「默认可见性」上分叉。分成两类而不是共用「项目」一个词，是因为项目在
   CRO 对应一单客户委托，往后会长出委托方、合同号这些字段；资料空间没有
   这些，混在一起会留下一列永远为空的脏数据。 */
export type ProjectType = "client" | "library";

export type WorkbenchProject = {
  id: string;
  name: string;
  type: ProjectType;
};

export type WorkbenchTask = {
  id: string;
  title: string;
  project: string;
  moduleId: string;
  coworkerId: string;
  coworkerName: string;
  time: string;
  status: string;
  priority?: TaskPriority;
};

export type TaskPriority = "high" | "medium" | "low";

export type CoworkerDefinition = {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
};

export type SessionHistoryEntry = {
  id: string;
  role: "user" | "agent" | "process";
  text: string;
};

export type AgentSessionSnapshot = {
  moduleId: string;
  coworkerName: string;
  stageLabel: string;
  entries: SessionHistoryEntry[];
  facts: Array<{ label: string; value: string }>;
};

export type IntentDefinition = {
  id: string;
  label: string;
  examples: string[];
  keywords: RegExp;
  clarification?: string;
};

export type QuickStartDefinition = {
  id: string;
  label: string;
  prompt: string;
  icon: LucideIcon;
  availability?: ModuleAvailability;
};

export type StageDefinition = {
  id: string;
  label: string;
};

export type ComposerActionDefinition = {
  id: string;
  label: string;
};

export type ArtifactDefinition = {
  id: string;
  label: string;
  kind: string;
};

export type RequiredFileDefinition = {
  id: string;
  label: string;
  required: boolean;
};

export type ValidationRuleDefinition = {
  id: string;
  label: string;
};

export type AgentModuleSessionProps = {
  projectName: string;
  taskTitle: string;
  initialRequest?: string;
  /** 首轮请求随带的附件（目前只有邮件交接会带）。渲染成 chip，不要拼进正文。 */
  initialAttachments?: ComposerAttachment[];
  coworkers: CoworkerDefinition[];
  activeCoworkerId: string;
  onCoworkerChange: (coworkerId: string) => void;
  onRunStatusChange: (status: ModuleRunStatus) => void;
  onBackToNewTask: () => void;
  handoffNotice?: string;
  priorSessionSnapshots?: AgentSessionSnapshot[];
  /* 这条会话自己已经发生过的对话。跟 priorSessionSnapshots 不是一回事:
     那个是「上一位数字同事聊过的」,用于换人接手时摆前情;这个是本会话的历史,
     直接还原成消息——滚上去就看得到,而不是折在一个前情块里。 */
  initialHistory?: SessionHistoryEntry[];
  /* 那次会话已经收齐的参数(字段 id -> 取值)。跟 initialHistory 配套:
     光还原对话不够,右侧面板会停在「未开始」,而对话里写着「参数已齐全」——
     两边互相打脸。上下文要回来就得整个回来。 */
  initialFields?: Record<string, string>;
  onSessionSnapshotChange?: (snapshot: AgentSessionSnapshot) => void;
  /* 去报价后台走应用内跳转，不走 window.location——整页刷新会把当前这单报价冲掉，
     草稿也会卡在「读参数」和「抹参数」的竞态里。 */
  onOpenQuotationManagement?: (options?: QuotationManagementTarget) => void;
  /* 当前登录账号的岗位。QA 审核用它决定谁能落笔——撰写人端与审批人端是
     同一个 Session 的两种渲染，不是两个页面。其余 module 忽略即可。 */
  viewerRole?: "author" | "approver" | "owner";
  /* 当前登录账号的姓名。交接选择器要用它把自己从候选里去掉——
     交接的定义就是球换一只手，交给自己不是交接。 */
  viewerName?: string;
  /* 这一版是被退回来的。带着驳回理由和逐条批注回到原会话——
     只把人送回会话是不够的，**要改什么必须在眼前**，否则他还得切回站内信
     逐条读、记住哪几行、再切回来改，而那正是这套东西要消灭的来回。 */
  rework?: SessionRework;
  /** 这一轮返工落笔了。壳层据此把它从「这条任务被退回着」里摘掉——
   *  不摘的话切走再回来，卡又原样长回来，而事情早就做完了。 */
  onReworkResolved?: () => void;
  /* 把这一版交给下一棒。QA 的驳回和通过都走这里：驳回交回撰写人、通过交给
     负责人做最终确认与归档。载荷落成一张工单，不再是一封等人点发送的草稿。 */
  onHandoff?: (handoff: SessionHandoff) => void;
  /* 会话级结论（目前是 QA 的提交/通过/驳回）。必须由 shell 按任务保存：
     module 组件在切走再切回时会重新挂载，结论留在组件里就等于点完就没了，
     而"这一版审完了没有"恰恰是回到会话时第一个要看到的东西。 */
  sessionOutcome?: SessionOutcome;
  onSessionOutcomeChange?: (outcome: SessionOutcome) => void;
};

/**
 * 被退回来的一版。
 *
 * notes 用 unknown[] 而不是 QuoteNote[]：modules/types.ts 是壳与模块之间的契约层，
 * 让它 import 具体业务模块的数据类型会把依赖方向倒过来。消费方（DMPK 会话）
 * 自己断言成 QuoteNote[]——那本来就是它的领域。
 */
export type SessionRework = {
  /** 驳回时写的总判断。跟逐条批注不是一回事：一个是结论，一组是账。 */
  reason?: string;
  by: string;
  at: string;
  notes: unknown[];
  /** 被退回的那份产物，用于「查看退回的报价」。 */
  attachmentName?: string;
};
export type SessionOutcome = "submitted" | "approved" | "rejected" | null;

/**
 * 会话里把活交出去时留下的凭据。
 *
 * 这里原来是 MailDraft——生成一封预填邮件，等人过目再发。问题是那样一来
 * **交接存不存在，取决于有没有人记得点发送**：没点，这一版就悬在半空，
 * 系统里没有任何地方知道它在谁那儿。工单不需要被发送，状态一变它就存在了。
 */
export type SessionHandoff = {
  /** 下一棒是谁。名字匹配不上人也不影响工单成立，只是处理人显示为原样 */
  to: string;
  toRole?: string;
  title: string;
  note: string;
  kind: "qa-review" | "dmpk-quotation";
  /* 随单产物。一张不带东西的工单等于一句「你去处理一下」,接手的人还得回来问
     到底审什么——所以交接卡上写了「随单带上产物」,这里就必须真的带。 */
  attachments?: Array<{ id: string; name: string; meta: string }>;
};

export type QuotationManagementTarget = {
  business?: "root" | "dmpk";
  tab?: "prices" | "rules" | "parameters" | "templates";
  draft?: string;
};

export type AgentModuleDefinition = {
  moduleId: string;
  moduleName: string;
  taskType: string;
  availability: ModuleAvailability;
  suggestedCoworker: CoworkerDefinition;
  supportedIntents: IntentDefinition[];
  quickStarts: QuickStartDefinition[];
  stages: StageDefinition[];
  composerActions: ComposerActionDefinition[];
  artifacts: ArtifactDefinition[];
  requiredFiles: RequiredFileDefinition[];
  validationRules: ValidationRuleDefinition[];
  handoffNotes: string[];
  Session: ComponentType<AgentModuleSessionProps>;
};

export type IntentResolution = {
  module: AgentModuleDefinition | null;
  confidence: "matched" | "ambiguous" | "unmatched";
  clarification?: string;
};

export type ShellActionCard = {
  title: string;
  description?: string;
  content?: ReactNode;
};
