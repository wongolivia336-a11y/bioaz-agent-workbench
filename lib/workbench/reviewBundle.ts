import type { QuotePaperData } from "./quotePaperFromLines";

/**
 * 随工单带给审核人的那一包：纸面 + 每项参数的原文依据 + 这一版改过什么。
 *
 * P0 工程方案第五层点名：审核人要看的是**同一份草稿**的原文依据、参数变更和计算明细，
 * 不是只有一张纸。原来交接只带两个文件名，审核画布拿固定件顶着——审核人批的
 * 和撰写人算的不是一份东西。现在会话在交出去那一下把三样打成一包挂在工单上，
 * 画布有包就读包、没包（老工单、手动开的单）照旧用固定件。
 *
 * 放在 lib 而不是 modules/types.ts：工单（lib/workbench/ticketData）和会话契约
 * （modules/types）都要引它，lib 是两者共同的下层。
 */

export type ReviewEvidence = {
  /** 参数 id，跟纸面上「f-<id>」那个锚点对得上 */
  id: string;
  label: string;
  value: string;
  /**
   * document  从材料里读的，带位置和原句
   * manual    人盖掉了原文（original 里是原句和原值）
   * sentence  人在对话 / 参数卡上给的，没有原文
   * derived   系统按检测类型算出来的（不适用）
   */
  kind: "document" | "manual" | "sentence" | "derived";
  sourceLabel?: string;
  anchor?: string;
  quote?: string;
  /** manual 时：原文为 X，已改为 Y */
  original?: { value: string; anchor: string; quote: string; sourceLabel: string };
  /** 文件认出来的还没有人点过头 */
  unconfirmed?: boolean;
};

export type ReviewChange = {
  id: string;
  at: string;
  by: string;
  kind: "price" | "adjustment" | "package" | "field" | "version";
  what: string;
  detail?: string;
};

export type ReviewBundle = {
  paper?: QuotePaperData;
  /** 读过哪几份材料 */
  sources: Array<{ label: string; title: string }>;
  evidence: ReviewEvidence[];
  changes: ReviewChange[];
};
