export type DigitalCapabilityStatus = "active" | "planned";

export type DigitalSkill = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: DigitalCapabilityStatus;
};

export type DigitalSubAgent = {
  id: string;
  name: string;
  role: string;
  description: string;
  status: DigitalCapabilityStatus;
};

export type DigitalCoworker = {
  id: string;
  displayName: string;
  domain: string;
  description: string;
  status: DigitalCapabilityStatus;
  moduleId?: string;
  skills: DigitalSkill[];
  subAgents: DigitalSubAgent[];
  taskExamples: string[];
  recentGrowth: string;
};

export const digitalTeamData: DigitalCoworker[] = [
  {
    id: "bioaz-helper",
    displayName: "任务调度同事",
    domain: "通用调度",
    description: "理解用户意图，判断任务类型，并把工作分派给合适的数字同事。",
    status: "active",
    skills: [
      { id: "intent-routing", name: "意图识别", category: "任务调度", description: "从自然语言中识别任务类型、业务场景和缺失信息。", status: "active" },
      { id: "coworker-dispatch", name: "数字同事分派", category: "任务调度", description: "根据任务目标推荐 DMPK、肿瘤报告、QA 审核等数字同事。", status: "active" },
      { id: "context-handoff", name: "上下文交接", category: "协作", description: "把用户输入、文件、项目和历史任务整理成可交接上下文。", status: "active" },
    ],
    subAgents: [
      { id: "clarifier", name: "需求澄清 Agent", role: "澄清", description: "发现任务目标不完整时提出补充问题。", status: "active" },
    ],
    taskExamples: ["帮我判断这项工作应该交给哪个数字同事", "把这个需求整理成可执行任务"],
    recentGrowth: "新增上下文交接能力",
  },
  {
    id: "dmpk-quotation-coworker",
    displayName: "DMPK 报价同事",
    domain: "DMPK 报价",
    description: "收集报价参数，匹配计价规则，并生成 DMPK 报价产物。",
    status: "active",
    moduleId: "dmpk-quotation",
    skills: [
      { id: "dmpk-parameter-collection", name: "报价参数收集", category: "参数管理", description: "识别检测类型、动物、样品数量、报告语言等关键报价参数。", status: "active" },
      { id: "dmpk-rule-match", name: "计价规则匹配", category: "规则引擎", description: "根据检测场景和参数匹配标准价格、折扣和例外规则。", status: "active" },
      { id: "dmpk-template-output", name: "报价模板生成", category: "交付", description: "把报价结果整理成 Word、Excel 或 PDF 交付格式。", status: "active" },
      { id: "dmpk-rule-maintenance", name: "规则维护建议", category: "后台配置", description: "辅助识别需要新增或调整的报价字段、规则和模板。", status: "planned" },
    ],
    subAgents: [
      { id: "dmpk-param-agent", name: "参数提取 Agent", role: "NLP 提取", description: "从客户需求中抽取报价字段和值。", status: "active" },
      { id: "dmpk-calc-agent", name: "报价计算 Agent", role: "计价", description: "基于规则和价格表计算费用明细。", status: "active" },
      { id: "dmpk-rule-check-agent", name: "规则校验 Agent", role: "校验", description: "检查新增规则是否和现有报价逻辑冲突。", status: "planned" },
    ],
    taskExamples: ["新建一个 PK 报价任务", "根据客户需求生成 BA Only 报价", "检查一条 DMPK 计价规则"],
    recentGrowth: "正在补充规则维护能力",
  },
  {
    id: "file-assistant",
    displayName: "文件助手",
    domain: "项目资料",
    description: "基于项目文件和历史任务进行搜索、总结和思路拓展。",
    status: "active",
    skills: [
      { id: "file-search", name: "文件搜索", category: "资料检索", description: "在项目文件中搜索关键词、结论和交付物。", status: "active" },
      { id: "project-summary", name: "资料总结", category: "总结", description: "把项目资料整理成关键结论和待办。", status: "active" },
      { id: "idea-expansion", name: "思路拓展", category: "协作", description: "基于已有资料提出下一步工作方向。", status: "active" },
    ],
    subAgents: [
      { id: "file-index-agent", name: "文件索引 Agent", role: "索引", description: "维护项目文件的可检索结构。", status: "active" },
    ],
    taskExamples: ["搜索当前项目相关文件", "总结这个项目的关键结论"],
    recentGrowth: "新增项目范围筛选",
  },
  {
    id: "tumor-report-coworker",
    displayName: "肿瘤报告同事",
    domain: "肿瘤药效",
    description: "整理原始数据，生成图表，并撰写肿瘤药效报告。",
    status: "active",
    moduleId: "tumor-report",
    skills: [
      { id: "tumor-data-clean", name: "原始数据整理", category: "数据分析", description: "整理体积、体重、给药和分组数据。", status: "active" },
      { id: "tumor-charting", name: "图表生成", category: "可视化", description: "生成趋势图、抑瘤率和统计摘要。", status: "active" },
      { id: "tumor-report-writing", name: "报告撰写", category: "报告生成", description: "生成结构化肿瘤药效报告。", status: "active" },
      { id: "tumor-literature", name: "文献检索", category: "文献", description: "检索相关模型、药物和机制背景。", status: "planned" },
    ],
    subAgents: [
      { id: "tumor-qc-agent", name: "数据 QC Agent", role: "质量检查", description: "发现缺失值、异常点和分组问题。", status: "active" },
      { id: "tumor-format-agent", name: "格式检查 Agent", role: "格式", description: "检查报告结构和交付格式。", status: "active" },
    ],
    taskExamples: ["生成一份肿瘤药效报告", "检查样本 9 的双批次数据"],
    recentGrowth: "计划接入文献检索",
  },
  {
    id: "qa-review-coworker",
    displayName: "QA 审核同事",
    domain: "质量审核",
    description: "复核交付包完整性，追溯证据，并提示交付风险。",
    status: "active",
    moduleId: "qa-review",
    skills: [
      { id: "qa-package-review", name: "交付包检查", category: "质量控制", description: "检查报告、图表、原始数据和附件是否齐全。", status: "active" },
      { id: "qa-evidence-trace", name: "证据追溯", category: "质量控制", description: "把报告结论追溯到数据来源和计算依据。", status: "active" },
    ],
    subAgents: [
      { id: "qa-checklist-agent", name: "清单核对 Agent", role: "核对", description: "按交付清单逐项核对文件。", status: "active" },
    ],
    taskExamples: ["检查这个交付包是否完整", "追溯报告中的关键结论"],
    recentGrowth: "新增证据追溯视角",
  },
];
