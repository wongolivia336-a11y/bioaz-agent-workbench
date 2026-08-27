/* 演示镜头。
   -------------------------------------------------------------------
   **这是演示脚手架，不是产品功能。上线前删掉。**

   真实的 CRO 里一个人只有一个岗位，不会切换——侧栏那个账号切换器本身就已经
   是演示装置了（见 ticketData.ts 的注释）。所以在它旁边再加一层镜头是一致的，
   不是新增了一个产品概念。

   为什么需要它：QA 和 DMPK 两条线交织在同一个收件箱、同一棵项目树里，
   演示其中一条时另一条一直在旁边晃。镜头把整个应用收敛到一条线上：
   侧栏只留该线的任务、收件箱只留该线的工单、账号切换器只列这条线上的角色。

   为什么用 URL 参数而不是多个仓库：一份代码、一次部署、三个可以直接发出去的
   链接。三个仓库意味着每个 bug 修三遍，一天就分叉——而这个项目一天改几十次。
   若之后要独立域名，按 docs/REPOSITORY_STRATEGY.md：同一仓库连多个 Vercel
   project，用环境变量决定默认镜头，**不 fork 代码**。 */

export type DemoLens = "all" | "qa-review" | "dmpk-quotation";

export type DemoLensDefinition = {
  value: DemoLens;
  label: string;
  /** 只留这个 module 的任务与工单。null = 不筛。 */
  moduleId: "qa-review" | "dmpk-quotation" | null;
  /** 工单类型筛选用的显示名，跟 ticketKindLabel 对齐。 */
  kindLabel: string | null;
  /** 这条线上可切换的账号。空数组 = 全部。 */
  accountIds: string[];
};

export const DEMO_LENSES: DemoLensDefinition[] = [
  { value: "all", label: "总览", moduleId: null, kindLabel: null, accountIds: [] },
  /* 撰写人是一线实验员林一一，审批人是王林彬。 */
  { value: "qa-review", label: "QA 审核", moduleId: "qa-review", kindLabel: "QA 审核", accountIds: ["acct-lin", "acct-wang"] },
  /* 撰写人是 DMPK 报价同事赵敏，审批人是王林彬。 */
  { value: "dmpk-quotation", label: "DMPK 报价", moduleId: "dmpk-quotation", kindLabel: "DMPK 报价", accountIds: ["acct-zhao", "acct-wang"] },
];

export const getDemoLens = (value: DemoLens) =>
  DEMO_LENSES.find((lens) => lens.value === value) ?? DEMO_LENSES[0];

/** 从地址栏读。`?view=dmpk` / `?view=qa`，认不出来就当总览。 */
export function readDemoLens(search: string): DemoLens {
  const value = new URLSearchParams(search).get("view");
  if (value === "dmpk" || value === "dmpk-quotation") return "dmpk-quotation";
  if (value === "qa" || value === "qa-review") return "qa-review";
  return "all";
}

/** 写回地址栏。总览就把参数去掉——干净的 URL 本身就是「没有镜头」的意思。 */
export function demoLensHref(lens: DemoLens) {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  if (lens === "all") url.searchParams.delete("view");
  else url.searchParams.set("view", lens === "dmpk-quotation" ? "dmpk" : "qa");
  return url.pathname + url.search;
}
