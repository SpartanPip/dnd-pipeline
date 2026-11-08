import { describe, expect, it } from "vitest";
import { articleSchema } from "@/lib/content/schema";
import { timelineEvents } from "@/lib/timeline";

const a = (slug: string, extra: object) =>
  articleSchema.parse({ title: slug, slug, summary: "S.", body: "", ...extra });

describe("timelineEvents", () => {
  it("keeps only events, in story order, grouped by session", () => {
    const groups = timelineEvents([
      a("late", { kind: "event", sessions: [2], order: 20001 }),
      a("npc", { kind: "character", sessions: [1], order: 10000 }),
      a("second", { kind: "event", sessions: [1], order: 10005 }),
      a("first", { kind: "event", sessions: [1], order: 10001 }),
    ]);
    expect(groups.map((g) => g.session)).toEqual([1, 2]);
    expect(groups[0].events.map((e) => e.slug)).toEqual(["first", "second"]);
  });
});
