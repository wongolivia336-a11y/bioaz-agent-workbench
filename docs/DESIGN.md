# BioAZ Agent Workbench Design Source of Truth

This document describes the current workbench. Obsolete Clinical Canvas v0.2
concepts, including the large `Document Altar` and `Upload Ready Panel`, have
been removed.

## Product Position

BioAZ Agent Workbench is a restrained medical-research workspace, not a generic
AI chat product or a marketing surface. UI decisions should prioritize stable
reading rhythm, traceable workflow state, clear operations, and low visual
noise.

## Executable Foundations

The implementation is the primary reference:

- `styles/tokens.css`: semantic color, typography, spacing, radius, shadow, and
  motion tokens
- `styles/design-system.css`: shared component behavior
- `components/ui/`: reusable UI primitives
- `/design-system`: local component catalog

This is the only design specification document. Do not create separate token,
component-guideline, module-design, or design-system README files. When a
shared rule changes, update the executable foundations first and then update
this document.

Confirmed visual foundations:

- Brand primary: `#2900FF`, reserved for the Logo and primary CTA
- Agent/process accent: `#5C60B8`
- Canvas: `#F7F8FA`
- Surface: `#FFFFFF`
- Body copy: `14px / 22px`
- Font weights: `400 / 500 / 600`
- Radius: `8px` tools, `12px` controls, `16px` containers
- Spacing: 4px base grid
- Borders before shadows

## Current Tumor Report Flow

The first UI/UX optimization target is the existing tumor-report path:

1. Enter a project
2. Upload files
3. Agent validation
4. Confirm warnings
5. Generate artifacts
6. Expert review
7. Open the right artifact panel
8. Final delivery

Existing steps, copy, permissions, confirmation semantics, and business logic
must remain unchanged unless a later requirement explicitly changes them.

### Current Upload Interaction

There is no large upload card or drag-and-drop altar.

- The Agent opening message remains in the Chatflow.
- Files are uploaded from the `+` action in the shared Composer.
- File requirements and uploaded file rows appear immediately above the
  Composer.
- When requirements are satisfied, the existing send action becomes
  `开始校验`.

## Current UI/UX Optimization Direction

### Chatflow

- Keep Logo and primary CTA in the existing brand blue.
- Use low-saturation `#5C60B8` for process nodes, process status, weak links,
  and secondary emphasis.
- Use translucent derivatives for process backgrounds and borders.
- Keep normal text neutral and visually dominant.
- Align Agent text, process rows, confirmation Gates, files, and Composer to one
  content grid.
- Use restrained right-aligned rounded rectangles for user messages rather than
  pill-shaped chat bubbles.

### Agent Motion

- The Agent Logo appears in active thinking/execution states, not as a
  persistent avatar beside every completed reply.
- The Logo geometry remains unchanged.
- Use only subtle breathing scale while a stage is active.
- A narrow, soft light sweep crosses inside the Logo when a workflow stage
  advances.
- Do not use continuous scanning, rotation, shape deformation, strong glow,
  bouncing, or large scaling.
- Stop all looping motion when the stage completes.
- Respect `prefers-reduced-motion`.

### Confirmation Gate

- Warning and review confirmation remain a distinct pending-operation Gate
  above the Composer, not part of message history.
- The Gate first appears collapsed and exposes its title, completion count, and
  manual expand control.
- Expanding the Gate should show all three standard confirmation items at
  desktop height without an internal scrollbar. Use internal scrolling only
  when the viewport cannot fit the content.
- Use approximately 112px per confirmation item so role, title, evidence, and
  impact do not overlap or compete for the same line.
- Do not animate the container by squeezing, stretching, or sliding its
  children. Geometry may switch directly; use only a restrained content
  opacity transition of approximately 160ms.
- Returning to the conversation bottom does not override the default collapsed
  state. The user expands the Gate deliberately when ready to process it.
- Pause state changes while the Gate has keyboard focus or is actively
  processing confirmation. Hover alone must not lock the Gate.
- Keep a manual expand/collapse icon in the Gate header.
- Use an approximately 56px summary bar when collapsed.
- Container hover must not scale, lift, or shift surrounding layout.

### Composer

- Treat coworker selection, attachments, input, help, and send as one stable
  input system.
- Use a neutral default border.
- Show a subtle `#5C60B8` focus ring only when focused.
- Keep a fixed visual gap between the confirmation Gate and Composer.

