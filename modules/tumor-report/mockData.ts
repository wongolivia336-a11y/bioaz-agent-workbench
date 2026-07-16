import type { TumorArtifact, TumorReview, TumorWarning } from "./types";

export const tumorWarnings: TumorWarning[] = [
  { id: "W-01", title: "终点日肿瘤体积存在 1 处缺失", impact: "影响 TGI 模块的统计表快照，生成前需要 SD 接受风险。", owner: "SD 确认", accepted: false },
  { id: "W-02", title: "异常事件闭环证据不完整", impact: "体重与安全性描述需要在审核阶段补充备注。", owner: "QA 放行", accepted: false },
  { id: "W-03", title: "p-value 方法来源需复核", impact: "不阻断生成，最终交付前需要统计确认口径。", owner: "统计确认", accepted: false },
];

export const tumorReviews: TumorReview[] = [
  { id: "R-01", title: "肿瘤体积与 TGI 模块", source: "数据核对专家发现终点日缺失对趋势判断有影响。", owner: "SD", status: "pending" },
  { id: "R-02", title: "体重与安全性模块", source: "QA 检查发现异常事件闭环证据仍需补充。", owner: "QA", status: "pending" },
  { id: "R-03", title: "统计方法与结论措辞", source: "统计专家建议复核 p-value 与 TGI 方法来源。", owner: "统计", status: "pending" },
];

export const tumorArtifacts: TumorArtifact[] = [
  { id: "report", title: "NCI-H82 双批次药效报告.docx", meta: "Word 报告 · 2.06 MB", kind: "word" },
  { id: "package", title: "样本9_双批次交付包.zip", meta: "报告、图表、QC 与证据摘要", kind: "package" },
  { id: "prism", title: "Prism 源文件", meta: "4 个数据文件", kind: "prism" },
  { id: "figures", title: "报告 Figure 图片", meta: "5 张 · 96dpi / 300dpi", kind: "figure" },
  { id: "qc", title: "QC 一致性报告.md", meta: "数据、图表与 Word 一致性", kind: "qc" },
];
