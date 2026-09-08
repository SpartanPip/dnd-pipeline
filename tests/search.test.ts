import { describe, expect, it } from "vitest";
import { searchArticles, suggestArticles, relatedArticles, allTags } from "@/lib/search";
import type { Article } from "@/lib/content/schema";

const articles: Article[] = [
  {
    title: "Ravenspire Keep",
    slug: "ravenspire-keep",
    tags: ["location", "castle"],
    summary: "A half-drowned fortress loyal only to itself.",
    body: "A fortress on the tallest of the Sunken Isles.",
  },
  {
    title: "Captain Elowen Vex",
    slug: "elowen-vex",
    tags: ["npc", "pirate"],
    summary: "The unofficial ruler of Saltmere.",
    body: "Captains the Grey Petrel and holds influence over Saltmere.",
  },
  {
    title: "Saltmere",
    slug: "saltmere",
    tags: ["location", "port-city"],
    summary: "The last free port in the Sunken Isles.",
    body: "Home base for the party, run by a council of captains.",
  },
];

describe("searchArticles", () => {
  it("returns every article for an empty query", () => {
    expect(searchArticles(articles, "").map((r) => r.slug).sort()).toEqual(
      ["elowen-vex", "ravenspire-keep", "saltmere"].sort(),
    );
  });

  it("ranks a title match at or near the top", () => {
    const results = searchArticles(articles, "Ravenspire");
    expect(results[0]?.slug).toBe("ravenspire-keep");
  });

  it("matches on tags", () => {
    const results = searchArticles(articles, "pirate");
    expect(results.some((r) => r.slug === "elowen-vex")).toBe(true);
  });

  it("tolerates a small typo (fuzzy matching)", () => {
    const results = searchArticles(articles, "Saltmear");
    expect(results.some((r) => r.slug === "saltmere")).toBe(true);
  });

  it("filters by tag regardless of query", () => {
    const results = searchArticles(articles, "", ["location"]);
    expect(results.map((r) => r.slug).sort()).toEqual(["ravenspire-keep", "saltmere"].sort());
  });

  it("combines a text query with a tag filter", () => {
    const results = searchArticles(articles, "keep", ["location"]);
    expect(results.map((r) => r.slug)).toEqual(["ravenspire-keep"]);
  });
});

describe("suggestArticles", () => {
  it("returns no suggestions for an empty query", () => {
    expect(suggestArticles(articles, "")).toEqual([]);
  });

  it("caps suggestions to the requested limit", () => {
    expect(suggestArticles(articles, "a", 1)).toHaveLength(1);
  });
});

describe("relatedArticles", () => {
  it("recommends articles that share a tag, excluding itself", () => {
    const related = relatedArticles(articles[0]!, articles);
    expect(related.map((a) => a.slug)).toContain("saltmere");
    expect(related.map((a) => a.slug)).not.toContain("ravenspire-keep");
  });
});

describe("allTags", () => {
  it("returns every distinct tag, sorted", () => {
    expect(allTags(articles)).toEqual(
      ["castle", "location", "npc", "pirate", "port-city"].sort(),
    );
  });
});
