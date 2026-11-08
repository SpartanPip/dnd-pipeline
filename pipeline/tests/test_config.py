from dnd_pipeline.config import Config, load_config, save_config


def test_missing_config_has_no_models(repo):
    cfg = load_config()
    assert cfg.transcription is None and cfg.organizing is None and cfg.images is None


def test_config_round_trip(repo):
    cfg = Config(transcription="mlx-community/whisper-large-v3-turbo", organizing="gemma4:12b",
                 images="z-image-turbo", image_quantize=8, tier="plus")
    save_config(cfg)
    assert (repo / "pipeline.config.json").exists()
    assert load_config() == cfg
