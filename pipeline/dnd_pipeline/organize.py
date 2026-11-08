"""Turn a session transcript into short, linked snapshot cards, and fold user answers back in."""

import logging
import re
import uuid
from collections.abc import Callable
from typing import Protocol

from . import content, sessions
from .content import CARD_WORD_LIMIT, Card, Question, tag
from .llm import LLMError

log = logging.getLogger(__name__)

Progress = Callable[[float, str], None]
KINDS = ["character", "event", "place", "faction", "item", "spell", "lore", "other"]
MAX_INDEX_CARDS = 150


class StructuredLLM(Protocol):
    def json(self, system: str, user: str, schema: dict) -> dict: ...


def _str_list() -> dict:
    return {"type": "array", "items": {"type": "string"}}


EXTRACT_SCHEMA = {
    "title": "extract",
    "type": "object",
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "kind": {"type": "string", "enum": KINDS},
                    "summary": {"type": "string"},
                    "body": {"type": "string"},
                    "tags": _str_list(),
                    "characters": _str_list(),
                    "links": _str_list(),
                    "questions": _str_list(),
                    "appearance": {"type": "string"},
                    "map_icon": {"type": "string"},
                },
                "required": ["title", "kind", "summary", "body", "tags", "characters", "links", "questions",
                             "appearance", "map_icon"],
            },
        },
        "new_names": _str_list(),
    },
    "required": ["cards", "new_names"],
}

MERGE_SCHEMA = {
    "title": "merge",
    "type": "object",
    "properties": {"summary": {"type": "string"}, "body": {"type": "string"}, "appearance": {"type": "string"}},
    "required": ["summary", "body", "appearance"],
}

APPLY_SCHEMA = {
    "title": "apply",
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "body": {"type": "string"},
        "appearance": {"type": "string"},
        "renames": {
            "type": "array",
            "items": {"type": "object", "properties": {"from": {"type": "string"}, "to": {"type": "string"}},
                      "required": ["from", "to"]},
        },
    },
    "required": ["title", "summary", "body", "appearance", "renames"],
}

EXTRACT_SYSTEM = f"""You turn part of a transcript of an in-person Dungeons & Dragons session into session-note cards.

Rules:
- Cover everything lore-worthy in this part: events, characters, places, factions, items, spells, lore.
  Skip dice math, rules talk, and out-of-character table chatter.
- Cards are snapshots: one character at this moment, or one event. Keep each body under {CARD_WORD_LIMIT} words
  and the summary to one sentence.
- Track characters, never players. Use names you actually heard, matched against the known names list.
  If you are not sure who did something or what a name is, say so in the card ("possibly Kael") and add a
  question such as "Who threw the first punch, Kael or Elara?" or "Is the name 'Gravel' correct?".
- Never invent names. Refer to unnamed figures descriptively ("a hooded dwarf").
- "characters": every character involved in the card. "links": titles of other cards (new or existing)
  this card relates to; link freely where a reader would want to jump.
- "appearance": only concrete visual details that were stated (looks, clothing, species, colors). Empty if none.
- "map_icon": for places only, one of the allowed icons; otherwise empty.
- "new_names": character or place names heard that are not in the known names list.
- If an existing card already covers exactly this moment, reuse its title so it gets merged.
- Respect answered questions as facts."""

MERGE_SYSTEM = f"""Merge two versions of the same session-note card into one. Keep every fact, drop repetition.
Body under {CARD_WORD_LIMIT} words, one-sentence summary. Merge appearance details."""

APPLY_SYSTEM = f"""The user answered open questions about a D&D session-note card. Rewrite the card so it agrees
with the answers. Keep it under {CARD_WORD_LIMIT} words with a one-sentence summary. If an answer corrects a name,
add a rename entry from the wrong name to the right one."""


def _clock(seconds: float) -> str:
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def windows(lines: list[dict], max_chars: int = 12000) -> list[str]:
    out, current = [], ""
    for line in lines:
        entry = f"[{_clock(line['start'])}] {line['text']}\n"
        if current and len(current) + len(entry) > max_chars:
            out.append(current)
            current = ""
        current += entry
    if current:
        out.append(current)
    return out


def _trim_words(text: str, limit: int = CARD_WORD_LIMIT) -> str:
    words = text.split()
    return text.strip() if len(words) <= limit else " ".join(words[:limit]) + "…"


