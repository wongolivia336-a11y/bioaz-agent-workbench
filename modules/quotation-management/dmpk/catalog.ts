/**
 * DMPK 报价配置的单一数据源。
 *
 * 以前每个检测类型各存一份（pkPrices / baPrices / toxPrices），
 * 结果 24 行价格里只有 11 个不同的费用项、37 行字段里只有 15 个不同的字段——
 * 一半以上是重复。重复本身不是问题，问题是改一处得记得同步另外两处。
 *
 * 所以这里把检测类型从「容器」降级成「属性」：一个费用项只存一份，
 * 用 appliesTo 说明它适用于哪几类。真的要让某一类不一样，走 exceptions/overrides，
 * 那是一个有名字的动作，不是随手改出来的副作用。
 */

export type DetectionScenario = "pk" | "ba-only" | "tox";

export const detectionScenarios: Array<{ id: DetectionScenario; label: string; short: string }> = [
  { id: "pk", label: "PK 检测", short: "PK" },
  { id: "ba-only", label: "BA Only 检测", short: "BA Only" },
  { id: "tox", label: "TOX 检测", short: "TOX" },
];

export const scenarioLabels: Record<DetectionScenario, string> = {
  pk: "PK 检测",
  "ba-only": "BA Only 检测",
  tox: "TOX 检测",
};

export const scenarioShortLabels: Record<DetectionScenario, string> = {
  pk: "PK",
  "ba-only": "BA Only",
  tox: "TOX",
};

const allScenarios: DetectionScenario[] = ["pk", "ba-only", "tox"];

/* ---------------- 标准价格 ---------------- */

export interface PriceException {
  scenario: DetectionScenario;
  price: string;
  /** 为什么要让这一类不一样——例外必须说得出理由，否则半年后没人敢动它 */
  note?: string;
}

export interface PriceItem {
  id: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  status: "published" | "draft";
  appliesTo: DetectionScenario[];
  exceptions: PriceException[];
}

export const priceCatalog: PriceItem[] = [
  { id: "animal-sd-rat", name: "SD 大鼠", category: "动物实验", price: "¥120", unit: "只", status: "published", appliesTo: ["pk", "tox"], exceptions: [] },
  { id: "animal-beagle", name: "Beagle 犬", category: "动物实验", price: "¥850", unit: "只", status: "published", appliesTo: ["pk", "tox"], exceptions: [] },
  { id: "animal-hamster", name: "仓鼠", category: "动物实验", price: "¥95", unit: "只", status: "published", appliesTo: ["pk", "tox"], exceptions: [] },
  { id: "animal-housing", name: "动物饲养", category: "动物实验", price: "¥15", unit: "只/天", status: "published", appliesTo: ["pk", "tox"], exceptions: [] },
  { id: "bio-plasma", name: "血浆样品检测", category: "生物分析", price: "¥180", unit: "样品", status: "published", appliesTo: allScenarios, exceptions: [] },
  { id: "bio-lcms", name: "LC-MS/MS 方法开发", category: "生物分析", price: "¥6,000", unit: "项", status: "published", appliesTo: allScenarios, exceptions: [] },
  { id: "bio-ligand", name: "配体结合法", category: "生物分析", price: "¥8,000", unit: "项", status: "published", appliesTo: ["pk", "ba-only"], exceptions: [] },
  { id: "bio-ba-method", name: "BA 专用分析方法", category: "生物分析", price: "¥7,500", unit: "项", status: "draft", appliesTo: ["ba-only"], exceptions: [] },
  { id: "bio-tox-endpoint", name: "毒性终点分析", category: "生物分析", price: "¥12,000", unit: "项", status: "draft", appliesTo: ["tox"], exceptions: [] },
  { id: "report-cn", name: "中文报告", category: "报告交付", price: "¥3,000", unit: "份", status: "published", appliesTo: allScenarios, exceptions: [] },
  { id: "report-en", name: "英文报告", category: "报告交付", price: "¥4,500", unit: "份", status: "published", appliesTo: allScenarios, exceptions: [] },
];

