# BioAZ Agent Workbench

Reusable Next.js workbench shell for two active business modules: DMPK quotation and tumor report.

This repository is for design review, user-flow validation, and engineering handoff. It is not production backend code.

## Preview

- Local phase-one branch: `codex/workbench-shell-phase-1`
- Vercel: https://prototype-bioaz-agent-workbench.vercel.app/

## Quick Start

```bash
npm install
npm run dev -- --port 4307
```

Open:

```text
http://localhost:4307
```

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
  Current design system and interaction rules.

- [docs/DMPK_QUOTATION_CANONICAL_SPEC.md](docs/DMPK_QUOTATION_CANONICAL_SPEC.md)
  Canonical DMPK interaction, panel, composer, preview, and artifact specification.

- [docs/HANDOFF.md](docs/HANDOFF.md)
  Engineering handoff notes for future API integration.

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md)
  Draft backend API contract.

- [docs/SKILLS_INVENTORY.md](docs/SKILLS_INVENTORY.md)
  Current local skills inventory and cleanup notes.

- [docs/archive/](docs/archive/)
  Historical worklogs, UX reviews, change notes, and presentation drafts. These are kept for traceability but are not the active source of truth.

## Repository Map

- `app/`
  Next.js App Router entry files. `app/page.tsx` renders the prototype screen and `app/globals.css` contains the visual system.

- `components/workbench-shell/`
  Product shell: sidebar, task entry, Helper routing, task list, file manager, and shared controls.

- `components/workbench-inspector/`
  Reusable Inspector container and public types.

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
- CSS in `app/globals.css`
- `lucide-react` icons

## Prototype Scope

- DMPK flow and workspace mock data only
- No backend APIs
- No authentication
- No database
- No real Word / Excel export service
