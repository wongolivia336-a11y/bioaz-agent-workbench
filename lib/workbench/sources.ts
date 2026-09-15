import type { ComposerAttachment } from "./composerAttachments";

/**
 * 来源：上传进会话、要被「读」的东西。
 *
 * 为什么不直接改 ComposerAttachment
 * ----------------------------------------------------------------------
 * 附件是 composer 的概念——一个 chip，发出去就挂在气泡上。来源是解析的概念：
 * 它有格式（Word / PDF / 图片），有角色（是方案、是样品清单还是上一版报价），
 * 读完会留下一条轨迹和一批事实。两者一对一，但职责不同；把解析结果塞进
 * chip 上，肿瘤线、站内信、文件库里所有渲染 chip 的地方都得跟着认识这些字段。
 * 所以这里是**旁边加一层**：附件进来、来源出去，附件类型一个字不改。
 *
 * 多模态的口子就开在这一层
 * ----------------------------------------------------------------------
 * 现在传的是 docx，是个折中；往后是 PDF、图片、Excel，甚至一封邮件正文。
 * 它们的差别只在「怎么读」，读出来的东西是同一副形状（ParseResult）。
 * 所以格式判定、解析器、结果三样分开：
 *   - detectSourceKind   看文件名定格式，往后可以换成看 mime / 看内容
 *   - SourceParser       一种或几种格式的读法；接 OCR 就是再写一个 parser
 *   - parseSource        按格式挑 parser；没有能读的，也要留下一条「尚未接入」
 *                        的轨迹，而不是静默吞掉——人得知道它没读
 */

export type SourceKind = "docx" | "pdf" | "xlsx" | "image" | "text" | "unknown";

/** 这份东西在报价里扮演什么角色。由解析第一步判定，决定它喂给哪一段。 */
export type SourceRole = "protocol" | "sample-list" | "prior-quote" | "reference" | "unknown";

export const sourceKindLabels: Record<SourceKind, string> = {
  docx: "Word 文档",
  pdf: "PDF 文档",
  xlsx: "Excel 表格",
  image: "图片",
  text: "文本",
  unknown: "未知格式",
};

export const sourceRoleLabels: Record<SourceRole, string> = {
  protocol: "实验方案",
  "sample-list": "样品清单",
  "prior-quote": "上一版报价",
  reference: "参考资料",
  unknown: "待判定",
};

const kindByExtension: Record<string, SourceKind> = {
  doc: "docx", docx: "docx",
  pdf: "pdf",
  xls: "xlsx", xlsx: "xlsx", csv: "xlsx",
  png: "image", jpg: "image", jpeg: "image", webp: "image", heic: "image", gif: "image",
  txt: "text", md: "text",
};

export function detectSourceKind(attachment: ComposerAttachment): SourceKind {
  const match = attachment.label.toLowerCase().match(/\.([a-z0-9]+)$/);
  return (match && kindByExtension[match[1]]) || "unknown";
}

/**
 * 解析轨迹里的一步：做了什么、产出了什么、来源在哪。
 *
 * result 与 anchor 是这条轨迹跟「整理实验事实 × 30」的全部差别：
 * 前者说读出了几样东西，后者说从原文哪一节读的。两样都没有的步骤，
 * 对看的人来说等于没发生。
 */
export type ParseStep = {
  id: string;
  title: string;
  /** 这一步读出了什么。给人看的一句话，带数字。 */
  result?: string;
  /** 原文位置：§1 实验设计 / 表 2 / 第 3 页。 */
  anchor?: string;
  /** 技术详情那一层：parser、置信度之类。 */
  tech?: string;
};

/** 读到了、但现有参数模型里没有格子放的东西。只读展示，不进字段。 */
export type ParsedFact = {
  id: string;
  label: string;
  summary: string;
  /** 放进一句话里的说法：「7 组动物」「37 个采样事件」。没有就不进那句话。 */
  brief?: string;
  anchor?: string;
  items?: string[];
};

/**
 * 读完之后还悬着的事。四类，归属不同：
 *   missing  缺参数 —— 原文没写，人来填
 *   confirm  待确认 —— 原文写了但有歧义（列了两种平台），人来拍板
 *   price    待补价 —— 价目里没有，但人可以现场给一个
 *   catalog  无价目 —— 后台没维护，人在前台做不了；不进参数卡，进规则面板
 */
export type PendingKind = "missing" | "confirm" | "price" | "catalog";

export type PendingItem = {
  id: string;
  kind: PendingKind;
  label: string;
  detail: string;
  /** 能落到现有字段上的，写字段 id；落不到的（无价目）留空。 */
  fieldId?: string;
  /** confirm 时原文给出的候选。它们会排到该字段选项的最前面。 */
  options?: string[];
  anchor?: string;
};

export type ParseResult = {
  sourceId: string;
  sourceLabel: string;
  kind: SourceKind;
  role: SourceRole;
  /** 判定出来的标题，如「BB-001 食蟹猴 28 天 DRF/毒理试验」。 */
  title: string;
  steps: ParseStep[];
  /** 能落到现有字段上的取值。键是字段 id。 */
  patch: Record<string, string>;
  facts: ParsedFact[];
  pending: PendingItem[];
};

export type SourceParser = {
  id: string;
  kinds: SourceKind[];
  parse: (attachment: ComposerAttachment, kind: SourceKind) => ParseResult;
};

/** 没有 parser 能读时的结果：一步轨迹说明「没读」，其余全空。 */
function unsupportedResult(attachment: ComposerAttachment, kind: SourceKind): ParseResult {
  return {
    sourceId: attachment.id,
    sourceLabel: attachment.label,
    kind,
    role: "unknown",
    title: attachment.label,
    steps: [{
      id: "unsupported",
      title: "判断文档类型",
      result: `${sourceKindLabels[kind]} · 该格式的解析尚未接入`,
      tech: `kind=${kind}  parser=none`,
    }],
    patch: {},
    facts: [],
    pending: [],
  };
}

export function parseSource(attachment: ComposerAttachment, parsers: SourceParser[]): ParseResult {
  const kind = detectSourceKind(attachment);
  const parser = parsers.find((item) => item.kinds.includes(kind));
  return parser ? parser.parse(attachment, kind) : unsupportedResult(attachment, kind);
}

/* 只读文件类附件。技能、连接器也挂在 composer 上，但它们不是「要被读的东西」。 */
export function parseSources(attachments: ComposerAttachment[], parsers: SourceParser[]): ParseResult[] {
  return attachments.filter((item) => item.kind === "file").map((item) => parseSource(item, parsers));
}

/**
 * 多份来源合成一份取值：后读的盖前读的。
 * 顺序就是上传顺序——人把更新的那份放在后面，这是最不需要解释的规则。
 */
export function mergeParsePatches(results: ParseResult[]): Record<string, string> {
  return results.reduce<Record<string, string>>((patch, result) => ({ ...patch, ...result.patch }), {});
}
