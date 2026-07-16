# Agent Module System

Each business capability is registered through `AgentModuleDefinition` in `modules/types.ts` and `modules/registry.ts`.

## Module Contract

A module declares identity, coworker, intents, quick starts, stages, composer actions, artifacts, required files, validation rules, handoff notes, and a Session component.

The Session receives only Shell context:

- project and task names
- initial natural-language request
- available digital coworkers
- active coworker and change callback
- return-to-new-task callback

## Active Modules

- `dmpk-quotation`: connected implementation, including fields, flow, business views, mock data, and Inspector renderers
- `tumor-report`: integration target; its standalone business flow is being migrated into the shared Shell

`tumor-quotation` and `qa-review` remain roadmap definitions only. They are not registered, shown in the coworker selector, or exposed as quick starts.

## Adding A Module

1. Create `modules/<module-id>/index.ts` and a Session component.
2. Keep business state and Inspector panel renderers inside that folder.
3. Register the module in `modules/registry.ts`.
4. Add intent examples and a quick start only when the module can represent that entry honestly.
5. Verify Helper clarification, dispatch, coworker switching, and unavailable fallback.
