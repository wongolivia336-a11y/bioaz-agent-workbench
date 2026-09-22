import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";
import { looksLikeChat, type ParseResult, type PendingItem, type SourceKind, type SourceParser } from "../../lib/workbench/sources";
import type { DmpkField } from "./fields";

/**
 * DMPK 的来源解析器。
 *
 * 三个 mock，对着甲方 P0-1 点名的三类材料：
 *   方案（Word / PDF / PPT / Excel）→ beta3 上那份已脱敏的「BB-001 食蟹猴 28 天 DRF/毒理试验」
 *   截图（图片）                   → 一张给药分组表，OCR 出 7 行，只认得出跟分组有关的那几项
 *   聊天记录（文本）               → 客户和商务的几句话，认得出的是报价区域 / 语言 / 格式这类要求
 *
 * 三份读出来的东西**不一样**，这正是要演的：不同材料喂的是报价的不同段落，
 * 叠着传时每一格的来源指向真正提供它的那份。都不是真解析——接 docx 结构、
 * 接 OCR 的时候，是往 dmpkSourceParsers 里换或加一个，调用方不改。
 *
 * 每一项识别出来的值都带原句（patchSources）。
 * ----------------------------------------------------------------------
 * 「保留原文依据」不是轨迹里写一句「§1 实验设计」就完了：台账上「4 周」这一格，
 * 人要能点开看到原文写的是「28-day repeat-dose」。所以原句跟着值走，
 * 一格一句，不是一份材料一句。
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
  pptx: "PPT 方案 · 18 页",
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
    /* 一格一句。位置和原句都是给人核对用的，所以原句保留原文的语言和写法。 */
    patchSources: {
      assayType: { anchor: "§1 实验设计", quote: "研究类型：28 天重复给药剂量范围探索 / 毒理试验（DRF/TOX），含单次给药 PK 卫星动物。" },
      molecule: { anchor: "§1 实验设计", quote: "受试物 BB-001 为双载荷抗体偶联药物（IMQ + MMAF），生物制品初免。" },
      species: { anchor: "§1 实验设计", quote: "动物种属：食蟹猴（Macaca fascicularis），11 只。" },
      groupCount: { anchor: "表 2 分组与给药", quote: "共 7 个队列：1 组对照载体、2/3/4 组核心（3 / 10 / 30 mg/kg）、2/3/4 组卫星。" },
      cycle: { anchor: "§1 实验设计", quote: "观察期 28 天（Day 1 – Day 28），核心组 Q1W×3 给药。" },
      compoundType: { anchor: "§1 实验设计", quote: "受试物 BB-001 为双载荷抗体偶联药物（IMQ + MMAF）。" },
      sampleType: { anchor: "表 3 采样计划", quote: "TK / PK / ADA / 细胞因子样品均为血清；免疫分型为全血。" },
      bloodPoints: { anchor: "表 3 采样计划", quote: "核心组 TK：D1 及 D15 给药后丰富采样、D8 给药前谷浓度、D28 终末，共 16 个时点。" },
      analyteCount: { anchor: "§4 生物分析", quote: "分析物：dpADC、游离 IMQ、游离 MMAF、spADC-IMQ、spADC-MMAF、Total mAb、ADA，共 7 项。" },
      format: { anchor: "§6 报告与交付", quote: "报价以 Excel 形式提供，附计算明细。" },
      language: { anchor: "§6 报告与交付", quote: "报告语言：中文。" },
    },
    /* 读出来的事实按 P0 工程方案的「8 维提取 Schema」归类（dim 1–8），面板按它排。
       brief 只留三条——对话里那句「读到 7 组动物、37 个采样事件、7 个分析方法」照旧。 */
    facts: [
      {
        id: "animal",
        dim: 1,
        label: "动物",
        summary: "食蟹猴 · 雌雄各半 · Non-GLP",
        anchor: "§1 实验设计",
      },
      {
        id: "groups",
        dim: 2,
        label: "组别",
        summary: "4 核心（对照 + 低 / 中 / 高）+ 3 卫星 · IV",
        brief: "7 组动物",
        anchor: "表 2",
        items: [
          "1 组 核心 对照载体 · 2 只 · Q1W×3",
          "2 / 3 / 4 组 核心 · 3 / 10 / 30 mg/kg · 各 2 只 · Q1W×3",
          "2 / 3 / 4 组 卫星 · 同剂量 · 各 1 只 · Day 1 单次",
        ],
      },
      {
        id: "counts",
        dim: 3,
        label: "数目",
        summary: "11 只 · 核心 2 / 组 · 卫星 1 / 组",
        anchor: "表 2",
      },
      {
        id: "operations",
        dim: 4,
        label: "实验操作",
        summary: "给药 · 采血 · 临床病理 · 心电 · 眼科 · 剖检",
        anchor: "§3",
      },
      {
        id: "frequencies",
        dim: 5,
        label: "实验操作次数",
        summary: "Q1W×3 · TK 16 点 · PK 11 点 · 28 天",
        anchor: "表 3",
        items: [
          "ADA 留样 · 核心 5 点 / 卫星 4 点",
          "临床病理 · 6 点 · 血清生化 / 血液学 / 凝血 / 尿液",
          "细胞因子 · 核心 21 点 / 卫星 7 点",
          "TK 毒代 · 16 点 · 4 个核心组各自采集",
          "卫星 PK · 11 点 · D1 丰富采样 + 尾部",
          "免疫分型全血 · 4 点（声明 16 份，推导 8 份）",
        ],
      },
      {
        id: "scope",
        dim: 6,
        label: "检测项目",
        summary: "TK · PK · 临床病理 · 细胞因子 · ADA · 免疫分型",
        anchor: "§2–§5",
      },
      {
        id: "methods",
        dim: 7,
        label: "检测方法",
        summary: "LC-MS/MS ×2 · ELISA ×2 · 待定 ×3 · 流式",
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
          "免疫分型 Panel A / B · 流式细胞术",
        ],
      },
      {
        id: "sampling",
        dim: 8,
        label: "检测数量",
        summary: "37 采样事件 · 479 份 · 给药 27 次",
        brief: "37 个采样事件",
        anchor: "表 3、表 4",
        items: [
          "TK / PK 血清 · 8 只 × 16 点 + 3 只 × 11 点 = 161 份 · 6 个分析物共用",
          "临床病理 · 8 只 × 6 点 = 48 份 × 4 项",
          "细胞因子 · 175 份",
          "ADA 留样 · 52 份",
          "免疫分型全血 · 32 份",
          "终末解剖标准组织 · 11 只 · 福尔马林固定",
        ],
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

/**
 * 一张给药分组表的截图。
 * OCR 出来的只有表格本身：组别、剂量、只数、给药方案。所以认得出的只有
 * 种属 / 组数 / 周期三项，加动物分组这条事实；「每组动物数」核心 2 只、卫星 1 只
 * 并存，照样待确认。它喂不出分析方法、报告格式——那些不在这张表上。
 */
function dosingTableScreenshot(attachment: ComposerAttachment, kind: SourceKind): ParseResult {
  return {
    sourceId: attachment.id,
    sourceLabel: attachment.label,
    kind,
    role: "protocol",
    title: "给药分组表（截图）· 食蟹猴 · 7 组",
    steps: [
      { id: "kind", title: "判断文档类型", result: "截图 · 版面识别为一张表格", anchor: "图片属性", tech: `kind=${kind}  layout=table  confidence=0.88` },
      { id: "ocr", title: "OCR 识别表格", result: "7 行 × 5 列 · 表头：组别 / 剂量 / 只数 / 给药 / 周期", anchor: "整图", tech: "ocr=layout-v3  cells=35  low_confidence=2" },
      { id: "groups", title: "提取动物分组", result: "7 组（4 核心 + 3 卫星）· IV infusion", anchor: "第 1–7 行", tech: "extractor=dose-groups  rows=7" },
      { id: "map", title: "映射到报价参数", result: "识别 3 项 · 待确认 1 项", tech: "mapper=dmpk-fields/v1  matched=3  confirm=1" },
    ],
    patch: { species: "食蟹猴", groupCount: "7", cycle: "4 周" },
    patchSources: {
      species: { anchor: "表头", quote: "食蟹猴 给药分组表" },
      groupCount: { anchor: "第 1–7 行", quote: "G1 对照 · G2 低 · G2-S · G3 中 · G3-S · G4 高 · G4-S" },
      cycle: { anchor: "「周期」列", quote: "28 d" },
    },
    facts: [
      {
        id: "groups",
        dim: 2,
        label: "组别",
        summary: "7 组 · 11 只 · IV infusion",
        brief: "7 组动物",
        anchor: "第 1–7 行",
        items: [
          "G1 对照载体 · 2 只 · Q1W×3",
          "G2 / G3 / G4 核心 · 3 / 10 / 30 mg/kg · 各 2 只",
          "G2-S / G3-S / G4-S 卫星 · 各 1 只 · Day 1 单次",
        ],
      },
    ],
    pending: [
      {
        id: "animals-per-group",
        kind: "confirm",
        fieldId: "animalsPerGroup",
        label: "每组动物数",
        detail: "「只数」列核心组 2、卫星组 1，两种口径并存，请确认按哪个计",
        options: ["2", "1"],
        anchor: "「只数」列",
      },
    ],
  };
}

/**
 * 客户和商务的聊天记录（导出的文本）。
 * 这类材料里没有实验设计，有的是**要求**：报给哪个区域、什么语言、什么格式、什么时候要。
 * 前三项落到字段上，原句就是客户那条消息；交付时间没有格子，进 facts。
 */
function chatLog(attachment: ComposerAttachment, kind: SourceKind): ParseResult {
  return {
    sourceId: attachment.id,
    sourceLabel: attachment.label,
    kind,
    role: "chat",
    title: "客户沟通记录 · 23 条消息 · 报价要求",
    steps: [
      { id: "kind", title: "判断文档类型", result: "聊天记录 · 23 条消息 · 2 天", anchor: "文件属性", tech: `kind=${kind}  classifier=source-role/v2  role=chat  confidence=0.95` },
      { id: "speakers", title: "识别说话人", result: "客户 2 人 · 商务 1 人", anchor: "消息前缀", tech: "speakers=3  client=2  sales=1" },
      { id: "requirements", title: "提取报价要求", result: "区域 · 语言 · 格式 · 交付时间", anchor: "第 7、9、18 条", tech: "extractor=quote-requirements  hits=4" },
      { id: "map", title: "映射到报价参数", result: "识别 3 项 · 1 条要求没有格子", tech: "mapper=dmpk-fields/v1  matched=3  unmapped=1" },
    ],
    patch: { region: "国内", language: "中文", format: "Excel" },
    patchSources: {
      region: { anchor: "第 7 条 · 客户 王工", quote: "按国内价报就行，不用美元。" },
      language: { anchor: "第 9 条 · 客户 王工", quote: "报告中文的，老板要看。" },
      format: { anchor: "第 18 条 · 客户 李经理", quote: "报价发 Excel 吧，我们内部要拆着算。" },
    },
    facts: [
      {
        id: "delivery",
        label: "交付要求",
        summary: "月底前 · CNY",
        brief: "1 条交付要求",
        anchor: "第 18、21 条",
        items: ["「报价发 Excel 吧，我们内部要拆着算。」（李经理，第 18 条）", "「最好月底前给到，我们下季度要立项。」（李经理，第 21 条）"],
      },
    ],
    pending: [],
  };
}

export const dmpkSourceParsers: SourceParser[] = [
  { id: "dmpk-protocol-mock", kinds: ["docx", "pdf", "pptx", "xlsx"], parse: bb001 },
  /* 截图分两种：文件名里带「微信 / 聊天」的是聊天截图，其余当表格截图读。 */
  { id: "dmpk-table-ocr-mock", kinds: ["image"], parse: (attachment, kind) => looksLikeChat(attachment) ? chatLog(attachment, kind) : dosingTableScreenshot(attachment, kind) },
  { id: "dmpk-chat-mock", kinds: ["text"], parse: chatLog },
  /* unknown 不注册：没有 parser 能读的格式走 sources.ts 里那条「尚未接入」的轨迹。 */
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
