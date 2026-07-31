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
  { id: "kb-1", title: "2024全球肿瘤药物研发白皮书.pdf", type: "pdf", size: 10485760, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["行业分析", "白皮书"], uploadedBy: "Admin", updatedAt: "2026-07-28 16:42", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker", "qa-review-coworker"] },
  { id: "kb-2", title: "实体瘤疗效评价标准RECIST1.1.pdf", type: "pdf", size: 2097152, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["指南", "评价标准"], uploadedBy: "Admin", updatedAt: "2026-07-28 16:40", status: "parsed", vectorized: true, assignedTo: ["tumor-report-coworker"] },
  { id: "kb-3", title: "肿瘤药效评价术语表.xlsx", type: "xlsx", size: 524288, folderId: "kb-folder-term", business: "肿瘤报告", tags: ["术语"], uploadedBy: "Admin", updatedAt: "2026-07-27 09:15", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-4", title: "DMPK实验操作规程.docx", type: "docx", size: 786432, folderId: "kb-folder-sop", business: "DMPK报价", tags: ["SOP", "操作规程"], uploadedBy: "Admin", updatedAt: "2026-07-26 14:02", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-5", title: "DMPK计价规则说明_v4.xlsx", type: "xlsx", size: 1048576, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["计价", "规则"], uploadedBy: "Admin", updatedAt: "2026-07-26 11:30", status: "parsed", vectorized: true, assignedTo: ["dmpk-quotation-coworker"] },
  { id: "kb-6", title: "生物分析方法学验证要点.pdf", type: "pdf", size: 3145728, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["方法学"], uploadedBy: "Admin", updatedAt: "2026-07-25 17:20", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-7", title: "报告交付格式模板.docx", type: "docx", size: 262144, folderId: "kb-folder-term", business: "通用", tags: ["模板", "交付"], uploadedBy: "Admin", updatedAt: "2026-07-24 10:05", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-8", title: "样品接收与留存SOP.docx", type: "docx", size: 655360, folderId: "kb-folder-sop", business: "通用", tags: ["SOP"], uploadedBy: "Admin", updatedAt: "2026-07-23 15:48", status: "parsing", vectorized: false, assignedTo: [] },
  { id: "kb-9", title: "2025免疫治疗联合用药综述.pdf", type: "pdf", size: 8388608, folderId: "kb-folder-tumor", business: "肿瘤报告", tags: ["综述"], uploadedBy: "Admin", updatedAt: "2026-07-22 13:11", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-10", title: "历史报价对照表_2025.xlsx", type: "xlsx", size: 1572864, folderId: "kb-folder-dmpk", business: "DMPK报价", tags: ["对照", "历史"], uploadedBy: "Admin", updatedAt: "2026-07-21 09:37", status: "failed", vectorized: false, assignedTo: [] },
  { id: "kb-11", title: "客户常见问题问答集.docx", type: "docx", size: 393216, folderId: null, business: "通用", tags: ["FAQ"], uploadedBy: "Admin", updatedAt: "2026-07-20 16:22", status: "parsed", vectorized: true, assignedTo: [] },
  { id: "kb-12", title: "动物伦理审查指引.pdf", type: "pdf", size: 1835008, folderId: "kb-folder-sop", business: "通用", tags: ["合规", "伦理"], uploadedBy: "Admin", updatedAt: "2026-07-19 11:09", status: "parsed", vectorized: true, assignedTo: [] },
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
