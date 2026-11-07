# dnd-pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the copied dnd-lore site into a Mac-only pipeline that records a D&D session, transcribes it, organizes it into short linked cards with open questions, and draws sticker images for cards with enough detail.

**Architecture:** The existing Next.js app gains card fields, a names pool, a Session page (Start/Stop), a Timeline view, inline questions, and image-pending/redraw UI. A Python worker (`pipeline/`, FastAPI on `127.0.0.1:8765`) records audio, transcribes with mlx-whisper, organizes with an Ollama LLM, and generates images with mflux. It writes `content/` files directly using Pydantic models that mirror the Zod schemas; a contract test checks the TS side accepts them. `setup.sh` detects the Mac (with permission), recommends models per tier, and writes `pipeline.config.json`.

**Tech Stack:** Next.js 16 / React 19 / Zod 4 / Vitest (existing); Python 3.12 via uv, FastAPI + uvicorn, sounddevice + soundfile, mlx-whisper, Ollama HTTP API, mflux (Z-Image Turbo), python-frontmatter, pytest.

**Spec:** `docs/superpowers/specs/2026-11-07-dnd-pipeline-design.md`

## Global Constraints

- macOS on Apple Silicon only; Intel Macs get a plain "local models not supported" message.
- Hardware detection only after the user says yes; user can skip and pick models directly.
- Nothing leaves the machine: no cloud APIs. Real campaigns, uploads, sessions, and `pipeline.config.json` are git-ignored; only `content/campaigns/sunken-isles/` is tracked.
- New article fields are optional/defaulted so existing hand-written articles stay valid.
- Pipeline never edits articles with `origin` other than `"pipeline"`; it may only link to them.
- Card bodies are short: `CARD_WORD_LIMIT = 80`.
- One image per card; generated images are fixed except via "Redraw with changes".
- Follow `STYLE_GUIDE.md` (shadcn/ui, existing tokens, lucide icons).

## Review Focus

1. Worker not running when the user presses Start → Session page shows "Pipeline worker isn't running — start it with `./start.sh`", not a crash. (Task 6 test)
2. LLM returns malformed/invalid JSON → that window is retried once, then skipped with a logged warning; processing continues. (Task 4 test)
3. Worker restarted mid-processing → resumes from `state.json` without duplicating cards. (Task 4 test)
4. User answers a question while the worker rewrites the same card → answers are not lost (worker re-reads and merges questions before writing). (Task 3 test)
5. Card title collides with an existing hand-written article slug → new card gets a suffixed slug; hand-written article untouched. (Task 3 test)

---

### Task 1: Schema extensions, names pool, git-ignore layout (TS)

**Files:**
- Modify: `src/lib/content/schema.ts`, `src/lib/content/paths.ts`, `src/lib/content/index.ts`, `.gitignore`
- Create: `src/lib/content/names.ts`
- Test: `tests/content.test.ts` (extend), `tests/names.test.ts`

**Interfaces — Produces:**
- `cardKindSchema = z.enum(["character","event","place","faction","item","spell","lore","other"])`
- `questionSchema = { id: string, text: string, answer?: string, answeredAt?: string, appliedAt?: string }`
- `articleFrontmatterSchema` gains: `kind?`, `origin: "pipeline"|"manual"` (default `"manual"`), `sessions: number[]` (default `[]`), `order?: number`, `imageStatus?: "pending"|"generated"`, `imageNotes?: string`, `questions: Question[]` (default `[]`)
- `namesSchema = { known: {name: string, aliases: string[]}[], listening: string[] }`; `getNames(slug): Promise<Names>` (empty default when file missing), `saveNames(slug, input: unknown): Promise<Names>`; path `namesJsonPath(slug)` → `content/campaigns/<slug>/names.json`
- `sessionsDir(slug)` → `content/campaigns/<slug>/sessions`
- `CARD_WORD_LIMIT = 80`

