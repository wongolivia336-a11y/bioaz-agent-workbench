# 数字团队（Digital Team）能力矩阵展示页面 —— 产品需求文档

> 状态：需求确认 | 优先级：高 | 适用版本：prototype-bioaz-v2

---

## 1. 背景与目标

### 1.1 背景
当前 prototype-bioaz-v2 已具备基本的数字同事（Coworker）工作流能力：
- 用户通过「新建任务」进入业务场景
- BioAZ Helper（任务调度同事）识别意图并分派给对应的数字同事
- 现有数字同事：DMPK报价同事、肿瘤报告同事、QA审核同事、肿瘤报价同事

但缺少一个**对外展示能力矩阵**的入口，无法让客户直观了解平台的数字同事团队及其能力边界。

### 1.2 目标
- **短期**：在 Sidebar 新增「数字团队」一级入口，以思维导图形式展示各数字同事的能力矩阵（Skills + SubAgents）
- **长期**：该页面作为能力矩阵的动态展示窗口，随平台能力生长而自动扩展

---

## 2. 用户与场景

### 2.1 目标用户
- **外部客户**（B2B 场景）：了解 BioAZ 平台的数字同事能力矩阵
- **内部演示**：销售/售前向客户展示时使用

### 2.2 核心场景
| 场景 | 用户行为 | 期望结果 |
|------|---------|---------|
| 能力探索 | 点击 Sidebar「数字团队」入口 | 看到平台所有数字同事及其能力图谱 |
| 能力详情 | 点击某个数字同事节点 | 右侧展开详情面板，展示其 Skills 和 SubAgents |
| 任务转化 | 在详情面板点击「创建任务」 | 跳转至新建任务页面，并预填入对应数字同事 |

---

## 3. 设计原则

1. **轻量不侵入**：不影响现有工作流（新建任务 → 业务场景），独立页面展示
2. **营销导向**：面向外部客户，强调能力覆盖广度和深度
3. **可扩展性**：当前 Skills 和 SubAgents 为虚拟数据，未来支持动态生长
4. **思维导图形式**：节点关系清晰，层级分明，非力导向图

---

## 4. 功能需求

### 4.1 页面结构（Master-Detail）

```
┌──────────────────────────────────────────────────┐
│  数字团队 —— BioAZ 能力矩阵                        │
├────────────────────────────┬─────────────────────┤
│                            │                     │
│  [思维导图区域]             │  [详情面板]         │
│                            │                     │
│  ┌─── DMPK报价同事         │  [默认：欢迎语]     │
│  │      ├── 💡 参数收集     │                     │
│  │      ├── 💡 规则匹配     │  选中节点后展示：   │
│  │      └── 🤖 报价计算Agent │  - 名称            │
│  │                          │  - 描述            │
│  ├─── 肿瘤报告同事         │  - Skills 列表      │
│  │      ├── 💡 数据整理     │  - SubAgents 列表  │
│  │      ├── 💡 文献检索     │  - 创建任务按钮    │
│  │      └── 🤖 格式检查Agent│                    │
│  │                          │                     │
│  └─── 任务调度同事         │                     │
│         └── 💡 意图识别     │                     │
│                            │                     │
└────────────────────────────┴─────────────────────┘
```

### 4.2 Sidebar 入口

- **位置**：Sidebar 一级导航，与「数据中枢」并列
- **命名**：「数字团队」
- **图标**：建议 `Users` 或 `UsersRound`（lucide-react）
- **路由**：新增 `"digitalTeam"` 路由

### 4.3 思维导图交互

| 交互 | 行为 | 效果 |
|------|------|------|
| 点击数字同事节点 | 展开/收起其子节点（Skills + SubAgents） | 详情面板同步更新 |
| 点击详情面板「创建任务」| 跳转至 `newTask` 路由 | 预填入对应数字同事 |
| 缩放/拖拽画布 | 支持整体缩放和拖拽 | 便于浏览大型图谱 |

### 4.4 BioAZ Helper 改名

