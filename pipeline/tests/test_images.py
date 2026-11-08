from dnd_pipeline import content, images
from dnd_pipeline.content import Card

from .fakes import FakeImages, FakeLLM


def setup(repo):
    d = repo / "content/campaigns/camp/articles"
    d.mkdir(parents=True)
    content.create_card("camp", Card(title="Gravel", slug="gravel", summary="A dwarf.", origin="pipeline",
                                     sessions=[1], imageStatus="pending", imageNotes="stout dwarf"))
    content.create_card("camp", Card(title="Fog", slug="fog", summary="Fog rolls in.", origin="pipeline",
                                     sessions=[1], imageStatus="pending"))


def test_only_cards_with_enough_detail_get_images(repo):
    setup(repo)
    llm = FakeLLM({"detail": [{"enough_detail": False, "prompt": ""}, {"enough_detail": True, "prompt": "a stout dwarf smith"}]})
    gen = FakeImages()
    assert images.process_pending("camp", gen, llm) == 1
    fog, gravel = content.read_card("camp", "fog"), content.read_card("camp", "gravel")
    assert fog.imageStatus == "pending" and fog.image is None
    assert gravel.imageStatus == "generated" and gravel.image.startswith("/uploads/camp/gravel-")
    assert (repo / "public" / gravel.image.lstrip("/")).exists()
    assert images.STYLE in gen.prompts[0] and "stout dwarf smith" in gen.prompts[0]


def test_generated_images_are_not_regenerated(repo):
    setup(repo)
    llm = FakeLLM({"detail": [{"enough_detail": True, "prompt": "p"}] * 2})
    images.process_pending("camp", FakeImages(), llm)
    assert images.process_pending("camp", FakeImages(), FakeLLM({})) == 0


def test_redraw_records_change_and_replaces_image(repo):
    setup(repo)
    llm = FakeLLM({"detail": [{"enough_detail": True, "prompt": "dwarf with eyepatch"}]})
    gen = FakeImages()
    images.redraw("camp", "gravel", "now wears an eyepatch", gen, llm)
    card = content.read_card("camp", "gravel")
    assert "eyepatch" in card.imageNotes and card.imageStatus == "generated"
    assert "eyepatch" in llm.calls[0][1]


def test_render_keeps_edits_made_while_drawing(repo):
    setup(repo)

    class EditingImages(FakeImages):
        def generate(self, prompt, out_path, seed=0):
            c = content.read_card("camp", "gravel")
            content.update_card("camp", c.model_copy(update={"title": "Gravelle the Smith"}))
            super().generate(prompt, out_path, seed)

    llm = FakeLLM({"detail": [{"enough_detail": False}, {"enough_detail": True, "prompt": "dwarf"}]})
    images.process_pending("camp", EditingImages(), llm)
    card = content.read_card("camp", "gravel")
    assert card.title == "Gravelle the Smith" and card.imageStatus == "generated"
