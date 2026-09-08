/**
 * Renders an article's markdown body to sanitized-enough HTML for display.
 * Articles are written by us (or the campaign-ramble skill), not untrusted
 * users, so we skip a heavyweight sanitizer — keep it that way only as long
 * as article content stays trusted/local.
 */
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

export async function renderMarkdown(body: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(body);
  return String(file);
}

/** Rough word count used to enforce the "half a page or less" guideline. */
export function wordCount(body: string): number {
  const stripped = body.replace(/[#*_`>[\]()!-]/g, " ");
  return stripped.split(/\s+/).filter(Boolean).length;
}