- [ ] Tests: old frontmatter (no new fields) parses with `origin === "manual"`, `questions` `[]`; pipeline frontmatter with all fields parses; `getNames` on a campaign without `names.json` returns `{known: [], listening: []}`; `saveNames` round-trips.
- [ ] Run `pnpm test` → fail; implement; → pass.
- [ ] `.gitignore`: `/content/campaigns/*` + `!/content/campaigns/sunken-isles/`, `/public/uploads/*` + `!/public/uploads/.gitkeep`, `/pipeline.config.json`, `/pipeline/.venv/`, `__pycache__/`, `.superpowers/`.
- [ ] Commit.

### Task 2: Python package skeleton, config, hardware tiers, setup

**Files:**
- Create: `pipeline/pyproject.toml` (python `>=3.12,<3.13`, script entry points `dnd-setup = dnd_pipeline.setup_cli:main`, `dnd-worker = dnd_pipeline.server:main`; ML deps in an optional `ml` extra so tests run without them)
- Create: `pipeline/dnd_pipeline/{__init__,paths,config,hardware,tiers,setup_cli}.py`
- Create: `setup.sh`, `start.sh`
- Test: `pipeline/tests/test_tiers.py`, `pipeline/tests/test_config.py`

**Interfaces — Produces:**
- `paths.REPO_ROOT`, `paths.content_root()`, `paths.campaign_dir(slug)`, `paths.uploads_dir(slug)`; root overridable by env `DND_REPO_ROOT` (tests use tmp dirs)
- `HardwareInfo(chip: str, apple_silicon: bool, memory_gb: int, free_disk_gb: int, macos: str)`; `detect_hardware() -> HardwareInfo` (sysctl/sw_vers/shutil.disk_usage)
- `ModelChoice(role: str, model: str | None, note: str)`; `recommend(hw: HardwareInfo) -> dict[str, ModelChoice]` for roles `transcription`, `organizing`, `images`
- `Config(transcription: str|None, organizing: str|None, images: str|None, image_quantize: int, tier: str)`; `load_config() -> Config`, `save_config(c)` at `REPO_ROOT/pipeline.config.json`

Tier table (by unified memory; Intel or <8 GB → all `None` with note "can't run locally"):

| tier | memory | transcription | organizing (Ollama) | images (mflux Z-Image Turbo) |
|---|---|---|---|---|
| basic | 8–15 GB | `mlx-community/whisper-small-mlx` | `gemma4:e2b` (note: low quality) | `None` (note: not enough memory) |
| standard | 16–23 | `mlx-community/whisper-large-v3-turbo` | `gemma4:e4b` | `z-image-turbo` q4 |
| plus | 24–47 | same | `gemma4:12b` | `z-image-turbo` q8 |
| max | 48+ | same | `gemma4:26b` | `z-image-turbo` q8 |

Free disk < 30 GB adds a warning note to every role.

- [ ] Tests: each tier boundary (8, 16, 24, 48 GB) and Intel → expected models; low disk adds note; config round-trip; missing config → all `None`.
- [ ] `setup_cli.main()`: asks "Can I check this Mac's hardware to recommend models? [Y/n]"; shows table; per role lets user press Enter to accept, type a model id, or `none`; saves config; offers to install Ollama (`brew install ollama`) and `ollama pull <model>`; offers to pre-download whisper/image weights; prints what isn't available.
- [ ] `setup.sh`: refuse on non-Darwin; check Homebrew, uv, pnpm (offer installs); `pnpm install`; `uv sync --extra ml` in `pipeline/`; run `uv run dnd-setup`. `start.sh`: start `ollama serve` if not running, start worker in background, run `pnpm dev`, kill worker on exit.
- [ ] `uv run pytest` passes; commit.

### Task 3: Python content layer (cards, names, map) + contract test

**Files:**
- Create: `pipeline/dnd_pipeline/content.py`
- Test: `pipeline/tests/test_content.py`, `tests/contract.test.ts`, fixture written by Python at `tests/fixtures/pipeline-card.md`

