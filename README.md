# DnD Lore

A local, self-hosted lore atlas for your D&D campaigns. Runs entirely on
`localhost` — no external services, no database. Every campaign gets:

- **Map** — a grid map centered on `(0, 0)`, with hoverable/clickable
  fantasy icons that jump into a curated search.
- **Articles** — short, cross-linked lore entries (title, tags, one-sentence
  summary, half-page description, optional image).
- **Search** — fuzzy, tag-aware search with live suggestions.

All three views are reachable from the header on every campaign page. The
home page (`/`) is a grid of campaigns to pick from.

## Getting started

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. A seeded example campaign, **The Sunken
Isles**, is included under `content/campaigns/sunken-isles/` so you can see
everything working immediately.

## Adding your own lore

- Use the UI: "New campaign" on the home page, "New article" on a
  campaign's Articles page, and the hover-to-edit image button anywhere
  you see an image.
- Or ramble about your campaign to your AI coding assistant — see the
  `campaign-ramble` skill in `.cursor/skills/campaign-ramble/SKILL.md`,
  which turns a free-form recap into articles and map updates for you.

## Project docs

- [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) — front-end design/styling
  conventions.
- [`AGENTS.md`](./AGENTS.md) — architecture, content schema, and
  conventions for AI coding agents working in this repo (`CLAUDE.md`
  re-exports the same file).

## Scripts

| Command              | What it does                                   |
| --------------------- | ----------------------------------------------- |
| `pnpm dev`            | Run the app locally                             |
| `pnpm build`          | Production build                                |
| `pnpm start`          | Run the production build                        |
| `pnpm lint`           | ESLint                                          |
| `pnpm typecheck`      | `tsc --noEmit`                                  |
| `pnpm test`           | Run the Vitest suite                            |
| `pnpm lint:content`   | Warn on oversized articles / unknown map icons  |

## Tech stack

Next.js (App Router) + React + TypeScript, Tailwind CSS + shadcn/ui,
MiniSearch, `react-icons/gi` for map icons, `react-dropzone` for image
uploads, `react-zoom-pan-pinch` for the map, Zod for content validation.
Content is plain Markdown/JSON under `content/campaigns/`, not a database —
see `AGENTS.md` for the full schema.

Map icons are from [game-icons.net](https://game-icons.net) (CC BY 3.0);
see the credit in the site footer.
