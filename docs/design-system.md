# BioAZ Design System

## 为什么有这份东西

几轮 UI 迭代下来，反复出现同一类问题：改了一个值不生效，或者改对了但别处又冒出来。回看根因，都不是"值写错了"，而是**同一个视觉结果由多个文件、多个层级共同决定**：

| 现象 | 真因 |
|---|---|
| 思考链紫色改三轮不生效 | 改的是 `.activityChain`，紫色其实在 `<summary>` 上 |
| 卡片 hover 抖动 | 改的是 padding，抖动来自 `font-size` 与 `min-height` 的 transition |
| 弹窗两个按钮高度不一致 | 模块规则与通用规则特异性相同，靠文件加载顺序决胜负 |

代价是具体的：曾被迫用 `!important`，也堆过 `.dmpk-quotationModuleShell :is(...)` 去抬特异性。

**这套系统的目标不是少写 CSS，是让一个视觉结果只有一个出处。**

## 技术选型

不引入 Tailwind / CVA / Radix。项目是纯 CSS + CSS 变量，引 Tailwind 会让两套体系长期并存，而现有 1.5 万行 CSS 短期不可能迁完。

借用 shadcn 的**组合式 API 范式**（`Menu` / `MenuGroup` / `MenuItem` 各自独立、由调用方拼装），配合已有的 `bioazUi*` BEM 命名与 `--bioaz-*` token。

## 分层与约束

```
styles/tokens.css        ← 所有 --bioaz-* 的唯一定义处
styles/design-system.css ← bioazUi* 组件样式，只消费 token
components/ui/           ← React 组件，只输出 bioazUi* 类名
app/*.css                ← 历史样式，逐步收敛
modules/                 ← 业务模块
```

**一条硬约束**：`modules/` 只允许覆盖 token 值，**不得重写 primitive 的结构属性**（padding / 布局 / 尺寸）。

今天的乱象正源于模块层直接改了基础件尺寸——例如 `.stackDecision:hover` 把 padding 从 `14/16` 改成 `18/20` 并加 transition，于是卡片一悬停就重排、按钮错位。

## Token

### 颜色

| Token | 用途 |
|---|---|
| `--bioaz-action-primary` `#17191e` | **主操作按钮**：确认、提交、上传、创建 |
| `--bioaz-brand-primary` `#2900ff` | 品牌色，**仅限 Logo 与极少数品牌级入口**，不要用作按钮底色 |
| `--bioaz-agent-accent` `#5c60b8` | Agent 相关的强调色：链接、选中态、进行中 |
| `--bioaz-status-*` / `--bioaz-status-*-soft` | 状态 chip 专用的前景/底色对 |

`--bioaz-status-*` 与 `--bioaz-success/warning/danger` 是**两组不同的东西**：后者是低饱和的语义文字色，前者是 chip 的底色/前景对，对比度按 chip 尺寸单独调过。不要混用。

### 图标

尺寸只有五档，写在 `size` 属性里，**不要用 CSS 改 `svg { width }`**：

| 尺寸 | 用在哪 |
|---|---|
| `12` | 内联标记、tab 叉号、状态点 |
| `14` | **默认**——按钮、列表项、菜单项 |
| `16` | 区块标题、主操作、卡片图标 |
| `20` | 空状态、头像位 |
| `24` | 预览大图、数字同事头像 |

例外只有一种：**同一个组件在不同容器里要不同尺寸**（如 `.assistantSuggestions` 的图标在 library 里 24px、在 ambient 里 14px）。这种才允许写 CSS，且取值必须落在上表里。

描边统一由 `--icon-stroke`（默认 `1.75`）控制，`styles/design-system.css` 里一条 `.lucide { stroke-width: var(--icon-stroke) }` 全局生效。**不要在 JSX 里写 `strokeWidth`——写了也不生效**，CSS 属性会盖过 lucide 的 presentation attribute。需要加重或减轻的地方，在那个元素自己的 CSS 规则里覆写 `--icon-stroke`。

图标名用 lucide 的**规范名**，不要用旧别名：`CircleHelp` 不是 `HelpCircle`，`TriangleAlert` 不是 `AlertTriangle`，`Ellipsis` 不是 `MoreHorizontal`。别名和规范名混用会让同一个字形在代码里有两个名字，grep 不到。

### 其他

圆角 `--bioaz-radius-tool` 8px（工具/chip）、`-control` 12px（按钮/输入）、`-container` 16px（卡片）、`-full`。
间距 `--bioaz-space-1..16` 对应 4/8/12/16/20/24/32/40/48/64。
另有字号、阴影、动效时长与缓动。

## 组件

全部从 `components/ui` 导入。

### 组件状态

- `stable`：API 与使用边界已稳定，开发和 Agent 默认优先使用。
- `candidate`：已有真实实现，但 API 仍可能调整；使用前检查调用范围。
- `deprecated`：不得新增使用，文档必须给出替代方案。

