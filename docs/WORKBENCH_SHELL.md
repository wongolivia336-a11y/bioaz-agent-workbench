# BioAZ Workbench Shell

The Shell owns product-wide navigation and task orchestration. It must not contain business fields or business-specific workflow stages.

## Responsibilities

- Brand, sidebar, projects, tasks, pins, and temporary tasks
- New-task home and project assignment
- BioAZ Helper intent clarification and dispatch confirmation
- Task list and file manager
- Digital coworker switching
- Shared composer, status, artifact, and empty-state conventions
- Mounting the selected Agent Module

`components/workbench-shell/WorkbenchShell.tsx` is the application composition root. Existing imports of `DmpkQuotationWorkbench` remain valid through a compatibility export, but no business logic lives there.

## Routing

The prototype uses local React state with four routes: `newTask`, `tasks`, `library`, and `module`. A future router or backend can replace this state without changing module contracts.

## Boundary Rule

Shell code may display module metadata from the registry. It must not import DMPK fields, quotation rules, or DMPK Inspector renderers.
