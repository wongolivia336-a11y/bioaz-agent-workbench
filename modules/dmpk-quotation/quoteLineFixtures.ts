import type { ParseResult } from "../../lib/workbench/sources";
import type { QuoteLine, QuotePackage } from "../../lib/workbench/quoteLines";
import type { DmpkField } from "./fields";

/**
 * BB-001 那一单的报价行。
 *
 * 数量全部**按实际关系推**，公式写在 formula 上给人核：
 *   核心组 4 组 × 2 只，卫星组 3 组 × 1 只；TK 16 点、卫星 PK 11 点、
 *   临床病理 6 点、细胞因子核心 21 点 / 卫星 7 点、ADA 核心 5 点 / 卫星 4 点、
 *   免疫分型 4 点；6 个分析物共用同一批 TK / PK 血清（8×16 + 3×11 = 161 份）。
 *
 * 单价走 `modules/quotation-management/dmpk/catalog.ts` 里有的那几档
 * （LC-MS/MS 方法开发 ¥6,000、样品检测 ¥180、配体结合法 ¥8,000、中文报告 ¥3,000、
 * 动物饲养 ¥15/只/天）；价目表里没有的服务，单价是照 beta3 那张金额表反推的。
 * 演示要的是「行 → 小计 → 总额」这条路和三种算不出来的状态，不是这些数本身。
 *
 * 状态跟着字段走
 * ----------------------------------------------------------------------
 * 「分析方法」待确认 → 三个平台未定的分析物，方法开发和样品检测两行都算不出；
 * 人在参数卡上选了 LC-MS/MS 或 ELISA，这两行当场变成已计价，走对应那档价。
 * 「报价区域」没填 → 报告那一行缺参数。
 * 细胞因子 / 免疫分型 / 流式 → 后台没价目，无价目。
 *
 * 待测物 / 检测方法（2026-09-21 会议要的右栏四要素）
 * ----------------------------------------------------------------------
 * 每行标 analyte / method，右栏「报价板块」按这两列画。采血、动物、报告这类行
 * 没有待测物，留空。平台没定的行 method 写「待确认」。
 */

const SERUM_SAMPLES = 8 * 16 + 3 * 11; // 161

const platformPrice: Record<string, { methodDev: number; methodDevId: string; perSample: number; label: string }> = {
  "LC-MS/MS": { methodDev: 6000, methodDevId: "bio-lcms", perSample: 180, label: "LC-MS/MS" },
  ELISA: { methodDev: 8000, methodDevId: "bio-ligand", perSample: 150, label: "ELISA" },
};

const PLATFORM_ANALYTES = "dpADC · spADC-IMQ · spADC-MMAF · Total mAb";