#### Capability Entry (Plus Menu)

The plus button is a capability entry, not a file picker. It answers *what do
I bring in and which abilities apply*, never *who does the work*.

- **Who does the work has exactly one entry**: the coworker dropdown above the
  input. The plus menu must never list experts or coworkers. Duplicating that
  choice in two places is the failure mode this rule exists to prevent.
- Three sections only: **add file / skills / connectors (MCP)**. Do **not**
  add a conversation "mode" (Plan / Ask). BioAZ is flow-driven — how a task
  runs is already defined by the coworker's flow. `ProjectPlanTab` is a
  project-level tab, not a conversation mode.
- Two levels: three first-level rows, each expanding a submenu to the right.
  Add file offers local upload plus searchable project-library and knowledge-base
  lists; skills and connectors are searchable lists.
- Skill and connector lists are **grouped, not filtered**. Before a coworker is
  known (home screen) they are flat. Once one is active, `<coworker> 已具备`
  sits on top and `其他可用…` follows. Borrowed items carry a
  `本次临时启用` marker on their chip so the temporary scope stays visible.
- Disconnected or pending connectors render disabled rather than hidden — the
  catalogue should stay legible.

#### Attachment Chips

- Selected items become removable chips **inside the composer border, above the
  textarea**. Chips belong to the message; the coworker belongs to the session,
  which is why they live at different altitudes.
- On send, chips move into the user message bubble as a read-only trail and
  clear from the composer. They do not change flow branching.
- User bubbles are light across the product; the trail uses an outlined chip,
  never translucent white.

#### Drag and Drop

- The whole page accepts a file drop and suppresses the browser's default
  "open this file" behaviour. Aiming at a 40px button from the desktop is not a
  reasonable ask.
- Visual feedback is confined to the composer: dashed border plus
  `松手以添加到对话`. No full-screen overlay — it is louder than this product.
- Only one composer per screen may claim the page-level listener.

#### Where It Applies

`WorkbenchComposer` owns the plus menu, chip row, and drop handling, and is
wired into new-task home, DMPK quotation, and the DMPK rule assistant. The
Helper drawer uses the same component with the menu disabled — a two-level
floating submenu has nowhere to go in a narrow drawer. The legacy tumor-report
composer is untouched; its plus button drives a scripted demo upload, not a
file picker.

Keyboard triggers (`/` for skills, `@` for files) are deliberately deferred.
They need cursor measurement, inline popover placement, and trigger-character
cleanup — almost nothing is shared with the floating menu.

### Right Inspector

- The Inspector has no Pin mode or Pin control.
- At widths of 1200px and above, opening the Inspector creates a real third
  layout column inside the white workspace surface.
- Below 1200px, the same Inspector becomes a full-height right Drawer.
- Closing and reopening preserves the current category and selected artifact.
- Wide-screen Inspector closes only through the shared header toggle or its
  internal close control; it does not close when the user clicks Chatflow.
- Use a fixed responsive width: approximately `360px` at 1440px and `400px` at
  1920px.
- Use a fixed header, optional filter area, and independently scrolling content.
- Present artifacts as compact structured rows; only ZIP delivery packages
  expose download.

### Shared Shell Surface

- The entire product uses `#F7F8FA` as a shared grey base.
- Sidebar remains directly on the grey base rather than becoming a card.
- Home, BioAZ Helper, Digital Team, Data Hub, DMPK, and tumor-report content
  use one shared `WorkbenchShell` and one large white workspace surface.
- The white workspace keeps 12px from the top, right, and bottom viewport edges,
  with an 8px grey gutter beside Sidebar.
- The workspace uses the 16px container radius, a light border, and only subtle
  elevation.
- The workspace Header and content area are both pure white. Do not add tinted
  header strips, gradients, decorative blocks, or duplicate inner columns.
- `WorkspaceHeader` owns breadcrumbs and a right-aligned action slot. Modules
  provide controls through the slot without creating another header row.
- Agent identity belongs in the opening message or Composer selector. Do not
  create a full-width `某某数字同事` row beneath the workspace Header.
- When Inspector opens, it divides the same white workspace instead of adding a
  separate floating card.

### Shared Panel Trigger

- Tumor report and DMPK use the same `PanelRight` trigger in the
  `WorkspaceHeader` action slot.
- Closed state is neutral. Hover uses a light brand background and brand icon.
  Open state uses a brand background and white icon.
