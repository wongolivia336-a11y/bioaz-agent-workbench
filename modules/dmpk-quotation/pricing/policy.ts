import type { PricingCoefficient, PricingSpec, PricingTier } from "../../../lib/workbench/pricingEngine";

export const DMPK_PRICING_POLICY_VERSION = "2.0-draft";
export const DEFAULT_CNY_PER_USD = 6.5;

export type DmpkRegion = "domestic" | "apac" | "europe-americas";

export const regionCoefficient = (region: DmpkRegion): PricingCoefficient | undefined => {
  if (region === "domestic") return undefined;
  return {
    id: `region-${region}`,
    label: region === "apac" ? "亚太地区系数" : "欧美地区系数",
    value: region === "apac" ? 1.3 : 1.5,
    skipForHardCost: true,
  };
};

export function perSamplePricing(input: {
  actualQty: number;
  unitPrice: number;
  minimumQty?: number;
  minimumEligible?: boolean;
  coefficients?: PricingCoefficient[];
  hardCost?: boolean;
  sourceCurrency?: "CNY" | "USD";
}): PricingSpec {
  return {
    mode: "per-unit",
    actualQty: input.actualQty,
    unitPrice: input.unitPrice,
    minimumQty: input.minimumEligible ? input.minimumQty : undefined,
    coefficients: input.coefficients,
    hardCost: input.hardCost,
    sourceCurrency: input.sourceCurrency ?? "USD",
    outputCurrency: "USD",
    cnyPerUsd: DEFAULT_CNY_PER_USD,
    rounding: "none",
  };
}

export function perPlatePricing(input: { actualQty: number; capacity: number; platePrice: number; coefficients?: PricingCoefficient[] }): PricingSpec {
  return {
    mode: "per-plate",
    actualQty: input.actualQty,
    plateCapacity: input.capacity,
    platePrice: input.platePrice,
    coefficients: input.coefficients,
    sourceCurrency: "USD",
    outputCurrency: "USD",
    rounding: "none",
  };
}

export function elisaPricing(actualQty: number, homogenization: boolean, coefficients: PricingCoefficient[] = []): PricingSpec {
  const tiers: PricingTier[] = homogenization
    ? [{ maxQty: 30, mode: "flat", amount: 1350 }, { mode: "per-unit", amount: 45 }]
    : [{ maxQty: 30, mode: "flat", amount: 1000 }, { mode: "per-unit", amount: 35 }];
  return { mode: "tiered", actualQty, tiers, coefficients, sourceCurrency: "USD", outputCurrency: "USD", rounding: "none" };
}

export const baCoefficient: PricingCoefficient = { id: "ba-1.5", label: "BA 方法与检测系数", value: 1.5 };
