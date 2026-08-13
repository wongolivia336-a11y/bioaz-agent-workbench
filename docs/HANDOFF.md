# Engineering Handoff

## Purpose

This repository contains a clickable front-end prototype for the BioAZ agent workbench.

DMPK quotation was the first business flow and still carries the most detail, but the
shell now hosts several: quotation, QA review, the data hub, and the mailbox. The design
language is derived from the tumor report workbench.

## Shell Map

| Route | Surface | Owning code |
|---|---|---|
| `newTask` | Intent capture, hands off to a module | `NewTaskHome.tsx` |
| `module` | A running task session | `modules/<module-id>/` |
| `library` | 数据中枢 — files and products across projects, plus the ask assistant | `FileManager.tsx`, `KnowledgeAsk.tsx` |
| `inbox` | 邮箱 — document hand-off between people | `MailboxPage.tsx` |
| `digitalTeam` | Coworkers, skills, connectors | `DigitalTeamPage.tsx` |

Two container types share one implementation (`ProjectType`): `client` is one customer
engagement, `library` is a shared reference space with no tasks and no client fields.

## Mailbox Model

Mail is the container; a to-do is one of its attributes (`action: open | done | none`),
not a second list. `lib/workbench/mailboxData.ts` is the single source — the sidebar badge
and the mailbox tab count both read `mailboxTodoCount()`. There is deliberately no
parallel "todo" collection; the earlier `InboxTodoPanel` was removed for that reason.

`lib/workbench/mockInbox.ts` still exists but now only backs the project activity feed and
the account switcher. It is **not** the mailbox model — do not extend it for mail.

## Current Scope

- Mock-only front-end state.
- No backend API integration.
- No real quotation calculation.
- No real Word / Excel generation.
- No persistence, auth, or permission service.
- **No ownership model.** Tasks read as personal chats inside a shared project, but
  `WorkbenchTask` has no owner field and the sidebar does not filter by account —
  switching accounts changes the mailbox, not the task tree.

## Preserved Design Rules

- Sidebar project/chat hierarchy follows the tumor report prototype.
- Agent replies stay short and business-facing.
- Activity chains are shown progressively and collapse into lightweight process rows.
- Right panel uses hairline borders, restrained color, and compact repeated rows.
- Modal previews reuse the tumor report preview layout.
- BioAZ Blue is reserved for primary actions, focus, links, and traceable affordances.
- One action, one door. A label that already appears in the topbar or a tab is not
  repeated in the content area.
- Floating assistants keep one silhouette. Collapsed and expanded are the same pill at
  two widths, with any answer floating above it — never a card wrapped around the pill.
  `FloatingChatDock` (DMPK) and `KnowledgeAsk dock="floating"` (数据中枢) follow this.

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