- Closing from inside the Panel returns the trigger directly to neutral. If the
  pointer lands over the revealed trigger, Hover remains suppressed until the
  pointer exits and re-enters.
- The trigger opens a real right workspace column at desktop width and a Drawer
  at narrower widths. There is no Pin mode.
- Panel opening is event-driven, not stage-driven. It opens automatically once
  only when artifacts are generated during the current live session. Closing
  it is respected; refreshes, historical tasks, validation, review, Home,
  Digital Team, and Data Hub do not force it open again.
- Both modules now use this trigger through the shared `PanelToggle`, which
  drives the `WorkbenchPanel` described below. The three mutually exclusive
  entries (artifacts / parameter collection / annotation canvas) are gone from
  both.

### Shared Right Panel

DMPK and tumor report share one `WorkbenchPanel`: a tab bar, a `+` visibility
menu, and a content area. It replaced DMPK's three mutually exclusive entries
and tumor report's dropdown panel selector. The old DMPK exclusivity existed
only to stop the full-height rail from covering the floating parameter card;
once nothing floats, the reason disappears.

- **Structure.** The panel lives inside the workspace, not beside it. Both the
  conversation and the panel sit inside the one rounded white card, split by a
  single full-height divider that runs from the top of the card to the bottom.
  The divider is one hairline at 6% ink — lighter than a normal border, because
  it marks a division inside a card rather than the edge between two cards. The
  panel's tab bar is its own header, level with the breadcrumb row, so the two
  halves are legible on either side of the divider.
- **Composer.** The composer is absolutely positioned across the workspace, so
  it does not inherit the grid column. Its right edge must be pulled in to the
  panel width whenever the panel is open, otherwise it centres on the whole card
  while the conversation above it centres on the left column.
- **Tabs.** From a per-module registry of `ResolvedInspectorPanel`;
  `available()` gates a panel by stage, the `+` menu decides which available
  panels are shown, and each tab carries an `×` to hide itself. The selected tab
  is marked by a grey underline, not a filled background. The `×` always
  occupies its 16px and only toggles visibility — sizing it on hover makes the
  whole tab strip jump. The last remaining tab keeps neither `×` nor the ability
  to be unchecked, so the panel can never become an exit-less blank.
- **Collapse.** The topbar toggle collapses the panel; the gutter and panel
  columns disappear and the conversation takes the full width. Below 1200px the
  open panel is a fixed overlay drawer pinned to the right edge instead of a
  layout column.
- **Defaults.** DMPK opens expanded on the parameter tab, because parameter
  collection is its main working surface. Tumor report stays event-driven per
  the rule above: collapsed by default, auto-opened once when artifacts are
  generated.
- **Stage suggestions.** Stage progression suggests a tab (DMPK: collecting →
  parameters, generating → process, generated → artifacts; tumor report:
  uploaded → files, validating → process, generated → artifacts). Once the user
  selects a tab themselves, later suggestions stop stealing the view and only
  mark the target tab with a dot. Explicit user intent — clicking a card in
  Chatflow, editing a field — always switches the tab, clears its dot, and
  expands a collapsed panel.
- **DMPK tabs.** Parameter collection, process, materials, gaps, evidence,
  artifacts, review, quotation rules. Default visible: parameters / process /
  artifacts.
- **Tumor report tabs.** Uploaded files, process, generation, risk review,
  artifacts, review suggestions. Default visible: files / process / artifacts.
  The uploaded-files tab is read-only; it exists because input files otherwise
  scroll out of Chatflow and cannot be found again.
- **Quotation rules** is the front-of-house disclosure of back-office pricing
  configuration. Its boundary matches `DmpkEditProposalCard`: values scoped to
  the current quotation are editable in place; global rules are read-only and
  deep-link to the quotation-management back office.
- Chatflow in DMPK is left-aligned rather than centred; the 900px cap is
  unchanged and user bubbles stay right-aligned.

### Shared Chatflow Grammar

- Tumor report and DMPK share the same Chatflow grid, user-message geometry,
  Composer focus treatment, process-card width, artifact-row height, and
  restrained motion.
- Both modules render the thinking chain with the same `agentRun` /
  `runHeader` / `timeline` structure: one card, one border, a header carrying
  the motion logo and elapsed time, and a timeline inside. Running shows the
  blue motion logo and opens the timeline; settled collapses to a single
  transparent, borderless line. DMPK previously used a `details`/`summary`
  variant where the element, its summary, and its panel each drew their own
  border, which read as three nested boxes.
