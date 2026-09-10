# 收件箱与数据中枢调整交接

更新时间：2026-08-13

## 交接结论

本轮已经确认产品逻辑，但当前收件箱视觉方案被否定，**不要在现有布局上继续微调 CSS**。下一位应保留业务链路，重新做一次页面构图。

当前工作区修改尚未提交、尚未推送。开发分支为 `codex/dmpk-composer-params`。

## 已确认的产品方向

### 1. 数据中枢

- 原“项目中枢”改名为“数据中枢”。
- 暂时删除“待我处理 / 动态 / 计划”，仅保留“资料与产物”。
- 现阶段以用户个人文件、任务产物和自定义文件夹为主，不强调云共享项目。
- 数据模型和文案不要写死“仅本地”或“永远不协作”。后续可能扩展组织协作、知识库、云文件和共享空间。

### 2. 收件箱

- 收件箱是独立页面，不再是数据中枢中的一个 tab。
- 产品形态更接近正式邮箱，而不是社交媒体私信。
- 邮件流转的主体是具体文件或压缩包，不是整个项目。
- 收件人可以是真人同事，也可以是数字同事。
- 普通邮件只是邮件；只有携带“行动请求”的邮件才成为接收人的待办。
- 必须支持筛选，例如全部、待我处理、已完成。
- 写邮件时允许 AI 根据收件人、附件和行动要求辅助起草，但不另开一个“邮件助手”聊天窗口。

### 3. 邮件进入业务 Session

这是本轮最重要的逻辑，不要退回到 BioAZ Helper 中转：

```text
收到行动邮件
-> 点击“进入处理会话”
-> 直接进入邮件所对应的数字同事 Session
-> 邮件正文、发件人要求、附件成为首轮上下文
-> Chatflow 显示“用户提交了文档”的附件消息
-> Agent 显示可审计的处理步骤和结果
-> 处理完成后在 composer 上方出现业务决策卡
-> 右侧 Canvas / Inspector 同步展示业务对象
```

- QA 报告邮件直接进入 `qa-review` Session。
- DMPK 报价邮件直接进入 `dmpk-quotation` Session。
- 不要为收件箱再实现一套聊天流、Composer、附件气泡、过程卡或 Canvas。
- 应复用 DMPK 已有的 `UserBubble`、`AgentReply`、`ActivityChain`、`WorkbenchComposer` 和 Inspector/Canvas 机制。
- “思考过程”只展示可审计步骤、依据与结论，不展示模型私有思维链。

## 当前实现位置

### 新增

- `components/workbench-shell/MailboxPage.tsx`
  - 包含收件箱/已发送 mock 数据。
  - 包含邮件列表、正文、附件、写信、AI 起草、行动请求和进入 Session 的入口。
  - 当前文件是未跟踪文件。

### 已修改

- `components/workbench-shell/WorkbenchShell.tsx`
  - 新增独立 `inbox` 路由渲染。
  - 新增 `startTaskFromMail`，按邮件的 `moduleId` 直接进入业务 Session。
- `modules/types.ts`
  - `WorkbenchRoute` 增加 `inbox`。
- `components/workbench-shell/WorkspaceSidebar.tsx`
  - “项目中枢”改名为“数据中枢”。
  - 收件箱图标改为进入独立路由。
- `components/workbench-shell/FileManager.tsx`
  - `HubTab` 收敛为 `data`。
  - 移除待我处理、动态和计划的渲染入口。
- `modules/qa-review/QaReviewSession.tsx`
  - 支持邮件 `initialRequest`。
  - 从邮件进入时先展示附件消息和审核步骤，完成后展开文档 Canvas。
- `app/inbox.css`
  - 同时包含旧 `InboxTodoPanel` 样式和新 `MailboxPage` 样式。
  - 当前新增的邮箱样式需要重新设计，不建议继续叠加覆盖。

## 用户明确否定的视觉方向

当前截图中的页面被评价为“满屏都是奇怪的感觉”。问题不是某个间距，而是整体信息层级和构图失败：

