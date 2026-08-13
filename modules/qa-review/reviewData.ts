/* QA 审核的静态素材。
   -------------------------------------------------------------------
   全部是假数据，但结构按真实审核台来：AI 批注是「条目」不是「文本块」，
   每条带页码定位与处置状态，因为撰写人要逐条消化、审批人要逐条采纳。
   审批结论落在版本上，所以版本是一等公民，不是一个下拉框的装饰。 */

export type QaFindingCategory = "time" | "page" | "format" | "content";
export type QaFindingState = "open" | "accepted" | "dismissed";

export type QaFinding = {
  id: string;
  category: QaFindingCategory;
  /** 文档页 / 内部页，审核报告里这两个经常不一致，必须都给 */
  docPage: number;
  innerPage?: string;
  severity: "error" | "warning";
  recordId: string;
  text: string;
};

export type QaVersion = {
  id: string;
  label: string;
  submittedAt: string;
  author: string;
  status: "draft" | "review" | "rejected" | "approved" | "archived";
};

export type QaNote = {
  id: string;
  source: "ai" | "human";
  author: string;
  time: string;
  text: string;
};

export type QaDiffRow = {
  page: number;
  field: string;
  before: string;
  after: string;
  kind: "changed" | "added" | "removed";
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

export const qaVersions: QaVersion[] = [
  { id: "v3", label: "202612011511 第三版", submittedAt: "2026-01-12 15:22", author: "林一一", status: "review" },
  { id: "v2", label: "202611281043 第二版", submittedAt: "2025-12-28 10:43", author: "林一一", status: "rejected" },
  { id: "v1", label: "202611150902 第一版", submittedAt: "2025-11-15 09:02", author: "林一一", status: "rejected" },
];

export const qaDocument = {
  title: "硝酸异哈哈梨酯检测报告.pdf",
  reportNo: "IARC-R-20253333063",
  sampleName: "硝酸异哈哈梨酯",
  testType: "委托检验",
  applicant: "江苏小小药业有限公司",
  issuer: "上海医药工业研究院有限公司分析测试中心",
  pageCount: 7,
};

export const qaFindings: QaFinding[] = [
  { id: "f1", category: "time", docPage: 1, severity: "error", recordId: "记录1-COA", text: "收检日期（2025-12-12）> 检测开始日期（2025-11-11），时间逻辑有问题" },
  { id: "f2", category: "time", docPage: 1, severity: "error", recordId: "记录1-COA", text: "审核时间（2025-12-11）> 批准时间（2025-10-10），时间逻辑有问题" },
  { id: "f3", category: "time", docPage: 8, innerPage: "7/7", severity: "error", recordId: "记录1-COA", text: "盖章日期（2025-10-09）< 批准时间（2025-10-10），盖章动作必须发生在其余流程之后" },
  { id: "f4", category: "page", docPage: 2, innerPage: "1/7", severity: "warning", recordId: "记录1-COA", text: "页码标记列表存在缺页问题（缺少第 1 页，但总页数应为 7 页）" },
  { id: "f5", category: "page", docPage: 5, innerPage: "4/7", severity: "warning", recordId: "记录1-COA", text: "页码标记列表存在多页问题（出现“第 17 页/共 7 页”）" },
  { id: "f6", category: "content", docPage: 3, innerPage: "2/7", severity: "warning", recordId: "记录1-COA", text: "样品名称在正文与封面不一致（正文写“硝酸异哈梨酯”，封面写“硝酸异哈哈梨酯”）" },
];

export const qaDiffRows: QaDiffRow[] = [
  { page: 1, field: "收检日期", before: "2025-12-12", after: "2025-11-10", kind: "changed" },
  { page: 1, field: "审核时间", before: "2025-12-11", after: "2025-10-09", kind: "changed" },
  { page: 3, field: "样品名称", before: "硝酸异哈梨酯", after: "硝酸异哈哈梨酯", kind: "changed" },
  { page: 5, field: "页码标记", before: "第 17 页/共 7 页", after: "第 4 页/共 7 页", kind: "changed" },
  { page: 8, field: "留样说明", before: "—", after: "留样期限 24 个月，存放于 A 区冷库", kind: "added" },
];

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

export type QaChatMessage = { id: string; role: "user" | "agent"; text: string };

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
