import { evaluatePricing, type PricingCoefficient, type PricingSpec } from "../../../lib/workbench/pricingEngine.ts";
import { baCoefficient, elisaPricing, perPlatePricing, perSamplePricing, regionCoefficient, type DmpkRegion } from "./policy.ts";

export type AssayPricingMode = "per-sample" | "per-plate" | "elisa-tiered";

export type AssayPricingTask = {
  id: string;
  kind: "pk" | "tk" | "ba" | "ada";
  analyte: string;
  matrices: string[];
  method: string;
  actualSampleQty: number;
  pricingMode: AssayPricingMode;
  methodBasePrice?: number;
  sampleUnitPrice?: number;
  minimumEligible?: boolean;
  minimumQty?: number;
  homogenization?: boolean;
  plateCapacity?: number;
  platePrice?: number;
  methodCoefficient?: number;
  detectionCoefficient?: number;
};

export type ClinicalPathologyTask = {
  id: string;
  kind: "hematology-basic" | "hematology-retic" | "chemistry-panel" | "chemistry-single" | "coagulation" | "urine-semi" | "urine-quant" | "urine-sediment";
  actualSampleQty: number;
  unitPrice: number;
};

export type AdaPlan = {
  screening?: { samples: number; capacity: number; platePrice: number };
  confirmation?: { samples: number; capacity: number; platePrice: number };
  titer?: { samples: number; platePrice: number };
};

export type PathologyTask = {
  id: string;
  kind: "necropsy" | "collection" | "weighing" | "fixation" | "slide" | "staining" | "reading";
  qty: number;
  unitPrice: number;
  includedBy?: string;
};

export type ReportPlan = {
  kind: "pk" | "tox" | "integrated" | "ba-only";
  basePrice?: number;
  baMethodAndDetectionTotal?: number;
  separateExperiments?: boolean;
  baMergedIntoIntegrated?: boolean;
};

export type Rule2Context = {
  region: DmpkRegion;
  sourceCurrency?: "CNY" | "USD";
};

export type RuleResult = {
  id: string;
  label: string;
  pricing?: PricingSpec;
  amount?: number;
  status: "priced" | "pending-confirm" | "excluded";
  reason?: string;
  actualQty?: number;
  billedQty?: number;
};

const coefficient = (id: string, label: string, value = 1): PricingCoefficient => ({ id, label, value });
const regionCoefficients = (context: Rule2Context) => {
  const item = regionCoefficient(context.region);
  return item ? [item] : [];
};

function result(id: string, label: string, pricing: PricingSpec): RuleResult {
  const trace = evaluatePricing(pricing);
  return trace
    ? { id, label, pricing, amount: trace.amount, status: "priced", actualQty: trace.actualQty, billedQty: trace.billedQty }
    : { id, label, pricing, status: "pending-confirm", reason: "计价参数不完整" };
}

export function compileAssayTask(task: AssayPricingTask, context: Rule2Context): RuleResult[] {
  if (task.actualSampleQty <= 0) return [{ id: task.id, label: `${task.kind.toUpperCase()} ${task.analyte}`, status: "excluded", reason: "没有实际送检样本，不生成收费行" }];
  const region = regionCoefficients(context);
  const ba = task.kind === "ba" ? [baCoefficient] : [];
  const methodFactor = coefficient("method", "方法开发系数", task.methodCoefficient ?? 1);
  const detectionFactor = coefficient("detection", "检测系数", task.detectionCoefficient ?? 1);
  const matrixFactor = 1 + Math.max(0, task.matrices.length - 1) * 0.5;
  const results: RuleResult[] = [];

  if (task.methodBasePrice !== undefined) {
    const pricing: PricingSpec = {
      mode: "flat",
      actualQty: 1,
      flatAmount: task.methodBasePrice * matrixFactor,
      coefficients: [methodFactor, ...ba, ...region],
      sourceCurrency: context.sourceCurrency ?? "USD",
      outputCurrency: "USD",
      cnyPerUsd: 6.5,
      rounding: "none",
    };
    results.push(result(`${task.id}-method`, `${task.analyte}方法开发`, pricing));
  } else {
    results.push({ id: `${task.id}-method`, label: `${task.analyte}方法开发`, status: "pending-confirm", reason: "已有方法按开发还是转移、联合方法或追加待测物优惠尚未确认" });
  }

  let detection: PricingSpec | undefined;
  if (task.pricingMode === "elisa-tiered") detection = elisaPricing(task.actualSampleQty, task.homogenization ?? true, [detectionFactor, ...ba, ...region]);
  if (task.pricingMode === "per-plate" && task.plateCapacity && task.platePrice !== undefined) detection = perPlatePricing({ actualQty: task.actualSampleQty, capacity: task.plateCapacity, platePrice: task.platePrice, coefficients: [detectionFactor, ...ba, ...region] });
  if (task.pricingMode === "per-sample" && task.sampleUnitPrice !== undefined) detection = perSamplePricing({ actualQty: task.actualSampleQty, unitPrice: task.sampleUnitPrice, minimumQty: task.minimumQty ?? 30, minimumEligible: task.minimumEligible, coefficients: [detectionFactor, ...ba, ...region], sourceCurrency: context.sourceCurrency ?? "USD" });
  results.push(detection
    ? result(`${task.id}-detection`, `${task.kind.toUpperCase()} ${task.analyte}样品检测`, detection)
    : { id: `${task.id}-detection`, label: `${task.kind.toUpperCase()} ${task.analyte}样品检测`, status: "pending-confirm", reason: "检测计价方式或价目未确认" });
  return results;
}

