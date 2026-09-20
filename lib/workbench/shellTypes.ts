import type { TaskPriority, WorkbenchTask } from "../../modules/types";

export type PinItem = {
  id: string;
  type: "project" | "task";
  title: string;
  project?: string;
  moduleId?: string;
  coworkerId?: string;
  coworkerName?: string;
  time?: string;
  status?: string;
  priority?: TaskPriority;
};

export type KnowledgeFile = {
  id: string;
  title: string;
  project: string;
  space: "projects" | "rules";
  kind: string;
  business: string;
  owner: string;
  updated: string;
  status: string;
  agentReady: boolean;
  folderId?: string;
  /* 解析状态只在偏离预期时才占用户注意力：成功什么都不显示，解析中要显示
     （否则用户传完就问，助手说没找到，他会以为 AI 不行），失败必须显示并
     给重试（否则这份文件是死的，没人知道为什么查不到它）。 */
  parseState?: "parsing" | "failed";
  /* 产物是哪条任务生成的（beta5 数据中枢「产物」tab 的「来源会话」那一列）。
     只有任务产物有；人传上来的资料没有来源任务。 */
  sourceTaskId?: string;
  sourceTask?: string;
};

/** 数据中枢里算「产物」的文件种类——由任务生成的，不是人传上来的。 */
export const ARTIFACT_KINDS = ["交付产物", "报告图表", "审核记录", "计算依据"] as const;
export const isArtifactFile = (file: Pick<KnowledgeFile, "kind">) => (ARTIFACT_KINDS as readonly string[]).includes(file.kind);

export type LibraryFolder = {
  id: string;
  name: string;
  project: string;
  pinned: boolean;
};

export type LibraryView = "overview" | "inputs" | "outputs" | "folder" | "trash";

export type TaskCollection = {
  actionRequired: WorkbenchTask[];
  all: WorkbenchTask[];
};
