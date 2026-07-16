# DMPK 报价 Agent 设计规范

> 最新完整规范请优先阅读：`DMPK_QUOTATION_CANONICAL_SPEC.md`。  
> 本文件保留为早期 DMPK 设计说明，canonical 版本沉淀了 2026-07-13 沟通确认的交互、字段、panel、modal、编辑回流和验收清单。

## 产品定位

DMPK 报价助手是对话驱动的结构化报价工作台，不是通用 Agent，也不是传统表单系统。

核心目标：

- 用户用自然语言发起报价需求。
- Agent 识别 DMPK 业务线与检测类型。
- 缺失参数通过底部补全卡片分组收集。
- 用户确认后生成 Word 报价单与 Excel 报价明细。
- 页面金额、Word 金额、Excel 金额必须一致。

## 三栏结构

### 左侧 Sidebar

直接沿用肿瘤报告项目 sidebar 规范。

- 顶部：BioAZ logo、折叠按钮。
- 操作区：`新建对话` 按钮、搜索按钮。
- 新建菜单：新建报告任务 / 新建报价任务 / 新建 QA 审核。
- 项目树：项目可折叠展开。
- 项目 hover：显示省略号、编辑入口和项目操作菜单。
- Chat 行：轻量状态色，不使用大色块。
- 当前 chat：浅灰底 + 细状态提示。
- 左下：账号区保持完整但视觉安静。

状态色：

- 运行中：灰蓝。
- 待确认：灰琥珀。
- 已完成：灰绿。
- 阻塞：灰红。

### 中间主对话流

中间是主流程和责任链，不承载完整表单。

- Agent 回复使用普通文本流，不放在卡片里。
- Agent 回复前可显示 BioAZ logo mark。
- 用户提交以右侧气泡出现。
- Activity chain 保留为轻量过程记录。
- 已完成过程折叠为：`已完成报价参数更新 · 查看过程`。
- 对话里的蓝色文字是查看 secondary panel 的入口，例如：`查看过程`、`查看规则证据`、`查看导出校验`。

蓝色链接规则：

- 仅用于可追溯、可预览、可展开的动作。
- Hover 时唤出右侧参数卡片下方的 secondary panel。
- 点击可固定该 panel。

### 右侧 Panel Stack

右侧不是 tab 切换，也不是完整 inspector 替代品，而是 panel stack。

结构：

```text
右侧固定列
┌ 参数收集 panel（常驻）
│  检测类型
│  动物实验
│  生物分析
│  报告与报价
└ secondary panel（hover / pinned）
   处理过程 / 产物与版本 / 规则证据 / 金额校验
```

参数 panel：

- 默认常驻。
- 不能被 secondary panel 替换。
- 展示已提交/已确认状态，不展示未发送草稿。
- 当前阶段展开，历史阶段可折叠，未来阶段灰显。
- Pencil 只是修改入口，点击后回到中间补全卡片，不在右侧内联编辑。

Secondary panel：

- 默认不展示。
- 从主对话里的蓝色链接 hover 唤出。
- 点击蓝色链接或 pin icon 后固定。
- 鼠标离开且未 pin 时收起。
- 视觉规格与参数 panel 一致：同圆角、同边框、同阴影、同卡片行结构。
- 生成产物后，右侧默认只保留参数 panel；产物列表通过蓝色入口 hover 唤出，也可 pin。

## 底部补全卡片

补全参数卡片位于 composer 上方，和参数 tab、输入框连成一个底部工作区。

不进入 chat transcript。

结构：

```text
补全卡片
参数 tabs
composer input
```

行为：

- 按业务阶段分页：检测类型 / 动物实验 / 生物分析 / 报告与报价。
- 每页展示当前阶段缺失字段。
- 用户选择某字段后，该字段行从补全卡片消失。
- 选择结果进入 composer 上方参数 tab。
- 用户在 tab 中点击 `×` 删除后，该字段回到补全卡片。
- 只有用户点击发送后，右侧参数 panel 才正式更新。

