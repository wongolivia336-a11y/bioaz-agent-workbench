import type { ComposerAttachment } from "../../lib/workbench/composerAttachments";

/* QA 审核的静态素材。
   -------------------------------------------------------------------
   全部是假数据，但结构按真实审核台来：AI 批注是「条目」不是「文本块」，
   每条带页码定位与处置状态，因为撰写人要逐条消化、审批人要逐条采纳。
   审批结论落在版本上，所以版本是一等公民，不是一个下拉框的装饰。 */

export type QaFindingCategory = "time" | "page" | "format" | "content";

/**
 * 两个轴，不能合并成一个字段。
 *
 * QaFindingState  —— QA 认不认这条问题（人对 AI 判断的处置）
 * QaRepairStatus  —— 撰写人改没改好（下一版对这条问题的回应）
 *
 * 一条问题可以同时是「QA 已采纳」+「撰写人未修复」，也可以是
 * 「QA 已忽略」+「撰写人反而改了」。塞进一个枚举就永远说不清。
 */
export type QaFindingState = "open" | "accepted" | "dismissed";
export type QaRepairStatus = "fixed" | "partial" | "unfixed" | "regressed";

export type QaFinding = {
  id: string;
  category: QaFindingCategory;
  /** 哪一版提出的。没有它就跨不过版本边界，"上一轮的问题解决了吗"无从谈起 */
  raisedIn: string;
  /** ai = 机器提的；human = 审核人手工补的。两者是同一类对象，都要被退回、被验证、被标状态 */
  source: "ai" | "human";
  /* 文档页 / 内部页。这份报告里两者经常不一致（文档第 2 页上印着「1/7」），
     再加上版本号，同一屏上有三套编号在打架，所以永远成对显示、不许出现裸数字。 */
  docPage: number;
  innerPage?: string;
  severity: "error" | "warning";
  recordId: string;
  text: string;
};

/**
 * 某一版对某条历史问题的复核结论。
 * 一条问题在每一轮复核里各有一条，所以是 (findingId × checkedIn) 的组合。
 */
export type QaRepair = {
  findingId: string;
  /** 在哪一版上复核的 */
  checkedIn: string;
  status: QaRepairStatus;
  /** 支撑这个结论的具体变更。空数组 = 这一版根本没动过它 */
  evidence: string[];
  /** AI 为什么这么判。UI 里点开才看，但必须存 */
  rationale: string;
};

export type QaVersion = {
  id: string;
  label: string;
  submittedAt: string;
  author: string;
  status: "draft" | "review" | "rejected" | "approved" | "archived";
  /* 这一版应该和谁比。取「上一次被退回的版本」而不是「上一个版本」——
     撰写人可能连提两版而中间没有审核，跟上一版比会漏掉一半改动；
     审批人问的是「自从我上次说不行以来，改了什么」。 */
  comparedAgainst?: string;
};

export type QaNote = {
  id: string;
  source: "ai" | "human";
  author: string;
  time: string;
  text: string;
};

export type QaDiffRow = {
  id: string;
  /** 这一行是哪两版之间的差异 */
  fromVersion: string;
  toVersion: string;
  /** 和问题一样，页码成对给 */
  page: number;
  innerPage?: string;
  field: string;
  before: string;
  after: string;
  kind: "changed" | "added" | "removed";
  /* 这处修改回应的是哪条问题。为空 = 无关修改——撰写人顺手动的，
     不对应任何一条 QA 意见。这类修改单独成组，它是审批人要额外看一眼的东西。 */
  findingId?: string;
};

export const qaFindingCategoryLabel: Record<QaFindingCategory, string> = {
  time: "时间逻辑",
  page: "页码逻辑",
  format: "格式规范",
  content: "内容一致性",
};

export const qaFindingStateLabel: Record<QaFindingState, string> = {
  open: "待处置",
  accepted: "已采纳",
  dismissed: "已忽略",
};

/* v3 跟 v1 比而不是跟 v2 比：v2 提交后被退回，v3 是针对那次退回的回应。
   如果 v2 没被审就又提了 v3，跟 v2 比会漏掉 v1→v2 那部分改动。 */
export const qaVersions: QaVersion[] = [
  { id: "v3", label: "202612011511 第三版", submittedAt: "2026-01-12 15:22", author: "林一一", status: "review", comparedAgainst: "v2" },
  { id: "v2", label: "202611281043 第二版", submittedAt: "2025-12-28 10:43", author: "林一一", status: "rejected", comparedAgainst: "v1" },
  { id: "v1", label: "202611150902 第一版", submittedAt: "2025-11-15 09:02", author: "林一一", status: "rejected" },
];

/** 当前正在审的版本。UI 一律从这里取，不要写死 qaVersions[0] */
export const qaCurrentVersionId = "v3";

