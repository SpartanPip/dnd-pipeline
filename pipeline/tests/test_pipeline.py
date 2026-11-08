from dnd_pipeline import content, pipeline, sessions
from dnd_pipeline.pipeline import Deps

from .fakes import FakeImages, FakeLLM


class FakeTranscriber:
    def transcribe_chunk(self, path, names):
        return [{"start": 0.0, "end": 1.0, "text": "Gravel the stout bearded dwarf sells a lantern."}]


def setup(repo):
    d = repo / "content/campaigns/camp/articles"
    d.mkdir(parents=True)
    meta = sessions.new_session("camp")
    (sessions.audio_dir("camp", meta.number) / "chunk-0001.wav").write_bytes(b"")
    return meta.number


def extract():
    return {"cards": [{"title": "Gravel", "kind": "character", "summary": "A dwarf.", "body": "Sells a lantern.",
                       "tags": [], "characters": ["Gravel"], "links": [], "questions": [],
                       "appearance": "stout, bearded", "map_icon": ""}], "new_names": ["Gravel"]}


def test_full_run_marks_done(repo):
    n = setup(repo)
    deps = Deps(transcriber=FakeTranscriber(), llm=FakeLLM({"extract": [extract()],
                "detail": [{"enough_detail": True, "prompt": "dwarf"}]}), images=FakeImages())
    pipeline.run_post_session("camp", n, deps)
    meta = sessions.load_meta("camp", n)
    assert meta.status == "done" and meta.progress == 1.0
    assert content.read_card("camp", "gravel").imageStatus == "generated"
    st = sessions.load_state("camp", n)
    assert st.answers_applied and st.images_done


def test_missing_models_skip_steps_with_message(repo):
    n = setup(repo)
    pipeline.run_post_session("camp", n, Deps())
    meta = sessions.load_meta("camp", n)
    assert meta.status == "done"
    assert "skipped" in meta.message.lower()


def test_rerun_after_done_does_not_redo_work(repo):
    n = setup(repo)
    deps = Deps(transcriber=FakeTranscriber(), llm=FakeLLM({"extract": [extract()],
                "detail": [{"enough_detail": False, "prompt": ""}]}), images=FakeImages())
    pipeline.run_post_session("camp", n, deps)
    again = Deps(transcriber=FakeTranscriber(), llm=FakeLLM({}), images=FakeImages())
    pipeline.run_post_session("camp", n, again)
    assert again.llm.calls == []
    assert len(content.list_cards("camp")) == 1


def test_error_is_recorded_on_session(repo):
    n = setup(repo)

    class Boom:
        def transcribe_chunk(self, path, names):
            raise RuntimeError("mic exploded")

    pipeline.run_post_session("camp", n, Deps(transcriber=Boom()))
    meta = sessions.load_meta("camp", n)
    assert meta.status == "error" and "mic exploded" in meta.error


def test_skipped_parts_reported_in_message(repo):
    n = setup(repo)
    pipeline.run_post_session("camp", n, Deps(transcriber=FakeTranscriber(), llm=FakeLLM({"extract": ["x", "x"]})))
    assert "1 part" in sessions.load_meta("camp", n).message