- **原名**：`bioazHelperCoworker` → `name: "BioAZ Helper"`
- **新名**：`name: "任务调度同事"`
- **说明文字**："识别任务意图并分派给合适的数字同事"

---

## 5. 数据模型

### 5.1 新增类型定义（`modules/types.ts`）

```typescript
// Skill 定义
export type SkillDefinition = {
  id: string;
  name: string;
  description: string;
  category: string; // 如 "数据分析" | "报告生成" | "质量控制"
};

// SubAgent 定义
export type SubAgentDefinition = {
  id: string;
  name: string;
  role: string;
  description: string;
};

// 数字同事能力扩展
export type CoworkerCapability = {
  coworkerId: string;
  coworkerName: string;
  domain: string;        // 领域标签
  expertiseLevel: number; // 1-5，影响展示权重
  description: string;
  skills: SkillDefinition[];
  subAgents: SubAgentDefinition[];
};
```

### 5.2 虚拟数据（`lib/workbench/digitalTeamData.ts`）

当前为原型阶段，提供以下虚拟数据：

#### 5.2.1 数字同事列表

| ID | 名称 | 领域 | 描述 |
|---|---|---|---|
| bioaz-helper | 任务调度同事 | 通用 | 识别任务意图并分派给合适的数字同事 |
| dmpk-quotation-coworker | DMPK报价同事 | DMPK | 收集参数、匹配规则并生成报价产物 |
| tumor-report-coworker | 肿瘤报告同事 | 肿瘤药效 | 整理原始数据并撰写肿瘤药效报告 |
| tumor-quotation-coworker | 肿瘤报价同事 | 肿瘤 | 识别肿瘤项目范围并生成报价 |
| qa-review-coworker | QA审核同事 | 质量 | 复核交付包完整性并追溯证据 |

#### 5.2.2 各同事的 Skills 和 SubAgents（虚拟示例）

**肿瘤报告同事**：
- **Skills**：
  - `skill-1`: 数据整理与清洗 — 从多源数据中提取关键信息
  - `skill-2`: 文献检索与分析 — 自动检索相关文献并提取关键结论
  - `skill-3`: 报告撰写 — 生成结构化的肿瘤药效报告
  - `skill-4`: 数据可视化 — 生成图表和趋势分析
- **SubAgents**：
  - `subagent-1`: 数据清洗Agent — 自动识别并修正数据异常
  - `subagent-2`: 格式检查Agent — 确保报告格式符合规范
  - `subagent-3`: 引用验证Agent — 验证文献引用的准确性

**DMPK报价同事**：
- **Skills**：
  - `skill-5`: 参数收集 — 从需求描述中提取关键报价参数
  - `skill-6`: 规则匹配 — 基于历史数据匹配最优报价方案
  - `skill-7`: 成本估算 — 计算实验成本和时间周期
- **SubAgents**：
  - `subagent-4`: 参数提取Agent — NLP 提取报价需求
  - `subagent-5`: 报价计算Agent — 基于规则引擎计算报价

（其余同事的 Skills 和 SubAgents 类似设计）

### 5.3 思维导图节点数据结构

```typescript
export type MindMapNode = {
  id: string;
  type: "root" | "coworker" | "skill" | "subAgent";
  label: string;
  description?: string;
  icon?: string; // lucide icon name
  children?: string[]; // 子节点 ID 列表
  parentId?: string;
  // 仅 coworker 节点
  domain?: string;
  expertiseLevel?: number;
};

export type MindMapEdge = {
  source: string;
  target: string;
  label?: string;
};
```

---

## 6. 交互设计

### 6.1 页面进入

1. 用户点击 Sidebar「数字团队」入口
2. 路由切换至 `"digitalTeam"`
3. 页面加载思维导图，默认展示所有数字同事节点（一级展开）
4. 详情面板显示默认欢迎语

### 6.2 节点交互

