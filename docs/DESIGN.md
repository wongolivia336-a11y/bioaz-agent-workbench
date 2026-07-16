# BioAZ Clinical Canvas Design Spec v0.2

BioAZ Clinical Canvas 是澎立肿瘤实验报告 Agent 工作空间的产品界面规范。目标不是做一个“AI demo”，而是做一个面向科研报告、校验、生成、审核和交付的 B 端 SaaS 工作台：白色、可信、克制、清楚，同时在上传、hover、thinking 和产物操作中保留一点轻快的活人感。

## Design Position

- **Product type**: 医疗 / 实验报告工作台，包含上传、校验、warning 确认、生成、专家审核、交付导出。
- **Primary user**: SD、QA、统计、实验报告使用人，以及需要快速判断报告状态和责任边界的业务角色。
- **Tone**: 严谨、干净、可信、轻巧、有节奏。
- **Not a goal**: 不做营销页，不做强 AI 科技感，不做满屏彩色卡片，不把工程运行细节默认暴露给业务用户。

## Reference Translation

- **Apple**: 借留白、层级、动效克制和明确 affordance；不借消费级过度宽松密度。
- **Notion**: 借工作空间、左侧层级、轻量内容块；不借过度自由的文档感，流程门禁仍要明确。
- **Linear**: 借真实 SaaS 的列表密度、状态扫描和任务推进节奏；不让界面变得过冷或过开发者。
- **IBM Carbon / GitHub Review**: 借状态语义、证据、审核责任和可追溯；不直接使用工程化术语作为默认文案。
- **atypica**: 借研究工作台的轻卡片、微动效和节奏感；不复制具体品牌视觉、暗色主题或资产。

## Color Tokens

```css
--canvas: #ffffff;
--surface: #fafbfc;
--surface-strong: #f5f7fa;
--line: #e7eaf0;
--line-strong: #d7dce5;

--ink: #111318;
--ink-soft: #2d3440;
--body: #5f6875;
--muted: #9aa3af;

--bioaz-blue: #2900ff;
--bioaz-navy: #11064a;

--success: #4f7f68;
--warning: #8b6f38;
--danger: #9b5a55;
```

## Color Rules

- BioAZ Blue is the only primary accent color.
- Blue is allowed for primary actions, traceable references, evidence hover, file/artifact actions, thinking states, focus rings, and hover hairlines.
- Navigation current state uses neutral deep grey, not BioAZ Blue.
- Blue is not used for large decorative backgrounds, hero gradients, large titles, or non-action ornament.
- Success, warning, and danger colors are semantic micro-signals only.
- Success uses a muted grey-green icon or small accepted label.
- Warning uses a muted grey-amber icon, warning code, or tiny label.
- Blocked/error uses a muted clinical red icon and concise reason.
- Review pending uses grey by default.
- Avoid large green, amber, or red backgrounds. When files satisfy requirements, use one green dot plus a very light green panel tint only.

## Typography

- Page title: 18-20px / 600-700
- Module title: 15-16px / 600-700
- Body: 14px / 400-500
- Supporting copy: 12-13px / 400-500
- Button: 14px / 600
- Sidebar primary label: 14-15px / 650-700
- Sidebar secondary label: 12-13px / 400-500
- Letter spacing is always 0. Do not use negative letter spacing in operational UI.

## Layout

- Left sidebar is fixed at 280px and never scrolls with the workspace.
- Center workspace scrolls independently.
- Right panel scrolls independently.
- Right panel is hover-floating by default and becomes a fixed right column when pinned.
- Main conversation width: 820-900px.
- Upload / preparation panel width: 720-760px.
- Right panel width: 360-400px.
- Right-panel cards use one stable row grammar: content on the left, icon actions fixed on the right. Do not let preview buttons enter the text flow.
- Repeated right-panel cards should keep a consistent minimum height, chip position, title weight, evidence line, status line, and right-side action alignment.
- Confirmed/pending state in repeated right-panel cards should be carried by the ID chip color, not repeated status text. Use low-saturation green for confirmed and muted amber for pending.
- The `查看 warning 证据` and `查看审核问题列表` inspector topics use the same card grammar as the deliverables recall area: status chip, title, compact meta lines, and right-side preview icon.
- Evidence and impact summaries inside right-panel cards are secondary text: 12px, muted color, tight line-height. They should never visually compete with the title.
- Composer stays sticky at the bottom of the center workspace.
- Workspaces should feel like production SaaS: dense enough for repeated use, but not cramped.

## Navigation

- Sidebar mirrors workspace / project / conversation hierarchy.
- Workspace and project rows may be slightly more spacious.
- Conversation rows should be compact: 48-52px, with 4-6px vertical gap.
- Active conversation can be slightly taller but should not become a large card.
- Conversation status is expressed through muted file icon color and hover/title text, not a second-line dot or large badge.