## 字段与报价规则

计价关键字段不能 TBD。

PK 关键字段：

- 分子类型。
- 动物种属 / 数量。
- 给药周期 / 频率。
- 采样点。
- 方法类型。
- 报告格式 / 语言。
- 报价区域。

BA Only 关键字段：

- 样品类型。
- 样本数量。
- 化合物数。
- 方法类型。
- 是否匀浆。
- 报告类型。

毒理关键字段：

- 动物种属。
- 主组 / 卫星组。
- TK。
- 临床病理。
- ADA。
- 给药周期。
- 血常规 / 血生化 / 血凝点数。

## 产物展示

默认产物：

- Word 报价单。
- Excel 报价明细。

生成后：

- 主对话流出现一个核心产物卡片或蓝色产物入口。
- 右侧参数 panel 仍常驻。
- 产物列表作为 secondary panel hover 出现。
- Word 和 Excel 是两个独立产物。

产物卡片行结构：

- 左侧：文件图标。
- 中间：产物名、管理费/语言/金额状态。
- 右侧：预览、下载、更多。

## Modal 预览

报价前确认使用 modal，结构参考肿瘤报告项目。

左侧目录：

- 检测类型。
- 动物实验。
- 生物分析。
- 报告与报价。
- 金额校验。

右侧内容：

- 表格化参数。
- 计价规则说明。
- 管理费规则。
- Word / Excel 金额一致性。

## Icon 规范

统一使用 `lucide-react`。

推荐映射：

- Sidebar 项目：`Folder`。
- Chat / 报价任务：`FileText`。
- DMPK 报价 Agent：`FileSpreadsheet`。
- 预览：`Eye`。
- 下载：`Download`。
- 修改参数：`Edit3`。
- 发送：`Send`。
- 折叠：`PanelRight`。
- 展开阶段：`ChevronDown` / `ChevronRight`。
- 更多操作：`MoreHorizontal`。
- 固定 panel：`Pin` / `PinOff`。

## 色彩与动效

沿用肿瘤报告项目。

- BioAZ Blue 仅用于主操作、focus、hover hairline、蓝色证据链接。
- 不使用大面积蓝色背景。
- 成功/警告/阻塞只用小面积语义色。
- 当前导航态用浅灰，不用蓝色大块。

动效：

- Agent thinking logo breathing：1600ms。
- 参数行选择后 fade/slide out。
- Tab 删除后字段行 fade/slide in。
- 用户气泡 180ms send motion。
- Secondary panel hover：140-180ms slide/fade。
- 产物生成后轻微 stagger。
- 尊重 reduced motion。

## 不做

- 不做 canvas。
- 不做右侧完整表单编辑。
- 不做估算报价。
- 不把补全卡片写入对话气泡。
- 不让未发送草稿进入右侧参数台账。
- 不使用大 AI 渐变、玻璃拟态、装饰性动效。

## 下一步：Workbench 基座化

当前 DMPK 原型不应继续手动复刻肿瘤报告样式。下一步应抽象 `BioAZ Agent Workbench Shell`，让后续 Agent 只替换 workflow 内容。

基座组件：

- `WorkspaceSidebar`
- `AgentHeader`
- `AgentReply`
- `ThinkingChain`
- `Composer`
- `ComposerChipRow`
- `DecisionCard`
- `RightPinnedPanel`
- `RightHoverPanel`
- `PreviewModal`

DMPK 只提供配置：

```ts
{
  workflowName: "DMPK 报价",
  stages: ["识别业务线", "参数收集", "规则校验", "报价生成"],
  fieldGroups: ["检测类型", "动物实验", "生物分析", "报告与报价"],
  artifacts: ["Word 报价单", "Excel 报价明细"],
  rightPanelPrimary: "参数收集"
}
```

所有新 Agent 原型必须先复用基座组件，再填业务字段和文案。
