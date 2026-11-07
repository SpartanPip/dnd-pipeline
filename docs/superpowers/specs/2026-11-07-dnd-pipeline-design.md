# dnd-pipeline — design

## Intent

A laptop sits on the table during an in-person D&D session and listens.
When the session ends, it keeps working locally for up to a couple of hours
and produces session notes: many short, linked cards about events and
characters, each eventually with a cute sticker/clip-art image, browsable
on a local website. It carries across sessions, so the campaign's notes
grow over time.

Everything runs locally on the user's Mac. No audio, transcript, or notes
leave the machine.

## Starting point: a copy of `SpartanPip/dnd-lore`

`dnd-pipeline` is a new repo (`SpartanPip/dnd-pipeline`, on the Desktop at
`~/Desktop/dnd-pipeline`) that starts as a copy of the private
`SpartanPip/dnd-lore` repo, then adds the pipeline and new card features.
dnd-lore is not modified.

Reuse as much of dnd-lore as possible. Keep its layout, styling
(`STYLE_GUIDE.md`, shadcn/ui), tagging, MiniSearch search, map, campaign
home page, image editing (`EditableImage`), and file-based content model
(`content/campaigns/<slug>/…`, Zod schemas in `src/lib/content/schema.ts`,
no database). Pipeline output is ordinary articles in that model, so search
and tags work on it for free.

dnd-lore's `campaign-ramble` skill (`.cursor/skills/campaign-ramble/`)
already describes the "turn a spoken recap into new/updated articles
without duplicates" logic. The organizing step reuses its load-context and
avoid-duplicates rules, run by a local model, but writes short snapshot
cards instead of growing ~250-word articles.

## Goals

1. **Mac setup script** that checks how capable the Mac is and recommends
   models for transcription, organizing, and image generation, which the
   user can override.
2. **Start/Stop button on the website** that records from the laptop mic
   during the session.
3. **Transcription** during the session, biased toward a short list of
   expected character names.
4. **Post-session organizing** (up to a couple of hours) into short, linked
   snapshot cards for events and characters.
5. **Sticker/clip-art images** for cards, only when there's enough detail.
6. **Open questions on cards**, answered on the page and fed back into
   later processing.
7. **Carry across sessions**: names, cards, answers, and pending images
   persist per campaign.

## Non-goals

- Windows or Linux support (Mac only for now).
- Identifying which *player* is speaking. Players don't matter; characters
  do.
- Online/Discord sessions. One laptop, one mic, in person.
- Cloud model APIs.

## Anti-goals (failure even if it "works")

- Confidently wrong notes: attributing an action to the wrong character or
  inventing a name without flagging uncertainty.
- Images that misrepresent a character because they were generated from
  thin detail.
- Long, rambling cards. Cards must be very short.
- A setup that silently installs something the Mac can't really run, or
  probes the hardware without asking.
- Losing a session's recording or processing work to a crash.
- A cluttered UI that breaks from dnd-lore's minimal style.

## Users and constraints

- macOS only. Make no assumptions about the specific Mac. Expect Apple
  Silicon to be the target; Intel Macs and low-memory Macs may not be able
  to run local models, and setup must say so plainly rather than fail
  obscurely.
- Hardware detection asks permission first. The user can skip detection
  entirely and name the models they want.

## How it works (decided)

### Setup

- One setup script for Mac (e.g. `./setup.sh`).
- Asks permission, then checks chip, unified memory, free disk space, and
  macOS version.
- Assigns a tier and recommends one model each for **transcription**,
  **organizing**, and **image generation**. The user can accept, swap any
  of them, or skip detection and pick directly.
- If the Mac can't run a role locally (or can't run anything), say so
  clearly. That's an acceptable outcome.
- Choices are saved to an editable config file in the repo; re-running
  setup changes them. *(builder-facing default; see "Calls I made")*

### Characters and names

- Track **characters**, never players.
- Each campaign has a **known-names pool** (all known characters) and a
  shorter **listening list** (names expected this session), both editable on
  the site. New names heard in a session are added to the pool
  automatically.
- The listening list biases transcription. The full pool is used during
  organizing.
- Attribution comes from names heard plus strong context clues. When unsure,
  the card says so and gets an open question.

### Cards

- Cards can be about **anything**: events, characters, places, factions,
  items, spells, plot threads. Together they must cover everything
  lore-worthy in the session. Places also get map cells, following
  campaign-ramble's map rules.
- Cards are **very short** and are **snapshots** in time: e.g. a character
  at a particular moment, or one event. A topic may have many cards across
  sessions.
- Linking is **free-form and decided by the LLM**. There may be a
  high-level card for a character that others link to, and cards may link
  to each other directly (e.g. a character's "spells" card links to a card
  about one specific spell). Shared tags let search show related cards
  together.
