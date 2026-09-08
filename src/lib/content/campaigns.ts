/**
 * Read/write access to `content/campaigns/<slug>/campaign.json`.
 *
 * All functions in the content layer are async, run only on the server
 * (Route Handlers / Server Components), and validate data with the Zod
 * schemas in `schema.ts` so bad content fails loudly instead of silently
 * corrupting a page.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_ROOT, campaignDir, campaignJsonPath } from "./paths";
import { campaignSchema, type Campaign } from "./schema";

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** List every campaign, sorted alphabetically by title. */
export async function listCampaigns(): Promise<Campaign[]> {
  if (!(await pathExists(CONTENT_ROOT))) return [];

  const entries = await fs.readdir(CONTENT_ROOT, { withFileTypes: true });
  const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const campaigns = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return await getCampaign(slug);
      } catch {
        return null; // skip folders without a valid campaign.json
      }
    }),
  );

  return campaigns
    .filter((c): c is Campaign => c !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getCampaign(slug: string): Promise<Campaign> {
  const raw = await fs.readFile(campaignJsonPath(slug), "utf-8");
  return campaignSchema.parse(JSON.parse(raw));
}

export async function campaignExists(slug: string): Promise<boolean> {
  return pathExists(campaignJsonPath(slug));
}

/** Create a new campaign folder + campaign.json + empty articles/map.json. */
export async function createCampaign(
  input: Pick<Campaign, "slug" | "title" | "description" | "coverImage">,
): Promise<Campaign> {
  const campaign = campaignSchema.parse(input);

  if (await campaignExists(campaign.slug)) {
    throw new Error(`Campaign "${campaign.slug}" already exists`);
  }

  await fs.mkdir(path.join(campaignDir(campaign.slug), "articles"), {
    recursive: true,
  });
  await fs.writeFile(
    campaignJsonPath(campaign.slug),
    JSON.stringify(campaign, null, 2) + "\n",
    "utf-8",
  );
  await fs.writeFile(
    path.join(campaignDir(campaign.slug), "map.json"),
    JSON.stringify({ cells: [] }, null, 2) + "\n",
    "utf-8",
  );

  return campaign;
}

/** Shallow-merge and persist changes to an existing campaign's metadata. */
export async function updateCampaign(
  slug: string,
  patch: Partial<Pick<Campaign, "title" | "description" | "coverImage">>,
): Promise<Campaign> {
  const current = await getCampaign(slug);
  const next = campaignSchema.parse({ ...current, ...patch, slug });
  await fs.writeFile(
    campaignJsonPath(slug),
    JSON.stringify(next, null, 2) + "\n",
    "utf-8",
  );
  return next;
}
