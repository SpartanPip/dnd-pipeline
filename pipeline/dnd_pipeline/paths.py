import os
from pathlib import Path

_DEFAULT_ROOT = Path(__file__).resolve().parents[2]


def repo_root() -> Path:
    return Path(os.environ.get("DND_REPO_ROOT", _DEFAULT_ROOT))


def content_root() -> Path:
    return repo_root() / "content" / "campaigns"


def campaign_dir(slug: str) -> Path:
    return content_root() / slug


def articles_dir(slug: str) -> Path:
    return campaign_dir(slug) / "articles"


def sessions_dir(slug: str) -> Path:
    return campaign_dir(slug) / "sessions"


def uploads_dir(slug: str) -> Path:
    return repo_root() / "public" / "uploads" / slug


def config_path() -> Path:
    return repo_root() / "pipeline.config.json"


def site_root() -> Path:
    """The checked-out repo holding the site's source, regardless of DND_REPO_ROOT."""
    return _DEFAULT_ROOT
