from dnd_pipeline import content, organize, sessions
from dnd_pipeline.content import Card, Question

from .fakes import FakeLLM


def setup_session(repo, lines):
    d = repo / "content/campaigns/camp"
    (d / "articles").mkdir(parents=True)
    (d / "campaign.json").write_text('{"slug": "camp", "title": "Camp"}')
    meta = sessions.new_session("camp")
    sessions.append_transcript("camp", meta.number, "chunk-0001.wav",
                               [{"start": float(i), "end": float(i) + 1, "text": t} for i, t in enumerate(lines)], 0)
    return meta.number


def card_out(title, kind="character", **kw):
    base = {"title": title, "kind": kind, "summary": f"{title} summary.", "body": f"{title} body.",
            "tags": [], "characters": [], "links": [], "questions": [], "appearance": "", "map_icon": ""}
    base.update(kw)
    return base


def test_windows_split_by_size():
    lines = [{"start": i * 60.0, "text": "x" * 50} for i in range(10)]
    ws = organize.windows(lines, max_chars=200)
    assert len(ws) > 1
    assert ws[0].startswith("[00:00]")


def test_organize_creates_cards_with_provenance(repo):
    n = setup_session(repo, ["Gravel the dwarf sells a lantern.", "Elara buys it."])
    llm = FakeLLM({"extract": [{
        "cards": [card_out("Gravel", characters=["Gravel"], questions=["Is the name 'Gravel' correct?"],
                           appearance="stout dwarf, soot apron", links=["Lantern Deal"]),
                  card_out("Lantern Deal", kind="event", characters=["Gravel", "Elara"])],
        "new_names": ["Gravel"],
    }]})
    organize.organize_session("camp", n, llm)
    gravel = content.read_card("camp", "gravel")
    deal = content.read_card("camp", "lantern-deal")
    assert gravel.origin == "pipeline" and gravel.sessions == [n] and gravel.imageStatus == "pending"
    assert gravel.order == n * 10000 and deal.order == n * 10000 + 1
    assert gravel.imageNotes == "stout dwarf, soot apron"
    assert gravel.questions[0].text == "Is the name 'Gravel' correct?"
    assert "/campaigns/camp/articles/lantern-deal" in gravel.body
    assert "gravel" in deal.tags and "elara" in deal.tags and "event" in deal.tags
    assert [k.name for k in content.read_names("camp").known] == ["Gravel"]


def test_place_cards_get_map_cells(repo):
    n = setup_session(repo, ["They reach Millbrook."])
    llm = FakeLLM({"extract": [{"cards": [card_out("Millbrook", kind="place", map_icon="village")], "new_names": []}]})
    organize.organize_session("camp", n, llm)
    cells = content.read_map("camp")
    assert cells[0].articleSlug == "millbrook" and cells[0].icon == "village"


def test_card_body_trimmed_to_word_limit(repo):
    n = setup_session(repo, ["Long."])
    llm = FakeLLM({"extract": [{"cards": [card_out("Wordy", body="word " * 200)], "new_names": []}]})
    organize.organize_session("camp", n, llm)
    assert len(content.read_card("camp", "wordy").body.split()) <= content.CARD_WORD_LIMIT + 1


def test_bad_json_retried_once_then_skipped(repo):
    n = setup_session(repo, ["a"] * 3)
    llm = FakeLLM({"extract": ["oops", "oops again"]})
    organize.organize_session("camp", n, llm)
    assert [c[0] for c in llm.calls] == ["extract", "extract"]
    assert sessions.load_state("camp", n).organized_windows == 1


def test_resume_does_not_repeat_finished_windows(repo):
    n = setup_session(repo, ["first " * 30, "second " * 30])
    st = sessions.load_state("camp", n)
    st.organized_windows = 1
    sessions.save_state("camp", n, st)
    llm = FakeLLM({"extract": [{"cards": [card_out("B")], "new_names": []}]})
    organize.organize_session("camp", n, llm, max_chars=200)
    assert len(llm.calls) == 1
    assert "second" in llm.calls[0][1] and "first first" not in llm.calls[0][1]


def test_same_title_same_session_merges(repo):
    n = setup_session(repo, ["x " * 120, "y " * 120])
    llm = FakeLLM({
        "extract": [{"cards": [card_out("Gravel", questions=["Q1?"])], "new_names": []},
                    {"cards": [card_out("Gravel", questions=["Q2?"])], "new_names": []}],
        "merge": [{"summary": "Merged.", "body": "Merged body.", "appearance": "beard"}],
    })
    organize.organize_session("camp", n, llm, max_chars=300)
    cards = [c for c in content.list_cards("camp") if c.title == "Gravel"]
    assert len(cards) == 1
    assert cards[0].body.strip() == "Merged body."
    assert [q.text for q in cards[0].questions] == ["Q1?", "Q2?"]


