/**
 * Read/write access to `content/campaigns/<slug>/articles/*.md`.
 *
 * Each article file is Markdown with YAML frontmatter (parsed by
 * `gray-matter`). The frontmatter + body together validate against
 * `articleSchema`.
 */
import fs from "node:fs/promises";
import matter from "gray-matter";
import { articlesDir, articlePath } from "./paths";
import { articleSchema, type Article } from "./schema";

const CARD_FIELDS = [
  "kind",
  "origin",
  "sessions",
  "order",
  "imageStatus",
  "imageNotes",
  "questions",
] as const;

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function serialize(article: Article): string {
  const { body, ...frontmatter } = article;
  // js-yaml can't dump undefined, which optional fields (e.g. a cleared appliedAt) produce.
  return matter.stringify(body.trim() + "\n", JSON.parse(JSON.stringify(frontmatter)));
}

/** List every article in a campaign, sorted alphabetically by title. */
export async function listArticles(campaignSlug: string): Promise<Article[]> {
  const dir = articlesDir(campaignSlug);
  if (!(await pathExists(dir))) return [];

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));

  const articles = await Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(`${dir}/${file}`, "utf-8");
      const { data, content } = matter(raw);
      try {
        return articleSchema.parse({ ...data, body: content });
      } catch {
        return null; // skip malformed files rather than crashing the page
      }
    }),
  );

  return articles
    .filter((a): a is Article => a !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getArticle(
  campaignSlug: string,
  articleSlug: string,
): Promise<Article> {
  const raw = await fs.readFile(articlePath(campaignSlug, articleSlug), "utf-8");
  const { data, content } = matter(raw);
  return articleSchema.parse({ ...data, body: content });
}

export async function articleExists(
  campaignSlug: string,
  articleSlug: string,
): Promise<boolean> {
  return pathExists(articlePath(campaignSlug, articleSlug));
}

/** Create or overwrite an article file. Used by the UI and the ramble skill. */
export async function saveArticle(
  campaignSlug: string,
  input: unknown,
): Promise<Article> {
  const article = articleSchema.parse(input);
  await fs.mkdir(articlesDir(campaignSlug), { recursive: true });
  await fs.writeFile(
    articlePath(campaignSlug, article.slug),
    serialize(article),
    "utf-8",
  );
  return article;
}

export async function deleteArticle(
  campaignSlug: string,
  articleSlug: string,
): Promise<void> {
  await fs.rm(articlePath(campaignSlug, articleSlug), { force: true });
}

/** Fill in card fields an update omitted, so editing a pipeline card keeps its questions and status. */
export function preserveCardFields(
  existing: Article,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };
  for (const field of CARD_FIELDS) {
    if (!(field in merged) && existing[field] !== undefined) merged[field] = existing[field];
  }
  return merged;
}

export async function answerQuestion(
  campaignSlug: string,
  articleSlug: string,
  questionId: string,
  answer: string,
): Promise<Article> {
  const article = await getArticle(campaignSlug, articleSlug);
  if (!article.questions.some((q) => q.id === questionId)) {
    throw new Error(`Unknown question ${questionId}`);
  }
  const questions = article.questions.map((q) =>
    q.id === questionId
      ? { ...q, answer: answer.trim(), answeredAt: new Date().toISOString(), appliedAt: undefined }
      : q,
  );
  return saveArticle(campaignSlug, { ...article, questions });
}
