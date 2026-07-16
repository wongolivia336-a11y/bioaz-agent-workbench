# Engineering Handoff

## Purpose

This repository contains a clickable front-end prototype for the DMPK quotation agent workspace.

It is derived from the tumor report workbench design language, but the business flow is quotation-specific.

## Current Scope

- Mock-only front-end state.
- No backend API integration.
- No real quotation calculation.
- No real Word / Excel generation.
- No persistence, auth, or permission service.

## Preserved Design Rules

- Sidebar project/chat hierarchy follows the tumor report prototype.
- Agent replies stay short and business-facing.
- Activity chains are shown progressively and collapse into lightweight process rows.
- Right panel uses hairline borders, restrained color, and compact repeated rows.
- Modal previews reuse the tumor report preview layout.
- BioAZ Blue is reserved for primary actions, focus, links, and traceable affordances.

## DMPK Flow

```text
User enters quotation request
-> Agent identifies DMPK / PK / BA Only / Toxicology
-> User supplements parameters through grouped cards
-> User sends structured parameter tabs
-> Right parameter ledger updates after submission
-> User previews all parameters
-> Agent generates Word and Excel quotation outputs
-> Right panel switches to artifacts / versions
```

## Key UX Decisions

- The right parameter panel is permanent and should not become the primary editing surface.
- Pencil actions in the right panel route the user back to the center conversation card.
- Missing fields are grouped by `检测类型`, `动物实验`, `生物分析`, and `报告与报价`.
- Pricing-critical fields cannot be TBD.
- No estimate quotation mode is included.
- Word and Excel are separate default deliverables.
- Versions are managed in the right panel, not in the sidebar.

## Suggested Next Steps

1. Run install and typecheck after explicit approval for dependency installation location.
2. Validate the first-screen layout in browser at desktop width.
3. Add real DMPK field schemas for PK / BA Only / Toxicology.
4. Replace mock rule text with pricing engine outputs.
5. Add export consistency checks once Word / Excel generation APIs exist.
