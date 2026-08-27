/* 批注锚点 → 会话参数字段。
   -------------------------------------------------------------------
   两套词表：批注锚在报价单的条目上（lib/workbench/quoteData 里那 15 个可编辑
   参数，来自真实 Excel），而会话收的是这个模块自己的字段（fields.ts）。
   它们**不是一一对应的**——报价单上有「Discount」「Samples analyzed」，
   会话里没有；会话里有「报告语言」「报价区域」，报价单上不体现。

   所以这张表只列**确实对得上**的那几条。对得上的，采纳之后参数面板跟着变；
   对不上的（比如管理费口径），采纳之后改的是报价单本身，不动会话参数。

   不硬凑：给对不上的强行找一个字段塞进去，参数面板会出现一个撰写人从没填过、
   也看不懂的值，而那比不更新更糟。 */
export const noteAnchorToField: Record<string, string> = {
  "p-tk-points": "bloodPoints",
  "p-compounds": "analyteCount",
  "p-tox-animals": "animalsPerGroup",
  "p-tox-groups": "groupCount",
  "p-duration": "cycle",
};

/** 这条批注改的是会话参数，还是报价单本身。 */
export const noteTargetsField = (anchorId: string) => Boolean(noteAnchorToField[anchorId]);
