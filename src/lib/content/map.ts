/** Read/write access to `content/campaigns/<slug>/map.json`. */
import fs from "node:fs/promises";
import { mapJsonPath } from "./paths";
import { mapDataSchema, type MapCell, type MapData } from "./schema";

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function getMap(campaignSlug: string): Promise<MapData> {
  const file = mapJsonPath(campaignSlug);
  if (!(await pathExists(file))) return { cells: [] };
  const raw = await fs.readFile(file, "utf-8");
  return mapDataSchema.parse(JSON.parse(raw));
}

export async function saveMap(
  campaignSlug: string,
  data: MapData,
): Promise<MapData> {
  const parsed = mapDataSchema.parse(data);
  await fs.writeFile(
    mapJsonPath(campaignSlug),
    JSON.stringify(parsed, null, 2) + "\n",
    "utf-8",
  );
  return parsed;
}

/** Insert a new cell or replace the existing one at the same (x, y). */
export async function upsertMapCell(
  campaignSlug: string,
  cell: MapCell,
): Promise<MapData> {
  const current = await getMap(campaignSlug);
  const cells = current.cells.filter((c) => !(c.x === cell.x && c.y === cell.y));
  cells.push(cell);
  return saveMap(campaignSlug, { cells });
}