| 节点类型 | 点击行为 | 详情面板内容 |
|---------|---------|------------|
| Root（中心）| 无 | 展示平台整体介绍 |
| Coworker | 展开/收起其子节点 | 名称、描述、领域、专家等级、Skills 列表、SubAgents 列表、创建任务按钮 |
| Skill | 无（或 tooltip 展示描述）| 名称 + 描述 |
| SubAgent | 无（或 tooltip 展示描述）| 名称 + 角色 + 描述 |

### 6.3 半交互设计

- **点击「创建任务」**：跳转至 `newTask` 路由，通过 URL 参数或 state 预填入对应数字同事
- **不直接启动任务**：保持轻量，任务创建仍走现有工作流

---

## 7. 技术约束

### 7.1 技术栈
- **框架**：Next.js 14 + React 18 + TypeScript
- **样式**：纯 CSS（`globals.css` + 组件级 CSS），无 Tailwind
- **图标**：lucide-react
- **状态管理**：React useState/useContext（无 Redux/Zustand）

### 7.2 不引入重型图表库
- 不推荐：D3.js（学习曲线陡）、ECharts（包体积大）、React Flow（可能过重）
- **推荐**：纯 SVG + React 手动计算坐标，或轻量级自定义组件
- 节点数预估：< 50 个，手动布局可行

### 7.3 响应式
- 桌面端：完整 Master-Detail 布局
- 移动端：思维导图全屏，点击节点后弹出底部 Sheet 展示详情

---

## 8. 与现有系统的关系

### 8.1 Sidebar 修改

`WorkspaceSidebar.tsx` 新增：
- 一级导航项：「数字团队」
- 路由：`"digitalTeam"`
- 位置：「新建任务」下方、「数据中枢」上方或并列

### 8.2 WorkbenchShell 修改

`WorkbenchShell.tsx` 新增：
- `route === "digitalTeam"` 的分支处理
- 渲染 `<DigitalTeamPage />` 组件

### 8.3 路由扩展

`WorkbenchRoute` 类型扩展：
```typescript
export type WorkbenchRoute = "newTask" | "tasks" | "library" | "module" | "projectDashboard" | "digitalTeam";
```

---

## 9. 后续扩展方向

1. **动态数据**：Skills 和 SubAgents 从后端 API 动态获取
2. **搜索/筛选**：支持按领域、能力关键词搜索数字同事
3. **能力对比**：支持选择多个数字同事进行能力对比
4. **使用统计**：展示各数字同事的调用次数、成功率等运营数据
5. **用户反馈**：允许用户对 Skills 和 SubAgents 点赞/评分
6. **动画效果**：节点展开/收起动画、连线动画

---

## 10. 已决策事项清单

| # | 决策事项 | 结论 | 备注 |
|---|---------|------|------|
| 1 | 入口位置 | Sidebar 一级入口，与「数据中枢」并列 | — |
| 2 | 入口命名 | 「数字团队」 | 备选：BioAZ 伙伴、能力矩阵 |
| 3 | BioAZ Helper 改名 | 「任务调度同事」 | 仅展示名称变更 |
| 4 | 展示形式 | 思维导图（非向心圆/力导向图） | 层级清晰，易于理解 |
| 5 | 数据来源 | 当前虚拟数据，未来动态生长 | — |
| 6 | 交互深度 | 半交互（详情面板 + 创建任务按钮）| 不直接启动任务 |
| 7 | 目标受众 | 外部客户 + 内部演示 | 营销导向 |
| 8 | 技术方案 | 纯 SVG + React，不引入重型图表库 | 节点数 < 50 |
| 9 | 页面布局 | Master-Detail（左图右详情） | 移动端适配为底部 Sheet |
| 10 | 与现有工作流关系 | 独立页面，不干扰现有流程 | 点击「创建任务」才跳转 |

---

## 11. 待确认事项

| # | 事项 | 优先级 |
|---|------|-------|
| 1 | 各数字同事的具体 Skills 和 SubAgents 列表 | 高 |
| 2 | 思维导图的视觉风格（颜色、节点大小、连线样式）| 中 |
| 3 | 详情面板的字段设计 | 中 |
| 4 | 移动端交互方案 | 低 |

---

*文档版本：v1.0*
*最后更新：2026-07-21*