function buildProtocolLines(fields: DmpkField[]): QuoteLine[] {
  const value = (id: string) => fields.find((field) => field.id === id)?.value ?? "";
  const method = value("method");
  const platform = platformPrice[method];
  const language = value("language");
  const region = value("region");

  const pendingPlatform = (id: string, service: string, qty: number, unit: string, formula: string, pkg: QuoteLine["package"], perSample: boolean): QuoteLine =>
    platform
      ? { id, package: pkg, scope: PLATFORM_ANALYTES, service: `${service} · ${platform.label}`, analyte: PLATFORM_ANALYTES, method: platform.label, qty, unit, formula, catalogPrice: perSample ? platform.perSample : platform.methodDev, catalogId: perSample ? "bio-plasma" : platform.methodDevId, status: "priced" }
      : { id, package: pkg, scope: PLATFORM_ANALYTES, service, analyte: PLATFORM_ANALYTES, method: "待确认（ELISA / LC-MS/MS）", qty, unit, formula, status: "pending-confirm", reason: "分析方法待确认（ELISA 或 LC-MS/MS），两档单价不同", dependsOn: "method" };

  return [
    /* ── PK / TK ── */
    { id: "tk-sampling", package: "pk-tk", scope: "1–4 组核心", service: "TK 毒代采血（血清）", analyte: "血清 · 6 个分析物", qty: 128, unit: "份", formula: "2 只 × 16 点 × 4 组", catalogPrice: 130, status: "priced" },
    { id: "pk-sampling", package: "pk-tk", scope: "2–4 组卫星", service: "单次给药 PK 采血（血清）", analyte: "血清 · 6 个分析物", qty: 33, unit: "份", formula: "1 只 × 11 点 × 3 组", catalogPrice: 130, status: "priced" },
    { id: "md-imq", package: "pk-tk", scope: "游离 IMQ", service: "方法开发 / 资格确认 · LC-MS/MS", analyte: "游离 IMQ", method: "LC-MS/MS", qty: 1, unit: "项", catalogPrice: 6000, catalogId: "bio-lcms", status: "priced" },
    { id: "md-mmaf", package: "pk-tk", scope: "游离 MMAF", service: "方法开发 / 资格确认 · LC-MS/MS", analyte: "游离 MMAF", method: "LC-MS/MS", qty: 1, unit: "项", catalogPrice: 6000, catalogId: "bio-lcms", status: "priced" },
    pendingPlatform("md-platform", "方法开发 / 资格确认", 4, "项", "4 个分析物各 1 项", "pk-tk", false),
    { id: "sa-imq", package: "pk-tk", scope: "游离 IMQ", service: "PK/TK 样品检测 · LC-MS/MS", analyte: "游离 IMQ", method: "LC-MS/MS", qty: SERUM_SAMPLES, unit: "份", formula: "8 只 × 16 点 + 3 只 × 11 点", catalogPrice: 180, catalogId: "bio-plasma", status: "priced" },
    { id: "sa-mmaf", package: "pk-tk", scope: "游离 MMAF", service: "PK/TK 样品检测 · LC-MS/MS", analyte: "游离 MMAF", method: "LC-MS/MS", qty: SERUM_SAMPLES, unit: "份", formula: "8 只 × 16 点 + 3 只 × 11 点", catalogPrice: 180, catalogId: "bio-plasma", status: "priced" },
    pendingPlatform("sa-platform", "PK/TK 样品检测", SERUM_SAMPLES * 4, "份", "161 份 × 4 个分析物", "pk-tk", true),

    /* ── TOX ── */
    { id: "clin-chem", package: "tox", scope: "1–4 组核心", service: "血清生化检查", analyte: "血清 · 生化指标", method: "生化分析仪", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 455, status: "priced" },
    { id: "hematology", package: "tox", scope: "1–4 组核心", service: "血液学检查（含网织红细胞）", analyte: "全血 · 血液学指标", method: "血球分析仪", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 325, status: "priced" },
    { id: "coagulation", package: "tox", scope: "1–4 组核心", service: "凝血检查", analyte: "血浆 · 凝血指标", method: "凝血分析仪", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 390, status: "priced" },
    { id: "urinalysis", package: "tox", scope: "1–4 组核心", service: "尿液检查", analyte: "尿液", method: "尿液分析仪", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 95, status: "priced" },
    { id: "cyto-sampling", package: "tox", scope: "1–4 组核心 + 2 组卫星", service: "细胞因子采血（血清）", analyte: "血清 · 细胞因子", qty: 175, unit: "份", formula: "2 只 × 21 点 × 4 组 + 1 只 × 7 点", catalogPrice: 130, status: "priced" },
    { id: "cyto-assay", package: "tox", scope: "1–4 组核心 + 2 组卫星", service: "细胞因子检测（10-plex）", analyte: "细胞因子 10-plex", method: "多重免疫分析（平台待定）", qty: 175, unit: "份", formula: "复用细胞因子采血", status: "no-catalog", reason: "当前没有精确覆盖 10-plex 细胞因子检测的价目" },
    { id: "immuno-sampling", package: "tox", scope: "1–4 组核心", service: "免疫分型全血采集", analyte: "全血 · 免疫分型", qty: 32, unit: "份", formula: "2 只 × 4 点 × 4 组（声明 16 份 / 组待核）", status: "no-catalog", reason: "临床病理或免疫检测采血未发布适用公式，不能套 PK / TK / ADA 价" },
    { id: "flow", package: "tox", scope: "1–4 组核心", service: "流式检测（Panel A / B）", analyte: "免疫分型 Panel A / B", method: "流式细胞术", qty: 32, unit: "份", formula: "复用免疫分型全血", status: "no-catalog", reason: "当前没有精确覆盖免疫分型 Panel A / B 的价目" },
    { id: "dosing", package: "tox", scope: "全部 7 组", service: "给药 · IV infusion 约 60 分钟", qty: 27, unit: "次", formula: "8 只 × 3 次 + 3 只 × 1 次", catalogPrice: 130, status: "priced" },
    { id: "in-life", package: "tox", scope: "全部 7 组 · 11 只", service: "濒死与临床观察、体重、摄食", qty: 308, unit: "只·天", formula: "11 只 × 28 天", catalogPrice: 15, catalogId: "animal-housing", status: "priced" },
    { id: "ecg", package: "tox", scope: "1–4 组核心", service: "心电图", method: "ECG", qty: 48, unit: "次", formula: "8 只 × 6 次", catalogPrice: 65, status: "priced" },
    { id: "ophthalmology", package: "tox", scope: "全部 7 组 · 11 只", service: "眼科检查（裂隙灯 + 荧光素染色）", method: "裂隙灯 + 荧光素染色", qty: 22, unit: "次", formula: "11 只 × 2 次", catalogPrice: 45, status: "priced" },
    { id: "formulation", package: "tox", scope: "全部 7 组", service: "制剂配制（0 / 3 / 10 / 30 mg/kg）", qty: 7, unit: "组", catalogPrice: 700, status: "priced" },
    { id: "necropsy", package: "tox", scope: "全部 7 组 · 11 只", service: "终末解剖、脏器称重、标准组织固定", qty: 11, unit: "只", catalogPrice: 800, status: "priced" },

    /* ── ADA ── */
    { id: "ada-sampling", package: "ada", scope: "1–4 组核心 + 2–4 组卫星", service: "ADA 采血留样（血清）", analyte: "血清 · ADA", qty: 52, unit: "份", formula: "2 只 × 5 点 × 4 组 + 1 只 × 4 点 × 3 组", catalogPrice: 130, status: "priced" },
    { id: "ada-md", package: "ada", scope: "ADA", service: "方法开发 · ELISA 筛选", analyte: "ADA", method: "ELISA（筛选）", qty: 1, unit: "项", catalogPrice: 8000, catalogId: "bio-ligand", status: "priced" },
    { id: "ada-assay", package: "ada", scope: "ADA", service: "ADA 筛选检测（确证与滴度不做）", analyte: "ADA", method: "ELISA（筛选）", qty: 52, unit: "份", formula: "复用 ADA 留样", catalogPrice: 150, status: "priced" },

    /* ── 动物 ──
       猴类价格是**人工输入项**（P0 工程方案第五层：猴类人工价格、折扣和其他费用作为独立人工调整项保存），
       不走价目表。第一版这儿编了一个 ¥32,500 当价目价，等于把一个该人定的数说成系统定的。
       现在它是无价目 · 待补价，SD 在板块里补一个，只作用于本单。 */
    { id: "animal-use", package: "animal", scope: "全部 7 组 · 11 只", service: "食蟹猴使用费（生物制品初免）", qty: 11, unit: "只", formula: "4 组核心 × 2 只 + 3 组卫星 × 1 只", status: "no-catalog", reason: "猴类价格是人工输入项，不走价目表——请 SD 按本单情况补一个单价" },

    /* ── 报告 ── */
    region
      ? { id: "report", package: "report", scope: "整单", service: `28 天 DRF/毒理综合报告 · ${language || "中文"}${region === "国内" ? "" : ` · ${region}`}`, qty: 1, unit: "份", catalogPrice: language === "英文" || language === "中英双语" ? 4500 : 3000, catalogId: language === "英文" || language === "中英双语" ? "report-en" : "report-cn", status: "priced" }
      : { id: "report", package: "report", scope: "整单", service: "28 天 DRF/毒理综合报告", qty: 1, unit: "份", status: "missing-param", reason: "报价区域未填，报告与管理费口径定不下来", dependsOn: "region" },
  ];
}