def test_same_title_earlier_session_makes_new_snapshot(repo):
    n = setup_session(repo, ["x"])
    content.create_card("camp", Card(title="Gravel", slug="gravel", summary="Old.", origin="pipeline", sessions=[n - 1 or 99]))
    llm = FakeLLM({"extract": [{"cards": [card_out("Gravel")], "new_names": []}]})
    organize.organize_session("camp", n, llm)
    assert content.read_card("camp", "gravel").summary == "Old."
    assert content.read_card("camp", "gravel-2").sessions == [n]


def test_apply_answers_renames_and_marks_applied(repo):
    setup_session(repo, ["x"])
    content.write_names("camp", content.Names(known=[{"name": "Gravel"}]))
    q = Question(id="q1", text="Is the name 'Gravel' correct?", answer="It's Gravelle", answeredAt="2026-11-07T00:00:00Z")
    content.create_card("camp", Card(title="Gravel", slug="gravel", summary="Gravel sells.", body="Gravel sells a lantern.",
                                     origin="pipeline", sessions=[1], questions=[q]))
    content.create_card("camp", Card(title="Deal", slug="deal", summary="Deal with Gravel.", body="Gravel and Elara.",
                                     origin="pipeline", sessions=[1]))
    llm = FakeLLM({"apply": [{"title": "Gravelle", "summary": "Gravelle sells.", "body": "Gravelle sells a lantern.",
                              "appearance": "", "renames": [{"from": "Gravel", "to": "Gravelle"}]}]})
    assert organize.apply_answers("camp", llm) == 1
    card = content.read_card("camp", "gravel")
    assert card.title == "Gravelle" and card.questions[0].appliedAt
    assert "Gravelle and Elara" in content.read_card("camp", "deal").body
    names = content.read_names("camp").known
    assert names[0].name == "Gravelle" and "Gravel" in names[0].aliases
    assert organize.apply_answers("camp", llm) == 0


def test_cards_with_missing_keys_or_bad_kind_are_kept_or_dropped_not_fatal(repo):
    n = setup_session(repo, ["x"])
    llm = FakeLLM({"extract": [{"cards": [
        {"title": "Odd", "kind": "battle", "summary": "S.", "body": "B."},
        {"kind": "event"},
    ]}]})
    organize.organize_session("camp", n, llm)
    odd = content.read_card("camp", "odd")
    assert odd.kind == "other" and odd.questions == []
    assert len(content.list_cards("camp")) == 1


def test_unreachable_llm_fails_session_without_skipping(repo):
    import pytest
    from dnd_pipeline.llm import LLMUnavailable

    n = setup_session(repo, ["x"])

    class Down:
        def json(self, *a):
            raise LLMUnavailable("connection refused")

    with pytest.raises(LLMUnavailable):
        organize.organize_session("camp", n, Down())
    assert sessions.load_state("camp", n).organized_windows == 0


def test_skipped_windows_are_recorded(repo):
    n = setup_session(repo, ["a"])
    organize.organize_session("camp", n, FakeLLM({"extract": ["bad", "bad"]}))
    assert sessions.load_state("camp", n).skipped_windows == [0]


def test_apply_answers_rereads_cards_renamed_earlier_in_the_loop(repo):
    setup_session(repo, ["x"])
    content.write_names("camp", content.Names(known=[{"name": "Gravel"}]))
    qa = lambda i: Question(id=i, text="?", answer="yes", answeredAt="2026-11-07T00:00:00Z")
    content.create_card("camp", Card(title="A Gravel", slug="a", summary="Gravel.", body="Gravel.",
                                     origin="pipeline", questions=[qa("q1")]))
    content.create_card("camp", Card(title="B", slug="b", summary="With Gravel.", body="Gravel again.",
                                     origin="pipeline", questions=[qa("q2")]))
    rename = {"title": "A Gravelle", "summary": "Gravelle.", "body": "Gravelle.", "appearance": "",
              "renames": [{"from": "Gravel", "to": "Gravelle"}]}
    keep = {"title": "B", "summary": "With Gravelle.", "body": "Gravelle again.", "appearance": "", "renames": []}
    llm = FakeLLM({"apply": [rename, keep]})
    organize.apply_answers("camp", llm)
    assert "Gravelle again" in llm.calls[1][1]
