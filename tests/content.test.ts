import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/content/slug";
import { articleSchema, mapCellSchema, campaignSchema } from "@/lib/content/schema";
import { listCampaigns, getCampaign } from "@/lib/content/campaigns";
import { listArticles, getArticle } from "@/lib/content/articles";
import { getMap } from "@/lib/content/map";
import { MAP_ICONS } from "@/lib/icons";

describe("slugify", () => {
  it("lowercases, hyphenates, and strips punctuation", () => {
    expect(slugify("Captain Elowen Vex")).toBe("captain-elowen-vex");
    expect(slugify("  Multiple   Spaces ")).toBe("multiple-spaces");
    expect(slugify("Café & Bar!")).toBe("cafe-bar");
  });
});

describe("schemas", () => {
  it("accepts a well-formed article", () => {
    const result = articleSchema.safeParse({
      title: "Test Article",
      slug: "test-article",
      tags: ["location"],
      summary: "A single sentence summary.",
      body: "Some body text.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(campaignSchema.safeParse({ slug: "Not Valid", title: "X" }).success).toBe(false);
  });

  it("requires a valid map cell shape", () => {
    const result = mapCellSchema.safeParse({
      x: 0,
      y: 0,
      icon: "castle",
      label: "Test Keep",
      search: { tags: ["location"] },
    });
    expect(result.success).toBe(true);
  });
});

describe("seeded example campaign (content/campaigns/sunken-isles)", () => {
  it("lists the campaign among all campaigns", async () => {
    const campaigns = await listCampaigns();
    expect(campaigns.some((c) => c.slug === "sunken-isles")).toBe(true);
  });

  it("loads campaign metadata", async () => {
    const campaign = await getCampaign("sunken-isles");
    expect(campaign.title).toBe("The Sunken Isles");
  });

  it("loads every seeded article with a valid schema", async () => {
    const articles = await listArticles("sunken-isles");
    expect(articles.length).toBeGreaterThanOrEqual(5);
    for (const article of articles) {
      expect(articleSchema.safeParse(article).success).toBe(true);
    }
  });

  it("loads a single article by slug", async () => {
    const article = await getArticle("sunken-isles", "saltmere");
    expect(article.tags).toContain("location");
    expect(article.body).toContain("elowen-vex");
  });

  it("loads the map and every cell uses a known icon", async () => {
    const map = await getMap("sunken-isles");
    expect(map.cells.length).toBeGreaterThan(0);
    for (const cell of map.cells) {
      expect(Object.keys(MAP_ICONS)).toContain(cell.icon);
    }
  });
});

describe("card fields", () => {
  it("defaults new fields on a hand-written article", () => {
    const parsed = articleSchema.parse({
      title: "Old", slug: "old", tags: [], summary: "Old one.", body: "x",
    });
    expect(parsed.origin).toBe("manual");
    expect(parsed.questions).toEqual([]);
    expect(parsed.sessions).toEqual([]);
  });

  it("accepts a pipeline card with every field", () => {
    const result = articleSchema.safeParse({
      title: "Gravel at the forge",
      slug: "gravel-at-the-forge",
      tags: ["gravel", "npc"],
      summary: "Gravel sells the party a cursed lantern.",
      body: "Short.",
      kind: "character",
      origin: "pipeline",
      sessions: [7],
      order: 70003,
      imageStatus: "pending",
      imageNotes: "stout dwarf, soot-stained apron",
      questions: [
        { id: "q1", text: "Is the name 'Gravel' correct?" },
        { id: "q2", text: "Who paid?", answer: "Kael", answeredAt: "2026-11-07T00:00:00Z" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown card kind", () => {
    const result = articleSchema.safeParse({
      title: "X", slug: "x", summary: "X.", body: "", kind: "vehicle",
    });
    expect(result.success).toBe(false);
  });
});
