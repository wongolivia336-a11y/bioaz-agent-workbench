import type { ParseResult } from "../../lib/workbench/sources";
import type { QuoteLine } from "../../lib/workbench/quoteLines";
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
 */

const SERUM_SAMPLES = 8 * 16 + 3 * 11; // 161

const platformPrice: Record<string, { methodDev: number; methodDevId: string; perSample: number; label: string }> = {
  "LC-MS/MS": { methodDev: 6000, methodDevId: "bio-lcms", perSample: 180, label: "LC-MS/MS" },
  ELISA: { methodDev: 8000, methodDevId: "bio-ligand", perSample: 150, label: "ELISA" },
};

export function buildDmpkQuoteLines(fields: DmpkField[], sources: ParseResult[]): QuoteLine[] {
  /* 没读过方案就没有行——十四项本身推不出这些关系，硬编一份会跟一句话
     识别出来的参数对不上。这时费用明细仍是原来那四行示意。 */
  if (!sources.some((source) => source.role === "protocol")) return [];

  const value = (id: string) => fields.find((field) => field.id === id)?.value ?? "";
  const method = value("method");
  const platform = platformPrice[method];
  const language = value("language");
  const region = value("region");

  const pendingPlatform = (id: string, service: string, qty: number, unit: string, formula: string, pkg: QuoteLine["package"], perSample: boolean): QuoteLine =>
    platform
      ? { id, package: pkg, scope: "dpADC · spADC-IMQ · spADC-MMAF · Total mAb", service: `${service} · ${platform.label}`, qty, unit, formula, catalogPrice: perSample ? platform.perSample : platform.methodDev, catalogId: perSample ? "bio-plasma" : platform.methodDevId, status: "priced" }
      : { id, package: pkg, scope: "dpADC · spADC-IMQ · spADC-MMAF · Total mAb", service, qty, unit, formula, status: "pending-confirm", reason: "分析方法待确认（ELISA 或 LC-MS/MS），两档单价不同", dependsOn: "method" };

  return [
    /* ── 动物 ── */
    { id: "animal-use", package: "animal", scope: "全部 7 组 · 11 只", service: "食蟹猴使用费（生物制品初免）", qty: 11, unit: "只", formula: "4 组核心 × 2 只 + 3 组卫星 × 1 只", catalogPrice: 32500, status: "priced" },

    /* ── PK / TK ── */
    { id: "tk-sampling", package: "pk-tk", scope: "1–4 组核心", service: "TK 毒代采血（血清）", qty: 128, unit: "份", formula: "2 只 × 16 点 × 4 组", catalogPrice: 130, status: "priced" },
    { id: "pk-sampling", package: "pk-tk", scope: "2–4 组卫星", service: "单次给药 PK 采血（血清）", qty: 33, unit: "份", formula: "1 只 × 11 点 × 3 组", catalogPrice: 130, status: "priced" },
    { id: "md-imq", package: "pk-tk", scope: "游离 IMQ", service: "方法开发 / 资格确认 · LC-MS/MS", qty: 1, unit: "项", catalogPrice: 6000, catalogId: "bio-lcms", status: "priced" },
    { id: "md-mmaf", package: "pk-tk", scope: "游离 MMAF", service: "方法开发 / 资格确认 · LC-MS/MS", qty: 1, unit: "项", catalogPrice: 6000, catalogId: "bio-lcms", status: "priced" },
    pendingPlatform("md-platform", "方法开发 / 资格确认", 4, "项", "4 个分析物各 1 项", "pk-tk", false),
    { id: "sa-imq", package: "pk-tk", scope: "游离 IMQ", service: "PK/TK 样品检测 · LC-MS/MS", qty: SERUM_SAMPLES, unit: "份", formula: "8 只 × 16 点 + 3 只 × 11 点", catalogPrice: 180, catalogId: "bio-plasma", status: "priced" },
    { id: "sa-mmaf", package: "pk-tk", scope: "游离 MMAF", service: "PK/TK 样品检测 · LC-MS/MS", qty: SERUM_SAMPLES, unit: "份", formula: "8 只 × 16 点 + 3 只 × 11 点", catalogPrice: 180, catalogId: "bio-plasma", status: "priced" },
    pendingPlatform("sa-platform", "PK/TK 样品检测", SERUM_SAMPLES * 4, "份", "161 份 × 4 个分析物", "pk-tk", true),

    /* ── TOX ── */
    { id: "clin-chem", package: "tox", scope: "1–4 组核心", service: "血清生化检查", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 455, status: "priced" },
    { id: "hematology", package: "tox", scope: "1–4 组核心", service: "血液学检查（含网织红细胞）", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 325, status: "priced" },
    { id: "coagulation", package: "tox", scope: "1–4 组核心", service: "凝血检查", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 390, status: "priced" },
    { id: "urinalysis", package: "tox", scope: "1–4 组核心", service: "尿液检查", qty: 48, unit: "份", formula: "2 只 × 6 点 × 4 组", catalogPrice: 95, status: "priced" },
    { id: "cyto-sampling", package: "tox", scope: "1–4 组核心 + 2 组卫星", service: "细胞因子采血（血清）", qty: 175, unit: "份", formula: "2 只 × 21 点 × 4 组 + 1 只 × 7 点", catalogPrice: 130, status: "priced" },
    { id: "cyto-assay", package: "tox", scope: "1–4 组核心 + 2 组卫星", service: "细胞因子检测（10-plex）", qty: 175, unit: "份", formula: "复用细胞因子采血", status: "no-catalog", reason: "当前没有精确覆盖 10-plex 细胞因子检测的价目" },
    { id: "immuno-sampling", package: "tox", scope: "1–4 组核心", service: "免疫分型全血采集", qty: 32, unit: "份", formula: "2 只 × 4 点 × 4 组（声明 16 份 / 组待核）", status: "no-catalog", reason: "临床病理或免疫检测采血未发布适用公式，不能套 PK / TK / ADA 价" },
    { id: "flow", package: "tox", scope: "1–4 组核心", service: "流式检测（Panel A / B）", qty: 32, unit: "份", formula: "复用免疫分型全血", status: "no-catalog", reason: "当前没有精确覆盖免疫分型 Panel A / B 的价目" },
    { id: "dosing", package: "tox", scope: "全部 7 组", service: "给药 · IV infusion 约 60 分钟", qty: 27, unit: "次", formula: "8 只 × 3 次 + 3 只 × 1 次", catalogPrice: 130, status: "priced" },
    { id: "in-life", package: "tox", scope: "全部 7 组 · 11 只", service: "濒死与临床观察、体重、摄食", qty: 308, unit: "只·天", formula: "11 只 × 28 天", catalogPrice: 15, catalogId: "animal-housing", status: "priced" },
    { id: "ecg", package: "tox", scope: "1–4 组核心", service: "心电图", qty: 48, unit: "次", formula: "8 只 × 6 次", catalogPrice: 65, status: "priced" },
    { id: "ophthalmology", package: "tox", scope: "全部 7 组 · 11 只", service: "眼科检查（裂隙灯 + 荧光素染色）", qty: 22, unit: "次", formula: "11 只 × 2 次", catalogPrice: 45, status: "priced" },
    { id: "formulation", package: "tox", scope: "全部 7 组", service: "制剂配制（0 / 3 / 10 / 30 mg/kg）", qty: 7, unit: "组", catalogPrice: 700, status: "priced" },
    { id: "necropsy", package: "tox", scope: "全部 7 组 · 11 只", service: "终末解剖、脏器称重、标准组织固定", qty: 11, unit: "只", catalogPrice: 800, status: "priced" },

    /* ── ADA ── */
    { id: "ada-sampling", package: "ada", scope: "1–4 组核心 + 2–4 组卫星", service: "ADA 采血留样（血清）", qty: 52, unit: "份", formula: "2 只 × 5 点 × 4 组 + 1 只 × 4 点 × 3 组", catalogPrice: 130, status: "priced" },
    { id: "ada-md", package: "ada", scope: "ADA", service: "方法开发 · ELISA 筛选", qty: 1, unit: "项", catalogPrice: 8000, catalogId: "bio-ligand", status: "priced" },
    { id: "ada-assay", package: "ada", scope: "ADA", service: "ADA 筛选检测（确证与滴度不做）", qty: 52, unit: "份", formula: "复用 ADA 留样", catalogPrice: 150, status: "priced" },

    /* ── 报告 ── */
    region
      ? { id: "report", package: "report", scope: "整单", service: `28 天 DRF/毒理综合报告 · ${language || "中文"}${region === "国内" ? "" : ` · ${region}`}`, qty: 1, unit: "份", catalogPrice: language === "英文" || language === "中英双语" ? 4500 : 3000, catalogId: language === "英文" || language === "中英双语" ? "report-en" : "report-cn", status: "priced" }
      : { id: "report", package: "report", scope: "整单", service: "28 天 DRF/毒理综合报告", qty: 1, unit: "份", status: "missing-param", reason: "报价区域未填，报告与管理费口径定不下来", dependsOn: "region" },
  ];
}
