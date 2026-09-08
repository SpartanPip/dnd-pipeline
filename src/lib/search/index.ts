/**
 * Smart search over a campaign's articles, built with MiniSearch.
 *
 * Field boosting favors title > tags > summary > body, and both fuzzy and
 * prefix matching are enabled so partial/typo'd queries still surface
 * relevant articles — this is what powers both the dedicated Search page
 * and the live autocomplete dropdown.
 */
import MiniSearch, { type SearchResult } from "minisearch";
import type { Article } from "@/lib/content/schema";

interface SearchDoc {
  id: string;
  title: string;
  tags: string;
  summary: string;
  body: string;
}

export interface ArticleSearchResult {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  image?: string;
  score: number;
}

const SEARCH_OPTIONS = {
  fuzzy: 0.2,
  prefix: true,
  boost: { title: 3, tags: 2, summary: 1.5, body: 1 },
};

function toDoc(article: Article): SearchDoc {
  return {
    id: article.slug,
    title: article.title,
    tags: article.tags.join(" "),
    summary: article.summary,
    body: article.body,
  };
}

export function buildArticleIndex(articles: Article[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    idField: "id",
    fields: ["title", "tags", "summary", "body"],
    storeFields: ["title", "summary"],
  });
  index.addAll(articles.map(toDoc));
  return index;
}

function toArticleResult(
  result: SearchResult,
  byId: Map<string, Article>,
): ArticleSearchResult {
  const article = byId.get(result.id);
  return {
    slug: result.id,
    title: (result.title as string) ?? article?.title ?? result.id,
    summary: (result.summary as string) ?? article?.summary ?? "",
    tags: article?.tags ?? [],
    image: article?.image,
    score: result.score,
  };
}

/**
 * Search a campaign's articles by free text and/or exact tag filters.
 * An empty query returns every article (still respecting tag filters),
 * which is what powers "browse by tag" navigation from the map and from
 * tag badges on article pages.
 */
export function searchArticles(
  articles: Article[],
  query: string,
  filterTags: string[] = [],
): ArticleSearchResult[] {
  const byId = new Map(articles.map((a) => [a.slug, a]));
  const trimmed = query.trim();

  let results: ArticleSearchResult[];
  if (trimmed) {
    const index = buildArticleIndex(articles);
    results = index.search(trimmed, SEARCH_OPTIONS).map((r) => toArticleResult(r, byId));
  } else {
    results = articles
      .map((a) => ({
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        tags: a.tags,
        image: a.image,
        score: 1,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filterTags.length > 0) {
    results = results.filter((r) => filterTags.every((t) => r.tags.includes(t)));
  }

  return results;
}

/** Live autocomplete suggestions for the search box, capped to `limit`. */
export function suggestArticles(
  articles: Article[],
  query: string,
  limit = 6,
): ArticleSearchResult[] {
  if (!query.trim()) return [];
  return searchArticles(articles, query).slice(0, limit);
}

/**
 * Related-article recommendations by tag overlap, used on article pages so
 * readers always have another link to follow (requirement: articles should
 * help readers navigate via links to other articles).
 */
export function relatedArticles(
  article: Article,
  allArticles: Article[],
  limit = 4,
): Article[] {
  return allArticles
    .filter((a) => a.slug !== article.slug)
    .map((a) => ({
      article: a,
      overlap: a.tags.filter((t) => article.tags.includes(t)).length,
    }))
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((entry) => entry.article);
}

/** Every distinct tag across a campaign's articles, sorted alphabetically. */
export function allTags(articles: Article[]): string[] {
  const set = new Set<string>();
  for (const article of articles) {
    for (const tag of article.tags) set.add(tag);
  }
  return Array.from(set).sort();
}
