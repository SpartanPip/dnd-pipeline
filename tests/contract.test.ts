import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { articleSchema } from "@/lib/content/schema";

describe("python pipeline contract", () => {
  it("accepts a card written by pipeline/dnd_pipeline/content.py", () => {
    const raw = fs.readFileSync(path.join(import.meta.dirname, "fixtures/pipeline-card.md"), "utf-8");
    const { data, content } = matter(raw);
    const result = articleSchema.safeParse({ ...data, body: content });
    expect(result.success).toBe(true);
    expect(result.data?.origin).toBe("pipeline");
    expect(result.data?.questions[0].id).toBe("q1");
  });
});