export const qaDocument = {
  title: "硝酸异哈哈梨酯检测报告.pdf",
  reportNo: "IARC-R-20253333063",
  sampleName: "硝酸异哈哈梨酯",
  testType: "委托检验",
  applicant: "江苏小小药业有限公司",
  issuer: "上海医药工业研究院有限公司分析测试中心",
  pageCount: 7,
};

/* f1~f6 是 v2 那轮提的，v3 要逐条回答它们；f7 是 v3 上新冒出来的。
   两批混在同一个数组里，靠 raisedIn 区分——它们是同一类对象，
   排序和处置逻辑完全一样，没有理由拆成两个列表。 */
export const qaFindings: QaFinding[] = [
  { id: "f1", raisedIn: "v2", source: "ai", category: "time", docPage: 1, innerPage: "1/7", severity: "error", recordId: "记录1-COA", text: "收检日期（2025-12-12）> 检测开始日期（2025-11-11），时间逻辑有问题" },
  { id: "f2", raisedIn: "v2", source: "ai", category: "time", docPage: 1, innerPage: "1/7", severity: "error", recordId: "记录1-COA", text: "审核时间（2025-12-11）> 批准时间（2025-10-10），时间逻辑有问题" },
  { id: "f3", raisedIn: "v2", source: "ai", category: "time", docPage: 8, innerPage: "7/7", severity: "error", recordId: "记录1-COA", text: "盖章日期（2025-10-09）< 批准时间（2025-10-10），盖章动作必须发生在其余流程之后" },
  { id: "f4", raisedIn: "v2", source: "ai", category: "page", docPage: 2, innerPage: "1/7", severity: "warning", recordId: "记录1-COA", text: "页码标记列表存在缺页问题（缺少第 1 页，但总页数应为 7 页）" },
  { id: "f5", raisedIn: "v2", source: "ai", category: "page", docPage: 5, innerPage: "4/7", severity: "warning", recordId: "记录1-COA", text: "页码标记列表存在多页问题（出现“第 17 页/共 7 页”）" },
  { id: "f6", raisedIn: "v2", source: "human", category: "content", docPage: 3, innerPage: "2/7", severity: "warning", recordId: "记录1-COA", text: "样品名称在正文与封面不一致（正文写“硝酸异哈梨酯”，封面写“硝酸异哈哈梨酯”）" },
  { id: "f7", raisedIn: "v3", source: "ai", category: "content", docPage: 6, innerPage: "5/7", severity: "warning", recordId: "记录1-COA", text: "本版新增的留样说明与第 2 页「样品已全部消耗」相互矛盾" },
];

/* v3 相对 v2 的变更。有 findingId 的是在回应某条问题，没有的是无关修改。 */
export const qaDiffRows: QaDiffRow[] = [
  { id: "d1", fromVersion: "v2", toVersion: "v3", page: 1, innerPage: "1/7", field: "收检日期", before: "2025-12-12", after: "2025-11-10", kind: "changed", findingId: "f1" },
  { id: "d2", fromVersion: "v2", toVersion: "v3", page: 1, innerPage: "1/7", field: "审核时间", before: "2025-12-11", after: "2025-10-09", kind: "changed", findingId: "f2" },
  { id: "d3", fromVersion: "v2", toVersion: "v3", page: 5, innerPage: "4/7", field: "页码标记", before: "第 17 页/共 7 页", after: "第 4 页/共 7 页", kind: "changed", findingId: "f5" },
  { id: "d4", fromVersion: "v2", toVersion: "v3", page: 3, innerPage: "2/7", field: "样品名称", before: "硝酸异哈梨酯", after: "硝酸异哈哈梨酯", kind: "changed", findingId: "f6" },
  { id: "d5", fromVersion: "v2", toVersion: "v3", page: 6, innerPage: "5/7", field: "留样说明", before: "—", after: "留样期限 24 个月，存放于 A 区冷库", kind: "added" },
  { id: "d6", fromVersion: "v2", toVersion: "v3", page: 4, innerPage: "3/7", field: "检测依据", before: "《中国药典》2025 年版四部通则 0441", after: "《中国药典》2025 年版四部通则 0441、0402", kind: "changed" },
];

/**
 * v3 对 v2 那轮六条问题的复核结论。
 *
 * 这份假数据刻意覆盖了四种状态，而不是全绿——审批人真正需要界面帮忙的
 * 恰恰是「有几条没改好」的时候，全绿的演示看不出这套东西有什么用。
 */
