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

## Git Rules

- Inspect `git status --short --branch` before edits and before final summary.
- Stage only files relevant to the requested task.
- For UI/code changes, run `npm run typecheck` before committing.
- For documentation-only changes, ensure no files under `app/`, `components/`, `lib/`, or `public/` changed.
