/**
 * 报价相关的权限——演示级。
 *
 * 2026-09-21 会议把权限分级明确后置了，但用户要在原型里用左下角的账号切换器
 * 演出「谁能改什么」：所以不建 permissions 模型、不进后端，只按账号上一个「级别」推三个布尔。
 *
 *   级别        改本单临时价 / 补价   看完整价目表   改底表（后台）
 *   SD              ✓                  ✓             ✓
 *   SD 助理         ✓                  ✗             ✗
 *   （没有级别）    ✗                  ✗             ✗
 *
 * 会上的原话是「SD 助理改临时价、SD 改底表」；用户 2026-09-21 晚确认：助理能改临时价，
 * 审批人算 SD（能改底表），项目负责人同 SD。
 *
 * 会话拿不到账号（单独渲染时）按全开处理——门槛是壳层加的，不是会话自带的。
 */
export type AccountGrade = "SD" | "SD 助理";

export type QuotePermissions = {
  /** 板块里的改价 / 补价——只作用于本单 */
  canAdjustTempPrice: boolean;
  /** 完整价目表那扇门 */
  canViewCatalog: boolean;
  /** 后台改底表（标准价格） */
  canEditCatalog: boolean;
};

export const fullQuotePermissions: QuotePermissions = { canAdjustTempPrice: true, canViewCatalog: true, canEditCatalog: true };

export function quotePermissionsFor(account: { grade?: AccountGrade } | null | undefined): QuotePermissions {
  if (account?.grade === "SD") return fullQuotePermissions;
  if (account?.grade === "SD 助理") return { canAdjustTempPrice: true, canViewCatalog: false, canEditCatalog: false };
  return { canAdjustTempPrice: false, canViewCatalog: false, canEditCatalog: false };
}
