# BioAZ Agent Workbench

Reusable Next.js workbench shell for two active business modules: DMPK quotation and tumor report.

This repository is for design review, user-flow validation, and engineering handoff. It is not production backend code. There is no backend, no auth, no database, and no real Word/Excel export — every flow runs on mock data in `lib/workbench/`.

## Quick Start

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000. Pass `-- --port 4307` if 3000 is taken.

```bash
npm run typecheck
```

There is no test suite and no ESLint config; `typecheck` is the gate before a commit.

## Preview

Vercel: https://prototype-bioaz-agent-workbench.vercel.app/

## Version Baseline

`responsive-baseline-2026-08-05` preserves the responsive Workbench before the
next large product iteration. Use that Git tag to compare or restore this UI;
the active branch can continue evolving independently.

This baseline covers desktop, tablet, and mobile shell behavior, responsive
content spacing, horizontally scrollable data tables, stacked narrow-screen
forms, and mobile drawers. The intended review widths are 1440, 1024, 768,
and 390 CSS pixels.

## What To Look At First

- `/` — new-task home. Describe a task, Helper routes it to a coworker, confirm the dispatch to enter a module.
- `/?view=quotation-management&business=dmpk` — DMPK rule management and its rule assistant.
- `/design-system` — executable design foundations: tokens, buttons, menus, chips, cards.

### Design System

The shared UI system is maintained for developers and coding agents:

- [docs/design-system.md](docs/design-system.md) — component inventory, Props, usage boundaries, and migration guidance.
- [styles/tokens.css](styles/tokens.css) — the single source of truth for global `--bioaz-*` tokens.
- [components/ui](components/ui) — stable shared UI primitives.
- `/design-system` — executable catalogue rendering the real components and an automatically extracted Token list.

Run it locally:

```powershell
$env:npm_config_cache='D:\.cache\npm'
npm.cmd run dev -- --port 3001
```

Then open http://localhost:3001/design-system.

The composer at the bottom of every conversation is the shared `WorkbenchComposer`: its plus button opens a two-level menu (file / skill / connector), selections become chips inside the input, and files can be dropped anywhere on the page. Who does the work is a separate control — the coworker dropdown above the input. See the Capability Entry section in [docs/DESIGN.md](docs/DESIGN.md).

## Vercel Deployment

Use the default Next.js settings:

- Framework Preset: `Next.js`
- Root Directory: repository root
- Build Command: `npm run build`
- Output Directory: leave empty
- Install Command: default or `npm install`

If a previous failed deployment configured `dist`, `out`, or another output directory, clear that setting and redeploy from the latest `main` branch.

## Documentation Map

- [CHANGELOG.md](CHANGELOG.md)
  Version history and important iteration notes.

- [AGENTS.md](AGENTS.md)
  Project-specific rules for Codex/agent handoff.

- [docs/DESIGN.md](docs/DESIGN.md)
  The single design source of truth: foundations, Shell, components,
  interactions, ownership boundaries, and migration rules. Preview executable
  foundations locally at `/design-system`.

- [docs/DMPK_QUOTATION_CANONICAL_SPEC.md](docs/DMPK_QUOTATION_CANONICAL_SPEC.md)
  Canonical DMPK interaction, panel, composer, preview, and artifact specification.

- [docs/HANDOFF.md](docs/HANDOFF.md)
  Engineering handoff notes for future API integration.

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md)
  Draft backend API contract.

- [docs/design-system.md](docs/design-system.md)
  How to use the shared components in `components/ui` and `WorkbenchComposer`,
  plus the migration traps found along the way.

- [docs/SKILLS_INVENTORY.md](docs/SKILLS_INVENTORY.md)
  Current local skills inventory and cleanup notes.

- [docs/archive/](docs/archive/)
  Historical worklogs, UX reviews, change notes, and presentation drafts. These are kept for traceability but are not the active source of truth.

## Repository Map

- `app/`
  Next.js App Router entry files. `app/page.tsx` renders the prototype screen. The visual system is split across ~13 stylesheets imported in `app/layout.tsx`; import order is the cascade order, so a later file wins on equal specificity.

- `components/workbench-shell/`
  Product shell: sidebar, task entry, Helper routing, task list, file manager, and shared controls.

- `components/workbench-inspector/`
  Reusable Inspector container and public types.

- `components/ui/`
  Shared BioAZ UI primitives such as buttons and cards.

- `styles/`
  Semantic design tokens and shared component styles.

- `modules/`
  Agent module registry and business-owned flows. DMPK quotation is connected and tumor report is the current integration branch.

- `lib/`
  Mock data, workflow helpers, type definitions, and API contract shape.

- `docs/`
  Active design, handoff, API, skills, and archive documentation.

- `public/`
  Static assets such as the BioAZ logo.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Plain CSS, no framework, no CSS-in-JS
- `lucide-react` icons (typed through a local shim in `types/lucide-react.d.ts` — add new icon names there before importing them)