/* ── 没传方案、只靠十四项对话收集的会话 ──────────────────────────────────
   2026-09-21 会议要右栏「已收集参数的状态展示 + 对应单价」——那就不能只有读过方案的
   会话才有账。十四项推不出 BB-001 那种组别 × 时点的关系，但推得出一张粗账：
   动物、采血、方法开发、样品检测、报告，各一行；哪一项参数还没填，对应的行就是
   「缺参数」并指回那一格。人在参数卡上每填一项，右栏就多亮一行。

   板块按检测类型定：PK → PK / TK 样品采集，BA Only → BA，TOX → TOX。
   单价走 catalog.ts 有的那几档；采血 ¥130 / 份和 BB-001 一样是照 beta3 反推的。 */

const speciesCatalog: Record<string, { price: number; catalogId: string }> = {
  "SD 大鼠": { price: 120, catalogId: "animal-sd-rat" },
  "Beagle 犬": { price: 850, catalogId: "animal-beagle" },
  仓鼠: { price: 95, catalogId: "animal-hamster" },
};

const methodCatalog: Record<string, { price: number; catalogId: string }> = {
  "LC-MS/MS": { price: 6000, catalogId: "bio-lcms" },
  ELISA: { price: 8000, catalogId: "bio-ligand" },
  LBA: { price: 8000, catalogId: "bio-ligand" },
};

