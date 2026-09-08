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
  return matter.stringify(body.trim() + "\n", frontmatter);
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
