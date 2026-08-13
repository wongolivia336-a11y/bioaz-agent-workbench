# Changelog

## 2026-08-13 — QA Review: Document-First Focus and a Resident Coworker

- Added a resident chat dock to the QA review workspace so the QA coworker can
  be asked why a finding was raised without giving up a column to conversation.
  Canned answers always cite a page; unmatched questions decline instead of
  inventing an answer.
- Inverted the fullscreen gesture for QA: the document expands and the panel
  steps aside, rather than the panel covering the document. Escape or the panel
  toggle returns, restoring the reader's own zoom.
- Restricted panel fullscreen to the AI comparison tab, the only panel that
  gains content when widened.
- Reused an existing review chat when the same inbox item is opened again,
  instead of stacking identically named tasks in the sidebar.
- Removed the dead 400px third shell column reserved for a legacy panel no
  component renders. Above 1200px it was silently taking 400px from every
  workspace, leaving the QA document column at 186px on a 1280px screen.

## 2026-08-05 — Responsive Baseline Archive

- Aligned the sidebar collapse breakpoint with its mobile drawer behavior.
- Added mobile sidebar dismissal by backdrop, Escape, and route navigation.
- Added shared tablet and mobile rules for shell spacing, headers, toolbars,
  data tables, new-task cards and composer, quotation forms, editors, and drawers.
- Recorded the pre-major-change baseline as `responsive-baseline-2026-08-05`.

## 2026-07-29 — Tumor Report UI Polish, Batch 1

- Replaced the tumor-report Inspector hover hot zone with an explicit header toggle.
- Mirrored the shared Sidebar collapse icon so its direction matches the resulting layout.
- Added a restrained validation Logo treatment with stable geometry, subtle breathing, and an internal stage glint.
- Moved tumor-report process emphasis from saturated brand blue to the Design System Agent accent.
- Removed persistent Logo avatars from completed Agent replies.
- Reworked user-originated messages as neutral rounded rectangles without chat tails.
- Added the shared grey application base and inset white workspace surface.
- Removed the tumor-report Inspector Pin mode; the header toggle now opens a
  real right column on wide screens and a right Drawer on narrow screens.
- Changed tumor-report workflow CTAs to neutral black and reserved the
  low-saturation Agent accent for Chatflow process emphasis.
- Replaced hover-driven confirmation-card stacking with a scroll-aware Gate,
  dual bottom thresholds, manual header control, and an internally scrolling
  fixed-height warning list.
- Increased the validation Logo light-sweep visibility while preserving the
  original Logo geometry.
- Added explicit brand-blue hover and active states to the Inspector toggle.
- Replaced the obsolete Clinical Canvas v0.2 design brief with the current Workbench UI/UX source of truth.

## 2026-07-23 — BioAZ Design System Foundation

- Added executable semantic tokens for brand, Agent accent, typography, spacing, radius, feedback, elevation, and motion.
- Added shared Button, IconButton, Surface Card, and Action Card primitives.
- Added a local `/design-system` visual catalog for product and engineering review.
- Migrated the home Quick Start entries to the shared Action Card while preserving routing behavior.
- Added design-system ownership and incremental migration guidance.

## 2026-07-19 — DMPK Quotation Management Prototype

- Simplified the Workbench sidebar and removed default todo and temporary-task demo entries.
- Added the quotation-management entry, DMPK standard prices, special rules, parameter builder, and scenario template versions.
- Added natural-language rule drafting, editable rule fields, calculation validation, draft and publish states, and lightweight inline condition editors.
- Added project-level quotation adjustment through the DMPK coworker with a structured confirmation preview.
- Added custom input to numeric DMPK parameter options while preserving existing project tasks.

## Tumor Report Integration Preparation

- Limited the active module Registry to DMPK quotation and tumor report.
- Added repository, deployment, and tumor migration boundaries for the canonical Workbench.
- Removed QA and tumor quotation references from active task and file-manager mock data.

## Workbench Shell Phase 1

- Established an independent BioAZ Agent Workbench repository and feature branch.
- Extracted sidebar, new-task routing, BioAZ Helper dispatch, task list, and file manager into the reusable Shell.
- Moved DMPK fields, flow, views, mock data, and Inspector renderers into the DMPK quotation module.
- Added registry-driven digital coworkers and explicit placeholders for tumor report, tumor quotation, and QA review.
- Preserved the existing DMPK visual baseline and interaction density.

Important project iterations are recorded here. Process notes and older drafts live in `docs/archive/`.

## 2026-07-10

### Documentation Structure

- Promoted `README.md`, `CHANGELOG.md`, `AGENTS.md`, and `docs/` as the active documentation structure.
- Moved historical worklog, UX review, presentation script, and change manual into `docs/archive/`.
- Moved the design brief to `docs/DESIGN.md` as the active design source of truth.
- Added a skills inventory to document local Codex skills without deleting any skills.

### Panel Evidence Preview Polish

- Unified warning and expert suggestion recall cards in the right inspector.
- Added row-level preview icons for warning and expert suggestion details.
- Moved confirmed/pending state into low-saturation ID chips instead of repeated status text.
- Clarified that expert suggestions are post-generation human review items and do not block completed Agent generation.

## 2026-07-09

### Warning Evidence Flow

- Added richer warning evidence preview content.
- Defaulted warning preview to the validation issues view.
- Added source evidence and impact scope language for warning details.

## 2026-07-06

### Initial Prototype Iteration

- Built the main upload, validation, warning confirmation, generation, expert review, and artifact preview flow.
- Added mock data and workflow state mapping.
- Added early handoff, design, and UX review notes.