const cycleDays: Record<string, number> = { "1 周": 7, "2 周": 14, "4 周": 28 };

/** P0 工程方案第五层：每个化合物「少于 30 按 30」。后台计价规则页写的是同一个数。 */
export const MIN_BILLED_SAMPLES = 30;

const toInt = (value: string) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function buildFieldLines(fields: DmpkField[]): QuoteLine[] {
  const value = (id: string) => fields.find((field) => field.id === id)?.value ?? "";
  const assay = value("assayType");
  if (!assay) return [];
  const pkg: QuoteLine["package"] = assay === "BA Only" ? "ba" : assay === "TOX" ? "tox" : "pk-tk";
  const species = value("species");
  const perGroup = toInt(value("animalsPerGroup"));
  const groups = toInt(value("groupCount"));
  const animals = perGroup && groups ? perGroup * groups : undefined;
  const points = toInt(value("bloodPoints"));
  const analytes = toInt(value("analyteCount"));
  const method = value("method");
  const sample = value("sampleType");
  const compound = value("compoundType");
  const language = value("language");
  const region = value("region");
  const days = cycleDays[value("cycle")];

  const missing = (id: string, pkgId: QuoteLine["package"], service: string, unit: string, dependsOn: string, label: string, extra: Partial<QuoteLine> = {}): QuoteLine =>
    ({ id, package: pkgId, scope: "本单", service, qty: 0, unit, status: "missing-param", reason: `${label}未填`, dependsOn, ...extra });

  const analyteLabel = [compound, analytes ? `${analytes} 个待测物` : ""].filter(Boolean).join(" · ") || undefined;
  const lines: QuoteLine[] = [];

  /* 采血 + 样品检测 + 方法开发（BA Only 没有采血——样品是客户送来的） */
  if (assay !== "BA Only") {
    lines.push(animals && points
      ? { id: "f-sampling", package: pkg, scope: `${groups} 组 · ${animals} 只`, service: `${assay === "TOX" ? "TK " : "PK "}采血（${sample || "血浆"}）`, analyte: sample ? `${sample}${analytes ? ` · ${analytes} 个待测物` : ""}` : undefined, qty: animals * points, unit: "份", formula: `${animals} 只 × ${points} 点`, catalogPrice: 130, status: "priced" }
      : missing("f-sampling", pkg, `${assay === "TOX" ? "TK " : "PK "}采血`, "份", !animals ? (perGroup ? "groupCount" : "animalsPerGroup") : "bloodPoints", !animals ? "动物数与组数" : "采血点数"));
  }
  /* 每个化合物的实际样本数 = 只数 × 点数；P0 引擎规则「少于 30 按 30」按化合物各自执行，
     计费量 = 化合物数 × max(实际, 30)。实际数和计费数都写在公式里——P0 的输出口径里两者要分开给。 */
  const perAnalyte = assay === "BA Only" ? (points ? points * (animals ?? 1) : undefined) : (animals && points ? animals * points : undefined);
  const billedPerAnalyte = perAnalyte !== undefined ? Math.max(perAnalyte, MIN_BILLED_SAMPLES) : undefined;
  const detectionQty = billedPerAnalyte !== undefined && analytes ? billedPerAnalyte * analytes : undefined;
  const detectionFormula = perAnalyte !== undefined && analytes
    ? `${assay === "BA Only" ? `${points} 点${animals ? ` × ${animals} 只` : ""}` : `${animals} 只 × ${points} 点`} = 每化合物 ${perAnalyte} 份${perAnalyte < MIN_BILLED_SAMPLES ? `，少于 ${MIN_BILLED_SAMPLES} 按 ${MIN_BILLED_SAMPLES} 计` : ""} × ${analytes} 个待测物`
    : undefined;
  const methodPrice = methodCatalog[method];
  if (!method) {
    lines.push(missing("f-detection", pkg, "样品检测", "份", "method", "分析方法", { analyte: analyteLabel }));
    lines.push(missing("f-method-dev", pkg, "方法开发", "项", "method", "分析方法", { analyte: analyteLabel }));
  } else {
    lines.push(detectionQty
      ? { id: "f-detection", package: pkg, scope: `${analytes} 个待测物`, service: `样品检测 · ${method}`, analyte: analyteLabel, method, qty: detectionQty, unit: "份", formula: detectionFormula, catalogPrice: 180, catalogId: "bio-plasma", status: "priced" }
      : missing("f-detection", pkg, `样品检测 · ${method}`, "份", !analytes ? "analyteCount" : !points ? "bloodPoints" : "animalsPerGroup", !analytes ? "待测物数量" : !points ? "采血点数" : "动物数", { analyte: analyteLabel, method }));
    lines.push(methodPrice
      ? { id: "f-method-dev", package: pkg, scope: `${analytes ?? 1} 个待测物`, service: `方法开发 · ${method}`, analyte: analyteLabel, method, qty: analytes ?? 1, unit: "项", catalogPrice: methodPrice.price, catalogId: methodPrice.catalogId, status: "priced" }
      : { id: "f-method-dev", package: pkg, scope: `${analytes ?? 1} 个待测物`, service: `方法开发 · ${method}`, analyte: analyteLabel, method, qty: analytes ?? 1, unit: "项", status: "no-catalog", reason: `当前价目表没有 ${method} 方法开发这一档` });
  }
  if (assay === "TOX") {
    lines.push({ id: "f-tox-endpoint", package: "tox", scope: "本单", service: "毒性终点分析", analyte: analyteLabel, method: method || undefined, qty: 1, unit: "项", status: "no-catalog", reason: "「毒性终点分析」价目还是草稿，未发布" });
  }

  /* 动物使用与饲养 */
  if (assay !== "BA Only") {
    const speciesPrice = speciesCatalog[species];
    lines.push(!species || !animals
      ? missing("f-animal", "animal", "动物使用费", "只", !species ? "species" : perGroup ? "groupCount" : "animalsPerGroup", !species ? "动物种属" : "动物数与组数")
      : speciesPrice
        ? { id: "f-animal", package: "animal", scope: `${groups} 组 · ${animals} 只`, service: `${species}使用费`, qty: animals, unit: "只", formula: `${perGroup} 只 × ${groups} 组`, catalogPrice: speciesPrice.price, catalogId: speciesPrice.catalogId, status: "priced" }
        : { id: "f-animal", package: "animal", scope: `${groups} 组 · ${animals} 只`, service: `${species}使用费`, qty: animals, unit: "只", formula: `${perGroup} 只 × ${groups} 组`, status: "no-catalog", reason: `当前价目表没有${species}这一档动物费` });
    lines.push(animals && days
      ? { id: "f-housing", package: "animal", scope: `${animals} 只 · ${days} 天`, service: "动物饲养", qty: animals * days, unit: "只·天", formula: `${animals} 只 × ${days} 天`, catalogPrice: 15, catalogId: "animal-housing", status: "priced" }
      : missing("f-housing", "animal", "动物饲养", "只·天", !animals ? (perGroup ? "groupCount" : "animalsPerGroup") : "cycle", !animals ? "动物数与组数" : "试验周期"));
  }

  /* 报告 */
  const english = language === "英文" || language === "中英双语";
  lines.push(region && language
    ? { id: "f-report", package: "report", scope: "整单", service: `${assay} 报告 · ${language}${region === "国内" ? "" : ` · ${region}`}`, qty: 1, unit: "份", catalogPrice: english ? 4500 : 3000, catalogId: english ? "report-en" : "report-cn", status: "priced" }
    : missing("f-report", "report", `${assay} 报告`, "份", !language ? "language" : "region", !language ? "报告语言" : "报价区域"));

  return lines;
}

