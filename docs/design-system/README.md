# BioAZ Design System

This directory documents the executable design system used by the BioAZ Agent Workbench.

## Sources of truth

- `styles/tokens.css`: visual foundations and semantic tokens
- `styles/design-system.css`: shared UI component behavior
- `components/ui/`: reusable primitives
- `/design-system`: local visual catalog

## Confirmed foundations

- Brand primary: `#2900FF`
- Agent accent: `#5C60B8`
- Body copy: `14px / 22px`
- Font weights: `400 / 500 / 600`
- Radius: `8px` tools, `12px` controls, `16px` containers, `999px` pills
- Spacing: 4px base grid
- Canvas: `#F7F8FA`
- Surface: `#FFFFFF`
- Cards use borders before shadows
- Purple interaction glow is reserved for entry-point Action Cards

## Component boundary

- `SurfaceCard` groups content and is not clickable.
- `ActionCard` enters a capability or flow and is wholly clickable.
- Do not put nested interactive controls inside an `ActionCard`.
- Business fields and stage rules remain in `modules/<module-id>/`.
- Shared primitives must not import business modules.

## Migration rule

Migrate one real surface at a time. Preserve product behavior, validate visual parity, and run `npm run typecheck` before expanding the migration.