export const qaRepairs: QaRepair[] = [
  { findingId: "f1", checkedIn: "v3", status: "fixed", evidence: ["d1"], rationale: "收检日期改为 2025-11-10，早于检测开始日期 2025-11-11，时间顺序成立。" },
  /* 改了，但改出了新毛病：审核时间被挪到批准时间之前，越过了另一条规则 */
  { findingId: "f2", checkedIn: "v3", status: "regressed", evidence: ["d2"], rationale: "审核时间改为 2025-10-09，虽然不再晚于批准时间，但早于收检日期 2025-11-10，审核不可能发生在收样之前。" },
  { findingId: "f3", checkedIn: "v3", status: "unfixed", evidence: [], rationale: "盖章日期仍为 2025-10-09，早于批准时间 2025-10-10，本版未做改动。" },
  { findingId: "f4", checkedIn: "v3", status: "unfixed", evidence: [], rationale: "页码标记仍从「1/7」开始缺页，本版未做改动。" },
  { findingId: "f5", checkedIn: "v3", status: "fixed", evidence: ["d3"], rationale: "「第 17 页/共 7 页」已改为「第 4 页/共 7 页」，与文档第 5 页对应。" },
  /* 名字统一了，但统一到了封面那个疑似错字的写法上 */
  { findingId: "f6", checkedIn: "v3", status: "partial", evidence: ["d4"], rationale: "正文已与封面一致，但两处现在都写作「硝酸异哈哈梨酯」；与委托单登记的品名仍不符，需人工确认以哪个为准。" },
];

export const qaRepairStatusLabel: Record<QaRepairStatus, string> = {
  fixed: "已修复",
  partial: "部分修复",
  unfixed: "未修复",
  regressed: "改动引入新问题",
};

/* 排序权重：审批人先要看没弄好的。已修复的沉到最后——它们不需要注意力，
   但也不能不显示，否则没法回答"上一轮那六条现在怎么样了"。 */
const repairWeight: Record<QaRepairStatus, number> = { regressed: 0, unfixed: 1, partial: 2, fixed: 3 };

/** 页码永远成对显示。三套编号（版本 / 文档页 / 内部标注页）同屏，裸数字必然被误读。 */
export function formatPageRef(docPage: number, innerPage?: string) {
  return innerPage ? `文档第 ${docPage} 页 · 标注 ${innerPage}` : `文档第 ${docPage} 页`;
}

/** 这一轮要回答的遗留问题：上一被比较版本提出的那批，按"没弄好的在前"排。 */
export function pendingIssues(versionId: string = qaCurrentVersionId) {
  const version = qaVersions.find((item) => item.id === versionId);
  const base = version?.comparedAgainst;
  if (!base) return [];
  return qaFindings
    .filter((finding) => finding.raisedIn === base)
    .map((finding) => ({
      finding,
      repair: qaRepairs.find((item) => item.findingId === finding.id && item.checkedIn === versionId) ?? null,
      changes: qaDiffRows.filter((row) => row.findingId === finding.id && row.toVersion === versionId),
    }))
    .sort((a, b) => (repairWeight[a.repair?.status ?? "unfixed"]) - (repairWeight[b.repair?.status ?? "unfixed"]));
}

/** 本版新冒出来的问题。和遗留问题分开取，因为它们没有"修没修好"这一说。 */
export function newIssues(versionId: string = qaCurrentVersionId) {
  return qaFindings.filter((finding) => finding.raisedIn === versionId);
}

/** 没有对应任何一条问题的修改。审批人要额外看一眼——撰写人顺手动了别的。 */
export function unrelatedChanges(versionId: string = qaCurrentVersionId) {
  return qaDiffRows.filter((row) => row.toVersion === versionId && !row.findingId);
}

/** 「变更」Tab 顶部那一行汇总 */
export function changeSummary(versionId: string = qaCurrentVersionId) {
  const rows = qaDiffRows.filter((row) => row.toVersion === versionId);
  return {
    added: rows.filter((row) => row.kind === "added").length,
    removed: rows.filter((row) => row.kind === "removed").length,
    changed: rows.filter((row) => row.kind === "changed").length,
    unrelated: rows.filter((row) => !row.findingId).length,
  };
}

export const qaInitialNotes: QaNote[] = [
  { id: "n1", source: "ai", author: "QA 审核同事", time: "01-12 15:23", text: "报告编号 IARC-R-20253333063：收检日期（2025-12-12）> 检测开始日期（2025-11-11），时间逻辑有问题" },
  { id: "n2", source: "ai", author: "QA 审核同事", time: "01-12 15:23", text: "报告编号 IARC-R-20253333063：审核时间（2025-12-11）> 批准时间（2025-10-10），时间逻辑有问题" },
  { id: "n3", source: "ai", author: "QA 审核同事", time: "01-12 15:23", text: "页码标记列表存在多页问题（出现“第 17 页/共 7 页”，但总页数应为 7 页）" },
];