当前 `components/ui` 中的 Button、IconButton、SurfaceCard、ActionCard、Menu、StatusChip、NavTabs、SegmentedControl、Dialog、Drawer 与 EmptyState 视为 `stable`。`WorkbenchComposer` 暂列为 `candidate`，因为它仍然同时服务首页、业务会话和窄 Drawer 等不同容器。

### 选择与提升规则

业务模块可以新增业务组件，例如 `QuotationSummary` 或 `EvidencePanel`，但不得在模块内重新实现已有 Primitive。一个业务组件只有在至少两个真实跨模块场景中形成稳定 API 后，才考虑提升到 `components/ui`。

当现有 Primitive 无法满足需求时，先记录缺口并判断它是业务专用问题还是共享问题，不要为了遵守目录规则而强行使用错误组件。

### Button / IconButton

```tsx
<Button variant="primary" size="small" leadingIcon={<Upload size={15} />}>上传文件</Button>
<IconButton icon={<Filter size={16} />} label="筛选" selected />
```

`variant`: `primary`（黑，主操作） / `secondary`（白底描边） / `ghost`（透明） / `danger`。
**每屏只应有一个 primary。**

### Menu / MenuGroup / MenuItem

图标触发的下拉。此前有三份几乎相同的副本，改一次筛选行为要同步三遍。

```tsx
<Menu icon={<Filter size={16} />} label="筛选" active={hasFilter} closeOnSelect={false}>
  <MenuGroup label="业务">
    <MenuItem active={v === "肿瘤报告"} onSelect={() => set("肿瘤报告")}>肿瘤报告</MenuItem>
  </MenuGroup>
</Menu>
```

`closeOnSelect` 默认 `true`。**多选场景必须传 `false`**（如知识库的标签筛选），否则选一个就关掉了。

### StatusChip

```tsx
<StatusChip tone="success" dot>已连接</StatusChip>
```

`tone`: `neutral` / `running` / `warning` / `success` / `danger`。

只统一"语气 → 视觉"这一层。**各模块保留自己的业务文案映射**——「解析成功」和「已连接」是不同的业务概念，不该合并成同一个枚举。模块里维护 `statusTone: Record<业务状态, StatusTone>` 即可。

`dot` 用于密集列表中需要快速扫读的场合。

### Dialog

```tsx
<Dialog
  title="确认发起专家审核"
  description="本次报告与业务证据将一并派发。"
  onClose={close}
  footer={<><Button onClick={close}>取消</Button><Button variant="primary" onClick={ok}>确认</Button></>}
/>
```

Escape 与点击遮罩都能关闭。底部按钮由 `.bioazUiDialogFooter > button` 统一尺寸——**不要给 footer 里的按钮单独设 height / border-radius / padding**，那正是之前出现 44 vs 34 高、6 vs 10 圆角的原因。

### Drawer

右侧详情抽屉，顶天立地（`position: fixed` + `inset-block: 0`）。高度取自视口而非父容器——早先用 `absolute` 贴在内容容器上，导致不同页面里抽屉高度各不相同。

### EmptyState

```tsx
<EmptyState title="暂无文件" description="上传项目资料或发起任务生成产物"
  action={<Button variant="primary">上传文件</Button>} />
```

`variant`: `panel`（内容区，带图标）/ `inline`（卡片网格内的占位，虚线框）。

按文档要求：一句说明 + 一个主行动按钮，不堆解释。

### NavTabs / SegmentedControl

判据是**切换的对象**：

- `NavTabs` — 换「看什么」，切到不同内容区。下划线式，可带计数徽标。
- `SegmentedControl` — 换「怎么看」，同一内容的不同呈现（列表/看板/日历）。分段式。

```tsx
<NavTabs items={[{ id: "plan", label: "计划" }, { id: "data", label: "资料与产物", count: 12 }]}
  value={tab} onChange={setTab} label="项目空间">
  <SearchBox />   {/* children 放右侧附加内容 */}
</NavTabs>

<SegmentedControl items={[{ id: "list", label: "列表", icon: <LayoutList size={14} /> }]}
  value={view} onChange={setView} label="计划视图" />
```

紧凑场景（如 header 的 Tab 层）改 `--bioaz-navtab-pad-x` 即可，不要另写一套类。

### SurfaceCard / ActionCard

`SurfaceCard` 是静态容器，`ActionCard` 是整体可点的卡片（渲染为 `button`）。`density`: `compact` / `default` / `spacious`。

### WorkbenchComposer

从 `components/workbench-shell/WorkbenchComposer` 导入。输入框此前在 5 处各写一遍，加号是个连 `onChange` 都没接的装饰性 `<label>`。