- In DMPK the conversation column, the parameter card, and the Composer all use
  one `--dmpk-column` width and one centre axis. Do not give any of them a
  separate width.
- Process nodes, weak links, and auxiliary status use low-saturation purple-blue
  `#5C60B8`; Logo and primary brand identity keep the primary brand blue.
- User messages are right-aligned rounded rectangles without chat tails.
- Business-specific forms, quotation tables, and parameter structures keep
  their domain hierarchy rather than copying another module's content layout.

### Multi-Member Progress

Long parallel work — currently the tumor-report expert squad — needs a progress
signal that is not another copy of the process timeline.

- One dataset, one expanded representation. While the squad is running, the
  member-status card owns "who is where" and the process card collapses; once
  the review lands, the member card collapses to a single summary line and the
  process card becomes expandable again.
- The member card reuses the `.agentRun` shell so it is pixel-identical in width
  and framing to the other process cards.
- Members render as a single row of chips: status dot, initial, short name. The
  running member's dot pulses; the full name, task, and finding stay in hover.
- Time is reported once, in the card header, using the same relative elapsed
  format as every other card. No fabricated absolute timestamps.

### Data Hub

- The Data Hub remains project-first. Borrow file-manager interaction details,
  but do not replace the project, task, Agent, and deliverable relationship with
  a generic workspace/folder hierarchy.
- A project page uses two bounded overview lanes: project materials and task
  outputs. Each shows at most five recent items, has no nested scrollbar, and
  uses a white-to-`#5C60B8` 4–6% fade plus an explicit `View all` action.
- Clicking a file previews it. Clicking the lane title or `View all` opens the
  full-width list for that category.
- Full lists share one table grammar but keep category-specific meaning. The
  default row actions are Preview, View details, and Delete.
- Delete is soft by default. A project-level recycle bin supports Restore and
  Permanent delete.
- Preview follows the existing Modal pattern. Details follow the existing right
  Panel pattern; do not create a second drawer system.
- Project files are reached from the project's three-dot menu rather than a
  permanent task-like Sidebar row. A clickable topbar breadcrumb carries the
  hierarchy from Data Hub to project, category, folder, or recycle bin.
- File-management primary actions such as Upload use the shared black primary
  button. Low-saturation purple-blue remains a focus, status, and weak-link
  color rather than a default action fill.
- The file assistant remains a bottom Chatbot affordance. It is a compact pill
  until clicked, then expands into the Composer and states its current scope.
  Clicking outside collapses it without an intermediate hover state.
- New folders are created from the Data Hub overview, where the user explicitly
  chooses the owning project. Creation may optionally pin a first-level folder
  shortcut under that project in Sidebar; nested folders do not automatically
  enter Sidebar. Project views keep Upload and Recycle bin actions only.

### Surface and Motion

- Do not wrap ordinary text or simple information in cards.
- Prefer typography, spacing, rows, and dividers for structure.
- Reserve containers for real interaction areas, data collections, workflow
  Gates, overlays, and modals.
- Hover: `120–160ms`
- Expand/collapse: `220–280ms`
- Panel transition: `260–320ms`
- Status completion: `200–300ms`
- Prefer opacity, color, and movement within `4–8px`.
- Avoid bouncing, large scaling, flashing, and decorative continuous animation.

## First-Round Validation

- Primary viewport: `1440 × 900`
- Also verify at 1920px width
- Preserve the current happy-path flow
- Stress-test many warnings, long filenames, and long artifact lists
- Empty and error-state redesign, full keyboard behavior, and resizable Inspector
  are deferred to a later round
- Run `npm.cmd run typecheck`
- Verify the real tumor-report preview, including open and closed Inspector
  layouts

## Ownership Boundaries

- `components/workbench-shell/WorkbenchShell.tsx` owns product composition.
- Shared Shell components know workspace structure, not business fields.
- `components/workbench-inspector/` owns shared Inspector mechanics.
- Modules own their workflow, messages, validation, artifacts, and Inspector
  content.
- `lib/workbench/` owns shared workspace mock data and types.
- Registry files contain discovery metadata, not UI state.
- Do not move business fields or stage checks into Shell components.
- Migrate one real surface at a time and avoid generic global CSS class names.
- Primary navigation uses click. Hover may reveal a shortcut, but it must never
  be the only way to reach an operation.