/* 药丸里的问答素材。
   -------------------------------------------------------------------
   两条规矩跟问答场是同一套，不是这里另立的：

   ① 每条回答都带页码/记录号。GxP 场景下说不出处的答案没人敢拿去做决定。
   ② 命中不了**不编**。兜底那句明说自己只跑了三类校验、超出范围给不了判断，
      而不是顺着问题铺一段听起来像回事的话——演示时第一眼就会被看穿，
      而"出处可点"是这套东西唯一的可信来源。

   分工也刻意留在这里：问「为什么/怎么办」走对话，做「采纳/忽略」走右侧列表。
   所以下面没有任何一条回答承诺替用户落处置动作。 */

/**
 * 会话里的一条。`run` 是 AI 跑批那条执行链——它必须是**消息**而不是挂在
 * 组件上的一个布尔量：一次审核跨好几版、AI 会跑好几次，每次都要在时间线上
 * 留一条可回看的记录。原来它是 `mailReviewRunning && <ActivityChain>`，
 * 跑完整条从树上摘掉，回不去"第二版当时 AI 说了什么"。
 */
export type QaChatMessage = {
  id: string;
  role: "user" | "agent" | "run";
  /** role=run 时是执行链标题 */
  text: string;
  attachments?: ComposerAttachment[];
  /** 以下四个只在 role=run 时有意义 */
  steps?: string[];
  running?: boolean;
  /** 跑完之后这条链的标题 */
  doneTitle?: string;
  timedOut?: boolean;
};

export const qaChatOpening: QaChatMessage[] = [
  {
    id: "qa-chat-open",
    role: "agent",
    text: `已完成《${qaDocument.title}》全文校验：时间逻辑 3 条、页码逻辑 2 条、内容一致性 1 条，共 ${qaFindings.length} 条。右侧「AI文件审核」可以逐条定位到页，判定依据问我。`,
  },
];

const qaChatFallback = "这个我答不了——本次只跑了时间逻辑、页码逻辑、内容一致性三类校验，一共 6 条，全在右侧「AI文件审核」里。超出这三类的判断没有依据，得你自己看原件。";

const qaReplies: Array<{ keywords: RegExp; text: string }> = [
  {
    keywords: /时间|日期|盖章|批准|收检/,
    text: "三条时间逻辑都在流程顺序上：第 1 页收检日期 2025-12-12 晚于检测开始 2025-11-11；第 1 页审核时间 2025-12-11 晚于批准时间 2025-10-10；第 8 页（内部 7/7）盖章日期 2025-10-09 早于批准时间 2025-10-10。判据是盖章必须发生在批准之后，前两条则是收检不能晚于检测、审核不能晚于批准。三条同属记录1-COA。",
  },
  {
    keywords: /页码|缺页|多页|第.?页.?共/,
    text: "两条页码问题：第 2 页（内部 1/7）缺少第 1 页标记；第 5 页（内部 4/7）出现「第 17 页/共 7 页」，超出总页数 7。两条都是标记问题不是内容问题，所以定级为提示不是错误。",
  },
  {
    keywords: /名称|一致|正文|封面|样品/,
    text: "第 3 页（内部 2/7）正文写「硝酸异哈梨酯」，封面写「硝酸异哈哈梨酯」，差一个「哈」字。封面与报告编号 IARC-R-20253333063 登记的样品名一致，所以按正文错处理。",
  },
  {
    keywords: /比对|差异|上一版|改了|变化|第二版/,
    text: `与第二版比有 ${qaDiffRows.length} 处差异：第 1 页收检日期 2025-12-12 → 2025-11-10、审核时间 2025-12-11 → 2025-10-09，第 3 页样品名称已补齐，第 5 页页码标记改回「第 4 页/共 7 页」，第 8 页新增留样说明。逐处对照在右侧「AI文件比对」。`,
  },
  {
    keywords: /合并|归类|汇总|分组|一共|多少条/,
    text: "按类分：时间逻辑 3 条（第 1、1、8 页，全部定级为错误）、页码逻辑 2 条（第 2、5 页，提示）、内容一致性 1 条（第 3 页，提示）。三条错误集中在日期字段，如果要合并成一条驳回理由，写「报告日期字段的先后顺序不成立，涉及第 1、8 页」就够了。",
  },
  {
    keywords: /通过|驳回|结论|建议|该怎么|要不要/,
    text: "事实是：3 条错误级批注全部落在日期先后顺序上，且第 8 页盖章日期早于批准时间属于流程顺序问题，不是笔误。剩下 3 条为提示级。结论该不该落、落哪个，是你的判断，我不替你按——落下去会连同理由一起写进审计轨迹。",
  },
];

export function resolveQaReply(question: string): string {
  return qaReplies.find((reply) => reply.keywords.test(question))?.text ?? qaChatFallback;
}