```tsx
<WorkbenchComposer
  className="newTaskComposer"      // 沿用各处既有的布局类，三列骨架不变
  as="div"                          // 或 "form"，配 onSubmit
  attachments={attachments}
  onAttachmentsChange={setAttachments}
  activeCoworkerId={coworkerId}    // null → 菜单平铺；有值 → 「已具备」置顶
  project={projectName}            // 过滤项目文件库
  menu                             // 窄容器传 menu={false}，只保留上传
  globalDrop                       // 同屏只能有一个 composer 打开它
>
  <textarea … />
  <button className="sendIconButton" … />
</WorkbenchComposer>
```

组件负责：加号二级菜单、chip 行、整页拖拽落区。**不负责**发送逻辑——`children` 里的输入控件和发送按钮仍由各调用点自己控制。

发送时把 `attachments` 固化到消息上，再用 `<MessageAttachments items={…} />` 渲染在气泡里（`UserBubble` 已内置 `attachments` 属性）。它的根节点是 `<span>`，因为要嵌进气泡的 `<span>`/`<p>` 里，`<div>` 属于非法嵌套。

选项数据来自 `lib/workbench/composerAttachments.ts`，技能与 MCP 直接读 `digitalTeamData`，不另建一份目录。

**加号菜单里不放「专家」**。「谁来干活」只有输入框上方的数字同事下拉一个入口，理由见 [DESIGN.md](DESIGN.md) 的 Capability Entry 一节。

## 还没做的

- `app/` 的 12 个 CSS 文件（约 1.5 万行）尚未按模块拆分
- Chip 除 StatusChip 外还有 SelectableChip（可点选筛选项）、RemovableChip（已生效条件带 ×）、MetaTag（只读元信息）三类待抽取
- 肿瘤报告与 DMPK 的 preview modal 结构差异大、业务耦合深，未纳入 Dialog

### 已清理的死代码

`.fileSpaceTabs` 与 `.ruleTabs` 的 CSS 已删除（TSX 中 0 引用）。注意 `.fileSpaceTabs` 曾出现在一条多选择器规则里，那条规则的其余选择器仍在使用——删死代码时要区分「整块删」和「从选择器列表里摘一行」。

`.draftTabs` 名字带 tabs，但它是 DMPK composer 的草稿参数 chip 列表，**不是 Tab**，未纳入收敛。它原本还兼职渲染附件名，附件那一支已经迁到 `.composerChipRow`，`.draftTabs` 现在只剩参数草稿一种用途。

`.quotationTabs` 的 CSS 保留未删：`quotation-management.css` 是压缩成单行的，且 `.quotationTabs button` 混在一条多选择器规则里，删除风险远大于收益。新组件不带 `.quotationTabs` 祖先，旧规则命不中——已实测确认 `borderWidth: 0px` / `borderRadius: 0px`，没有被旧样式污染。

## 迁移时的注意事项

1. **先量后改**。迁移前用 `getComputedStyle` 记录 `background / border / radius / padding / fontSize`，迁移后逐项比对。只看截图会漏掉 1px 与字号差异。
2. **注意行为差异**，不只是视觉。共享组件的默认值可能与某个调用点原本的行为不同（`closeOnSelect` 就是一例）。
3. **注意元素类型的改变会踩到祖先的通配规则**。加号从 `<label>` 改成 `<button>` 后，被 `.workspaceAssistantComposer button {}`（36px 黑色圆钮）整片命中，菜单里每个按钮都变成了黑圆点。改标签名前先 grep 祖先容器有没有 `… button {}` / `… input {}` 这类不带类名的后代规则。
3. **组件类名沿用既有 CSS 类**（如 Menu 沿用 `.toolMenu`），迁移即可做到视觉上完全无变化，风险最低。

## Agent 使用约束

1. 新功能优先从 `components/ui` 导入已有基础组件。
2. 业务组件留在业务模块内，不得用新名字重复实现 Button、Dialog、Drawer、Menu、Tabs、StatusChip 等 Primitive。
3. 组件 CSS 不新增十六进制、RGB 或 HSL 色值。优先消费 `styles/tokens.css` 中的全局 `--bioaz-*` Token。
4. 业务特有颜色先在模块根节点声明语义化局部 Token，例如 `--tumor-evidence-highlight`，内部组件只消费变量。
5. 第三方品牌色、科学图表数据色和外部内容渲染可以例外，但需要用简短注释注明来源与作用范围。
6. 这些规则用于代码评审和 Agent 决策，当前不阻断 typecheck、build 或 CI。

## 可视化与 Token 清单

运行开发服务后访问 `/design-system`。页面直接渲染真实 React 组件，并在服务端读取 `styles/tokens.css` 自动生成 Token 清单。不要另建手工维护的静态 HTML 副本；需要分享时应从真实页面导出，避免文档与组件实现漂移。
