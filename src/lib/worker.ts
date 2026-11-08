/** Talks to the local Python worker (pipeline/dnd_pipeline/server.py). Returns null when it isn't running. */
export async function workerFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const base = process.env.DND_WORKER_URL ?? "http://127.0.0.1:8765";
  try {
    return await fetch(`${base}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(5000) });
  } catch {
    return null;
  }
}

export const WORKER_DOWN_MESSAGE =
  "The pipeline worker isn't running. Start everything with ./start.sh.";