**Interfaces — Produces:**
- Pydantic `Question`, `Card` (fields mirror Task 1 frontmatter + `body`), `Names`, `MapCell`
- `slugify(text) -> str` (same rules as `src/lib/content/slug.ts`)
- `list_cards(slug) -> list[Card]`, `read_card(slug, card_slug) -> Card | None`
- `write_card(slug, card: Card) -> Card`: refuses to overwrite non-pipeline articles (picks `<slug>-2`, `-3`… for new cards instead); re-reads an existing file and merges `questions` by id keeping any `answer`/`answeredAt` from disk
- `read_names(slug)`, `write_names(slug, names)`, `add_known_names(slug, names: list[str])` (dedupe case-insensitively)
- `read_map(slug)`, `add_map_cell(slug, label, icon, article_slug, near_slug: str|None)`: icon must be in `MAP_ICON_KEYS` (parsed from `src/lib/icons.ts` keys) else `landmark`; place adjacent to `near_slug`'s cell or nearest free cell to (0,0)

- [ ] Tests: write/read round-trip; collision with manual article → suffixed slug, manual file byte-identical; question answer on disk survives `write_card`; map placement nearest free; names dedupe.
- [ ] Python test writes the fixture; `tests/contract.test.ts` parses it with `articleSchema` and expects success.
- [ ] Commit.

### Task 4: Pipeline stages (transcribe, organize, answers, images) with checkpointing

**Files:**
- Create: `pipeline/dnd_pipeline/{sessions,transcribe,llm,organize,images}.py`
- Test: `pipeline/tests/test_organize.py`, `pipeline/tests/test_sessions.py`, `pipeline/tests/test_images.py`

**Interfaces — Produces:**
- `sessions.py`: `SessionMeta(number, started_at, ended_at, status, step, progress: float, message, error)`; statuses `recording|transcribing|organizing|imaging|done|error`; `new_session(slug) -> SessionMeta`, `load_meta/save_meta`, `load_state/save_state` (`state.json`: `{"transcribed": [chunk names], "organized_windows": int, "answers_applied": bool, "images_done": bool}`); files under `sessions/<n>/{session.json,state.json,audio/chunk-0001.wav,transcript.jsonl}`
- `transcribe.py`: `Transcriber(model: str)`; `.transcribe_chunk(wav_path, prompt_names: list[str]) -> list[dict(start,end,text)]` (lazy import mlx_whisper, `initial_prompt` = "Names: " + names)
- `llm.py`: `LLM(model, host="http://127.0.0.1:11434")`; `.json(system: str, user: str, schema: dict) -> dict` via `/api/chat` with `format=schema`, `stream=False`; raises `LLMError` on bad JSON
- `organize.py`: `windows(transcript_lines, max_chars=12000) -> list[str]`; `organize_session(slug, n, llm, progress_cb)`; `apply_answers(slug, llm) -> int`; per window the LLM returns `{"cards":[{title, kind, summary, body, tags, links:[titles], questions:[text], appearance, image_ready}], "new_names":[...] }`; cards matching an existing pipeline card *from this session* by slug are merged (LLM merge call), otherwise created with `sessions=[n]`, `order=n*10000+i`, `imageStatus="pending"`, `origin="pipeline"`; links rendered as markdown links to resolved slugs; places get map cells; invalid output retried once then skipped
- `images.py`: `ImageGenerator(model, quantize)`; `.generate(prompt, out_path)` (lazy mflux `ZImageTurbo`); `STYLE = "cute cartoon sticker, clip art, thick white outline, flat colors, simple, centered, plain background"`; `build_prompt(card, linked_cards) -> str`; `process_pending(slug, gen, llm)` asks LLM `{enough_detail: bool, prompt: str}` and generates only when true; `redraw(slug, card_slug, change, gen)` regenerates and appends change to `imageNotes`
- `pipeline.run_post_session(slug, n, cfg)`: finish transcription → organize → apply_answers → images; each step checks/updates `state.json`

