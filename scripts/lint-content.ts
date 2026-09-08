/**
 * Soft content-quality check: validates every campaign/article/map file
 * against the Zod schemas and flags articles over the half-page word
 * guideline. Warnings only — never fails the build — run it manually or in
 * CI as a nudge. Usage: `pnpm lint:content`.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { listCampaigns } from "../src/lib/content/campaigns";
import { listArticles } from "../src/lib/content/articles";
import { getMap } from "../src/lib/content/map";
import { wordCount } from "../src/lib/content/markdown";
import { ARTICLE_WORD_LIMIT } from "../src/lib/content/schema";
import { MAP_ICONS } from "../src/lib/icons";
import { CONTENT_ROOT } from "../src/lib/content/paths";

async function main() {
  const warnings: string[] = [];

  let slugs: string[] = [];
  try {
    slugs = (await fs.readdir(CONTENT_ROOT, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    console.log("No content/campaigns directory yet — nothing to lint.");
    return;
  }

  for (const slug of slugs) {
    const articles = await listArticles(slug);
    for (const article of articles) {
      const words = wordCount(article.body);
      if (words > ARTICLE_WORD_LIMIT) {
        warnings.push(
          `[${slug}/${article.slug}] ${words} words (limit ~${ARTICLE_WORD_LIMIT}) — trim to half a page.`,
        );
      }
    }

    const map = await getMap(slug);
    for (const cell of map.cells) {
      if (!(cell.icon in MAP_ICONS)) {
        warnings.push(
          `[${slug}] map cell (${cell.x}, ${cell.y}) uses unknown icon "${cell.icon}" — add it to src/lib/icons.ts or pick an existing key.`,
        );
      }
    }
  }

  const campaigns = await listCampaigns();
  console.log(
    `Checked ${campaigns.length} campaign(s), ${slugs.length} folder(s) under ${path.relative(process.cwd(), CONTENT_ROOT)}.`,
  );

  if (warnings.length === 0) {
    console.log("No content warnings.");
    return;
  }

  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
