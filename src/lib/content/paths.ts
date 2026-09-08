/**
 * Central place for every on-disk path the content layer touches. Import
 * from here instead of building paths ad hoc so the folder layout only has
 * to change in one place.
 */
import path from "node:path";

export const CONTENT_ROOT = path.join(process.cwd(), "content", "campaigns");
export const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
export const UPLOADS_PUBLIC_PREFIX = "/uploads";

export function campaignDir(campaignSlug: string): string {
  return path.join(CONTENT_ROOT, campaignSlug);
}

export function campaignJsonPath(campaignSlug: string): string {
  return path.join(campaignDir(campaignSlug), "campaign.json");
}

export function mapJsonPath(campaignSlug: string): string {
  return path.join(campaignDir(campaignSlug), "map.json");
}

export function articlesDir(campaignSlug: string): string {
  return path.join(campaignDir(campaignSlug), "articles");
}

export function articlePath(campaignSlug: string, articleSlug: string): string {
  return path.join(articlesDir(campaignSlug), `${articleSlug}.md`);
}

export function campaignUploadsDir(campaignSlug: string): string {
  return path.join(UPLOADS_ROOT, campaignSlug);
}
