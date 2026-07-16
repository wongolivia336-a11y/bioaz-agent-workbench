import type { ActionStep, ExportItem, ReviewItem, WarningItem } from "./types";

export const validationActionsBase: Array<Omit<ActionStep, "status">> = [
  {
    label: "读取方案 DOCX",
    detail: "识别试验目的、动物信息、分组和给药流程。",
    tech: "read_protocol_docx(protocol_file=脱敏实验报告6.docx)",
  },
  {
    label: "识别数据表结构",
    detail: "定位 Raw data、Group summary、Study design 和图表来源。",
    tech: "detect_workbook_sheets(data_file=脱敏数据6.xlsx)",
  },
  {
    label: "检查统计口径",
    detail: "核对 TGI、RTV、p-value 和 SEM 的规则引用。",
    tech: "validate_statistical_profile(rule_set_ref=current_effective)",
  },
  {
    label: "扫描异常事件",
    detail: "检查死亡、剔除、停药、安乐死和偏离记录。",
    tech: "scan_deviation_events(source_range=Observation)",
  },
  {
    label: "生成校验摘要",
    detail: "汇总 warning、表格快照、QA checklist 和下一步动作。",
    tech: "create_validation_report(job_id=job_99aa8e49...)",
  },
];

export const generationActionsBase: Array<Omit<ActionStep, "status">> = [
  {
    label: "冻结 validation 事实",
    detail: "绑定确认记录、规则版本和 validation digest。",
    tech: "freeze_validation_facts(validation_job_id=job_99aa8e49...)",
  },
  {
    label: "生成 Prism 源文件",
    detail: "生成 body-weight、tumor-volume、RTV、tumor-weight 四类 Prism 源文件。",
    tech: "create_prism_sources(count=4)",
    artifacts: ["body-weight.prism", "tumor-volume.prism", "relative-tumor-volume.prism", "tumor-weight.prism"],
  },
  {
    label: "生成 Figure 图片",
    detail: "输出 96dpi / 300dpi 图像，用于 Word 与交付包。",
    tech: "render_figures(format=png, count=5)",
    artifacts: ["tumor-volume-96dpi.png", "tumor-volume-300dpi.png", "body_weight-300dpi.png", "relative_tumor_volume-300dpi.png", "tumor_weight-300dpi.png"],
  },
  {
    label: "生成 Word 报告",
    detail: "把确认后的事实写入中文实验报告模板。",
    tech: "assemble_report_docx(template=standard_cn_tumor)",
    artifacts: ["研究受试物对人小细胞肺癌 NCI-H82 细胞株报告.docx"],
  },
  {
    label: "生成 QC 与交付包",
    detail: "生成 QC 报告、审计摘要、manifest 摘要和 ZIP 交付包。",
    tech: "create_delivery_package(include_qc=true)",
    artifacts: ["qc-report.md", "report-package.zip", "manifest 摘要"],
  },
];

export const reviewActionsBase: Array<Omit<ActionStep, "status">> = [
  {
    label: "数据核对专家 D",
    detail: "核对报告、Excel 与方案之间的数据来源一致性。",
    tech: "dispatch_review_agent(agent=D, scope=data_lineage)",
  },
  {
    label: "统计复核专家 C",
    detail: "复核 TV、RTV、TGI、p-value 与结论措辞边界。",
    tech: "dispatch_review_agent(agent=C, scope=statistics)",
  },
  {
    label: "安全性专家 S",
    detail: "检查异常事件、人道终点、停药与动物福利闭环。",
    tech: "dispatch_review_agent(agent=S, scope=safety)",
  },
  {
    label: "图表版式专家 G",
    detail: "检查图表、目录、Prism/OLE 依赖和交付格式。",
    tech: "dispatch_review_agent(agent=G, scope=layout_delivery)",
  },
  {
    label: "终审专家 F",
    detail: "合并专家意见，输出需要用户确认的关键建议。",
    tech: "merge_review_findings(agent=F)",
  },
];

