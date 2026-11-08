<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# dnd-pipeline — agent guide

A local-only website for browsing lore across several D&D campaigns, plus a
Python worker that records sessions and turns them into cards. Each campaign
has **Map**, **Articles**, **Timeline**, **Search**, and **Session** views,
reachable from the header on every campaign page. The home page (`/`) is a
grid of campaigns to pick from.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 +
shadcn/ui ("nova" preset), MiniSearch, `react-icons/gi` (map icons),
`react-dropzone` (image uploads), `react-zoom-pan-pinch` (map pan/zoom),
Zod (schemas/validation). Package manager: **pnpm**. No database — see
"Content model" below.

Read `STYLE_GUIDE.md` before touching any UI. It's short; follow it.

## Content model — no database

Everything lives in plain files under `content/campaigns/<slug>/`, which
you (or the `campaign-ramble` skill) can read and edit directly:

```
content/campaigns/<slug>/
  campaign.json        # { slug, title, description?, coverImage? }
  map.json             # { cells: [{ x, y, icon, label, search, articleSlug? }] }
  articles/<slug>.md   # frontmatter (title, slug, tags, summary, image?, card fields) + markdown body
  names.json           # { known: [{ name, aliases }], listening: [name] }
  sessions/<n>/        # session.json, state.json, audio/, transcript.jsonl (written by the worker)
```

- Card fields on articles (all optional/defaulted): `kind`, `origin`
  (`pipeline` | `manual`), `sessions`, `order` (session * 10000 + position),
  `imageStatus` (`pending` | `generated`), `imageNotes`, `questions`. The
  pipeline only edits articles with `origin: pipeline`. Cards stay under
  `CARD_WORD_LIMIT` words.

- Schemas/types live in `src/lib/content/schema.ts` — the single source of
  truth. Always validate against these (via the helpers in
  `src/lib/content/{campaigns,articles,map}.ts`) instead of writing files
  by hand with `fs`.
- Articles: one sentence `summary`, markdown `body` capped at
  `ARTICLE_WORD_LIMIT` (~half a page) by convention, cross-link other
  articles with plain markdown links to
  `/campaigns/<slug>/articles/<other-slug>`.
- Map cells: integer `(x, y)`, centered on `(0, 0)`. `icon` must be a key
  in `MAP_ICONS` (`src/lib/icons.ts`) — extend that curated list rather
  than reaching for arbitrary `react-icons/gi` icons.
- Uploaded images are written by `POST /api/upload` to
  `public/uploads/<slug>/...` so they persist across restarts.

## Where things live

- `src/app/` — routes. `campaigns/[slug]/{map,articles,search}/page.tsx`
  are the three per-campaign views; `campaigns/[slug]/layout.tsx` renders
  the shared header nav.
- `src/app/api/**` — route handlers that read/write `content/` and
  `public/uploads/`. UI components call these; they never touch `fs`
  directly.
- `src/components/` — shared UI. `components/ui/` is shadcn-managed —
  regenerate via the CLI rather than hand-editing when possible.
- `src/lib/content/` — filesystem + Zod layer for campaigns/articles/map.
- `src/lib/search/` — MiniSearch index + query helpers.
- `src/lib/icons.ts` — curated map icon vocabulary + attribution.
- `.cursor/skills/campaign-ramble/` — turns a free-form ramble about a
  session into article/map updates. Use it for bulk content authoring.
- `src/lib/worker.ts` — the site's client for the worker; returns null when
  it isn't running.
- `pipeline/` — Python worker (uv project). `content.py` mirrors the Zod
  schemas (keep them in sync; `tests/contract.test.ts` checks a card Python
  wrote), `server.py` is the FastAPI worker on `127.0.0.1:8765`,
  `pipeline.py` runs post-session steps (transcribe → organize → apply
  answers → images) with progress checkpointed in `state.json`, `tiers.py`
  holds the per-Mac model recommendations used by `setup.sh`.
- `logs/` — `worker.log`, `site.log`, `ollama.log`, overwritten by each
  `./start.sh`. Check `worker.log` first when a session fails or skips parts.

## Commands

```
pnpm dev            # run locally at http://localhost:3000
pnpm build && pnpm start
pnpm lint
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest run
pnpm lint:content    # word-count / schema check for all articles
./setup.sh           # install deps + pick models (writes pipeline.config.json)
./start.sh           # worker + site
cd pipeline && uv run pytest
```

## Conventions

- Server Components by default; `"use client"` only for the interactive
  island that needs it.
- Route handlers validate input with the Zod schemas in
  `src/lib/content/schema.ts` and return `{ error }` with a 4xx status on
  failure — follow that shape for new endpoints.
- Keep content, UI, and API concerns separate: `lib/content` never imports
  from `components`, and components never call `node:fs` directly.
