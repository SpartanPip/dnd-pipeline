import pytest

from dnd_pipeline.hardware import HardwareInfo
from dnd_pipeline.tiers import recommend, tier_for


def mac(memory_gb, apple_silicon=True, disk=200):
    return HardwareInfo(chip="Apple M4", apple_silicon=apple_silicon, memory_gb=memory_gb,
                        free_disk_gb=disk, macos="26.0")


@pytest.mark.parametrize("mem,tier,llm,images", [
    (8, "basic", "gemma4:e2b", None),
    (16, "standard", "gemma4:e4b", "z-image-turbo"),
    (24, "plus", "gemma4:12b", "z-image-turbo"),
    (48, "max", "gemma4:26b", "z-image-turbo"),
    (128, "max", "gemma4:26b", "z-image-turbo"),
])
def test_tier_boundaries(mem, tier, llm, images):
    rec = recommend(mac(mem))
    assert tier_for(mac(mem)) == tier
    assert rec["organizing"].model == llm
    assert rec["images"].model == images


def test_basic_tier_uses_small_whisper_and_explains_no_images():
    rec = recommend(mac(8))
    assert rec["transcription"].model == "mlx-community/whisper-small-mlx"
    assert "memory" in rec["images"].note


def test_standard_and_up_use_turbo_whisper():
    assert recommend(mac(16))["transcription"].model == "mlx-community/whisper-large-v3-turbo"


def test_image_quantization_by_tier():
    assert recommend(mac(16))["images"].quantize == 4
    assert recommend(mac(32))["images"].quantize == 8


def test_intel_mac_cannot_run_anything():
    rec = recommend(mac(64, apple_silicon=False))
    assert tier_for(mac(64, apple_silicon=False)) == "unsupported"
    assert all(choice.model is None for choice in rec.values())
    assert all("can't run" in choice.note for choice in rec.values())


def test_under_8gb_cannot_run_anything():
    assert all(c.model is None for c in recommend(mac(4)).values())


def test_low_disk_warns_on_every_role():
    rec = recommend(mac(32, disk=20))
    assert all("disk" in c.note.lower() for c in rec.values())
