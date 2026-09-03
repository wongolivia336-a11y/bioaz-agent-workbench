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

export type DemoLens = "all" | "qa-review" | "dmpk-quotation" | "tumor-quotation";

export type DemoLensDefinition = {
  value: DemoLens;
  label: string;
  /** 只留这个 module 的任务与工单。null = 不筛。 */
  moduleId: "qa-review" | "dmpk-quotation" | "tumor-quotation" | null;
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
  /* 撰写人是肿瘤报价同事陈默，审批人同样是王林彬——两条报价线共用一位审批人，
     这不是偷懒：CRO 里报价审批本来就归同一个岗位，让他在两条线上都出现，
     「同一个人手上压着两条线的单」这件事才演得出来。 */
  { value: "tumor-quotation", label: "肿瘤报价", moduleId: "tumor-quotation", kindLabel: "肿瘤报价", accountIds: ["acct-chen", "acct-wang"] },
];

export const getDemoLens = (value: DemoLens) =>
  DEMO_LENSES.find((lens) => lens.value === value) ?? DEMO_LENSES[0];

/* 不带参数时停在哪一档。近期要演示的就是 DMPK 报价这条线,所以直接打开
   就是它——演示前少一次「记得先切镜头」。
   要换成别的线,改这一个常量,读和写会跟着一起变(见下面两个函数)。 */
export const DEFAULT_LENS: DemoLens = "dmpk-quotation";

/* 参数名不能叫 view——那个名字早就被深链占用了(view=library / digital-team /
   quotation-management),而且那段逻辑是「只要 view 有值就把 query 抹掉」,
   所以 ?view=dmpk 每次加载都会被清干净。叫 line:这一维本来就是「业务线」。 */
export const LENS_PARAM_NAME = "line";

/** URL 里的短名。默认那一档不写进地址栏,所以它不在这张表的写入侧。 */
const LENS_PARAM: Record<DemoLens, string> = {
  "all": "all",
  "qa-review": "qa",
  "dmpk-quotation": "dmpk",
  "tumor-quotation": "tumor",
};

/** 从地址栏读。认不出来就用默认档。 */
export function readDemoLens(search: string): DemoLens {
  const value = new URLSearchParams(search).get(LENS_PARAM_NAME);
  if (value === "dmpk" || value === "dmpk-quotation") return "dmpk-quotation";
  if (value === "tumor" || value === "tumor-quotation") return "tumor-quotation";
  if (value === "qa" || value === "qa-review") return "qa-review";
  if (value === "all" || value === "overview") return "all";
  return DEFAULT_LENS;
}

/* 写回地址栏。**默认那一档才把参数去掉**——「干净 URL = 默认值」这条规则
   必须跟 readDemoLens 对称,否则切到非默认档、一刷新就被打回默认,
   而用户以为自己切过了。 */
export function demoLensSearch(lens: DemoLens, currentHref: string) {
  const url = new URL(currentHref);
  if (lens === DEFAULT_LENS) url.searchParams.delete(LENS_PARAM_NAME);
  else url.searchParams.set(LENS_PARAM_NAME, LENS_PARAM[lens]);
  return url.pathname + url.search;
}
