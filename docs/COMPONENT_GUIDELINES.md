# Component Guidelines

## Ownership

- Shell components know workspace concepts, not business fields.
- Modules know their own workflow, messages, validation, artifacts, and Inspector content.
- `WorkbenchInspector` knows panel mechanics, not business topics.
- Registry files contain discovery metadata, not UI state.

## Interaction

- Primary navigation uses click.
- Context actions use the row ellipsis or right click.
- Hover may reveal a shortcut or Inspector hot zone, but cannot be the only path.
- Selection must produce an active state or checkmark.
- BioAZ Helper clarifies ambiguous intent before dispatch.
- Switching a digital coworker changes the active module through the registry.

## Compatibility

Do not duplicate the former monolith. `components/DmpkQuotationWorkbench.tsx` is a compatibility export only.
