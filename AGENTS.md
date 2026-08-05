# Agent Instructions

This file applies to `prototype-bioaz-agent-workbench`.

## Project Boundaries

- This is a clickable Next.js frontend prototype, not production backend code.
- Do not change UI, visual style, or interaction behavior unless the user explicitly asks for it.
- The product composition root is `components/workbench-shell/WorkbenchShell.tsx`.
- Shared Inspector mechanics live in `components/workbench-inspector/`.
- Business flows and renderers live in `modules/<module-id>/`.
- Workspace mock data and shared types live in `lib/workbench/`.
- Do not put business fields or stage checks in Shell components.

## Run and Validate

- Run commands from this project directory, not from `G:\实习`.
- Prefer npm cache at `D:\.cache\npm` when installing or running npm tooling:

```powershell
$env:npm_config_cache='D:\.cache\npm'
npm run typecheck
npm run dev -- --port 3001
```

- Use `npm run typecheck` as the default validation check for code changes.

## Do Not Scan or Commit Generated Artifacts

Avoid scanning, editing, or committing:

- `node_modules/`
- `.next/`
- `output/`
- `dist/`
- `coverage/`
- `*.log`
- `tsconfig.tsbuildinfo`

These are generated or local-only artifacts.

## Documentation Rules

- `README.md` is the project entry point.
- `CHANGELOG.md` records important user-visible or handoff-relevant changes.
- `docs/DESIGN.md` is the current design source of truth.
- `docs/HANDOFF.md` is the engineering handoff source of truth.
- `docs/API_CONTRACT.md` is the backend API planning draft.
- `docs/archive/` stores historical process documents. Do not delete archived files unless the user explicitly asks.

## Design System Rules

- Prefer existing primitives from `components/ui` for buttons, cards, dialogs, drawers, menus, tabs, status chips, and empty states.
- Business modules may add business-specific components, but must not reimplement an existing UI primitive under a new local class or component name.
- Keep business-specific components inside their owning module. Promote one to `components/ui` only after at least two real cross-module use cases establish a stable API.
- Component styles must not introduce raw hex, RGB, or HSL colors. Use global `--bioaz-*` tokens first; define a semantic token on the module root when the color is genuinely business-specific.
- Third-party brand colors, scientific chart series, and externally rendered content are documented exceptions. Add a short source/scope comment when using one.
- These are review guidelines, not CI-blocking rules. When no existing primitive or token fits, document the gap instead of forcing an incorrect abstraction.
- See `docs/design-system.md` for component usage boundaries and `/design-system` for the executable catalogue.

## Git Rules

- Inspect `git status --short --branch` before edits and before final summary.
- Stage only files relevant to the requested task.
- For UI/code changes, run `npm run typecheck` before committing.
- For documentation-only changes, ensure no files under `app/`, `components/`, `lib/`, or `public/` changed.