def _link_line(slug: str, targets: list[tuple[str, str]]) -> str:
    return "See also: " + ", ".join(f"[{title}](/campaigns/{slug}/articles/{s})" for title, s in targets)


def _strip_link_line(body: str) -> str:
    return re.sub(r"\n*See also: .*$", "", body.strip(), flags=re.S).strip()


def _context(slug: str, n: int) -> str:
    names = content.read_names(slug)
    known = [n.name + (f" (also: {', '.join(n.aliases)})" if n.aliases else "") for n in names.known]
    cards = content.list_cards(slug)
    cards.sort(key=lambda c: (n in c.sessions, c.order or 0), reverse=True)
    index = [f"- {c.title} [{c.kind or 'article'}]: {c.summary}" for c in cards[:MAX_INDEX_CARDS]]
    answers = [f"- Q: {q.text} A: {q.answer}" for c in cards for q in c.questions if q.answer]
    icons = ", ".join(sorted(content.map_icon_keys()))
    return (
        f"Known names: {', '.join(known) or 'none yet'}\n\n"
        f"Existing cards:\n" + ("\n".join(index) or "none yet") + "\n\n"
        f"Answered questions:\n" + ("\n".join(answers) or "none") + "\n\n"
        f"Allowed map icons: {icons}\n"
    )


def _ask(llm: StructuredLLM, system: str, user: str, schema: dict) -> dict | None:
    for attempt in (1, 2):
        try:
            return llm.json(system, user, schema)
        except LLMError as exc:
            log.warning("LLM %s call failed (attempt %d): %s", schema["title"], attempt, exc)
    return None


def _session_card(slug: str, n: int, title: str) -> Card | None:
    for c in content.list_cards(slug):
        if c.origin == "pipeline" and n in c.sessions and c.title.lower() == title.lower():
            return c
    return None


def _questions(texts: list[str], existing: list[Question] = ()) -> list[Question]:
    seen = {q.text.strip().lower() for q in existing}
    out = list(existing)
    for t in texts:
        if t.strip() and t.strip().lower() not in seen:
            out.append(Question(id=uuid.uuid4().hex[:10], text=t.strip()))
            seen.add(t.strip().lower())
    return out


def _tags(raw: dict) -> list[str]:
    tags = [raw["kind"]] + [tag(c) for c in raw.get("characters", [])] + [tag(t) for t in raw.get("tags", [])]
    return list(dict.fromkeys(t for t in tags if t))[:8]


def _save_raw_card(slug: str, n: int, raw: dict, order: int, llm: StructuredLLM) -> Card:
    existing = _session_card(slug, n, raw["title"])
    if existing:
        merged = _ask(llm, MERGE_SYSTEM,
                      f"Card A:\n{existing.summary}\n{_strip_link_line(existing.body)}\nAppearance: {existing.imageNotes or ''}\n\n"
                      f"Card B:\n{raw['summary']}\n{raw['body']}\nAppearance: {raw['appearance']}",
                      MERGE_SCHEMA) or {
            "summary": existing.summary,
            "body": _strip_link_line(existing.body) + " " + raw["body"],
            "appearance": "; ".join(filter(None, [existing.imageNotes, raw["appearance"]])),
        }
        card = existing.model_copy(update={
            "summary": merged["summary"][:200] or existing.summary,
            "body": _trim_words(merged["body"]),
            "imageNotes": merged["appearance"] or existing.imageNotes,
            "tags": list(dict.fromkeys(existing.tags + _tags(raw)))[:8],
            "questions": _questions(raw["questions"], existing.questions),
        })
        return content.update_card(slug, card)

    card = Card(
        title=raw["title"][:100],
        slug=content.slugify(raw["title"]) or "card",
        summary=(raw["summary"] or raw["title"])[:200],
        body=_trim_words(raw["body"]),
        tags=_tags(raw),
        kind=raw["kind"],
        origin="pipeline",
        sessions=[n],
        order=order,
        imageStatus="pending",
        imageNotes=raw["appearance"] or None,
        questions=_questions(raw["questions"]),
    )
    return content.create_card(slug, card)


def _resolve_links(slug: str, n: int, pending: dict[str, list[str]]) -> None:
    by_title = {}
    for c in sorted(content.list_cards(slug), key=lambda c: (n in c.sessions, c.order or 0)):
        by_title[c.title.lower()] = c
    for card_slug, titles in pending.items():
        card = content.read_card(slug, card_slug)
        if not card or card.origin != "pipeline":
            continue
        targets = []
        for t in titles:
            target = by_title.get(t.lower())
            if target and target.slug != card.slug and (target.title, target.slug) not in targets:
                targets.append((target.title, target.slug))
        body = _strip_link_line(card.body)
        if targets:
            body += "\n\n" + _link_line(slug, targets)
        if body != card.body.strip():
            content.update_card(slug, card.model_copy(update={"body": body}))


