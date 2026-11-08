import fs from "node:fs/promises";
import { campaignDir, namesJsonPath } from "./paths";
import { namesSchema, type Names } from "./schema";

export async function getNames(campaignSlug: string): Promise<Names> {
  try {
    const raw = await fs.readFile(namesJsonPath(campaignSlug), "utf-8");
    return namesSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { known: [], listening: [] };
    throw error;
  }
}

export async function saveNames(campaignSlug: string, input: unknown): Promise<Names> {
  const names = namesSchema.parse(input);
  await fs.mkdir(campaignDir(campaignSlug), { recursive: true });
  await fs.writeFile(namesJsonPath(campaignSlug), JSON.stringify(names, null, 2) + "\n", "utf-8");
  return names;
}