1. 顶部同时出现页面标题、二级 tab、写邮件动作，形成三块互不相干的漂浮区域。
2. 左侧邮件列表像一个独立后台面板，右侧正文又像另一个页面，缺少共同的版式主轴。
3. 搜索、筛选、状态 tab、列表标题纵向堆叠，工具密度高但邮件数量很少。
4. 正文内容被限制成居中的窄卡式区域，外围留白失去结构意义。
5. 页面同时使用外层工作台 topbar、内部列表头和邮件正文头，出现“框套框、列套列”。
6. 此前尝试过邮箱内部左侧文件夹栏，也被明确要求整列删除。

因此请不要继续以下做法：

- 不要再增加邮箱内部导航侧栏。
- 不要用更多边框、卡片、胶囊或工具条修补层级。
- 不要把“写邮件”做成远离邮件列表和正文的孤立按钮。
- 不要照搬完整桌面邮箱产品的信息密度；本原型邮件量小，主任务是文件流转。
- 不要改变已经确认的“邮件进入现有业务 Session”逻辑来迁就布局。

## 建议下一位从这里重新设计

建议先停写代码，画一个低保真布局，只保留四个必要区域：

```text
统一页面头：收件箱标题 + 收件箱/已发送切换 + 写邮件

左侧：紧凑邮件索引
右侧：当前邮件正文
右侧底部或正文结尾：附件 + 单张行动卡
```

可尝试的构图原则：

- 页面头只保留一行，不再拆成 topbar 两层。
- 收件箱/已发送可以靠近标题，写邮件靠右，但三者必须共享同一水平基线。
- 邮件索引宽度约 320–360px；正文自然占满剩余空间。
- 搜索与筛选可以合并成一条轻量工具行，状态筛选可进入 Filter menu，不一定常驻三个 tab。
- 邮件正文不要再套大卡片；直接在内容列上建立 640–760px 的阅读宽度即可。
- 附件作为正文的一部分，行动卡作为邮件结尾的唯一强调区。
- 空状态装饰图应移除或极度克制，避免与邮件正文竞争注意力。
- 先对照 `docs/DESIGN.md`、`components/ui/` 和现有 DMPK Session，再实现视觉稿。

## 数据模型的可扩展边界

当前 `MailboxPage.tsx` 内部的 mock 类型只用于原型。后续若抽到 `lib/workbench/`，建议保留下列抽象：

- `ResourceRef`：附件引用，未来可扩展 upload、task output、mail copy、cloud、knowledge source。
- `moduleId`：决定邮件进入哪个既有业务 Session。
- `contextProject`：当前仅用于寻找任务挂靠位置，不应成为邮件必须字段。
- `action` / `actionLabel`：邮件是否请求行动以及处理状态。
- `from` / `to`：未来允许真人和数字同事，不要只建岗位枚举。

## 当前验证状态

最后一次验证结果：

- `npm.cmd run typecheck`：通过。
- `http://localhost:53439/`：HTTP 200。
- 本地开发服务曾退出过，已重新在 53439 端口启动；接手时仍应重新确认。

## Git 注意事项

- 当前改动未 commit、未 push。
- 不要直接丢弃工作区：其中包含已经确认的路由、数据中枢收敛和 Session 上下文传递逻辑。
- 若重做视觉，优先保留 `WorkbenchShell.tsx`、`modules/types.ts`、`FileManager.tsx` 和 `QaReviewSession.tsx` 中的产品逻辑，再重写 `MailboxPage.tsx` 结构及其新 CSS。
- `app/inbox.css` 中旧收件箱样式仍可能被历史组件使用，删除前先搜索引用。

## 接手验收清单

- [ ] 点击侧栏收件箱图标进入独立页面。
- [ ] 收件箱/已发送切换清楚，但页面没有第二根导航侧栏。
- [ ] 写邮件入口明确且不孤立。
- [ ] 一封邮件能清晰展示发件人、正文、附件和行动请求。
- [ ] QA 邮件直接进入 QA Session，不经过 Helper。
- [ ] QA Chatflow 首条显示用户提交的报告附件。
- [ ] Agent 审核步骤复用现有 `ActivityChain`。
- [ ] 审核结论出现后 Canvas 展开，决策卡位于 composer 上方。
- [ ] DMPK 邮件进入既有 DMPK Session。
- [ ] 页面没有新造第二套 Chatflow、Composer 或 Canvas。
- [ ] `npm.cmd run typecheck` 通过。

