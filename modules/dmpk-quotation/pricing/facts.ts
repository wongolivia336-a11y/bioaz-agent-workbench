/** 实验事实层：只描述真实发生的事，不带价目和金额。 */
export type AnimalGroupFact = {
  id: string;
  label: string;
  species: string;
  strain?: string;
  animalCount: number;
  role: "main" | "satellite";
  services: Array<"tox" | "tk" | "pk">;
};

export type CollectionEventFact = {
  id: string;
  label: string;
  kind: "blood" | "urine" | "tissue" | "other";
  timepoint: string;
  groupIds: string[];
  /** 该时点实际覆盖的动物数，不从总动物数猜。 */
  animalCount: number;
  /** 这次物理采集服务哪些任务；用于界面说明，不用于合并检测数量。 */
  purposes?: Array<"pk" | "tk" | "ba" | "ada">;
};

export type AssayTaskFact = {
  id: string;
  kind: "pk" | "tk" | "ba" | "ada" | "clinical-pathology";
  analyte: string;
  matrix: string;
  method: string;
  actualSampleQty: number;
  /** 多个任务可引用同一个事件；复用不等于合并检测数量。 */
  collectionEventId?: string;
};

export type DmpkStudyFacts = {
  groups: AnimalGroupFact[];
  collections: CollectionEventFact[];
  assayTasks: AssayTaskFact[];
};

export type FactIssue = {
  id: string;
  severity: "blocking" | "warning";
  message: string;
  taskId?: string;
};

export function validateStudyFacts(facts: DmpkStudyFacts): FactIssue[] {
  const issues: FactIssue[] = [];
  const groupIds = new Set(facts.groups.map((group) => group.id));
  const collectionIds = new Set(facts.collections.map((event) => event.id));

  for (const group of facts.groups) {
    if (!Number.isFinite(group.animalCount) || group.animalCount <= 0) {
      issues.push({ id: `group-count-${group.id}`, severity: "blocking", message: `${group.label}缺少有效动物数` });
    }
  }
  for (const event of facts.collections) {
    if (!event.groupIds.length || event.groupIds.some((id) => !groupIds.has(id))) {
      issues.push({ id: `collection-group-${event.id}`, severity: "blocking", message: `${event.label}引用了不存在的实验组` });
    }
  }
  for (const task of facts.assayTasks) {
    if (task.collectionEventId && !collectionIds.has(task.collectionEventId)) {
      issues.push({ id: `task-collection-${task.id}`, severity: "blocking", taskId: task.id, message: `${task.id}引用了不存在的采集事件` });
    }
    if (!Number.isFinite(task.actualSampleQty) || task.actualSampleQty <= 0) {
      issues.push({ id: `task-samples-${task.id}`, severity: "blocking", taskId: task.id, message: `${task.id}没有实际送检样本，不应生成收费行` });
    }
  }
  return issues;
}

export type CollectionChargeDraft = {
  id: string;
  eventId: string;
  service: string;
  actualQty: number;
  unit: "次";
  taskIds: string[];
};

/**
 * 一次物理采集只生成一条采集费；PK/TK/BA/ADA 检测任务仍各自保留。
 * 未绑定任务的采集事件也是实际服务，仍可生成收费行。
 */
export function buildCollectionChargeDrafts(facts: DmpkStudyFacts): CollectionChargeDraft[] {
  return facts.collections.map((event) => ({
    id: `collection-${event.id}`,
    eventId: event.id,
    service: event.label,
    actualQty: event.animalCount,
    unit: "次",
    taskIds: facts.assayTasks.filter((task) => task.collectionEventId === event.id).map((task) => task.id),
  }));
}

/** 同一动物跨 TOX/TK/PK 只进入一次动物使用量。 */
export function totalUniqueAnimals(facts: DmpkStudyFacts): number {
  return facts.groups.reduce((total, group) => total + Math.max(0, group.animalCount), 0);
}
