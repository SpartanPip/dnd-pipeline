from fastapi.testclient import TestClient

from dnd_pipeline import sessions
from dnd_pipeline.pipeline import Deps
from dnd_pipeline.server import Worker, create_app


class FakeRecorder:
    instances = []

    def __init__(self, out_dir, on_chunk):
        self.out_dir, self.on_chunk, self.stopped = out_dir, on_chunk, False
        FakeRecorder.instances.append(self)

    def start(self):
        (self.out_dir / "chunk-0001.wav").write_bytes(b"")
        self.on_chunk(self.out_dir / "chunk-0001.wav")

    def stop(self):
        self.stopped = True


def make(repo, ran=None):
    (repo / "content/campaigns/camp").mkdir(parents=True)
    ran = ran if ran is not None else []

    def runner(slug, n, deps):
        ran.append((slug, n))
        meta = sessions.load_meta(slug, n)
        meta.status = "done"
        sessions.save_meta(slug, meta)

    worker = Worker(recorder_factory=FakeRecorder, deps_factory=lambda: Deps(), post_session=runner)
    return worker, TestClient(create_app(worker)), ran


def test_health(repo):
    _, client, _ = make(repo)
    assert client.get("/health").json()["ok"] is True


def test_start_stop_queues_processing(repo):
    worker, client, ran = make(repo)
    r = client.post("/sessions/start", json={"campaign": "camp"})
    assert r.status_code == 200 and r.json()["number"] == 1
    assert client.get("/status").json()["recording"] == {"campaign": "camp", "session": 1}
    assert client.post("/sessions/start", json={"campaign": "camp"}).status_code == 409
    assert client.post("/sessions/stop").status_code == 200
    worker.wait_idle()
    assert ran == [("camp", 1)]
    assert FakeRecorder.instances[-1].stopped
    assert client.get("/status").json()["recording"] is None
    assert sessions.load_meta("camp", 1).ended_at


def test_stop_without_recording_is_409(repo):
    _, client, _ = make(repo)
    assert client.post("/sessions/stop").status_code == 409


def test_unknown_campaign_is_404(repo):
    _, client, _ = make(repo)
    assert client.post("/sessions/start", json={"campaign": "nope"}).status_code == 404


def test_reprocess_endpoint(repo):
    worker, client, ran = make(repo)
    sessions.new_session("camp")
    assert client.post("/campaigns/camp/sessions/1/process").status_code == 202
    worker.wait_idle()
    assert ran == [("camp", 1)]


def test_recover_queues_interrupted_sessions(repo):
    (repo / "content/campaigns/camp").mkdir(parents=True)
    a = sessions.new_session("camp")
    b = sessions.new_session("camp")
    b.status = "organizing"
    sessions.save_meta("camp", b)
    ran = []
    worker = Worker(recorder_factory=FakeRecorder, deps_factory=lambda: Deps(),
                    post_session=lambda s, n, d: ran.append((s, n)))
    worker.recover()
    worker.wait_idle()
    assert sorted(ran) == [("camp", a.number), ("camp", b.number)]
    assert sessions.load_meta("camp", a.number).ended_at


def test_path_traversal_campaign_rejected(repo):
    _, client, _ = make(repo)
    assert client.post("/sessions/start", json={"campaign": "../camp"}).status_code == 404
    assert client.post("/campaigns/..%2Fx/sessions/1/process").status_code == 404


def test_reprocess_done_session_starts_organizing_over(repo):
    worker, client, ran = make(repo)
    meta = sessions.new_session("camp")
    meta.status = "done"
    sessions.save_meta("camp", meta)
    st = sessions.load_state("camp", 1)
    st.transcribed, st.organized_windows, st.images_done, st.answers_applied = ["chunk-0001.wav"], 3, True, True
    sessions.save_state("camp", 1, st)
    client.post("/campaigns/camp/sessions/1/process")
    worker.wait_idle()
    st = sessions.load_state("camp", 1)
    assert st.organized_windows == 0 and not st.images_done and not st.answers_applied
    assert st.transcribed == ["chunk-0001.wav"]
