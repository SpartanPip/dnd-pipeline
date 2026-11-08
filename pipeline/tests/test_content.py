from pathlib import Path

from dnd_pipeline import content
from dnd_pipeline.content import Card, Names, Question

REAL_REPO = Path(__file__).resolve().parents[2]


def make_campaign(repo, slug="camp"):
    d = repo / "content" / "campaigns" / slug
    (d / "articles").mkdir(parents=True)
    (d / "campaign.json").write_text('{"slug": "%s", "title": "Camp"}' % slug)
    return d


def card(**kw):
    base = dict(title="Gravel at the forge", slug="gravel-at-the-forge", tags=["gravel"],
                summary="Gravel sells a cursed lantern.", body="Short body.",
                kind="character", origin="pipeline", sessions=[1], order=10000,
                imageStatus="pending")
    base.update(kw)
    return Card(**base)


def test_slugify_matches_ts_rules():
    assert content.slugify("Captain Elowen Vex") == "captain-elowen-vex"
    assert content.slugify("  Multiple   Spaces ") == "multiple-spaces"
    assert content.slugify("Café & Bar!") == "cafe-bar"


def test_write_and_read_round_trip(repo):
    make_campaign(repo)
    written = content.create_card("camp", card())
    assert content.read_card("camp", written.slug) == written
    assert [c.slug for c in content.list_cards("camp")] == ["gravel-at-the-forge"]


def test_collision_with_manual_article_gets_suffix(repo):
    d = make_campaign(repo)
    manual = d / "articles" / "gravel-at-the-forge.md"
    manual.write_text("---\ntitle: Gravel\nslug: gravel-at-the-forge\nsummary: Mine.\n---\n\nHand written.\n")
    before = manual.read_bytes()
    written = content.create_card("camp", card())
    assert written.slug == "gravel-at-the-forge-2"
    assert manual.read_bytes() == before


def test_answers_on_disk_survive_rewrite(repo):
    make_campaign(repo)
    content.create_card("camp", card(questions=[Question(id="q1", text="Is it Gravel?")]))
    on_disk = content.read_card("camp", "gravel-at-the-forge")
    on_disk.questions[0].answer = "Gravelle"
    on_disk.questions[0].answeredAt = "2026-11-07T00:00:00Z"
    content._write_raw("camp", on_disk)
    content.update_card("camp", card(body="Updated.", questions=[Question(id="q1", text="Is it Gravel?")]))
    after = content.read_card("camp", "gravel-at-the-forge")
    assert after.body.strip() == "Updated."
    assert after.questions[0].answer == "Gravelle"


def test_names_dedupe_case_insensitively(repo):
    make_campaign(repo)
    content.write_names("camp", Names(known=[{"name": "Elara", "aliases": []}], listening=[]))
    content.add_known_names("camp", ["elara", "Kael", "Kael"])
    assert [n.name for n in content.read_names("camp").known] == ["Elara", "Kael"]


def test_map_cell_nearest_free_and_unknown_icon(repo):
    d = make_campaign(repo)
    (d / "map.json").write_text('{"cells": [{"x": 0, "y": 0, "icon": "castle", "label": "Keep", "search": {"tags": []}}]}')
    cell = content.add_map_cell("camp", "Millbrook", "spaceship", "millbrook")
    assert cell.icon == "landmark"
    assert (cell.x, cell.y) != (0, 0)
    assert abs(cell.x) + abs(cell.y) == 1


def test_map_cell_placed_next_to_related(repo):
    d = make_campaign(repo)
    (d / "map.json").write_text('{"cells": [{"x": 5, "y": 5, "icon": "village", "label": "Town", "search": {"tags": []}, "articleSlug": "town"}]}')
    cell = content.add_map_cell("camp", "Town Well", "landmark", "town-well", near_slug="town")
    assert abs(cell.x - 5) + abs(cell.y - 5) == 1


def test_map_icon_keys_read_from_site():
    assert {"castle", "village", "landmark"} <= content.map_icon_keys()


def test_writes_contract_fixture(repo):
    make_campaign(repo)
    c = content.create_card("camp", card(questions=[Question(id="q1", text="Is it Gravel?")],
                                       imageNotes="stout dwarf"))
    src = content.card_path("camp", c.slug)
    fixture = REAL_REPO / "tests" / "fixtures" / "pipeline-card.md"
    fixture.parent.mkdir(exist_ok=True)
    fixture.write_text(src.read_text())


def test_create_never_overwrites_earlier_pipeline_card(repo):
    make_campaign(repo)
    first = content.create_card("camp", card(sessions=[1]))
    second = content.create_card("camp", card(sessions=[2], body="Later snapshot."))
    assert first.slug == "gravel-at-the-forge"
    assert second.slug == "gravel-at-the-forge-2"
    assert content.read_card("camp", first.slug).sessions == [1]


def test_update_refuses_manual_article(repo):
    import pytest
    make_campaign(repo)
    with pytest.raises(ValueError):
        content.update_card("camp", card(origin="manual"))


def test_update_keeps_applied_marker_set_by_pipeline(repo):
    make_campaign(repo)
    answered = Question(id="q1", text="Is it Gravel?", answer="Gravelle", answeredAt="2026-11-07T00:00:00Z")
    content.create_card("camp", card(questions=[answered]))
    applied = answered.model_copy(update={"appliedAt": "2026-11-07T01:00:00Z"})
    content.update_card("camp", card(questions=[applied]))
    assert content.read_card("camp", "gravel-at-the-forge").questions[0].appliedAt == "2026-11-07T01:00:00Z"


def test_changed_answer_on_disk_beats_stale_pipeline_copy(repo):
    make_campaign(repo)
    old = Question(id="q1", text="Is it Gravel?", answer="Yes", answeredAt="2026-11-07T00:00:00Z")
    content.create_card("camp", card(questions=[old]))
    on_disk = content.read_card("camp", "gravel-at-the-forge")
    on_disk.questions[0] = Question(id="q1", text="Is it Gravel?", answer="No, Gravelle",
                                    answeredAt="2026-11-07T02:00:00Z")
    content._write_raw("camp", on_disk)
    stale = old.model_copy(update={"appliedAt": "2026-11-07T03:00:00Z"})
    content.update_card("camp", card(questions=[stale]))
    q = content.read_card("camp", "gravel-at-the-forge").questions[0]
    assert q.answer == "No, Gravelle" and q.appliedAt is None
