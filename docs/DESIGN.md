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
- `docs/design-system/README.md`: component boundaries and migration rules

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
- The Gate first appears expanded.
- Limit its expanded height; keep its header and actions stable while the item
  list scrolls internally.
- When the user scrolls away from the conversation bottom, collapse it smoothly
  into a compact summary bar.
- Expand it at 48px or less from the bottom and collapse it at 120px or more;
  keep the current state between those thresholds to prevent flicker.
- Manual collapse takes precedence until the user expands it or a new Gate
  appears.
- Pause automatic collapse while the Gate has focus, is hovered, or is actively
  processing confirmation.
- Keep a manual expand/collapse icon in the Gate header.
- At 1440x900, cap the expanded Gate at approximately 420px; keep Header and
  actions stable while the warning list scrolls internally.
- Use an approximately 56px summary bar when collapsed.
- Container hover must not scale, lift, or shift surrounding layout.

### Composer

- Treat coworker selection, attachments, input, help, and send as one stable
  input system.
- Use a neutral default border.
- Show a subtle `#5C60B8` focus ring only when focused.
- Keep a fixed visual gap between the confirmation Gate and Composer.

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
- Home, Digital Team, Data Hub, DMPK, and tumor-report content use one large
  white workspace surface.
- The white workspace keeps 12px from the top, right, and bottom viewport edges,
  with an 8px grey gutter beside Sidebar.
- The workspace uses the 16px container radius, a light border, and only subtle
  elevation.
- When Inspector opens, it divides the same white workspace instead of adding a
  separate floating card.

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
- `components/workbench-inspector/` owns shared Inspector mechanics.
- `modules/tumor-report/` owns tumor-report business flow and rendering.
- `lib/workbench/` owns shared workspace mock data and types.
- Do not move business fields or stage checks into Shell components.
- Migrate one real surface at a time and avoid generic global CSS class names.
