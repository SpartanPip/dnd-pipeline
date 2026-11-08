import fs from "node:fs/promises";
import path from "node:path";
import { sessionsDir } from "./paths";
import { sessionMetaSchema, type SessionMeta } from "./schema";

export async function listSessions(campaignSlug: string): Promise<SessionMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(sessionsDir(campaignSlug));
  } catch {
    return [];
  }
  const metas = await Promise.all(
    entries
      .filter((e) => /^\d+$/.test(e))
      .map(async (e) => {
        try {
          const raw = await fs.readFile(path.join(sessionsDir(campaignSlug), e, "session.json"), "utf-8");
          return sessionMetaSchema.parse(JSON.parse(raw));
        } catch {
          return null;
        }
      }),
  );
  return metas.filter((m): m is SessionMeta => m !== null).sort((a, b) => a.number - b.number);
}

export async function deleteSessionAudio(campaignSlug: string, sessionNumber: number): Promise<void> {
  const dir = path.join(sessionsDir(campaignSlug), String(sessionNumber));
  const metaPath = path.join(dir, "session.json");
  const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  await fs.rm(path.join(dir, "audio"), { recursive: true, force: true });
  await fs.writeFile(metaPath, JSON.stringify({ ...meta, has_audio: false }, null, 2) + "\n", "utf-8");
}