## Radius System

BioAZ uses a soft squircle language: rounded enough to feel modern, not so round that the product becomes childish.

- Large panel / modal / upload altar: 24-28px
- Standard card: 16-18px
- File row / input / decision row: 14-16px
- Icon button / small control: 10-12px
- Pills are rare. Use them only for small status chips or compact metadata, not as the default shape for every control.

## Shadow System

- Default surfaces rely on hairline borders, not shadows.
- Hover surfaces may lift 1px and gain a very soft shadow.
- Floating panel and modal can use a soft workspace shadow.
- No glassmorphism, glowing orbs, neon halos, or bokeh decoration.

## Icon System

- Use `lucide-react` as the unified open-source icon system for the prototype.
- Navigation icons: linear, 18-20px.
- File and artifact icons: linear, 18-22px.
- Operation icons: upload, send, preview, download, more, pin, remove.
- Status should usually be a dot, not an icon.
- Avoid generic AI or emotional icons such as sparkle, alert, bot, magic wand unless the state truly needs it.
- Icons should support recognition, not decorate the interface.

## Component Rules

### Clinical Outline Sidebar

- Sidebar preserves the hierarchy: workspace, project, conversation, account.
- It should feel like a clinical workspace outline, not a heavy app menu.
- Keep the BioAZ logo, but use a smaller SaaS-style brand lockup.
- New conversation is a secondary white button, not the dominant black primary action.
- Workspace rows may use generic navigation icons; project and conversation rows should use report/file-oriented icons.
- Only the current conversation uses the active line. Parent workspace and project rows stay neutral so the sidebar feels like a quiet outline.
- Current conversation uses a subtle grey background plus a 2px deep-grey left line, not BioAZ Blue.
- Conversation status is expressed through the file icon color; expose the full status through hover/title, not permanent text or an extra dot.
- Keep vertical rhythm breathable but realistic. Conversation rows should not stretch to fill the sidebar.
- Account area remains complete but visually quiet.

### Document Altar

- Empty state is a centered drag-and-drop panel.
- It contains DOCX and XLSX slots, simple file requirements, and a secondary file picker.
- Drag-over may shift hairline to BioAZ Blue and lift the panel by 1px.

### Upload Ready Panel

- After files are selected, stay in a preparation state instead of entering chat immediately.
- Show two long file groups: protocol DOCX and data XLSX.
- File rows show icon, filename, size, and a remove icon.
- Replacing a file means removing it and uploading again.
- When requirements are met, use one green dot plus a very light green panel tint.
- The primary action is `开始校验`.

### Agent Reply

- Agent reply is the main narrative layer.
- It uses plain text without avatar, border, or background.
- It does not use status dots. Start with a bold business phrase inside the paragraph, such as `校验完成。`.
- Agent actions inside replies should be inline text links, not centered standalone buttons.
- Default alignment follows the reading flow: left aligned inside the center column. Only user bubbles are right aligned.
- It should remain visible after thinking collapses.
- Every reply should answer: what was done, what was found, what the user needs to do next.
- Keep replies short: usually 1-3 sentences.
- Agent reply text uses the same scale as user chat text, around 15px.
- User confirmations and approvals must appear as user chat bubbles before the next agent phase begins.

### Thinking Card

- Thinking is a process layer, not the main explanation.
- During execution, it grows step by step: show reached nodes and the current node only. Do not reveal future steps as a to-do checklist.
- After completion, it collapses into a single “processed / view process” row.
- Collapsed thinking should be visually light: no outer card border, a small logo, and business wording such as `已完成校验过程 · 查看过程`.
- Expanded thinking may keep a soft hairline card so the process remains distinguishable from the agent reply.
- Running thinking may be a clearer card. Completed expanded thinking should be narrower and should not leave a large empty right side.
- Expanded thinking remains smaller than normal chat text and should never dominate the main reply.
- Technical details are opt-in.
- Job id, trace id, digest, lineage, sha, worker logs, and function names are hidden behind technical details.

### Decision List

- Warning and expert review confirmations sit above the composer.
- Use a question-like panel: task title, numbered rows, and bottom actions.
- Rows are horizontal on desktop and stack only on narrow screens.
- Default row numbering uses `1 / 2 / 3`; internal IDs such as `W-01` and `R-01` belong in preview or evidence details.
- Row hover may use a light BioAZ Blue hairline and soft glow.
- Selected rows use a subtle grey background, not a large color block.
- Decision rows should feel like business evidence, not engineering logs.
- Actions stay at the row or panel bottom depending on density.
- Warning confirmation means accepting risk into generation, not confirming final scientific conclusions.
- Warning and expert suggestion rows both expose a preview icon at row level and panel level. Row click can open preview; confirmation buttons must remain explicit.
- Preview defaults are task-specific: warning opens `校验问题`; expert suggestion opens `建议列表`.
- When the last warning or expert suggestion is confirmed, the user side automatically sends a completion bubble before the next agent response.
- Completed warning and review rows switch their status dot to green.

