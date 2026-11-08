import pytest


@pytest.fixture
def repo(tmp_path, monkeypatch):
    (tmp_path / "content" / "campaigns").mkdir(parents=True)
    (tmp_path / "public" / "uploads").mkdir(parents=True)
    monkeypatch.setenv("DND_REPO_ROOT", str(tmp_path))
    return tmp_path
