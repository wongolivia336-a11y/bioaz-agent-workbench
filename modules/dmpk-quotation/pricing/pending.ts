export type ConfirmationOwner = "customer" | "price-owner" | "technical";

export type PricingConfirmation = {
  id: string;
  owner: ConfirmationOwner;
  question: string;
  affectedLineIds: string[];
  blocking: boolean;
  fallback: string;
  status: "open" | "resolved";
  answer?: string;
};

export const confirmationOwnerLabels: Record<ConfirmationOwner, string> = {
  customer: "客户／需求方",
  "price-owner": "甲方／价目负责人",
  technical: "技术／系统",
};

export function canPublishFormalQuote(confirmations: PricingConfirmation[]): boolean {
  return !confirmations.some((item) => item.blocking && item.status === "open");
}
