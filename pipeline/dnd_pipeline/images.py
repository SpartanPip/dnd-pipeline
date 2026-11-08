"""Sticker-style images for cards, generated only when a card has enough visual detail."""

import re
import uuid
import zlib
from collections.abc import Callable
from functools import cache
from pathlib import Path
from typing import Protocol, get_args

from . import content
from .content import Card
from pydantic import BaseModel

from .organize import StructuredLLM, _ask
from .paths import uploads_dir

STYLE = ("cute cartoon sticker, clip art, thick white outline, flat bright colors, simple shapes, "
         "centered subject, plain light background, no text")

DETAIL_SCHEMA = {
    "title": "detail",
    "type": "object",
    "properties": {"enough_detail": {"type": "boolean"}, "prompt": {"type": "string"}},
    "required": ["enough_detail", "prompt"],
}

DETAIL_SYSTEM = """You decide whether a D&D session-note card has enough concrete visual detail to draw a
simple sticker of it without guessing, and if so write a short image prompt (under 60 words) describing only the
subject. Be strict: a character needs at least two stated visual details (e.g. species/ancestry plus clothing,
build, hair, or a notable feature); an event needs who or what is involved and what is happening; a place or item
needs a physical description. Never add details that are not in the card or the related cards."""


class DetailOut(BaseModel):
    enough_detail: bool = False
    prompt: str = ""


class Generates(Protocol):
    def generate(self, prompt: str, out_path: Path, seed: int = 0) -> None: ...


@cache
def load_model(quantize: int):
    from mflux.models.z_image import ZImageTurbo

    return ZImageTurbo(quantize=quantize)


class ImageGenerator:
    def __init__(self, quantize: int = 8, size: int = 768, steps: int = 9):
        self.quantize, self.size, self.steps = quantize, size, steps

    def generate(self, prompt: str, out_path: Path, seed: int = 0) -> None:
        image = load_model(self.quantize).generate_image(
            prompt=prompt, seed=seed, num_inference_steps=self.steps, width=self.size, height=self.size,
        )
        out_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(str(out_path))


def _linked(slug: str, card: Card, all_cards: list[Card]) -> list[Card]:
    targets = set(re.findall(rf"/campaigns/{re.escape(slug)}/articles/([a-z0-9-]+)", card.body))
    name_tags = {t for t in card.tags if t not in get_args(content.CardKind)}
    return [c for c in all_cards if c.slug != card.slug and
            (c.slug in targets or (c.kind == "character" and name_tags & set(c.tags) and c.imageNotes))]


def _describe(slug: str, card: Card, all_cards: list[Card], change: str | None = None) -> str:
    related = "\n".join(f"- {c.title}: {c.summary} Appearance: {c.imageNotes or 'unknown'}"
                        for c in _linked(slug, card, all_cards)[:6])
    text = (f"Card: {card.title} [{card.kind or 'article'}]\nSummary: {card.summary}\nBody: {card.body}\n"
            f"Appearance notes: {card.imageNotes or 'none'}\nRelated cards:\n{related or 'none'}")
    if change:
        text += f"\n\nThe user asked for a redraw with this change (treat as enough detail): {change}"
    return text


def _render(slug: str, card: Card, prompt: str, gen: Generates) -> Card:
    filename = f"{card.slug}-{uuid.uuid4().hex[:8]}.png"
    gen.generate(f"{STYLE}. {prompt}", uploads_dir(slug) / filename, seed=zlib.crc32(card.slug.encode()))
    card = content.read_card(slug, card.slug) or card
    return content.update_card(slug, card.model_copy(update={
        "image": f"/uploads/{slug}/{filename}", "imageStatus": "generated",
    }))


def process_pending(slug: str, gen: Generates, llm: StructuredLLM,
                    progress: Callable[[float, str], None] = lambda f, m: None) -> int:
    all_cards = content.list_cards(slug)
    pending = [c for c in all_cards if c.origin == "pipeline" and c.imageStatus == "pending"]
    made = 0
    for i, stale in enumerate(pending):
        card = content.read_card(slug, stale.slug)
        if not card or card.origin != "pipeline" or card.imageStatus != "pending":
            continue
        progress(i / max(len(pending), 1), f"Checking image detail for {card.title}")
        verdict = _ask(llm, DETAIL_SYSTEM, _describe(slug, card, all_cards), DETAIL_SCHEMA, DetailOut)
        if verdict and verdict.enough_detail and verdict.prompt.strip():
            progress(i / max(len(pending), 1), f"Drawing {card.title}")
            _render(slug, card, verdict.prompt, gen)
            made += 1
    return made


def redraw(slug: str, card_slug: str, change: str, gen: Generates, llm: StructuredLLM) -> Card:
    card = content.read_card(slug, card_slug)
    if card is None or card.origin != "pipeline":
        raise ValueError(f"{card_slug} is not a pipeline card")
    notes = "; ".join(filter(None, [card.imageNotes, f"Change: {change.strip()}"]))
    card = content.update_card(slug, card.model_copy(update={"imageNotes": notes}))
    verdict = _ask(llm, DETAIL_SYSTEM, _describe(slug, card, content.list_cards(slug), change), DETAIL_SCHEMA,
                   DetailOut)
    prompt = (verdict.prompt.strip() if verdict else "") or f"{card.title}. {notes}"
    return _render(slug, card, prompt, gen)
