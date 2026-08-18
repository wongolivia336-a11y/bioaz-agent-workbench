# Engineering Handoff

## Session State — 2026-08-17

Branch `codex/dmpk-composer-params`, everything committed and pushed to `origin`
(GitHub). **Never push to the `gitlab` remote.** Working tree clean at `60eb7ed`.

Seven commits landed this session, newest first:

| Commit | What |
|---|---|
| `60eb7ed` | Header second row min-height; sidebar plus reverted |
| `967d209` | Track the QA handoff doc (`*.md` is gitignored — see below) |
| `03e7c78` | QA data model: version-scoped findings + repair verdicts |
| `d8f4ab3` | Removed the assistant pill's hover sheen; simplified expand |
| `a62d52d` | Data-hub assistant pinned with sticky; full-width toggle |
| `a3c9b46` | Thinking chain unified; data hub given one assistant shape |
| `5a93800` | Session minimap; mailbox rebuilt around composing |

**In flight:** QA review动线 restructure. The data model is done; **no QA UI work has
started.** Read `docs/QA_REVIEW_HANDOFF.md` before touching `modules/qa-review/` — it
carries the confirmed information architecture and the six-step build order. Steps 2–6
are untouched.

### Traps that will cost you hours

1. **`.gitignore` line 17 is `*.md`.** Every doc in `docs/` was force-added. A new
   markdown file will silently stay out of your commit — use `git add -f`.
2. **Next dev's build cache serves stale CSS.** Edited a rule, hard-reloaded, and the
   computed value is still the old one? It is not a cascade problem. Verify by fetching
   the served stylesheet directly:
   ```js
   const href = document.querySelector('link[rel=stylesheet]').href;
   fetch(href).then(r => r.text()).then(t => console.log(t.slice(t.indexOf('.your-selector'), 200)));
   ```
   Fix: stop the server, `Remove-Item -Recurse -Force .next`, restart.
3. **A hidden browser pane freezes rAF and CSS transitions.** `requestAnimationFrame`
   never fires and transitions stay `running` forever, so `getComputedStyle` returns the
   *start* frame, not the settled value, and rAF-driven components (`SessionMinimap`)
   never update. To read真值: set `el.style.transition = 'none'` and
   `el.getAnimations().forEach(a => a.finish())` first.
4. **`npm run build` always fails with EISDIR on this machine**, unrelated to any change.
   Validate with `npm run typecheck`.

### Known dead code, not yet swept

- `.activityChain*` in `globals.css` (~150 lines) — no TSX renders those classes anymore.
- `KnowledgeAsk`'s `dock="inline"` branch and its CSS — both call sites pass `floating`.
- `.workspaceAssistantHoverMenu` CSS in `iteration.css` — never rendered.

None of it affects runtime, but it is the soil that grew this session's "two rules
disagreeing, later line wins" bugs. Worth one dedicated pass.

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

Every session scroller carries a `SessionMinimap` — a navigation rail on the right edge
that stays invisible while scrolling and reveals on pointer proximity. Hosts opt in by
putting `data-minimap` / `data-minimap-label` on their nodes; the component finds them by
DOM scan, which is why three unrelated conversation structures share one implementation.

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
- **A floating element inside a scroller must be `sticky`, not `absolute`.** The views are
  their own positioning ancestors, so an absolute child scrolls away with the content. A
  sticky element also has to sit last in flow, or it pins *and* leaves a hole where it sat.
- **Radii come from three tiers only:** `--bioaz-radius-tool` 8 / `--bioaz-radius-control`
  12 / `--bioaz-radius-container` 16, plus `-full`. Pick by the element's short side —
  roughly 25–30% of it — not by nearest number: a 32px icon button and a 44px primary
  button should not share a radius. Two rival token namespaces (`--radius-card/control`,
  `--radius-sm/md/lg`) are now aliases of these; do not revive them. Nested radii are
  *supposed* to differ — inner = outer minus padding is correct, not a stray value.
  ~240 off-scale literals remain in quotation management, digital team, and knowledge base.
- **`--bioaz-brand-primary` is logo-only.** Agent surfaces use `--bioaz-agent-accent`. The
  thinking chain used to draw in logo blue; it does not any more.
- **Colour marks what is happening, not what is done.** In the timeline only the running
  step carries accent and a halo; finished steps go neutral. The inverse — solid dots for
  done, hollow for running — buries the one step the reader is looking for.
- **The conversation column is one width.** `app/session-column.css` owns it; chains,
  replies and the composer all follow it and impose no `max-width` of their own.
- **Mailbox recipients are people only.** Handing work to a digital coworker goes through
  「进入处理会话」. This supersedes the line in `MAILBOX_DATA_HUB_HANDOFF.md`.
- **Composing is the mailbox's default right pane**, not a popover. Reading a mail replaces
  it and a back button returns.
- **Hover promises nothing.** Permanent entries do not lift, sweep, or glow on hover —
  whether something expands is decided by a click. Expansion animates opacity only,
  ~180ms; no blur (`filter` cannot be composited), no translate, no bounce.

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

**Confirmed with the product owner, in order.** Steps 1–6 are the QA review restructure;
`docs/QA_REVIEW_HANDOFF.md` carries the reasoning behind each.

1. ~~QA data model — version-scoped findings, repair verdicts, change↔finding links.~~ ✅
2. Rename the QA tabs (问题 / 变更 / 审批) and delete the 文档 tab — the document is the
   left half of every Canvas, not a peer state.
3. Rebuild 变更 as a table with a summary row: 遗留问题 / 对应修改 / 修复状态.
4. Canvas mode: fill everything below the breadcrumb and right of the sidebar, collapse
   ChatFlow, composer becomes a centred floating pill. Keep the dual page readout
   (`文档第 5 页 · 标注 4/7`) permanently visible, and a two-column toggle with synced
   scrolling. **A previous attempt only widened the panel to 1100px — that is not this.**
5. Clicking a finding locates it in the document (currently does nothing).
6. Rejecting a version must not create a new Session.

Then, unrelated to QA:

7. Sweep the dead code listed at the top of this file.
8. Finish the radius pass in quotation management, digital team, knowledge base.
9. 知识库 still uses `WorkspaceAssistant`, which opens as a centred modal. 数据中枢 moved
   to `KnowledgeAsk`; decide whether 知识库 follows.
10. 「全部项目」dropdown → a persistent project tree in the left column (agreed, not built).

Long-standing, unchanged:

11. Add real DMPK field schemas for PK / BA Only / Toxicology.
12. Replace mock rule text with pricing engine outputs.
13. Add export consistency checks once Word / Excel generation APIs exist.

## Verification Habits

The preview pane cannot be screenshotted in this environment, so visual claims were made
by measurement, not by looking. That worked well and is worth continuing: read geometry
with `getBoundingClientRect`, read the winning value with `getComputedStyle`, and drive
state machines with real clicks before claiming something works. When a fix appears not to
apply, check trap 2 and 3 above before rewriting the CSS — both produced false negatives
this session, and one of them led to a wrong claim being reported before it was caught.
