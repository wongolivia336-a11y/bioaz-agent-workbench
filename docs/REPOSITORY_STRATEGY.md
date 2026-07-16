# Repository And Deployment Strategy

## Source Of Truth

`prototype-bioaz-agent-workbench` is the only active product repository. Shared Shell code and both active business modules are developed and tested here.

Standalone repositories are migration sources and historical references:

- `prototype-agent-workbench` -> `tumor-report-agent-prototype-`
- `prototype-dmpk-quotation-workbench` -> `dmpk-agent`

Do not copy Shell changes back and forth between these repositories. Urgent standalone fixes must be documented and ported into the corresponding module once.

## Active Scope

- DMPK quotation
- Tumor report

Tumor quotation and QA review are roadmap items and must remain unregistered until implementation starts.

## Git Flow

- `main`: previewable, reviewed product baseline
- `codex/tumor-report-module`: current tumor report migration
- Future work: one short feature branch per business change

No nested Git repositories, submodules, generated build folders, or copied `node_modules` belong in the canonical repository.

## GitHub

Create one new repository named `bioaz-agent-workbench`. The two existing repositories remain intact during migration. After both modules pass acceptance, tag their final standalone commits and mark them as legacy in their README files.

## Vercel

Connect one Vercel project to `bioaz-agent-workbench/main`. Pull requests and feature branches provide Preview Deployments; `main` provides the stable review URL.

If separate direct URLs are later required, create two Vercel projects from the same repository and select the default module through an environment variable. Do not fork or duplicate source code for deployment.
