import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import type { ParseResult, PendingItem, SourceKind, SourceParser } from "../../lib/workbench/sources";
import type { DmpkField } from "./fields";

/**
 * DMPK 的来源解析器。
 *
 * 现在只有一个 mock，读什么格式都返回同一单——beta3 上那份已脱敏的
 * 「BB-001 食蟹猴 28 天 DRF/毒理试验」。演示要的是「传文件 → 看它怎么读的」
 * 这条路走通，不是真的解析 docx。所以 kinds 写全，第一步如实报格式，
 * 后面几步一样。接真解析、接 OCR 的时候，是往 dmpkSourceParsers 里
 * **再加一个**，不是改这个。
 *
 * 取值只落到现有的十四项上。
 * ----------------------------------------------------------------------
 * 这一单真实的形状比十四项大得多：7 个动物组、37 个采样事件、7 个分析方法、
 * 42 项委托范围。它们不进字段——模型不动。读到但没格子放的写进 facts，
 * 在「输入材料」面板里只读展示；人要核对时能看见，但不用替它们填表。
 */

const BB001_TITLE = "BB-001 食蟹猴 28 天 DRF/毒理试验（含单次给药 PK 卫星动物）";

const kindOpening: Record<SourceKind, string> = {
  docx: "Word 方案 · 12 页",
  pdf: "PDF 方案 · 12 页",
  xlsx: "Excel 表格 · 3 个工作表",
  image: "图片 · 版面识别为方案表格",
  text: "文本 · 方案正文",
  unknown: "未知格式",
};

