export type KnowledgeBaseFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type KnowledgeBaseFile = {
  id: string;
  title: string;
  type: "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "other";
  size: number;
  folderId: string | null;
  business: string;
  tags: string[];
  uploadedBy: string;
  updatedAt: string;
  status: "parsed" | "parsing" | "failed";
  /** 已向量化的文件才会进入知识库助手的检索范围 */
  vectorized: boolean;
  /** 空数组表示当前工作空间全部数字同事可用 */
  assignedTo: string[];
};

export const mockKbFolders: KnowledgeBaseFolder[] = [
  { id: "kb-folder-report", name: "行业报告", parentId: null },
  { id: "kb-folder-tumor", name: "肿瘤", parentId: "kb-folder-report" },
  { id: "kb-folder-dmpk", name: "DMPK", parentId: "kb-folder-report" },
  { id: "kb-folder-sop", name: "SOP", parentId: null },
  { id: "kb-folder-term", name: "术语与模板", parentId: null },
];

export const mockKbFiles: KnowledgeBaseFile[] = [
  { id: "kb-1", title: "2024全球肿瘤药物研发白皮书.pdf", type: "pdf", size: 10485760, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["行业分析", "白皮书"], uploadedBy: "Admin", updatedAt: "2026-07-31 09:30", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker", "qa-review-coworker"] },
  { id: "kb-2", title: "实体瘤疗效评价标准RECIST1.1.pdf", type: "pdf", size: 2097152, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["指南", "评价标准"], uploadedBy: "Admin", updatedAt: "2026-07-30 16:40", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-3", title: "肿瘤药效评价术语表.xlsx", type: "xlsx", size: 524288, folderId: "kb-folder-term", business: "肿瘤报告", tags: ["术语"], uploadedBy: "Admin", updatedAt: "2026-07-29 11:20", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-4", title: "DMPK实验操作规程.docx", type: "docx", size: 786432, folderId: "kb-folder-sop", business: "DMPK报价", tags: ["SOP", "操作规程"], uploadedBy: "Admin", updatedAt: "2026-07-28 14:02", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-5", title: "DMPK计价规则说明_v4.xlsx", type: "xlsx", size: 1048576, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["计价", "规则"], uploadedBy: "Admin", updatedAt: "2026-07-27 11:30", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-6", title: "生物分析方法学验证要点.pdf", type: "pdf", size: 3145728, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["方法学"], uploadedBy: "Admin", updatedAt: "2026-07-26 17:20", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-7", title: "报告交付格式模板.docx", type: "docx", size: 262144, folderId: "kb-folder-term", business: "通用", tags: ["模板", "交付"], uploadedBy: "Admin", updatedAt: "2026-07-25 10:05", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-8", title: "样品接收与留存SOP.docx", type: "docx", size: 655360, folderId: "kb-folder-sop", business: "通用", tags: ["SOP"], uploadedBy: "Admin", updatedAt: "2026-07-24 15:48", status: "parsing", vectorized: false, assignedTo: [] },
  { id: "kb-9", title: "2025免疫治疗联合用药综述.pdf", type: "pdf", size: 8388608, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["综述"], uploadedBy: "Admin", updatedAt: "2026-07-23 13:11", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-10", title: "历史报价对照表_2025.xlsx", type: "xlsx", size: 1572864, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["对照", "历史"], uploadedBy: "Admin", updatedAt: "2026-07-22 09:37", status: "failed", vectorized: false, assignedTo: [] },
  { id: "kb-11", title: "客户常见问题问答集.docx", type: "docx", size: 393216, folderId: null, business: "通用", tags: ["FAQ"], uploadedBy: "Admin", updatedAt: "2026-07-21 16:22", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-12", title: "动物伦理审查指引.pdf", type: "pdf", size: 1835008, folderId: "kb-folder-sop", business: "通用", tags: ["合规", "伦理"], uploadedBy: "Admin", updatedAt: "2026-07-20 11:09", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-13", title: "肿瘤微环境评价指标汇编.xlsx", type: "xlsx", size: 891200, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["指标", "评价"], uploadedBy: "Admin", updatedAt: "2026-07-19 14:33", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-14", title: "药代动力学参数解读指南.pdf", type: "pdf", size: 2560000, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["PK", "指南"], uploadedBy: "Admin", updatedAt: "2026-07-18 10:15", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker", "qa-review-coworker"] },
  { id: "kb-15", title: "GLP实验室管理规范.docx", type: "docx", size: 512000, folderId: "kb-folder-sop", business: "通用", tags: ["GLP", "规范"], uploadedBy: "Admin", updatedAt: "2026-07-17 16:50", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-16", title: "免疫组化染色操作规程.pdf", type: "pdf", size: 1228800, folderId: "kb-folder-sop", business: "通用", tags: ["IHC", "操作规程"], uploadedBy: "Admin", updatedAt: "2026-07-16 09:20", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-17", title: "细胞毒性试验设计模板.xlsx", type: "xlsx", size: 458752, folderId: "kb-folder-term", business: "肿瘤报告", tags: ["模板", "毒性"], uploadedBy: "Admin", updatedAt: "2026-07-15 11:45", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-18", title: "血脑屏障通透性评价综述.pdf", type: "pdf", size: 3670016, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["BBB", "综述"], uploadedBy: "Admin", updatedAt: "2026-07-14 13:30", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-19", title: "肿瘤免疫治疗临床前评价路径.pdf", type: "pdf", size: 4194304, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["免疫治疗", "评价路径"], uploadedBy: "Admin", updatedAt: "2026-07-13 15:10", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-20", title: "分析批接受标准与质控图解读.docx", type: "docx", size: 720896, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["质控", "解读"], uploadedBy: "Admin", updatedAt: "2026-07-12 10:00", status: "parsing", vectorized: false, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-21", title: "实验动物福利与伦理审查申请表.docx", type: "docx", size: 204800, folderId: "kb-folder-sop", business: "通用", tags: ["伦理", "申请表"], uploadedBy: "Admin", updatedAt: "2026-07-11 16:00", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-22", title: "生物标志物检测方法验证指南.pdf", type: "pdf", size: 2785280, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["生物标志物", "验证"], uploadedBy: "Admin", updatedAt: "2026-07-10 09:45", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-23", title: "肿瘤体积测量与统计分析SOP.docx", type: "docx", size: 348160, folderId: "kb-folder-sop", business: "肿瘤报告", tags: ["测量", "统计"], uploadedBy: "Admin", updatedAt: "2026-07-09 14:20", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker", "qa-review-coworker"] },
  { id: "kb-24", title: "药物相互作用DDI预测模型介绍.pdf", type: "pdf", size: 3328000, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["DDI", "相互作用"], uploadedBy: "Admin", updatedAt: "2026-07-08 11:00", status: "failed", vectorized: false, assignedTo: [] },
  { id: "kb-25", title: "基因毒性试验Ames试验指南.pdf", type: "pdf", size: 1536000, folderId: "kb-folder-sop", business: "通用", tags: ["Ames", "基因毒性"], uploadedBy: "Admin", updatedAt: "2026-07-07 10:30", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-26", title: "临床研究申报资料撰写要点.docx", type: "docx", size: 589824, folderId: "kb-folder-term", business: "通用", tags: ["申报", "撰写"], uploadedBy: "Admin", updatedAt: "2026-07-06 15:15", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-27", title: "PDX模型构建与传代管理规范.docx", type: "docx", size: 634880, folderId: "kb-folder-sop", business: "肿瘤报告", tags: ["PDX", "模型"], uploadedBy: "Admin", updatedAt: "2026-07-05 14:40", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-28", title: "抑瘤率TGI计算口径说明.xlsx", type: "xlsx", size: 297984, folderId: "kb-folder-term", business: "肿瘤报告", tags: ["TGI", "口径"], uploadedBy: "Admin", updatedAt: "2026-07-04 09:50", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker", "qa-review-coworker"] },
  { id: "kb-29", title: "统计方法选择决策树.pdf", type: "pdf", size: 1126400, folderId: "kb-folder-term", business: "通用", tags: ["统计", "决策树"], uploadedBy: "Admin", updatedAt: "2026-07-03 16:25", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-30", title: "口服生物利用度评价方案汇编.pdf", type: "pdf", size: 2969600, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["生物利用度", "方案"], uploadedBy: "Admin", updatedAt: "2026-07-02 11:15", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-31", title: "组织分布试验采样时间点设计.docx", type: "docx", size: 445440, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["组织分布", "采样"], uploadedBy: "Admin", updatedAt: "2026-07-01 10:20", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-32", title: "血浆蛋白结合率测定标准操作.docx", type: "docx", size: 388096, folderId: "kb-folder-sop", business: "DMPK报价", tags: ["蛋白结合", "SOP"], uploadedBy: "Admin", updatedAt: "2026-06-30 15:05", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-33", title: "肝微粒体稳定性试验指南.pdf", type: "pdf", size: 1740800, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["肝微粒体", "稳定性"], uploadedBy: "Admin", updatedAt: "2026-06-29 13:45", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-34", title: "CDX模型药效评价常见问题.docx", type: "docx", size: 512000, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["CDX", "FAQ"], uploadedBy: "Admin", updatedAt: "2026-06-28 09:30", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-35", title: "联合给药协同效应判定方法.pdf", type: "pdf", size: 2211840, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["联合用药", "协同"], uploadedBy: "Admin", updatedAt: "2026-06-27 14:10", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-36", title: "体重变化与humane endpoint判定.docx", type: "docx", size: 327680, folderId: "kb-folder-sop", business: "肿瘤报告", tags: ["体重", "终点"], uploadedBy: "Admin", updatedAt: "2026-06-26 11:55", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker", "qa-review-coworker"] },
  { id: "kb-37", title: "交付包完整性核查清单.xlsx", type: "xlsx", size: 235520, folderId: "kb-folder-term", business: "通用", tags: ["交付", "清单"], uploadedBy: "Admin", updatedAt: "2026-06-25 16:40", status: "parsed", vectorized: true, assignedTo: ["qa-review-coworker"] },
  { id: "kb-38", title: "原始数据溯源与审计追踪要求.pdf", type: "pdf", size: 1433600, folderId: "kb-folder-sop", business: "通用", tags: ["溯源", "审计"], uploadedBy: "Admin", updatedAt: "2026-06-24 10:05", status: "parsed", vectorized: true, assignedTo: ["qa-review-coworker"] },
  { id: "kb-39", title: "报价常见议价场景与应对.docx", type: "docx", size: 471040, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["议价", "话术"], uploadedBy: "Admin", updatedAt: "2026-06-23 15:20", status: "parsing", vectorized: false, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-40", title: "2026肿瘤靶点研发趋势速览.pdf", type: "pdf", size: 5242880, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["趋势", "靶点"], uploadedBy: "Admin", updatedAt: "2026-06-22 09:15", status: "parsed", vectorized: true, assignedTo: [] },
];

export function formatFileSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** 面包屑：从当前文件夹回溯到根 */
export function folderTrail(folders: KnowledgeBaseFolder[], folderId: string | null) {
  const trail: KnowledgeBaseFolder[] = [];
  let cursor = folderId;
  while (cursor) {
    const folder = folders.find((item) => item.id === cursor);
    if (!folder) break;
    trail.unshift(folder);
    cursor = folder.parentId;
  }
  return trail;
}