def organize_session(slug: str, n: int, llm: StructuredLLM, progress: Progress = lambda f, m: None,
                     max_chars: int = 12000) -> None:
    ws = windows(sessions.read_transcript(slug, n), max_chars)
    state = sessions.load_state(slug, n)
    for i in range(state.organized_windows, len(ws)):
        progress(i / max(len(ws), 1), f"Organizing part {i + 1} of {len(ws)}")
        result = _ask(llm, EXTRACT_SYSTEM, _context(slug, n) + "\nTranscript part:\n" + ws[i], EXTRACT_SCHEMA)
        if result is None:
            log.warning("Skipping transcript part %d of session %d: no valid response", i + 1, n)
        else:
            for j, raw in enumerate(result.get("cards", [])):
                if not raw.get("title", "").strip():
                    continue
                card = _save_raw_card(slug, n, raw, n * 10000 + i * 100 + j, llm)
                links = state.pending_links.setdefault(card.slug, [])
                links += [t for t in raw.get("links", []) if t not in links]
                if raw["kind"] == "place":
                    near = next((content.slugify(t) for t in raw.get("links", [])), None)
                    content.add_map_cell(slug, card.title, raw.get("map_icon", ""), card.slug, near_slug=near)
            content.add_known_names(slug, result.get("new_names", []))
        state.organized_windows = i + 1
        sessions.save_state(slug, n, state)
    _resolve_links(slug, n, state.pending_links)
    progress(1.0, "Organized")


def _replace_word(text: str, old: str, new: str) -> str:
    return re.sub(rf"\b{re.escape(old)}\b", new, text)


def _apply_rename(slug: str, old: str, new: str) -> None:
    for card in content.list_cards(slug):
        if card.origin != "pipeline":
            continue
        updated = card.model_copy(update={
            "title": _replace_word(card.title, old, new),
            "summary": _replace_word(card.summary, old, new),
            "body": _replace_word(card.body, old, new),
        })
        if updated != card:
            content.update_card(slug, updated)
    names = content.read_names(slug)
    entry = next((k for k in names.known if k.name.lower() == old.lower()), None)
    if entry:
        entry.name = new
        if old not in entry.aliases:
            entry.aliases.append(old)
    elif not any(k.name.lower() == new.lower() for k in names.known):
        names.known.append(content.KnownName(name=new, aliases=[old]))
    names.listening = [new if x.lower() == old.lower() else x for x in names.listening]
    content.write_names(slug, names)


def apply_answers(slug: str, llm: StructuredLLM) -> int:
    """Fold newly answered questions into their cards. Returns how many cards changed."""
    changed = 0
    for card in content.list_cards(slug):
        fresh = [q for q in card.questions if q.answer and not q.appliedAt]
        if card.origin != "pipeline" or not fresh:
            continue
        qa = "\n".join(f"Q: {q.text}\nA: {q.answer}" for q in fresh)
        result = _ask(llm, APPLY_SYSTEM,
                      f"Card title: {card.title}\nSummary: {card.summary}\nBody: {_strip_link_line(card.body)}\n"
                      f"Appearance: {card.imageNotes or ''}\n\nAnswers:\n{qa}", APPLY_SCHEMA)
        if result is None:
            continue
        stamp = content.now_iso()
        link_line = re.search(r"See also: .*$", card.body.strip(), flags=re.S)
        body = _trim_words(result["body"]) + ("\n\n" + link_line.group(0) if link_line else "")
        questions = [q.model_copy(update={"appliedAt": stamp}) if q in fresh else q for q in card.questions]
        content.update_card(slug, card.model_copy(update={
            "title": result["title"][:100] or card.title,
            "summary": result["summary"][:200] or card.summary,
            "body": body,
            "imageNotes": result["appearance"] or card.imageNotes,
            "questions": questions,
        }))
        for r in result.get("renames", []):
            if r["from"].strip() and r["to"].strip() and r["from"] != r["to"]:
                _apply_rename(slug, r["from"].strip(), r["to"].strip())
        changed += 1
    return changed