function bb001(attachment: ComposerAttachment, kind: SourceKind): ParseResult {
  return {
    sourceId: attachment.id,
    sourceLabel: attachment.label,
    kind,
    role: "protocol",
    title: BB001_TITLE,
    steps: [
      { id: "kind", title: "判断文档类型", result: `${kindOpening[kind]} → 按 DMPK/TOX 报价读取`, anchor: "文件属性", tech: `kind=${kind}  classifier=source-role/v2  role=protocol  confidence=0.93` },
      { id: "structure", title: "识别文档结构", result: "6 节 · 4 张表", anchor: "目录", tech: "layout=heading-tree  sections=6  tables=4" },
      { id: "overview", title: "提取实验概览", result: "毒理 · 28 天 · 食蟹猴 · 7 队列 / 11 只", anchor: "§1 实验设计", tech: "extractor=study-overview  fields=6  confidence=0.91" },
      { id: "groups", title: "提取动物分组", result: "7 组（4 核心 + 3 卫星）· IV infusion", anchor: "表 2 分组与给药", tech: "extractor=dose-groups  rows=7  dosing=Q1W×3 / single" },
      { id: "sampling", title: "提取采样计划", result: "37 个采样事件 · 479 份", anchor: "表 3、表 4", tech: "extractor=sampling-events  events=37  specimens=479  dedupe=timepoint" },
      { id: "methods", title: "提取分析方法", result: "7 个分析物 · 其中 3 个平台原文列了两种", anchor: "§4 生物分析", tech: "extractor=bioanalysis  analytes=7  ambiguous_platform=3" },
      { id: "map", title: "映射到报价参数", result: "识别 11 项 · 待确认 2 项 · 缺 1 项", tech: "mapper=dmpk-fields/v1  matched=11  confirm=2  missing=1" },
      { id: "catalog", title: "核对价目", result: "42 项委托 · 36 项可计价 · 6 项无价目", anchor: "标准价格 v1.0.13", tech: "catalog=pt_2026_q3  priced=36  no_catalog=6" },
    ],
    /* 每组 2 只 / 1 只、平台 ELISA / LC-MS/MS 这两项原文有歧义，不猜，进 pending。
       报价区域原文没写，也进 pending，但它是普通的「缺」。 */
    patch: {
      assayType: "TOX",
      molecule: "抗体",
      species: "食蟹猴",
      groupCount: "7",
      cycle: "4 周",
      compoundType: "抗体",
      sampleType: "血清",
      bloodPoints: "16",
      analyteCount: "7",
      format: "Excel",
      language: "中文",
    },
    facts: [
      {
        id: "groups",
        label: "动物分组",
        summary: "7 组 · 11 只 · IV infusion",
        brief: "7 组动物",
        anchor: "表 2",
        items: [
          "1 组 核心 对照载体 · 2 只 · Q1W×3",
          "2 / 3 / 4 组 核心 · 3 / 10 / 30 mg/kg · 各 2 只 · Q1W×3",
          "2 / 3 / 4 组 卫星 · 同剂量 · 各 1 只 · Day 1 单次",
        ],
      },
      {
        id: "sampling",
        label: "采样事件",
        summary: "37 项 · 479 份（按时点去重）",
        brief: "37 个采样事件",
        anchor: "表 3、表 4",
        items: [
          "ADA 留样 · 核心 5 点 / 卫星 4 点",
          "临床病理 · 6 点 · 血清生化 / 血液学 / 凝血 / 尿液",
          "细胞因子 · 核心 21 点 / 卫星 7 点",
          "TK 毒代 · 16 点 · 4 个核心组各自采集",
          "卫星 PK · 11 点 · D1 丰富采样 + 尾部",
          "免疫分型全血 · 4 点（声明 16 份，推导 8 份）",
          "终末解剖标准组织 · 福尔马林固定",
        ],
      },
      {
        id: "methods",
        label: "分析方法",
        summary: "7 个分析物 · Non-GLP · 方法开发 + 样品检测",
        brief: "7 个分析方法",
        anchor: "§4",
        items: [
          "dpADC 完整双载荷 · 平台待定",
          "游离 IMQ · LC-MS/MS",
          "游离 MMAF · LC-MS/MS",
          "spADC-IMQ · 平台待定",
          "spADC-MMAF · 平台待定",
          "Total mAb · Generic ELISA",
          "ADA · ELISA 筛选、确证、滴度",
        ],
      },
      {
        id: "scope",
        label: "委托范围",
        summary: "42 项 · PK/TK、TOX、ADA 三个工作包",
        anchor: "§2–§5",
      },
    ],
    pending: [
      {
        id: "animals-per-group",
        kind: "confirm",
        fieldId: "animalsPerGroup",
        label: "每组动物数",
        detail: "核心组每组 2 只、卫星组每组 1 只，两种口径并存，请确认按哪个计",
        options: ["2", "1"],
        anchor: "表 2",
      },
      {
        id: "platform",
        kind: "confirm",
        fieldId: "method",
        label: "分析方法",
        detail: "dpADC / spADC-IMQ / spADC-MMAF 可由 ELISA 或 LC-MS/MS 检测，需选定平台",
        options: ["LC-MS/MS", "ELISA"],
        anchor: "§4 生物分析",
      },
      {
        id: "region",
        kind: "missing",
        fieldId: "region",
        label: "报价区域",
        detail: "原文没有写报价区域",
      },
      ...["对照核心组", "2 组核心", "3 组核心", "4 组核心"].map<PendingItem>((group, index) => ({
        id: `catalog-immuno-${index}`,
        kind: "catalog",
        label: `${group}免疫分型全血采血`,
        detail: "临床病理或免疫检测采血，当前未发布适用公式；不能套 PK / TK / ADA 价",
        anchor: "表 4",
      })),
      { id: "catalog-cytokine", kind: "catalog", label: "细胞因子检测", detail: "当前没有精确覆盖 10-plex 细胞因子检测的价目" },
      { id: "catalog-flow", kind: "catalog", label: "流式检测", detail: "当前没有精确覆盖免疫分型 Panel A / B 的价目" },
    ],
  };
}

export const dmpkSourceParsers: SourceParser[] = [
  {
    id: "dmpk-protocol-mock",
    kinds: ["docx", "pdf", "xlsx", "image", "text", "unknown"],
    parse: bb001,
  },
];

/**
 * 把待确认项写回字段：候选排到选项最前面，hint 写上原文怎么说的。
 *
 * 只动 options 的顺序和 hint，不收窄选项——这两个属性 ParamField 本来就有。
 * 收窄的话，往后点铅笔改这一项，只剩原文那两个可选，而原文并不是词表。
 */
export function applyPendingToFields(fields: DmpkField[], pending: PendingItem[]): DmpkField[] {
  return fields.map((field) => {
    const item = pending.find((entry) => entry.kind === "confirm" && entry.fieldId === field.id);
    if (!item?.options?.length) return field;
    const rest = (field.options ?? []).filter((option) => !item.options!.includes(option));
    return { ...field, options: [...item.options, ...rest], hint: `原文：${item.detail}` };
  });
}