- New card features on top of dnd-lore articles:
  - **Open questions**, e.g. "Is the name 'Gravel' correct?" or "Who was
    involved in this action?" The user answers them inline on the card;
    answers are saved and used the next time the pipeline processes.
  - **Image status**: `pending` until there's enough detail, then generated.
  - **Session provenance**: which session(s) a card came from.
- **Timeline view**: event cards in story order, grouped by session, as a
  fourth campaign view alongside Map, Articles, Search.

### Images

- **One image per card.** Simple, cute, cartoonish **sticker/clip-art**
  style, kept consistent across a campaign.
- Generate only when the card has enough concrete detail (for characters:
  e.g. appearance, ancestry/race, notable features). Otherwise mark the card
  `image pending`.
- After each session, recheck all pending cards and generate those that
  now have enough detail.
- Once generated, an image is **fixed**. Each card has a **"Redraw with
  changes"** action where the user describes what's different, and the image
  is regenerated from the card plus that note.
- The existing hover-to-replace upload in dnd-lore stays.

### Campaigns and privacy

- The site handles multiple completely separate campaigns, as dnd-lore
  does today (home page grid, one folder per campaign). Names pools,
  cards, questions, and sessions never cross campaigns.
- Real campaign notes stay **local only**: real campaigns' content and
  generated images are git-ignored and never committed or pushed. Only the
  seeded example campaign is tracked.

### Session flow

1. User opens the campaign on the site, optionally edits the listening
   list, presses **Start**.
2. The Mac records from the mic and transcribes in chunks as the session
   goes, so post-session time is spent on organizing.
3. User presses **Stop**. Post-session processing runs:
   1. Finish and clean up the transcript using the full names pool.
   2. Organize into new/updated snapshot cards for events and characters,
      using prior cards and previously answered questions; attach open
      questions where uncertain; record session provenance.
   3. Recheck pending images; generate where there's enough detail.
4. The site shows progress, and cards appear as they're written.

## Calls I made (user can veto)

- The pipeline may edit cards it created, including from earlier sessions,
  when an answered question shows they were wrong (e.g. a corrected name is
  applied everywhere). It never edits hand-written articles; it may only
  link to them.
- Cards carry a type (event, character, place, …) and a "pipeline-made vs
  hand-written" marker.
- To limit visual drift with one image per card, a card's image prompt
  includes the appearance details from the cards it links to about the
  same character/thing.
- "Up to a couple of hours" is a target, not a hard cutoff. If time runs
  long, images are the step that can wait; they're picked up on the next
  pending-image recheck. Assume sessions of 3–4 hours of audio.
- Live transcription may fall behind on slower Macs; it catches up after
  Stop rather than dropping audio.

- The recording stays with the session folder so it can be re-processed;
  the user can delete it from the site.
- Processing saves its progress after each step and chunk, so a crash or a
  closed laptop resumes instead of starting over.
- Recording and model work happen in a **local background service**
  (Python, since the Mac ML tooling lives there) that the Next.js app talks
  to over localhost. This way recording doesn't depend on a browser tab
  staying open. The service writes `content/` files directly, through
  Python models that mirror the Zod schemas, with a contract test that the
  site's schemas accept what Python writes.
- Session artifacts (audio, transcript chunks, processing state) live under
  `content/campaigns/<slug>/sessions/<n>/`.
- Starting model defaults per tier (the builder should verify these are
  still current and runnable at build time):
  - Transcription: a Whisper-family model on Apple Silicon (e.g.
    `mlx-whisper` / whisper.cpp), from small/base on low tiers to
    large-v3-turbo on high tiers; the listening list goes in the initial
    prompt.
  - Organizing: a local instruct LLM via Ollama or MLX-LM, sized to
    unified memory (roughly ~4B on 16 GB, ~8–14B on 24–36 GB, ~30B+ on
    48 GB+), with structured JSON output validated by the Zod schemas.
  - Images: a fast diffusion model on Apple Silicon (e.g. FLUX schnell via
    `mflux`, or an SDXL-turbo-class model on lower tiers) with a fixed
    sticker style prompt per campaign.
  - 8 GB Macs and Intel Macs: likely transcription only, or nothing; setup
    says which roles aren't available.

## Left to the builder

- Exact tier thresholds and model choices within the guidance above.
- Exact schema shape for questions, image status, sessions, and the names
  pool, as long as it extends dnd-lore's Zod schemas and stays file-based.
- How the organizing model is prompted, chunked, and checked (e.g.
  multi-pass extract → match existing → write), as long as cards stay short
  and uncertainty is surfaced as questions.
- The "enough detail to draw" rule.
- UI details, within dnd-lore's `STYLE_GUIDE.md`.
- Updating `README.md`, `AGENTS.md`, and the `campaign-ramble` skill to
  reflect the new repo.