- [ ] Tests with a fake LLM and fake generator: organize creates cards with correct provenance/order; invalid JSON retried then skipped; resume after `organized_windows=1` doesn't duplicate; apply_answers renames a card and updates names pool and marks `appliedAt`; images skipped when `enough_detail` false and status stays `pending`.
- [ ] Commit.

### Task 5: Worker service (recording + job runner)

**Files:**
- Create: `pipeline/dnd_pipeline/{recorder,server}.py`
- Test: `pipeline/tests/test_server.py`

**Interfaces — Produces (HTTP on 127.0.0.1:8765):**
- `GET /health` → `{ok: true, config}`
- `GET /status` → `{recording: {campaign, session} | null, job: {campaign, session, kind, status, step, progress, message} | null}`
- `POST /sessions/start {campaign}` → `SessionMeta` (409 if already recording)
- `POST /sessions/stop` → queues post-session job
- `POST /campaigns/{c}/sessions/{n}/process` → re-run/resume
- `POST /campaigns/{c}/apply-answers`
- `POST /campaigns/{c}/cards/{card}/redraw {change}`
- `Recorder(out_dir, chunk_seconds=30, on_chunk)` using sounddevice InputStream 16 kHz mono; live transcription of chunks in a background thread when a transcription model is configured
- On startup: any session left in `recording` is marked stopped and queued; any non-done job is resumed

- [ ] Tests with FastAPI TestClient, fake recorder and fake pipeline: start/stop/409; stop queues a job; status reflects job.
- [ ] Commit.

### Task 6: Website — Session page, names editor, timeline, questions, image pending/redraw

**Files:**
- Create: `src/lib/worker.ts` (`workerFetch(path, init) -> Promise<Response | null>`; returns `null` when the worker is unreachable; base `process.env.DND_WORKER_URL ?? "http://127.0.0.1:8765"`)
- Create: `src/lib/content/sessions.ts` (`listSessions(slug): Promise<SessionMeta[]>`, `deleteSessionAudio(slug, n)`)
- Create routes: `src/app/api/campaigns/[slug]/names/route.ts` (GET/PUT), `.../session/route.ts` (GET status+sessions, POST `{action:"start"|"stop"|"process"|"apply-answers", session?}`), `.../sessions/[n]/audio/route.ts` (DELETE), `.../articles/[article]/questions/route.ts` (POST `{id, answer}`), `.../articles/[article]/redraw/route.ts` (POST `{change}`)
- Create pages/components: `src/app/campaigns/[slug]/session/page.tsx`, `src/app/campaigns/[slug]/timeline/page.tsx`, `src/components/session-controls.tsx`, `src/components/names-editor.tsx`, `src/components/card-questions.tsx`, `src/components/redraw-dialog.tsx`, `src/components/image-pending.tsx`
- Modify: `src/components/campaign-header.tsx` (add Timeline, Session), `src/components/article-card.tsx` (pending placeholder), article page (questions, kind badge, sessions line, redraw button)
- Test: `tests/worker.test.ts`, `tests/questions.test.ts`, `tests/timeline.test.ts`

- [ ] Tests: `workerFetch` returns null on connection refused; answering a question sets `answer`+`answeredAt` and keeps other fields; timeline helper `timelineEvents(articles)` returns only `kind==="event"` sorted by `order`, grouped by first session.
- [ ] Session page: listening list + known pool editor, Start/Stop button, live status (poll `/api/.../session` every 2 s while active), past sessions with Reprocess / Delete recording, "Apply answers now".
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass; commit.

### Task 7: Docs, example content, end-to-end check

- [ ] Update `README.md` (setup, start, game-night flow, tiers, privacy), `AGENTS.md` (new content model + worker), campaign-ramble skill note about card fields.
- [ ] Add a couple of pipeline-style example cards to `sunken-isles` (one with a pending image and an open question).
- [ ] Run `pnpm build`, `uv run pytest`, start the worker + site and exercise Start/Stop with the real mic and a tiny whisper model; post-session with Ollama if installed.
- [ ] Create `SpartanPip/dnd-pipeline` (private) and push.
