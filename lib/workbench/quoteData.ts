/**
 * DMPK / TOX 报价单。
 *
 * 结构照着真实产物来:同一张报价有两种形态,共用一套锚点。
 *
 *   Excel「计算表」—— 左半边计价明细(含单价),右半边参数与小计。对内。
 *   Word「报价书」 —— Category / Item / Description 三列 + 合计 + 条款。对客户,
 *                     **没有单价、没有参数**。
 *
 * 审核发生在 Excel 那一侧,因为报价复核是**算术**不是读文章:要核的是参数填得对
 * 不对、单价走没走对档、折扣口径对不对。Word 那一侧是同一批条目换个说法,
 * 所以两边锚点同名——切视图不丢批注。
 *
 * Excel 原表里有一句「Yellow-highlighted fields are editable」,标出了哪些格子是
 * 人可以改的。那批格子就是下面的 quoteParams——不用另发明一套锚点。
 */

/** 计价条目。Word 和 Excel 都有,Excel 多一列单价。 */
export type QuoteItem = {
  id: string;
  category: string;
  item: string;
  description: string;
  /** 单价（USD）。Word 版不展示。 */
  unitPrice?: number;
  note?: string;
};

/** 可编辑参数（原表里的黄格子）。只在 Excel 形态里存在。 */
export type QuoteParam = {
  id: string;
  label: string;
  value: string;
  /** 这个参数喂给哪一项小计——批注一个参数时要说清它会影响什么 */
  feeds?: string;
};

/** 计算出来的小计。它们不可直接编辑,是参数的结果。 */
export type QuoteSubtotal = {
  id: string;
  label: string;
  amount: number;
};

export const quoteMeta = {
  title: "Single/Repeat dose oligonucleotide toxicity",
  docTitle: "Study Cost Estimate and Outline Protocol",
  validity: "The price estimate for the study listed below is valid for 30 days.",
  currency: "USD",
  packagePrice: 33748,
  otherFees: 0,
  totalPrice: 33748,
  standardPrice: 33748,
  discountedPrice: 33748,
};

export const quoteItems: QuoteItem[] = [
  { id: "i-species", category: "Test system", item: "Species and strain", description: "C57 Mouse, 2 animals/group, 2 groups", unitPrice: 10, note: "Animal Usage" },
  { id: "i-dosing", category: "In-life", item: "Animal dosing", description: "Single/Repeat dosing, 1 dose per group; the dosing route will be provided by Sponsor.", unitPrice: 50, note: "Dose (prepared once)" },
  { id: "i-bodyweight", category: "In-life", item: "Body weight", description: "Frequency will be provided by Sponsor", unitPrice: 8, note: "Unit price for dosing" },
  { id: "i-clinobs", category: "In-life", item: "Clinical observation", description: "Cage-side and detail clinical observation. Frequency will be provided by Sponsor.", unitPrice: 42, note: "In life -TOX- (per animal/week)" },
  { id: "i-food", category: "In-life", item: "Food Consumption", description: "Quantitative per cage.", unitPrice: 24, note: "In life -TK-" },
  { id: "i-necropsy", category: "In-life", item: "Macroscopic necropsy", description: "Postmortem and macroscopic necropsy will be performed.", unitPrice: 15, note: "Gross necropsy" },
  { id: "i-period", category: "In-life", item: "In-life Experiment Period", description: "7 days (approximately 1 week)" },
  { id: "i-hema", category: "Clinical Pathology", item: "Hematology", description: "Collect whole blood (EDTA-K2 anticoagulant) for hematology at 1 time point.", unitPrice: 38, note: "Hematology" },
  { id: "i-chem", category: "Clinical Pathology", item: "Serum chemistry", description: "Collect serum for clinical chemistry at 1 time point.", unitPrice: 58, note: "Serum biochemistry" },
  { id: "i-coag", category: "Clinical Pathology", item: "Coagulation", description: "Collect whole blood (sodium citrate anticoagulant) for coagulation.", unitPrice: 48, note: "Coagulation" },
  { id: "i-sampling", category: "TK", item: "Blood Sampling", description: "Collect serial TK plasma samples at 10 time points per animal.", unitPrice: 8, note: "Unit price for blood collection" },
  { id: "i-method", category: "TK", item: "Bioanalysis (Small Molecular)", description: "Develop an LC-MS/MS (siRNA duplex) method for 1 analyte.", unitPrice: 4000, note: "Method development" },
  { id: "i-analysis", category: "TK", item: "Sample analysis", description: "Analyze 1 analyte across 90 TK samples.", unitPrice: 50, note: "Unit price for plasma sample analysis" },
  { id: "i-tissue", category: "Tissue Collection", item: "Tissue collection, weighing and fixation", description: "After euthanasia, collect 6 tissues per animal, weigh and fix.", unitPrice: 22.5, note: "Tissue collection, weighing, and fixation" },
  { id: "i-report", category: "Reporting", item: "Project management, data processing and reporting", description: "Calculate PK parameters using WinNonlin where applicable.", unitPrice: 3000, note: "Report (discount applicable)" },
];

