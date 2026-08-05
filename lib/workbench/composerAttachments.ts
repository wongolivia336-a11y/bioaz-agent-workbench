import { digitalTeamData, mcpData } from "./digitalTeamData";
import { formatFileSize, mockKbFiles } from "./knowledgeBaseData";
import { initialKnowledgeFiles } from "./mockWorkspace";

export type ComposerAttachmentKind = "file" | "skill" | "connector";
export type ComposerAttachmentOrigin = "local" | "library" | "knowledge";

export type ComposerAttachment = {
  id: string;
  kind: ComposerAttachmentKind;
  label: string;
  meta?: string;
  origin?: ComposerAttachmentOrigin;
  /** 当前数字同事本身不具备这项能力，chip 上会标「本次临时启用」 */
  borrowed?: boolean;
};

export type ComposerOption = {
  id: string;
  label: string;
  meta?: string;
  disabled?: boolean;
  disabledReason?: string;
};

/** label 为 null 表示不分组平铺（首页阶段还没确定数字同事时用这种形态） */
export type ComposerOptionGroup = {
  id: string;
  label: string | null;
  options: ComposerOption[];
};

const coworkerDisplayName = (coworkerId: string) =>
  digitalTeamData.find((coworker) => coworker.id === coworkerId)?.displayName ?? "当前数字同事";

/** 技能来自数字同事定义，按名称去重，避免同一能力在菜单里出现两次。 */
function allSkills() {
  const bucket = new Map<string, ComposerOption & { owners: string[] }>();
  digitalTeamData.forEach((coworker) => {
    coworker.skills.forEach((skill) => {
      const existing = bucket.get(skill.name);
      if (existing) {
        existing.owners.push(coworker.id);
        return;
      }
      bucket.set(skill.name, {
        id: skill.id,
        label: skill.name,
        meta: skill.status === "planned" ? `${skill.category} · 规划中` : skill.category,
        owners: [coworker.id],
      });
    });
  });
  return Array.from(bucket.values());
}

function split<T extends { owners: string[] }>(items: T[], coworkerId: string | null) {
  if (!coworkerId) return { owned: [] as T[], other: items };
  return {
    owned: items.filter((item) => item.owners.includes(coworkerId)),
    other: items.filter((item) => !item.owners.includes(coworkerId)),
  };
}

/**
 * 分组不过滤：确定数字同事之后「已具备」置顶、「其他可用」在下；
 * 还没确定同事时（首页）直接平铺，不谈归属。
 */
function grouped(
  items: Array<ComposerOption & { owners: string[] }>,
  coworkerId: string | null,
  flatLabel: string,
): ComposerOptionGroup[] {
  const strip = ({ owners: _owners, ...option }: ComposerOption & { owners: string[] }) => option;
  if (!coworkerId) return [{ id: "all", label: null, options: items.map(strip) }];
  const { owned, other } = split(items, coworkerId);
  const groups: ComposerOptionGroup[] = [];
  if (owned.length) groups.push({ id: "owned", label: `${coworkerDisplayName(coworkerId)}已具备`, options: owned.map(strip) });
  if (other.length) groups.push({ id: "other", label: `其他可用${flatLabel}`, options: other.map(strip) });
  return groups;
}

export function skillGroups(coworkerId: string | null): ComposerOptionGroup[] {
  return grouped(allSkills(), coworkerId, "技能");
}

export function connectorGroups(coworkerId: string | null): ComposerOptionGroup[] {
  const items = mcpData.map((connector) => ({
    id: connector.id,
    label: connector.name,
    meta: connector.status === "connected" ? `${connector.system} · ${connector.scope}` : connector.status === "pending" ? `${connector.system} · 待审批` : `${connector.system} · 未连接`,
    disabled: connector.status !== "connected",
    disabledReason: connector.status === "pending" ? "等待审批" : "未连接",
    owners: connector.usedBy,
  }));
  return grouped(items, coworkerId, "连接器");
}

export function libraryFileOptions(project: string | null): ComposerOption[] {
  return initialKnowledgeFiles
    .filter((file) => file.space === "projects")
    .filter((file) => !project || file.project === project)
    .map((file) => ({ id: `library-${file.id}`, label: file.title, meta: `${file.kind} · ${file.updated}` }));
}

export function knowledgeFileOptions(): ComposerOption[] {
  return mockKbFiles
    .filter((file) => file.vectorized)
    .map((file) => ({ id: `knowledge-${file.id}`, label: file.title, meta: `${file.business} · ${formatFileSize(file.size)}` }));
}

export function fileAttachmentFromUpload(file: File): ComposerAttachment {
  return {
    id: `local-${file.name}-${file.size}-${file.lastModified}`,
    kind: "file",
    label: file.name,
    meta: formatFileSize(file.size),
    origin: "local",
  };
}

/** 同一项重复选中时不叠加，保持 chip 与菜单勾选状态一致。 */
export function mergeAttachments(current: ComposerAttachment[], incoming: ComposerAttachment[]) {
  const seen = new Set(current.map((item) => item.id));
  const next = [...current];
  incoming.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    next.push(item);
  });
  return next;
}
