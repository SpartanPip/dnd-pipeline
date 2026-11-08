from dnd_pipeline import sessions


def test_new_sessions_number_upward(repo):
    (repo / "content/campaigns/camp").mkdir(parents=True)
    assert sessions.new_session("camp").number == 1
    s2 = sessions.new_session("camp")
    assert s2.number == 2
    assert (sessions.session_dir("camp", 2) / "audio").is_dir()
    assert [m.number for m in sessions.list_sessions("camp")] == [1, 2]


def test_state_and_transcript_round_trip(repo):
    (repo / "content/campaigns/camp").mkdir(parents=True)
    meta = sessions.new_session("camp")
    st = sessions.load_state("camp", meta.number)
    st.organized_windows = 2
    sessions.save_state("camp", meta.number, st)
    assert sessions.load_state("camp", meta.number).organized_windows == 2
    sessions.append_transcript("camp", 1, "chunk-0002.wav", [{"start": 1.0, "end": 2.0, "text": " Hi "}], offset=30)
    assert sessions.read_transcript("camp", 1) == [{"chunk": "chunk-0002.wav", "start": 31.0, "end": 32.0, "text": "Hi"}]


def test_transcribe_pending_skips_done_chunks(repo):
    (repo / "content/campaigns/camp").mkdir(parents=True)
    meta = sessions.new_session("camp")
    audio = sessions.session_dir("camp", meta.number) / "audio"
    for i in (1, 2):
        (audio / f"chunk-{i:04d}.wav").write_bytes(b"")

    class T:
        calls = []

        def transcribe_chunk(self, path, names):
            self.calls.append((path.name, tuple(names)))
            return [{"start": 0.0, "end": 1.0, "text": path.stem}]

    t = T()
    st = sessions.load_state("camp", 1)
    st.transcribed = ["chunk-0001.wav"]
    sessions.save_state("camp", 1, st)
    sessions.transcribe_pending("camp", 1, t, ["Elara"], chunk_seconds=30)
    assert t.calls == [("chunk-0002.wav", ("Elara",))]
    assert sessions.read_transcript("camp", 1)[0]["start"] == 30.0
