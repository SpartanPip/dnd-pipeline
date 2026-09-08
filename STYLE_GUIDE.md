# Style Guide

Our own front-end conventions, kept deliberately small so the app stays
minimal, clean, and consistent as new campaigns/features get added. AI
agents editing this repo should follow this guide automatically — see
`AGENTS.md` and `.cursor/rules/frontend-style.mdc`.

## Principles

1. **Minimal and clean.** Neutral palette, generous whitespace, no visual
   noise. If a design decision isn't covered here, default to "less."
2. **One source of truth for look and feel: shadcn/ui.** Never hand-roll a
   button, input, dialog, badge, tooltip, etc. Add missing primitives with
   `pnpm dlx shadcn@latest add <component>` and use them everywhere.
3. **Consistency over cleverness.** Reuse the existing components/patterns
   in `src/components/` before inventing new ones.

## Colors

Use only the CSS variables defined in `src/app/globals.css`
(`bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`,
`bg-primary`, `bg-destructive`, `border-border`, etc.). Do not introduce new
hex/oklch colors in components — if the palette is missing something,
add a token to `globals.css` instead of inlining a color.

## Typography

- Page titles: `text-2xl font-semibold tracking-tight`
- Section titles: `text-xl font-semibold tracking-tight`
- Card titles: shadcn `CardTitle` default
- Body text: `text-sm` (default), `text-muted-foreground` for secondary text
- Article bodies render through Tailwind Typography (`prose prose-sm`,
  see `src/app/campaigns/[slug]/articles/[article]/page.tsx`)

## Spacing & layout

- Follow Tailwind's default 4px scale; prefer `gap-*` / `space-y-*` over
  manual margins between siblings.
- Page content is wrapped in `max-w-6xl` (grids) or `max-w-2xl` (article
  reading width), centered with `mx-auto`, padded `px-4 py-8`.

## Icons

Two icon vocabularies, kept separate:

- **UI icons** (buttons, nav, form affordances): `lucide-react`.
- **Map icons** (fantasy/location icons on the campaign map): `react-icons/gi`
  via the curated list in `src/lib/icons.ts`. Don't import `react-icons/gi`
  icons directly elsewhere — add new ones to that curated map first so the
  map's icon vocabulary stays consistent.
- Decorative icons get `aria-hidden`; icon-only buttons/links get an
  `aria-label`.

## Images

- Every user-facing image goes through `EditableImage`
  (`src/components/editable-image.tsx`) so hover-to-replace works
  everywhere automatically.
- Use a Tailwind aspect-ratio class (`aspect-video`, `aspect-[4/3]`,
  `aspect-[16/9]`) + `object-cover`; don't hardcode pixel heights.
- Always provide meaningful `alt` text.

## Components & state

- Server Components by default. Add `"use client"` only for the specific
  interactive island that needs it (state, effects, browser APIs) — see
  `search-experience.tsx` or `editable-image.tsx` for the pattern.
- Data mutations go through the `/api/**` route handlers, never direct
  filesystem access from client components.
- Every list view handles the empty state with a one-line, friendly message
  (see any `*/page.tsx` for examples) — never render a blank screen.

## Naming

- Files: kebab-case (`article-card.tsx`). Components: PascalCase. One
  component per file; colocate small one-off pieces near their usage,
  promote to a shared file once reused twice.
- Terminology: "campaign", "article", "map cell", "tag" — used consistently
  across code, UI copy, and docs. Don't introduce synonyms.

## Accessibility

- Every interactive element must be reachable and operable by keyboard
  (shadcn/Radix primitives handle this by default — don't override focus
  styles).
- Don't rely on color alone to convey state (pair with text/icon).
