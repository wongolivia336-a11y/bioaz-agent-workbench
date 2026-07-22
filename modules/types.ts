import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ModuleAvailability = "available" | "placeholder";
export type ModuleRunStatus = "active" | "completed";
export type WorkbenchRoute = "newTask" | "tasks" | "library" | "module" | "projectDashboard";

export type WorkbenchProject = {
  id: string;
  name: string;
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
};

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
  coworkers: CoworkerDefinition[];
  activeCoworkerId: string;
  onCoworkerChange: (coworkerId: string) => void;
  onRunStatusChange: (status: ModuleRunStatus) => void;
  onBackToNewTask: () => void;
  handoffNotice?: string;
  priorSessionSnapshots?: AgentSessionSnapshot[];
  onSessionSnapshotChange?: (snapshot: AgentSessionSnapshot) => void;
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