export const priceCategories = ["动物实验", "生物分析", "报告交付"];

/* ---------------- 报价字段 ---------------- */

export type FieldType = "single" | "multiple" | "number" | "text";

export interface FieldOption {
  value: string;
  label: string;
}

/** 例外只记「我盖住了哪几条」，没写的属性继续跟随主值 */
export interface FieldOverride {
  scenario: DetectionScenario;
  label?: string;
  type?: FieldType;
  required?: boolean;
  allowCustom?: boolean;
  options?: FieldOption[];
  note?: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options: FieldOption[];
  required: boolean;
  allowCustom: boolean;
  group: string;
  appliesTo: DetectionScenario[];
  overrides: FieldOverride[];
}

export const fieldGroups: Array<{ id: string; label: string }> = [
  { id: "assay", label: "检测类型" },
  { id: "animal", label: "动物实验" },
  { id: "analysis", label: "生物分析" },
  { id: "delivery", label: "报告与报价" },
];

export const fieldCatalog: FieldDef[] = [
  {
    key: "assayType", label: "检测类型", type: "single", required: true, allowCustom: false, group: "assay",
    options: [{ value: "pk", label: "PK" }, { value: "ba-only", label: "BA Only" }, { value: "tox", label: "TOX" }],
    appliesTo: allScenarios, overrides: [],
  },
  {
    key: "compoundType", label: "化合物类别", type: "single", required: true, allowCustom: true, group: "assay",
    options: [{ value: "small", label: "小分子" }, { value: "large", label: "大分子" }, { value: "custom", label: "自定义" }],
    appliesTo: allScenarios, overrides: [],
  },
  {
    key: "animalSpecies", label: "动物种属", type: "single", required: true, allowCustom: true, group: "animal",
    options: [{ value: "sd_rat", label: "SD 大鼠" }, { value: "beagle", label: "Beagle 犬" }, { value: "custom", label: "自定义" }],
    appliesTo: ["pk", "tox"],
    // 迁移前就存在的分叉：TOX 的种属列表比 PK 多一个仓鼠
    overrides: [{
      scenario: "tox",
      options: [{ value: "sd_rat", label: "SD 大鼠" }, { value: "beagle", label: "Beagle 犬" }, { value: "hamster", label: "仓鼠" }, { value: "custom", label: "自定义" }],
      note: "TOX 常用仓鼠做急性毒性",
    }],
  },
  {
    key: "animalCountPerGroup", label: "每组动物数", type: "number", required: true, allowCustom: true, group: "animal",
    options: [{ value: "3", label: "3" }, { value: "6", label: "6" }, { value: "10", label: "10" }],
    appliesTo: ["pk", "tox"], overrides: [],
  },
  {
    key: "groupCount", label: "组数", type: "number", required: true, allowCustom: true, group: "animal",
    options: [{ value: "3", label: "3" }, { value: "4", label: "4" }, { value: "6", label: "6" }],
    appliesTo: ["pk", "tox"], overrides: [],
  },
  {
    key: "trialDuration", label: "试验周期", type: "number", required: true, allowCustom: true, group: "animal",
    options: [{ value: "1", label: "1 周" }, { value: "2", label: "2 周" }, { value: "4", label: "4 周" }],
    appliesTo: ["pk", "tox"],
    // 同上：TOX 要做长周期，多两档
    overrides: [{
      scenario: "tox",
      options: [{ value: "1", label: "1 周" }, { value: "2", label: "2 周" }, { value: "4", label: "4 周" }, { value: "8", label: "8 周" }, { value: "13", label: "13 周" }],
      note: "TOX 需要长周期给药",
    }],
  },
  {
    key: "toxicityEndpoint", label: "毒性终点", type: "multiple", required: true, allowCustom: true, group: "animal",
    options: [{ value: "acute", label: "急性" }, { value: "subacute", label: "亚急性" }, { value: "chronic", label: "慢性" }, { value: "custom", label: "自定义" }],
    appliesTo: ["tox"], overrides: [],
  },
  {
    key: "analysisMethod", label: "分析方法", type: "single", required: true, allowCustom: true, group: "analysis",
    options: [{ value: "lcms", label: "LC-MS/MS" }, { value: "ligand", label: "配体结合法" }, { value: "custom", label: "自定义" }],
    appliesTo: allScenarios, overrides: [],
  },
  {
    key: "sampleType", label: "样本类型", type: "multiple", required: true, allowCustom: true, group: "analysis",
    options: [{ value: "plasma", label: "血浆" }, { value: "serum", label: "血清" }, { value: "tissue", label: "组织" }, { value: "custom", label: "自定义" }],
    appliesTo: allScenarios, overrides: [],
  },
  {
    key: "sampleCount", label: "样本数量", type: "number", required: true, allowCustom: true, group: "analysis",
    options: [{ value: "60", label: "60" }, { value: "120", label: "120" }, { value: "240", label: "240" }],
    appliesTo: allScenarios, overrides: [],
  },
  {
    key: "analyteCount", label: "待测物数量", type: "number", required: true, allowCustom: true, group: "analysis",
    options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }],
    appliesTo: ["pk", "tox"], overrides: [],
  },
  {
    key: "methodDev", label: "是否需要方法开发", type: "single", required: true, allowCustom: false, group: "analysis",
    options: [{ value: "yes", label: "是" }, { value: "no", label: "否" }],
    appliesTo: ["pk", "ba-only"], overrides: [],
  },
  {
    key: "reportLanguage", label: "报告语言", type: "single", required: true, allowCustom: false, group: "delivery",
    options: [{ value: "cn", label: "中文" }, { value: "en", label: "英文" }, { value: "both", label: "中英双语" }],
    appliesTo: allScenarios, overrides: [],
  },
  {
    key: "currency", label: "报价币种", type: "single", required: true, allowCustom: true, group: "delivery",
    options: [{ value: "cny", label: "CNY" }, { value: "usd", label: "USD" }, { value: "custom", label: "自定义" }],
    appliesTo: allScenarios, overrides: [],
  },
  {
    key: "deliverFormat", label: "交付格式", type: "multiple", required: true, allowCustom: false, group: "delivery",
    options: [{ value: "word", label: "Word" }, { value: "excel", label: "Excel" }, { value: "pdf", label: "PDF" }],
    appliesTo: allScenarios, overrides: [],
  },
];

