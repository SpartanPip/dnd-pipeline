"""Python mirror of src/lib/content: cards (articles), names pool, and map.

Models here must stay in sync with src/lib/content/schema.ts; tests/contract.test.ts
checks that the site accepts what this module writes.
"""

import json
import re
import unicodedata
from datetime import datetime, timezone
from functools import cache
from pathlib import Path
from typing import Literal

import frontmatter
from pydantic import BaseModel, Field

from .paths import articles_dir, campaign_dir, site_root

CardKind = Literal["character", "event", "place", "faction", "item", "spell", "lore", "other"]
CARD_WORD_LIMIT = 80


class Question(BaseModel):
    id: str
    text: str
    answer: str | None = None
    answeredAt: str | None = None
    appliedAt: str | None = None


class Card(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    slug: str
    tags: list[str] = []
    summary: str = Field(min_length=1, max_length=200)
    image: str | None = None
    kind: CardKind | None = None
    origin: Literal["pipeline", "manual"] = "manual"
    sessions: list[int] = []
    order: int | None = None
    imageStatus: Literal["pending", "generated"] | None = None
    imageNotes: str | None = None
    questions: list[Question] = []
    body: str = ""


class KnownName(BaseModel):
    name: str
    aliases: list[str] = []


class Names(BaseModel):
    known: list[KnownName] = []
    listening: list[str] = []


class MapCellSearch(BaseModel):
    text: str | None = None
    tags: list[str] = []


class MapCell(BaseModel):
    x: int
    y: int
    icon: str
    label: str = Field(min_length=1, max_length=80)
    search: MapCellSearch = MapCellSearch()
    articleSlug: str | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return re.sub(r"-{2,}", "-", text)


def tag(text: str) -> str:
    return slugify(text) or "untagged"


def card_path(slug: str, card_slug: str) -> Path:
    return articles_dir(slug) / f"{card_slug}.md"


def _parse(path: Path) -> Card | None:
    try:
        post = frontmatter.load(path)
        return Card(**post.metadata, body=post.content)
    except Exception:
        return None


def read_card(slug: str, card_slug: str) -> Card | None:
    path = card_path(slug, card_slug)
    return _parse(path) if path.exists() else None


def list_cards(slug: str) -> list[Card]:
    d = articles_dir(slug)
    if not d.exists():
        return []
    cards = [c for p in sorted(d.glob("*.md")) if (c := _parse(p))]
    return sorted(cards, key=lambda c: c.title.lower())


def _write_raw(slug: str, card: Card) -> None:
    meta = card.model_dump(exclude={"body"}, exclude_none=True)
    meta["questions"] = [q.model_dump(exclude_none=True) for q in card.questions]
    post = frontmatter.Post(card.body.strip() + "\n", **meta)
    articles_dir(slug).mkdir(parents=True, exist_ok=True)
    card_path(slug, card.slug).write_text(frontmatter.dumps(post, sort_keys=False) + "\n")


def _free_slug(slug: str, base: str) -> str:
    candidate, n = base, 2
    while card_path(slug, candidate).exists():
        candidate, n = f"{base}-{n}", n + 1
    return candidate


def create_card(slug: str, card: Card) -> Card:
    """Write a new pipeline card under a slug no other article uses."""
    card = card.model_copy(update={"origin": "pipeline", "slug": _free_slug(slug, card.slug or slugify(card.title))})
    _write_raw(slug, card)
    return card


def update_card(slug: str, card: Card) -> Card:
    """Rewrite a pipeline card in place, keeping answers the user gave meanwhile."""
    existing = read_card(slug, card.slug)
    if card.origin != "pipeline" or (existing and existing.origin != "pipeline"):
        raise ValueError(f"refusing to edit hand-written article {card.slug}")
    if existing:
        answered = {q.id: q for q in existing.questions if q.answer}
        merged = [q if q.answer else answered.get(q.id, q) for q in card.questions]
        ids = {q.id for q in merged}
        merged += [q for q in existing.questions if q.id not in ids and q.answer]
        card = card.model_copy(update={"questions": merged})
    _write_raw(slug, card)
    return card


def names_path(slug: str) -> Path:
    return campaign_dir(slug) / "names.json"


def read_names(slug: str) -> Names:
    path = names_path(slug)
    return Names.model_validate_json(path.read_text()) if path.exists() else Names()


def write_names(slug: str, names: Names) -> None:
    names_path(slug).write_text(names.model_dump_json(indent=2) + "\n")


def add_known_names(slug: str, new: list[str]) -> list[str]:
    names = read_names(slug)
    seen = {n.name.lower() for n in names.known} | {a.lower() for n in names.known for a in n.aliases}
    added = []
    for name in new:
        name = name.strip()
        if name and name.lower() not in seen:
            names.known.append(KnownName(name=name))
            seen.add(name.lower())
            added.append(name)
    if added:
        write_names(slug, names)
    return added


@cache
def map_icon_keys() -> frozenset[str]:
    src = (site_root() / "src" / "lib" / "icons.ts").read_text()
    block = src.split("MAP_ICONS", 1)[1].split("};", 1)[0]
    return frozenset(re.findall(r"^\s+([a-z0-9]+):", block, re.M))


def map_path(slug: str) -> Path:
    return campaign_dir(slug) / "map.json"


def read_map(slug: str) -> list[MapCell]:
    path = map_path(slug)
    if not path.exists():
        return []
    return [MapCell(**c) for c in json.loads(path.read_text()).get("cells", [])]


def _nearest_free(taken: set[tuple[int, int]], cx: int, cy: int) -> tuple[int, int]:
    for r in range(0, 100):
        ring = sorted(
            ((cx + dx, cy + dy) for dx in range(-r, r + 1) for dy in range(-r, r + 1) if abs(dx) + abs(dy) == r),
            key=lambda p: (abs(p[0] - cx) + abs(p[1] - cy), p),
        )
        for p in ring:
            if p not in taken:
                return p
    raise RuntimeError("map is full")


def add_map_cell(slug: str, label: str, icon: str, article_slug: str, near_slug: str | None = None) -> MapCell:
    cells = read_map(slug)
    for c in cells:
        if c.articleSlug == article_slug:
            return c
    anchor = next((c for c in cells if near_slug and c.articleSlug == near_slug), None)
    taken = {(c.x, c.y) for c in cells}
    x, y = _nearest_free(taken, anchor.x if anchor else 0, anchor.y if anchor else 0)
    cell = MapCell(x=x, y=y, icon=icon if icon in map_icon_keys() else "landmark",
                   label=label[:80], articleSlug=article_slug)
    cells.append(cell)
    map_path(slug).write_text(json.dumps({"cells": [c.model_dump(exclude_none=True) for c in cells]}, indent=2) + "\n")
    return cell