/* ── 积木：人在基础卡下面自己加的板块 ────────────────────────────────────
   P0 八维的 ⑥ 检测项目是多选（PK、TK、TOX、ADA…），而十四项里的「检测类型」是单选。
   十四项不动：检测类型定的是**主板块**，再要哪个板块，人在 composer 的积木卡上点一下加。
   加上去的板块也是账——立刻在右栏长出一段，行大多「缺参数」，指回参数卡那一格；
   参数一填，行就亮。每个板块要哪几行是照 BB-001 那份细账缩的。 */

export type ExtraPackage = Extract<QuotePackage, "pk-tk" | "tox" | "ba" | "ada">;

export const extraPackageOptions: Array<{ id: ExtraPackage; label: string; hint: string }> = [
  { id: "pk-tk", label: "PK / TK", hint: "采血、方法开发、样品检测" },
  { id: "tox", label: "TOX", hint: "TK 采血、临床病理、解剖、毒性终点" },
  { id: "ba", label: "BA", hint: "客户送样的样品检测" },
  { id: "ada", label: "ADA", hint: "留样、ELISA 筛选" },
];

function buildExtraPackageLines(pkg: ExtraPackage, fields: DmpkField[]): QuoteLine[] {
  const value = (id: string) => fields.find((field) => field.id === id)?.value ?? "";
  const perGroup = toInt(value("animalsPerGroup"));
  const groups = toInt(value("groupCount"));
  const animals = perGroup && groups ? perGroup * groups : undefined;
  const points = toInt(value("bloodPoints"));
  const analytes = toInt(value("analyteCount"));
  const method = value("method");
  const sample = value("sampleType") || "血浆";
  const groupScope = groups && animals ? `${groups} 组 · ${animals} 只` : "本单";
  const animalsDep = perGroup ? "groupCount" : "animalsPerGroup";
  const missing = (id: string, service: string, unit: string, dependsOn: string, label: string, extra: Partial<QuoteLine> = {}): QuoteLine =>
    ({ id, package: pkg, scope: "本单", service, qty: 0, unit, status: "missing-param", reason: `${label}未填`, dependsOn, ...extra });
  const methodPrice = methodCatalog[method];
  const methodDev = (id: string, service: string): QuoteLine => !method
    ? missing(id, service, "项", "method", "分析方法")
    : methodPrice
      ? { id, package: pkg, scope: `${analytes ?? 1} 个待测物`, service: `${service} · ${method}`, method, qty: analytes ?? 1, unit: "项", catalogPrice: methodPrice.price, catalogId: methodPrice.catalogId, status: "priced" }
      : { id, package: pkg, scope: `${analytes ?? 1} 个待测物`, service: `${service} · ${method}`, method, qty: analytes ?? 1, unit: "项", status: "no-catalog", reason: `当前价目表没有 ${method} 方法开发这一档` };
  const perAnalyte = pkg === "ba" ? points : animals && points ? animals * points : undefined;
  const detection = (id: string, service: string): QuoteLine => !method
    ? missing(id, service, "份", "method", "分析方法")
    : perAnalyte && analytes
      ? { id, package: pkg, scope: `${analytes} 个待测物`, service: `${service} · ${method}`, analyte: `${sample} · ${analytes} 个待测物`, method, qty: Math.max(perAnalyte, MIN_BILLED_SAMPLES) * analytes, unit: "份", formula: `每化合物 ${perAnalyte} 份${perAnalyte < MIN_BILLED_SAMPLES ? `，少于 ${MIN_BILLED_SAMPLES} 按 ${MIN_BILLED_SAMPLES} 计` : ""} × ${analytes} 个待测物`, catalogPrice: 180, catalogId: "bio-plasma", status: "priced" }
      : missing(id, `${service} · ${method}`, "份", !analytes ? "analyteCount" : !points ? "bloodPoints" : animalsDep, !analytes ? "待测物数量" : !points ? "采血点数" : "动物数与组数", { method });

  switch (pkg) {
    case "pk-tk":
      return [
        animals && points
          ? { id: "x-pk-sampling", package: pkg, scope: groupScope, service: `PK 采血（${sample}）`, analyte: sample, qty: animals * points, unit: "份", formula: `${animals} 只 × ${points} 点`, catalogPrice: 130, status: "priced" }
          : missing("x-pk-sampling", "PK 采血", "份", !animals ? animalsDep : "bloodPoints", !animals ? "动物数与组数" : "采血点数"),
        methodDev("x-pk-md", "方法开发"),
        detection("x-pk-detection", "PK 样品检测"),
      ];
    case "tox":
      return [
        animals && points
          ? { id: "x-tox-tk-sampling", package: pkg, scope: groupScope, service: `TK 毒代采血（${sample}）`, analyte: sample, qty: animals * points, unit: "份", formula: `${animals} 只 × ${points} 点`, catalogPrice: 130, status: "priced" }
          : missing("x-tox-tk-sampling", "TK 毒代采血", "份", !animals ? animalsDep : "bloodPoints", !animals ? "动物数与组数" : "采血点数"),
        animals && points
          ? { id: "x-tox-clinpath", package: pkg, scope: groupScope, service: "临床病理（血清生化 / 血液学 / 凝血 / 尿液）", analyte: "血清 · 全血 · 尿液", qty: animals * points, unit: "份·套", formula: `${animals} 只 × ${points} 点 · 四项打包`, catalogPrice: 1265, status: "priced" }
          : missing("x-tox-clinpath", "临床病理（血清生化 / 血液学 / 凝血 / 尿液）", "份·套", !animals ? animalsDep : "bloodPoints", !animals ? "动物数与组数" : "采样时点"),
        animals
          ? { id: "x-tox-necropsy", package: pkg, scope: groupScope, service: "终末解剖、脏器称重、标准组织固定", qty: animals, unit: "只", catalogPrice: 800, status: "priced" }
          : missing("x-tox-necropsy", "终末解剖、脏器称重、标准组织固定", "只", animalsDep, "动物数与组数"),
        { id: "x-tox-endpoint", package: pkg, scope: "本单", service: "毒性终点分析", qty: 1, unit: "项", status: "no-catalog", reason: "「毒性终点分析」价目还是草稿，未发布" },
      ];
    case "ba":
      return [
        methodDev("x-ba-md", "方法开发"),
        detection("x-ba-detection", "BA 样品检测"),
      ];
    case "ada":
      return [
        animals && points
          ? { id: "x-ada-sampling", package: pkg, scope: groupScope, service: "ADA 采血留样（血清）", analyte: "血清 · ADA", qty: animals * points, unit: "份", formula: `${animals} 只 × ${points} 点`, catalogPrice: 130, status: "priced" }
          : missing("x-ada-sampling", "ADA 采血留样", "份", !animals ? animalsDep : "bloodPoints", !animals ? "动物数与组数" : "留样时点"),
        { id: "x-ada-md", package: pkg, scope: "ADA", service: "方法开发 · ELISA 筛选", analyte: "ADA", method: "ELISA（筛选）", qty: 1, unit: "项", catalogPrice: 8000, catalogId: "bio-ligand", status: "priced" },
        animals && points
          ? { id: "x-ada-assay", package: pkg, scope: "ADA", service: "ADA 筛选检测（确证与滴度不做）", analyte: "ADA", method: "ELISA（筛选）", qty: animals * points, unit: "份", formula: "复用 ADA 留样", catalogPrice: 150, status: "priced" }
          : missing("x-ada-assay", "ADA 筛选检测", "份", !animals ? animalsDep : "bloodPoints", !animals ? "动物数与组数" : "留样时点", { analyte: "ADA", method: "ELISA（筛选）" }),
      ];
  }
}

/**
 * 这条会话的账。读过方案 → BB-001 那份按关系推的细账；没读过 → 十四项推出来的粗账。
 * 退回会话两样都不要（`fieldsOnly: false`）：它的纸面是批注锚着的固定件，换了账批注就没处落。
 * 人在积木卡上加的板块（`extraPackages`）接在后面；账里本来就有的板块不重复加。
 */
export function buildDmpkQuoteLines(fields: DmpkField[], sources: ParseResult[], options: { fieldsOnly?: boolean; extraPackages?: ExtraPackage[] } = {}): QuoteLine[] {
  const base = sources.some((source) => source.role === "protocol")
    ? buildProtocolLines(fields)
    : options.fieldsOnly === false ? [] : buildFieldLines(fields);
  if (!base.length || !options.extraPackages?.length) return base;
  const present = new Set(base.map((line) => line.package));
  const extra = options.extraPackages.filter((pkg) => !present.has(pkg)).flatMap((pkg) => buildExtraPackageLines(pkg, fields));
  return [...base, ...extra];
}
