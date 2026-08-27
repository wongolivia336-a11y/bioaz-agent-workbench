import type { SessionHistoryEntry } from "../../modules/types";

/* 已经发生过的那段对话。
   -------------------------------------------------------------------
   为什么要种：被驳回的报价点「进入会话处理」，应该回到**当初产出它的那个
   会话**。可原型里会话是纯 React state，页面一刷新就没了——于是撰写人落进
   一个空白会话，而演示要讲的恰恰是「带着上下文回去」。

   为什么不用 priorSessionSnapshots：那个字段的语义是「**上一位数字同事**在
   这条任务里聊过的那段」，用于换人接手时把前情摆在顶上，所以它会把当前 module
   自己的快照过滤掉。这里要的是另一件事——**这条会话自己的历史**，
   它该直接还原成会话里的消息，滚上去就看得到，而不是折在一个前情块里。

   key 是 taskId，跟 Ticket.taskId 对上：工单知道自己出自哪条会话。 */
export const seededSessionHistory: Record<string, SessionHistoryEntry[]> = {
  "task-ba": [
    { id: "h1", role: "user", text: "Balb/c nude 小鼠 BA 试验，血浆样品 LC-MS/MS，2 组每组 3 只，周期 2 周，采血点 8 个。客户要 Word 加 Excel。" },
    { id: "h2", role: "agent", text: "已识别：检测类型 BA Only、动物种属 Balb/c nude、每组 3 只、2 组、试验周期 2 周、采血点 8。还需要补充化合物类别、分析方法、样品类型和报告语言。" },
    { id: "h3", role: "user", text: "普通小分子，LC-MS/MS，血浆，中文报告。" },
    { id: "h4", role: "agent", text: "参数已齐全。已匹配 BA 动物实验与生物分析价格规则，管理费按 30% 口径计取。" },
    { id: "h5", role: "agent", text: "报价单已生成，Word 与 Excel 金额校验一致。" },
    { id: "h6", role: "user", text: "交接给 王林彬：客户催得急，麻烦优先看一下。" },
    { id: "h7", role: "agent", text: "已交接。这件事现在在 王林彬 那儿，本次的 Word 报价单与 Excel 报价明细已随行。" },
  ],
};

/* 那次会话收齐的参数。
   -------------------------------------------------------------------
   光还原对话是不够的：右侧参数面板会停在「未开始」，
   而对话里写着「参数已齐全、报价单已生成」——两边互相打脸。
   上下文要回来就得整个回来。

   key 是 DMPK 模块自己的字段 id（modules/dmpk-quotation/fields.ts）。 */
export const seededSessionFields: Record<string, Record<string, string>> = {
  "task-ba": {
    assayType: "BA Only",
    molecule: "小分子",
    species: "Balb/c nude",
    animalsPerGroup: "3",
    groupCount: "2",
    cycle: "2 周",
    compoundType: "普通小分子",
    method: "LC-MS/MS",
    sampleType: "血浆",
    bloodPoints: "8",
    analyteCount: "1",
    format: "Word + Excel",
    language: "中文",
    region: "国内",
  },
};