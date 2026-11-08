# dnd-pipeline

Session notes for in-person D&D, made on your Mac. Put a laptop on the table,
press **Start**, and play. When you press **Stop**, it keeps working locally for
up to a couple of hours and turns the session into short, linked cards (events,
characters, places, items, spells…) with cute sticker images, browsable on a
local website.

Nothing leaves your machine: recording, transcription, organizing, and image
generation all run locally.

Built on [dnd-lore](https://github.com/SpartanPip/dnd-lore): same campaigns,
map, articles, tags, and search, plus:

- **Session** page: Start/Stop recording, live processing progress, the
  campaign's character names, and past sessions (re-process or delete a
  recording).
- **Timeline**: event cards in story order, grouped by session.
- **Open questions** on cards ("Is the name 'Gravel' correct?"). Answer them on
  the card; answers are applied the next time the pipeline runs (or press
  **Apply answers now**).
- **Image pending**: a card only gets an image once it has enough detail to draw
  it right. Pending cards are rechecked after every session. Images are fixed
  once drawn; use **Redraw** on a card to describe a change.

## Requirements

macOS with Apple Silicon (M1 or newer) and [Homebrew](https://brew.sh). Intel
Macs can run the website, but not the local models.

## Setup

```bash
./setup.sh
```

This installs dependencies (asking before installing anything with Homebrew),
then asks whether it may check your Mac's chip, memory, and free disk to
recommend models. You can accept each recommendation, type a different model,
or type `none` to skip a step. Skip the check entirely to pick models yourself.
Choices are saved to `pipeline.config.json`; run `./setup.sh` again to change
them.

| Memory | Transcription | Organizing (Ollama) | Images (mflux) |
| --- | --- | --- | --- |
| 8–15 GB | `whisper-small` | `gemma4:e2b-it-q4_K_M` (rougher notes) | not available |
| 16–23 GB | `whisper-large-v3-turbo` | `gemma4:e4b-it-q4_K_M` | Z-Image Turbo, 4-bit |
| 24–47 GB | `whisper-large-v3-turbo` | `gemma4:12b-it-q4_K_M` | Z-Image Turbo, 8-bit |
| 48 GB+ | `whisper-large-v3-turbo` | `gemma4:26b-a4b-it-q4_K_M` | Z-Image Turbo, 8-bit |

If a step has no model, the rest of the pipeline still runs and the site says
what was skipped.

## Game night

```bash
./start.sh
```

Open <http://localhost:3000>, pick a campaign, go to **Session**.

1. Type the character names you expect tonight into the listening list (it
   helps transcription spell them right).
2. Press **Start**. The first time, macOS asks to let your terminal app use the
   microphone. Allow it.
3. Press **Stop** when you're done. Leave the laptop running; progress shows on
   the Session page and cards appear as they're written.

If the laptop sleeps or the worker stops mid-processing, run `./start.sh`
again and it picks up where it left off.

If something goes wrong, check `logs/` (`worker.log`, `site.log`,
`ollama.log`). Each `./start.sh` overwrites them.

## Privacy

Real campaigns (`content/campaigns/*` except the `sunken-isles` example),
generated images (`public/uploads/`), recordings, and `pipeline.config.json`
are git-ignored, so pushing this repo never uploads your notes.

## Development

| Command | What it does |
| --- | --- |
| `pnpm dev` | Website only |
| `pnpm test` / `pnpm typecheck` / `pnpm lint` | Website checks |
| `pnpm lint:content` | Warn on oversized articles / unknown map icons |
| `cd pipeline && uv run pytest` | Pipeline tests (no models needed) |
| `cd pipeline && uv run dnd-worker` | Worker only (`127.0.0.1:8765`) |

See [`AGENTS.md`](./AGENTS.md) for architecture and the content model, and
[`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for UI conventions.

Map icons are from [game-icons.net](https://game-icons.net) (CC BY 3.0).