export const initialWarnings: WarningItem[] = [
  {
    id: "W-01",
    title: "终点日肿瘤体积存在 1 处缺失",
    impact: "影响 TGI 模块的统计表快照，需要接受风险后才能进入生成。",
    owner: "需 SD 确认",
    accepted: false,
  },
  {
    id: "W-02",
    title: "异常事件闭环证据不完整",
    impact: "影响体重/安全性描述，需要在模块审核中补充备注。",
    owner: "需 QA 放行",
    accepted: false,
  },
  {
    id: "W-03",
    title: "p-value 方法来源需复核",
    impact: "不阻断报告生成，但最终放行前需统计确认口径。",
    owner: "需统计确认",
    accepted: false,
  },
];

export const initialReviews: ReviewItem[] = [
  {
    id: "R-01",
    title: "肿瘤体积模块",
    source: "统计检查 Agent 检出终点日缺失对 TGI 趋势的影响。",
    owner: "需 SD 确认",
    status: "pending",
  },
  {
    id: "R-02",
    title: "体重 / 安全性模块",
    source: "QA 检查 Agent 检出异常事件闭环证据缺口。",
    owner: "需 QA 放行",
    status: "pending",
  },
  {
    id: "R-03",
    title: "TGI 公式口径",
    source: "统计检查 Agent 建议复核 TGI 与 p-value 的方法来源。",
    owner: "需统计确认",
    status: "pending",
  },
];

export const generationGroups: ExportItem[] = [
  {
    title: "Word 报告",
    meta: "研究受试物对 NCI-H82 移植瘤生长作用报告.docx",
    count: "report-docx · 2.06 MB",
    kind: "word",
    downloadable: false,
  },
  {
    title: "交付包",
    meta: "Word、Prism、图片、QC 和业务证据摘要",
    count: "report-package · 2.68 MB",
    kind: "package",
    downloadable: true,
  },
  {
    title: "Prism 源文件",
    meta: "body-weight / tumor-volume / RTV / tumor-weight",
    count: "4 个文件",
    kind: "prism",
    downloadable: false,
  },
  {
    title: "Figure 图片",
    meta: "96dpi / 300dpi 图像，用于报告和归档",
    count: "5 张图片",
    kind: "figure",
    downloadable: false,
  },
  {
    title: "QC 报告",
    meta: "Word 数字、Prism 一致性和证据闭环",
    count: "qc-report.md / json",
    kind: "qc",
    downloadable: false,
  },
  {
    title: "业务证据摘要",
    meta: "校验问题、表格快照、下载记录和确认边界",
    count: "可追溯",
    kind: "evidence",
    downloadable: false,
  },
];

export const traceReferences = [
  {
    label: "recognized-context.json",
    detail: "业务证据：方案与数据表已识别到分组、给药、终点和统计表位置，可用于核对 Agent 的判断来源。",
  },
  {
    label: "validation-report.json",
    detail: "业务证据：校验报告记录 warning 影响范围、是否阻断、建议责任人和下一步动作。",
  },
  {
    label: "qc-report.md",
    detail: "业务证据：QC 摘要用于确认 Word 数字、Prism 数据一致性、图表和异常事件闭环。",
  },
];

export const expertProfiles: Record<string, { role: string; finding: string }> = {
  "数据核对专家 D": {
    role: "数据来源一致性、缺失值、分组映射",
    finding: "发现终点日肿瘤体积缺失对 TGI 模块有影响。",
  },
  "统计复核专家 C": {
    role: "统计方法、p-value、TGI/RTV 口径",
    finding: "建议复核 TGI 和 p-value 的方法来源。",
  },
  "安全性专家 S": {
    role: "异常事件、人道终点、动物福利闭环",
    finding: "发现异常事件和处置记录需要 SD / QA 复核。",
  },
  "图表版式专家 G": {
    role: "图表、目录、Prism/OLE、交付件格式",
    finding: "建议复核图表规范和交付件外部依赖。",
  },
  "终审专家 F": {
    role: "合并 D/C/S/G 结果并输出收口建议",
    finding: "当前无硬阻断，但存在需人工确认的关键建议。",
  },
};
