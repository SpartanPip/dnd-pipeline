---
name: campaign-ramble
description: >-
  Turns a free-form, spoken-style ramble about a D&D campaign session
  (recap, brain-dump, "here's what happened at the table") into updates to
  that campaign's article corpus and map under content/campaigns/<slug>/.
  Use whenever the user rambles, narrates, or brain-dumps about a campaign,
  session, NPC, location, or plot event and wants it captured as lore.
---

# Campaign ramble → lore corpus

Turn a rambling recap into well-formed articles and map cells, editing the
files under `content/campaigns/<slug>/` directly with your normal file
tools (Read/Write/edit) — no need to run the dev server or call the API.
Every file must validate against the Zod schemas in
`src/lib/content/schema.ts`; read that file if you're unsure of a shape.

## Workflow

1. **Identify the campaign.** List `content/campaigns/*/campaign.json` and
   match by name. If ambiguous or the user hasn't said which campaign, ask.
   If no campaigns exist yet, offer to create one (`campaign.json` +
   `articles/` + empty `map.json` — see `schema.ts` → `campaignSchema`).

2. **Load context before writing anything.** Read every existing article's
   frontmatter (title, tags, summary — skip bodies unless relevant) and the
   current `map.json`. This is how you avoid creating duplicate articles
   for something that already exists.

3. **Extract entities** from the ramble: locations, NPCs, factions/
   organizations, items, and events/plot threads. Skip in-character combat
   mechanics and out-of-character table talk — only lore-worthy content.

4. **For each entity, decide new vs. update:**
   - Match against existing articles by title similarity or tag overlap.
   - If it matches, update that article in place (same slug) — extend the
     body lightly, don't rewrite what's already there.
   - If it's new, create `content/campaigns/<slug>/articles/<new-slug>.md`.

5. **Write each article** following `articleSchema`:
   - `title`: short, proper-noun-first.
   - `slug`: kebab-case, derived from the title.
   - `tags`: 2-5 kebab-case tags (e.g. `location`, `npc`, `faction`,
     `quest`, plus specific ones like `port-city`, `undead`).
   - `summary`: exactly one sentence.
   - `body`: markdown, roughly half a page (~250 words, see
     `ARTICLE_WORD_LIMIT`). Link to related articles with plain markdown
     links: `[Elowen](/campaigns/<slug>/articles/elowen)`.
   - Frontmatter format: YAML at the top of the file (gray-matter style —
     see any existing article for the exact layout).

6. **Update the map for places.** If an entity is a physical location:
   - Add/update a cell in `map.json` (`mapCellSchema`): integer `x`/`y`
     (map is centered on `(0, 0)`), an `icon` key from
     [icons-reference.md](icons-reference.md) (add a new curated icon to
     `src/lib/icons.ts` only if truly nothing fits), a short `label`, and
     either an `articleSlug` (direct link) or a `search` payload
     (`{ text?, tags? }`) that surfaces the right article(s).
   - Coordinates: place new locations adjacent to related existing cells
     (e.g. a district "in" a city goes next to that city's cell). If
     there's no spatial anchor and the user didn't give one, pick the
     nearest open cell to `(0, 0)` and say in your summary that the
     placement is a guess.

7. **Cross-link lightly.** For 1-2 clearly related existing articles, add a
   short markdown link to the new/updated article where it naturally
   fits — don't restructure their content.

8. **Validate and report back.** Run `pnpm lint:content` if the project is
   set up (flags oversized articles and unknown map icons). Then summarize
   for the user: which articles were created vs. updated, which map cells
   changed, and anything you guessed (coordinates, tags) that they should
   confirm or correct.

## Rules

- Never delete or overwrite unrelated content. Never remove existing map
  cells or articles without explicit confirmation.
- Keep summaries to one sentence and bodies to half a page — trim rather
  than let an article grow long; split into two linked articles instead.
- Reuse existing slugs/tags before inventing new ones (check step 2).
- If the ramble is too vague to extract a clean article (e.g. a single
  passing mention), it's fine to skip it rather than force a stub.

## Reference

- [icons-reference.md](icons-reference.md) — available map icon names.

## Pipeline cards

Articles with `origin: pipeline` were written by the session pipeline
(`pipeline/`). Leave their card fields (`kind`, `sessions`, `order`,
`imageStatus`, `imageNotes`, `questions`) intact when you extend them, and keep
hand-written articles `origin: manual` (the default).
