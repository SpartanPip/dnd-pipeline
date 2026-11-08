import httpx
import pytest

from dnd_pipeline.llm import LLM, LLMError, LLMUnavailable

SCHEMA = {"title": "Out", "type": "object"}


def respond(monkeypatch, status, body):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(status, json=body,
                                                                       request=httpx.Request("POST", "http://x")))


@pytest.mark.parametrize("status", [404, 501])
def test_unsupported_model_is_unavailable_not_bad_output(monkeypatch, status):
    respond(monkeypatch, status, {"error": "structured output is unavailable"})
    with pytest.raises(LLMUnavailable, match="structured output is unavailable"):
        LLM("m").json("s", "u", SCHEMA)


def test_unparseable_content_is_llm_error_with_response(monkeypatch):
    respond(monkeypatch, 200, {"message": {"content": "not json"}})
    with pytest.raises(LLMError, match="not json"):
        LLM("m").json("s", "u", SCHEMA)


def test_valid_content_is_parsed(monkeypatch):
    respond(monkeypatch, 200, {"message": {"content": '{"a": 1}'}})
    assert LLM("m").json("s", "u", SCHEMA) == {"a": 1}


def test_truncated_output_is_llm_error(monkeypatch):
    respond(monkeypatch, 200, {"message": {"content": '{"a": '}, "done_reason": "length", "eval_count": 16000})
    with pytest.raises(LLMError, match="token limit"):
        LLM("m").json("s", "u", SCHEMA)


def test_thinking_is_disabled(monkeypatch):
    sent = {}

    def post(url, json, timeout):
        sent.update(json)
        return httpx.Response(200, json={"message": {"content": "{}"}}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", post)
    LLM("m").json("s", "u", SCHEMA)
    assert sent["think"] is False
