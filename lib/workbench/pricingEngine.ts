/**
 * 通用计价内核。
 *
 * 这里只处理数学与可追溯结果，不认识 PK、TK、BA、动物或报告。
 * 业务规则（某任务是否保底、哪些系数可用）由业务模块组装 PricingSpec。
 */
export type PricingCurrency = "CNY" | "USD";
export type PricingMode = "per-unit" | "flat" | "per-plate" | "tiered";

export type PricingTier = {
  /** 含该上限；不填表示最后一档。 */
  maxQty?: number;
  mode: "flat" | "per-unit";
  amount: number;
};

export type PricingCoefficient = {
  id: string;
  label: string;
  value: number;
  /** 地区等系数不作用于硬成本。 */
  skipForHardCost?: boolean;
};

export type PricingSpec = {
  mode: PricingMode;
  actualQty: number;
  unitPrice?: number;
  flatAmount?: number;
  minimumQty?: number;
  plateCapacity?: number;
  platePrice?: number;
  tiers?: PricingTier[];
  coefficients?: PricingCoefficient[];
  hardCost?: boolean;
  sourceCurrency?: PricingCurrency;
  outputCurrency?: PricingCurrency;
  /** 1 USD 对应的 CNY；只有币种不同时才使用。 */
  cnyPerUsd?: number;
  /** 2.0 尚未锁定统一取整时保持 none。 */
  rounding?: "none" | "line-2dp";
};

export type PricingTrace = {
  actualQty: number;
  billedQty: number;
  baseAmount: number;
  coefficients: PricingCoefficient[];
  coefficientProduct: number;
  sourceAmount: number;
  amount: number;
  currency: PricingCurrency;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const normalize = (value: number) => Math.round(value * 1e10) / 1e10;

function tierAmount(spec: PricingSpec, qty: number): number | undefined {
  const tier = spec.tiers?.find((candidate) => candidate.maxQty === undefined || qty <= candidate.maxQty);
  if (!tier) return undefined;
  return tier.mode === "flat" ? tier.amount : qty * tier.amount;
}

function convertCurrency(amount: number, source: PricingCurrency, output: PricingCurrency, cnyPerUsd?: number): number | undefined {
  if (source === output) return amount;
  if (!cnyPerUsd || cnyPerUsd <= 0) return undefined;
  return source === "CNY" ? amount / cnyPerUsd : amount * cnyPerUsd;
}

export function evaluatePricing(spec: PricingSpec, manualUnitPrice?: number): PricingTrace | undefined {
  if (!Number.isFinite(spec.actualQty) || spec.actualQty < 0) return undefined;
  const billedQty = spec.minimumQty === undefined ? spec.actualQty : Math.max(spec.actualQty, spec.minimumQty);
  const unitPrice = manualUnitPrice ?? spec.unitPrice;
  let baseAmount: number | undefined;

  if (spec.mode === "per-unit" && unitPrice !== undefined) baseAmount = billedQty * unitPrice;
  if (spec.mode === "flat") baseAmount = manualUnitPrice ?? spec.flatAmount ?? spec.unitPrice;
  if (spec.mode === "per-plate" && spec.plateCapacity && spec.plateCapacity > 0) {
    const platePrice = manualUnitPrice ?? spec.platePrice;
    if (platePrice !== undefined) baseAmount = Math.ceil(spec.actualQty / spec.plateCapacity) * platePrice;
  }
  if (spec.mode === "tiered") baseAmount = tierAmount(spec, spec.actualQty);
  if (baseAmount === undefined) return undefined;

  const coefficients = (spec.coefficients ?? []).filter((item) => !(spec.hardCost && item.skipForHardCost));
  const coefficientProduct = coefficients.reduce((product, item) => product * item.value, 1);
  const sourceAmount = baseAmount * coefficientProduct;
  const sourceCurrency = spec.sourceCurrency ?? "CNY";
  const outputCurrency = spec.outputCurrency ?? sourceCurrency;
  const converted = convertCurrency(sourceAmount, sourceCurrency, outputCurrency, spec.cnyPerUsd);
  if (converted === undefined) return undefined;
  const amount = spec.rounding === "line-2dp" ? round2(converted) : normalize(converted);

  return { actualQty: spec.actualQty, billedQty, baseAmount, coefficients, coefficientProduct, sourceAmount, amount, currency: outputCurrency };
}
