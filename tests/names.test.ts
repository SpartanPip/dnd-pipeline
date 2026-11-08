import fs from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import { campaignDir } from "@/lib/content/paths";
import { getNames, saveNames } from "@/lib/content/names";

const SLUG = "zz-test-names";

afterAll(async () => {
  await fs.rm(campaignDir(SLUG), { recursive: true, force: true });
});

describe("names pool", () => {
  it("returns an empty pool when names.json is missing", async () => {
    expect(await getNames(SLUG)).toEqual({ known: [], listening: [] });
  });

  it("round-trips a saved pool", async () => {
    const pool = { known: [{ name: "Elara", aliases: ["El"] }], listening: ["Elara"] };
    await saveNames(SLUG, pool);
    expect(await getNames(SLUG)).toEqual(pool);
  });

  it("rejects an invalid pool", async () => {
    await expect(saveNames(SLUG, { known: [{ aliases: [] }] })).rejects.toThrow();
  });
});