/* ---------------- 共用的读取逻辑 ---------------- */

/** 筛选器是「看」，不是「改」：它只决定列表里显示谁，不决定改动落到谁头上。 */
export function matchesScenario(appliesTo: DetectionScenario[], filter: DetectionScenario | "all") {
  return filter === "all" || appliesTo.includes(filter);
}

export function describeScope(appliesTo: DetectionScenario[]) {
  return appliesTo.map((id) => scenarioShortLabels[id]).join("、");
}

/** 把主值和某一类的例外合成这一类真正生效的字段定义 */
export function resolveField(field: FieldDef, scenario: DetectionScenario): FieldDef {
  const override = field.overrides.find((item) => item.scenario === scenario);
  if (!override) return field;
  return {
    ...field,
    label: override.label ?? field.label,
    type: override.type ?? field.type,
    options: override.options ?? field.options,
    required: override.required ?? field.required,
    allowCustom: override.allowCustom ?? field.allowCustom,
  };
}

export type FieldOverrideKey = "label" | "type" | "required" | "allowCustom" | "options";

export const fieldOverrideLabels: Record<FieldOverrideKey, string> = {
  label: "字段名称",
  type: "字段类型",
  required: "是否必填",
  allowCustom: "允许自定义",
  options: "选项列表",
};

export function overriddenKeys(override: FieldOverride): FieldOverrideKey[] {
  return (Object.keys(fieldOverrideLabels) as FieldOverrideKey[]).filter((key) => override[key] !== undefined);
}