export const quoteParams: QuoteParam[] = [
  { id: "p-tox-animals", label: "Number of TOX animals/group", value: "2", feeds: "s-animal" },
  { id: "p-tox-groups", label: "Number of TOX groups", value: "2", feeds: "s-animal" },
  { id: "p-duration", label: "Study duration (weeks)", value: "1", feeds: "s-toxvivo" },
  { id: "p-doses", label: "Number of doses/group", value: "1", feeds: "s-toxvivo" },
  { id: "p-satellite", label: "Use of satellite groups", value: "Yes", feeds: "s-tkvivo" },
  { id: "p-tk-animals", label: "Number of TK animals/group", value: "3", feeds: "s-tkvivo" },
  { id: "p-tk-groups", label: "Number of TK groups", value: "3", feeds: "s-tkvivo" },
  { id: "p-hema", label: "Hematology time points/animal", value: "1", feeds: "s-clinpath" },
  { id: "p-chem", label: "Serum biochemistry time points/animal", value: "1", feeds: "s-clinpath" },
  { id: "p-coag", label: "Coagulation/animal", value: "1", feeds: "s-clinpath" },
  { id: "p-tk-points", label: "TK blood sampling time points/animal", value: "10", feeds: "s-tkanalysis" },
  { id: "p-compounds", label: "Number of compounds", value: "1", feeds: "s-tkanalysis" },
  { id: "p-samples", label: "Samples analyzed", value: "90", feeds: "s-tkanalysis" },
  { id: "p-tissues", label: "Number of TOX tissue samples/animal", value: "6", feeds: "s-tissuefix" },
  { id: "p-discount", label: "Discount", value: "0.9", feeds: "s-report" },
];

export const quoteSubtotals: QuoteSubtotal[] = [
  { id: "s-animal", label: "Animal Usage Fee", amount: 40 },
  { id: "s-toxvivo", label: "TOX in vivo cost (excluding animal usage fee)", amount: 540 },
  { id: "s-tkvivo", label: "TK in vivo cost (excluding animal usage fee)", amount: 684 },
  { id: "s-clinpath", label: "Clinical pathology cost", amount: 864 },
  { id: "s-tkanalysis", label: "TK analysis + blood collection cost", amount: 26580 },
  { id: "s-tissuefix", label: "Fixed cost for pathological tissue collection", amount: 540 },
  { id: "s-report", label: "Report", amount: 4500 },
];

/* ─── 批注 ───────────────────────────────────────────────────────────────
   跟 QA 的 QaFinding 同构:锚点 + 分类 + 严重度 + 说明。多一个 suggested。

   多这一个字段是因为两边被审的东西不一样:QA 的批注是「这句话有问题」,下一版
   靠人读着改;报价的批注是「这个数应该是 6 不是 2」——建议值能被下一版直接核验,
   不用人肉比对。没有它,同一张报价来回三轮还是靠记性。

   source 恒为人工:报价复核不带 AI,所以 QA 那一维（AI/人工两色）在这里天然为空。 */
export type QuoteNoteCategory = "param" | "price" | "basis" | "missing" | "notApplicable";

/* 五个分类要能把「这一条哪里不对」分干净,而且各自指向一个明确的处置动作:
   前三个是「数改一下」,后两个是「这条该增/该删」。

   notApplicable 原先叫「此项不适用」——只说了状态,没说该怎么办,读的人还得
   自己推一步(不适用……所以呢?)。叫「不应计费」就把结论写在标签上了,而且跟
   「缺漏项」正好成一对:一个是少报了,一个是多报了。
   basis 原先写「口径/折扣有误」,斜杠是把两件事塞进一个标签;折扣本来就是计价
   口径的一种,合并成「计价口径有误」。 */
export const quoteNoteCategoryLabel: Record<QuoteNoteCategory, string> = {
  param: "参数取值有误",
  price: "单价有误",
  basis: "计价口径有误",
  missing: "缺漏项",
  notApplicable: "不应计费",
};

/** 哪些分类需要填建议值。缺漏项和不应计费没有值可改——一个是还没有,一个是要去掉。 */
export const quoteNoteNeedsValue: Record<QuoteNoteCategory, boolean> = {
  param: true, price: true, basis: true, missing: false, notApplicable: false,
};

/* 严重度的说法定义在这里,不散在三个组件里各写各的。
   「不改不能过 / 仅提醒」是口语,写进要随工单留痕的记录里不合适;而且它说的是
   审批人的态度,不是给撰写人的指令。改成「必须修订 / 建议修订」——对方看到的是
   自己要做什么,而这两条正是退回时唯一要区分的事。 */
export const quoteNoteSeverityLabel: Record<QuoteNote["severity"], string> = {
  blocking: "必须修订",
  advisory: "建议修订",
};

export type QuoteNote = {
  anchorId: string;
  category: QuoteNoteCategory;
  /** blocking = 必须修订,阻止归档;advisory = 建议修订,随单留档不拦 */
  severity: "blocking" | "advisory";
  text: string;
  /** 建议值。下一版据此核验「改了没有」。 */
  suggested?: string;
  /* 谁写的、什么时候。一份报价可能来回几轮、经手几个人,一条批注不署名就答不了
     「这句话该问谁」——而追问原提出人正是审核来回时最常做的事。 */
  author: string;
  authorRole: string;
  at: string;
  /** 选中的那段原文。跟 QA 一样把它带上:清单给结论,引用给证据。 */
  quote?: string;
};