export function compileClinicalPathology(tasks: ClinicalPathologyTask[], context: Rule2Context): RuleResult[] {
  const kinds = new Set(tasks.map((task) => task.kind));
  return tasks.map((task) => {
    if (task.kind === "hematology-basic" && kinds.has("hematology-retic")) return { id: task.id, label: "普通血常规", status: "excluded", reason: "含网织红血常规与普通血常规互斥" };
    return result(task.id, task.kind, perSamplePricing({ actualQty: task.actualSampleQty, unitPrice: task.unitPrice, minimumEligible: false, coefficients: regionCoefficients(context), sourceCurrency: context.sourceCurrency ?? "USD" }));
  });
}

export function compileAda(plan: AdaPlan, context: Rule2Context): RuleResult[] {
  const coefficients = regionCoefficients(context);
  const out: RuleResult[] = [];
  if (plan.screening) out.push(result("ada-screening", "ADA 筛选", perPlatePricing({ actualQty: plan.screening.samples, capacity: plan.screening.capacity, platePrice: plan.screening.platePrice, coefficients })));
  if (plan.confirmation) out.push(result("ada-confirmation", "ADA 确认", perPlatePricing({ actualQty: plan.confirmation.samples, capacity: plan.confirmation.capacity, platePrice: plan.confirmation.platePrice, coefficients })));
  if (plan.titer) out.push(result("ada-titer", "ADA 滴度", perPlatePricing({ actualQty: plan.titer.samples, capacity: 8, platePrice: plan.titer.platePrice, coefficients })));
  if (!out.length) out.push({ id: "ada-scope", label: "ADA 检测范围", status: "pending-confirm", reason: "需确认筛选、确认、滴度分别做哪些" });
  return out;
}

export function compilePathology(tasks: PathologyTask[], context: Rule2Context): RuleResult[] {
  return tasks.map((task) => task.includedBy
    ? { id: task.id, label: task.kind, status: "excluded", reason: `已包含在${task.includedBy}，不重复收费` }
    : result(task.id, task.kind, perSamplePricing({ actualQty: task.qty, unitPrice: task.unitPrice, minimumEligible: false, hardCost: true, coefficients: regionCoefficients(context), sourceCurrency: context.sourceCurrency ?? "USD" })));
}

export function compileReport(plan: ReportPlan, context: Rule2Context): RuleResult[] {
  if (plan.kind === "ba-only") {
    if (plan.baMethodAndDetectionTotal === undefined) return [{ id: "report-ba", label: "BA Only 报告", status: "pending-confirm", reason: "缺少 BA 方法费与检测费合计" }];
    return [result("report-ba", "BA Only 报告", { mode: "flat", actualQty: 1, flatAmount: plan.baMethodAndDetectionTotal * 0.15, coefficients: regionCoefficients(context), sourceCurrency: "USD", outputCurrency: "USD", rounding: "none" })];
  }
  if (plan.kind === "integrated" && plan.baMergedIntoIntegrated) return [{ id: "report-integrated", label: "PK＋毒理整合报告", status: "pending-confirm", reason: "整合报告价档及 BA 合并后是否保留 15% 尚待甲方确认" }];
  if (plan.basePrice === undefined) return [{ id: "report", label: "报告费", status: "pending-confirm", reason: "报告价档尚未确认" }];
  const count = plan.separateExperiments ? 2 : 1;
  return [result("report", plan.kind === "integrated" ? "PK＋毒理整合报告" : `${plan.kind.toUpperCase()} 报告`, { mode: "per-unit", actualQty: count, unitPrice: plan.basePrice, coefficients: regionCoefficients(context), sourceCurrency: context.sourceCurrency ?? "USD", outputCurrency: "USD", cnyPerUsd: 6.5, rounding: "none" })];
}
