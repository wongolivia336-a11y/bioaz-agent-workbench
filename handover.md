# 交接上下文 — prototype-bioaz-v2 后台文件助手优化

## 📍 项目位置
```
G:\实习\原型优化项目\prototype-bioaz-v2
```

## 🎯 当前任务（两个待修复点）

### 问题 1：后台顶部面包屑样式与前台不一致
- **位置**：`app/quotation-management.css` 中的 `.quotationBreadcrumb`
- **现状**：我已经改了 `display: inline-flex`、`gap: 11px`、`color: var(--body)`
- **用户反馈**："颜色或者字体都和之前有差异"，用户不满意当前效果
- **参考**：前台的面包屑在 `app/globals.css` 中 `.breadcrumb` 定义
- **核心需求**：后台面包屑的样式（颜色、字体、间距）要和前台完全一致

### 问题 2：DMPK 报价助手（后台悬浮入口）
- **位置**：`modules/quotation-management/components/DmpkRuleAssistant.tsx`
- **现状**：我已经改成了使用 `workspaceAssistantPanel libraryAssistantWorkspace` 类名
- **用户想要的形式**：
  1. 底部悬浮入口（类似前台文件助手 `ambientFileAssistant`）
  2. hover 展开 → 顶部三个小卡片快捷建议 + 输入框
  3. 点击卡片或发送后 → 进入全屏聊天界面
- **核心需求**：借鉴前台文件助手的 UI 形式，不要重构，只迁移形式
- **注意**：用户说"不要改动前台"，前台保持原样

## 🗂️ 涉及文件

### 已修改（但用户不满意）
```
app/dmpk-rule-assistant.css                ← 悬浮入口样式
app/quotation-management.css               ← 面包屑样式
modules/quotation-management/components/
  DmpkRuleAssistant.tsx                    ← 后台报价助手组件
```

### 新增（可保留）
```
components/file-assistant/                 ← 可复用的文件问答助手组件
  FileQaAssistant.tsx
  FileQaAssistant.css
  index.ts
```

### 恢复的文件
```
modules/dmpk-quotation/DmpkQuotationSession.tsx   ← 已恢复到原始状态
```

## 🎨 参考文件（不要改动）

### 前台文件助手（参考基准）
- **组件**：`components/workbench-shell/ShellControls.tsx` 中的 `WorkspaceAssistant`
- **悬浮入口样式**：`app/iteration.css` 中的 `.ambientFileAssistant`
- **全屏面板样式**：`app/iteration.css` 中的 `.libraryAssistant .workspaceAssistantPanel`
- **面包屑样式**：`app/globals.css` 中的 `.breadcrumb`

## 💬 给下一个 Agent 的 Prompt

用户要你把前台文件助手的 UI 形式迁移到后台 DMPK 报价管理页面。

### 具体要求：
1. **不要改动前台代码**（`components/workbench-shell/ShellControls.tsx` 和 `app/iteration.css` 中的前台样式不要动）
2. **后台面包屑**：`app/quotation-management.css` 中 `.quotationBreadcrumb` 的样式要和前台 `app/globals.css` 中的 `.breadcrumb` 完全一致（颜色、字体、间距等）
3. **DMPK 报价助手**：修改 `modules/quotation-management/components/DmpkRuleAssistant.tsx`
   - 底部悬浮入口形式和前台文件助手的 `ambientFileAssistant` 完全一致
   - hover 展开后显示三个小卡片 + 输入框
   - 点击卡片或发送后进入全屏聊天界面
   - 借鉴前台文件助手的 UI 形式，包括类名、交互逻辑等
4. **不要创建新组件**，直接在前台代码基础上改后台的
5. **预览地址**：`http://localhost:3000/`（或 `http://localhost:3001/`）

### 当前已修改但未达预期的文件：
- `app/dmpk-rule-assistant.css`
- `app/quotation-management.css`
- `modules/quotation-management/components/DmpkRuleAssistant.tsx`

### 项目位置：
```
G:\实习\原型优化项目\prototype-bioaz-v2
```

### 启动预览：
```bash
cd "G:\实习\原型优化项目\prototype-bioaz-v2"
npm run dev
```