### Deliverables Panel

- After generation, the right panel defaults to deliverables first.
- Main conversation keeps only Word report and delivery package.
- Prism, figures, QC, manifest/evidence summary, and intermediate assets live in the right panel.
- Each artifact exposes preview, download, and more.
- More menu may include opening another way and viewing business evidence.
- Artifact preview is a secondary reader, not a file explorer: show business-readable structure, key tables, QC gates, package composition, and evidence summaries; hide signed URLs, internal bucket paths, full manifest, sha, trace, and debug logs by default.
- Main conversation artifact preview and right-panel artifact preview must open the same modal system so users learn one interaction pattern.
- After report generation, the right panel also acts as the recall surface for confirmed warning and expert suggestion details.
- Confirmed warning rows stay visible as `已确认 warning`; each row keeps its source evidence summary, status, and preview icon.
- Expert suggestion rows stay visible as `专家建议摘要`; each row keeps its suggestion summary, status, and preview icon.
- Warning recall and expert suggestion recall must use the same visual row grammar as deliverables: rounded card, left content stack, right icon action, no centered titles or orphaned buttons.

### Expert Review

- Expert review is automatic after generation.
- It should be represented as the third thinking chain after validation and generation.
- It follows the same pattern: thinking chain first, collapse after completion, agent reply remains visible.
- Expert names may be BioAZ Blue references with hover details.
- Expert suggestions are post-generation human review items. They do not block the already completed Agent generation step.
- Expert suggestion wording should emphasize final release, SD / QA / statistics confirmation, or human revision before archive/export; avoid implying the Agent must regenerate unless the user explicitly asks.
- Expert suggestion preview uses the same evidence structure as warning preview: `来源证据` and `影响范围`.
- Experts are not the protagonist. The user’s next action and responsibility are the protagonist.
- After all expert suggestions are confirmed, show an `专家建议文档` artifact card as a lightweight review deliverable.

## Conversation Phase Pattern

The main chat is divided into three clear phases:

1. Validation: user starts validation, agent thinks, agent summarizes warning and next action.
2. Generation: user accepts warning, agent thinks, agent summarizes produced artifacts.
3. Expert review: agent enters review, review thinking chain runs/collapses, agent summarizes issues needing confirmation.

Each phase should be visually separated with enough vertical rhythm. Do not stack thinking cards, replies, artifacts, and decisions so tightly that the phase boundary disappears.

Empty state can be centered. Once the task enters chatflow, agent replies, process rows, and evidence links follow a left-aligned reading rhythm.

## Motion

Motion should feel 70% Apple smooth and 30% atypica light. It should help the user understand state, not perform.

- Logo breathing mark: 1600ms, `scale(1) -> scale(1.035) -> scale(1)`, opacity `0.86 -> 1 -> 0.86`, with a tiny `-1deg -> 1.5deg -> -1deg` turn.
- Logo moves only while thinking; otherwise static.
- Thinking nodes should appear progressively with a short grow/fade, so the chain feels like it is being built rather than checked off.
- User confirmation bubbles can enter with a subtle 180ms send motion to separate phases.
- Status dots can flash once when warning/review state changes to confirmed.
- Generated artifacts can enter with a small stagger. This applies to core deliverables and the expert suggestion document.
- Upload hover / drag-over: hairline shifts to BioAZ Blue and panel lifts 1px.
- Artifact hover: slight lift, clearer operation icons.
- Floating panel and preview modal: 140-180ms slide/fade.
- Respect reduced motion preferences and collapse decorative motion when requested.
- Avoid long rotations, particles, bouncing, wave effects, and decorative continuous motion.

## Copy Rules

- Use business language before technical language.
- Say `校验完成`, `需要确认`, `已进入专家检查`, `最终放行仍需确认`.
- Avoid vague AI copy such as `智能体正在思考`, `任务成功啦`, `AI 已为你完成`.
- The main conversation should not expose engineering terms by default.
- Engineering terms belong in technical details or evidence preview.
- User-facing copy should clarify responsibility boundaries.

## Do Not

- Do not create a marketing hero.
- Do not use large AI gradients, glowing orbs, bokeh blobs, or decorative glassmorphism.
- Do not overuse colorful tags.
- Do not show full lineage, job ids, trace ids, digests, or function names by default.
- Do not put every process artifact in the main conversation.
- Do not let warning confirmation sound like scientific sign-off.
- Do not let generated outputs appear final before review and release gates are clear.
