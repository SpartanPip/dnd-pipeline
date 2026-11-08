from dnd_pipeline.setup_cli import config_from_choices, resolve_answer
from dnd_pipeline.tiers import ModelChoice


def test_enter_accepts_recommendation():
    assert resolve_answer("", ModelChoice("organizing", "gemma4:12b")) == "gemma4:12b"


def test_none_disables_role():
    assert resolve_answer(" none ", ModelChoice("images", "z-image-turbo")) is None


def test_typed_model_overrides():
    assert resolve_answer("qwen3:8b", ModelChoice("organizing", "gemma4:12b")) == "qwen3:8b"


def test_config_from_choices_keeps_quantize():
    cfg = config_from_choices(
        {"transcription": "w", "organizing": "o", "images": "z-image-turbo"},
        {"images": ModelChoice("images", "z-image-turbo", quantize=4)},
        tier="standard",
    )
    assert cfg.image_quantize == 4 and cfg.tier == "standard" and cfg.organizing == "o"
