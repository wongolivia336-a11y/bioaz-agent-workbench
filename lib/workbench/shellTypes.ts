import type { WorkbenchTask } from "../../modules/types";

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
};

export type TaskCollection = {
  actionRequired: WorkbenchTask[];
  all: WorkbenchTask[];
};
