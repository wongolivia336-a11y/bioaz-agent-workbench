# Changelog

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
