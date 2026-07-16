# Tumor Report Module Migration

## Source

Standalone source: `G:\实习\原型优化项目\prototype-agent-workbench`

Business source of truth: `components/ReportWorkbench.tsx`, plus `lib/types.ts`, `lib/workflow.ts`, `lib/mock-data.ts`, and `lib/mock-service.ts`.

## Keep And Move

- Tumor report stages and transition rules
- Upload, validation, warning confirmation, generation, review, follow-up, and delivery flow
- Conversation and composer business behavior
- Warning, review, artifact, evidence, and preview renderers
- Tumor-specific mock data and API contract notes
- Inspector panel content and stage availability rules

## Do Not Move

- Standalone `WorkspaceSidebar`, project tree, search, account, and pin implementation
- Standalone Shell layout and task navigation
- Standalone `HoverInspector` container and selector mechanics
- Duplicate Agent reply, user bubble, artifact card, and generic menu primitives when a Shell equivalent exists
- Standalone global styling that would overwrite the current Workbench visual baseline

## Target Files

```text
modules/tumor-report/
  index.ts
  TumorReportSession.tsx
  types.ts
  flow.ts
  mockData.ts
  views.tsx
  inspectorPanels.tsx
  artifacts.tsx
```

## Integration Contract

`TumorReportSession` receives project, task, initial request, coworker selection, and back-navigation through `AgentModuleSessionProps`. It returns only the center workspace and optional right rail. The Shell remains responsible for Sidebar and global task routing.

Tumor Inspector content is registered through panel definitions and rendered by the shared `WorkbenchInspector`. Business stages must not be added to the generic Inspector component.

## Acceptance

1. Helper recognizes a tumor report request and asks for dispatch confirmation.
2. Confirmation opens the tumor report module under the selected project.
3. Upload, validation, warning confirmation, report generation, review, follow-up, and artifact preview still work.
4. Shared Sidebar, pins, task list, file manager, coworker selector, and Helper remain unchanged.
5. Inspector hover, pin, selector, fallback, and conversation deep links match DMPK behavior.
6. DMPK regression paths remain unchanged.
7. Only DMPK quotation and tumor report appear in the active Registry.
