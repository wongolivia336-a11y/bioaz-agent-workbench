# Engineering Handoff

## Session State — 2026-09-16

Branch `codex/dmpk-composer-params`, everything committed and pushed to `origin`
(GitHub `wongolivia336-a11y/bioaz-agent-workbench`). **Never push to the `gitlab`
remote.** Working tree clean at `5f88239` except one deliberately untracked file
(`docs/worklog/2026-09-15-提交版工作日志.md` — the human-voice log the intern submits;
the owner asked that it stay out of the repo).

### Where things live

| What | Where |
|---|---|
| This prototype | `G:\实习\原型优化项目\prototype-bioaz-agent-workbench` |
| Design-system repo (separate git, separate push) | `G:\实习\原型优化项目\bioaz-design-system` |
| Working rules for this repo (**gitignored, local only** — copy it if you move machines) | `.claude/skills/bioaz-workbench/SKILL.md` |
| Design rationale for everything below | `docs/DMPK_SOURCE_PARSING.md` (9 sections, one per round) |
| Daily technical logs | `docs/worklog/2026-09-15-工作日志.md`, `2026-09-16-工作日志.md` |
| Client's P0 list and how it maps | `docs/DMPK_SOURCE_PARSING.md` §5 |
| Live reference the client is comparing against | `next-beta3.bioaz.cn` (login wall; a real Chrome session gets in, the in-app browser does not) |

### What landed (2026-09-15 → 16), newest first

| Commit | What |
|---|---|
| `5f88239` | Only `origin: "local"` uploads are read as materials; ticket files never are (fixed a real regression in the rework session) |
| `87b9809` | Sentence recognition learns 报价区域 (the one sanctioned exception to the do-not-touch list) |
| `95500c3` | Quote paper reads the line ledger; `quoteStale` + regenerate; 「核对已有信息并重新计算」 |
| `fffb834` | P0-1: per-field source (`ParamField.source`) with the original sentence; three material fixtures (protocol / screenshot / chat) |
| `d0f45d9` | P0-2: recognised-vs-confirmed status, `QuoteLine` ledger with subtotals, SD manual unit price |
| `ccde657` | Design note mapped onto the client's P0 |
| `5f18075` | File-first entry: source layer + parser registry, parse trace, materials panel, session summary |

New files: `lib/workbench/sources.ts`, `lib/workbench/quoteLines.ts`,
`lib/workbench/quotePaperFromLines.ts`, `modules/dmpk-quotation/parseFixtures.ts`,
`modules/dmpk-quotation/quoteLineFixtures.ts`. Everything else is additive edits.

### Decisions the owner made — do not relitigate

- **Additive only. The fourteen DMPK fields, `parseDmpkRequest`, the stage machine, the
  parameter card and `priceCatalog` are not to be restructured.** (`parseDmpkRequest` got
  three region rules with explicit permission; ask again before touching it.)
- **Every format runs a mock parser.** Real docx/PDF/OCR/chat parsing is a *new
  registration* in `dmpkSourceParsers`, not a rewrite; `unknown` formats take the
  "尚未接入" trace and are never swallowed.
- **A file and a sentence sent together: the file wins.** Later sentences and card edits
  still override.
- **Only files a person uploaded (`origin: "local"`) are materials.** Ticket attachments
  (`origin: "library"`) are artifacts moving between people; a rework session reads none.
- **Recognised values are proposals until confirmed.** No gate on generation, but the
  button reads 「确认并生成」; no gate on handoff when the quote is stale, but the card warns.
- **Manual unit prices live in the session (`manualPrices`, keyed by line id), never on
  the line and never in the catalogue.** The chat path for the report fee writes the same table.
- **The tab is called 报价明细, not 计算依据.** 「SD」stays literally `SD`
  (`MANUAL_PRICE_BY`) until the client says who that is.
- **A person overwriting a document-sourced value demotes it to 「人填」** with the
  original sentence kept; hand-filled fields never get a mark.

### What is left (all blocked outside the prototype)

1. Real parsing — docx structure, PDF, OCR, chat segmentation (backend).
2. Who "SD" is — signature and permission for manual prices (client).
3. Catalogue entries for 免疫分型采血 / 细胞因子 / 流式 and the unit prices currently
   back-derived from beta3 (back office).
4. Minor: chips + file + empty text sends the file without parsing it (recorded, not fixed).

### How to verify in five minutes

`npm run typecheck` (`npm run build` always EISDIRs here — ignore it), `npm run audit:ui`
(compare against `scripts/audit-ui.baseline.json`; `-- --update` only after you meant it),
then `npm run dev`, home → pick a project → attach any `.docx` + type「按这份方案出 DMPK 报价」
→ 确认分派. You should see an 8-step parse trace, 11/14 in the ledger with 「识别」chips and
anchor marks, 报价明细 with subtotals, and a CNY paper in the Excel preview. Drive React
with `await`s between clicks; switch right-rail tabs with the full pointer/mouse event set.

### Traps that will cost you hours

1. **`.gitignore` has `*.md` but `!docs/**/*.md`** — docs are tracked, anything else
   markdown is not; `.claude/` is ignored entirely (the SKILL lives only on this machine).
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

## DMPK Flow (as of 2026-09-16)

```text
User uploads materials (Word / PDF / PPT / screenshot / chat export) and/or types a request
-> Source layer picks a parser per format; parse trace reveals step by step
   (what was read · where in the document); unsupported formats say so
-> Values land on the fourteen fields with per-field source (anchor + sentence);
   facts with no slot (groups / sampling events / methods) go to 输入材料, read-only
-> Pending items split: missing → card; confirm → card with the document's candidates
   first; no-catalogue → 报价规则 with a back-office link
-> Line ledger (报价明细) prices whatever it can, by work package, with reasons on
   unpriced rows; SD may override any unit price for this quote only
-> Recognised values carry 「识别」 until confirmed (per field, bulk, or 「确认并生成」)
-> Generate: Word / Excel paper is folded from the same lines; a snapshot is taken
-> Any later edit marks the quote 待重出 (version card, pre-quote card, handoff warning)
-> Handoff; 会话摘要 from the topbar prefills the note
```

*Everything below this line predates 2026-09 and was not re-verified this round. The QA
restructure status in "Suggested Next Steps" is as of 2026-08-17 — check
`docs/QA_REVIEW_HANDOFF.md` and `git log -- modules/qa-review` before relying on it.*

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
