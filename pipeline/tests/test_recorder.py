from dnd_pipeline.recorder import Recorder


def test_callback_errors_are_captured_not_raised(tmp_path):
    rec = Recorder(tmp_path, on_chunk=lambda p: None)

    class Broken:
        def write(self, data):
            raise OSError("disk full")

    rec._file = Broken()

    class Data:
        def copy(self):
            return b""

    rec._callback(Data(), 160, None, None)
    assert "disk full" in rec.health()["error"]
