import fs from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { campaignDir } from "@/lib/content/paths";
import { answerQuestion, getArticle, preserveCardFields, saveArticle } from "@/lib/content/articles";
import { deleteSessionAudio, listSessions } from "@/lib/content/sessions";
import { articleSchema } from "@/lib/content/schema";

const SLUG = "zz-test-questions";

beforeAll(async () => {
  await saveArticle(SLUG, {
    title: "Gravel",
    slug: "gravel",
    summary: "A dwarf.",
    body: "Body.",
    origin: "pipeline",
    sessions: [1],
    imageStatus: "pending",
    questions: [
      { id: "q1", text: "Is the name 'Gravel' correct?" },
      { id: "q2", text: "Who paid?" },
    ],
  });
  const dir = `${campaignDir(SLUG)}/sessions/1`;
  await fs.mkdir(`${dir}/audio`, { recursive: true });
  await fs.writeFile(`${dir}/audio/chunk-0001.wav`, "x");
  await fs.writeFile(
    `${dir}/session.json`,
    JSON.stringify({ number: 1, started_at: "2026-11-07T00:00:00Z", status: "done", progress: 1 }),
  );
});

afterAll(async () => {
  await fs.rm(campaignDir(SLUG), { recursive: true, force: true });
});

describe("answering questions", () => {
  it("stores the answer and timestamp, leaving other fields alone", async () => {
    await answerQuestion(SLUG, "gravel", "q1", "It's Gravelle");
    const article = await getArticle(SLUG, "gravel");
    expect(article.questions[0].answer).toBe("It's Gravelle");
    expect(typeof article.questions[0].answeredAt).toBe("string");
    expect(article.questions[1].answer).toBeUndefined();
    expect(article.origin).toBe("pipeline");
    expect(article.sessions).toEqual([1]);
  });

  it("rejects an unknown question id", async () => {
    await expect(answerQuestion(SLUG, "gravel", "nope", "x")).rejects.toThrow(/question/i);
  });
});

describe("editing a pipeline card", () => {
  it("keeps card fields the editor doesn't send", async () => {
    const existing = await getArticle(SLUG, "gravel");
    const merged = articleSchema.parse(
      preserveCardFields(existing, { title: "Gravelle", slug: "gravel", tags: [], summary: "S.", body: "B." }),
    );
    expect(merged.title).toBe("Gravelle");
    expect(merged.origin).toBe("pipeline");
    expect(merged.questions).toHaveLength(2);
    expect(merged.imageStatus).toBe("pending");
  });
});

describe("sessions", () => {
  it("lists sessions and deletes a recording", async () => {
    expect((await listSessions(SLUG)).map((s) => s.number)).toEqual([1]);
    await deleteSessionAudio(SLUG, 1);
    const [session] = await listSessions(SLUG);
    expect(session.has_audio).toBe(false);
    await expect(fs.access(`${campaignDir(SLUG)}/sessions/1/audio`)).rejects.toThrow();
  });
});
