"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, Square, RotateCw, Trash2, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SessionMeta } from "@/lib/content/schema";

interface WorkerStatus {
  recording: { campaign: string; session: number } | null;
  job: { kind: string; campaign: string; session: number | null } | null;
  queued: number;
  last_error: string | null;
}

const ACTIVE = new Set(["recording", "transcribing", "organizing", "imaging"]);

export function SessionControls({
  campaignSlug,
  initialSessions,
}: {
  campaignSlug: string;
  initialSessions: SessionMeta[];
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [worker, setWorker] = useState<WorkerStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignSlug}/session`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setWorker(data.worker);
    setSessions(data.sessions);
  }, [campaignSlug]);

  const active = Boolean(worker?.recording || worker?.job) || sessions.some((s) => ACTIVE.has(s.status));

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, active ? 2000 : 10000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh, active]);

  async function act(action: string, session?: number) {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaignSlug}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, session }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Something went wrong.");
    } else if (action === "apply-answers") {
      toast("Applying your answers in the background.");
    }
    refresh();
  }

  async function deleteAudio(n: number) {
    if (!confirm(`Delete the recording for session ${n}? The notes stay; it just can't be re-processed.`)) return;
    await fetch(`/api/campaigns/${campaignSlug}/sessions/${n}/audio`, { method: "DELETE" });
    refresh();
  }

  const recordingHere = worker?.recording?.campaign === campaignSlug;
  const recordingElsewhere = worker?.recording && !recordingHere;

  return (
    <div className="space-y-6">
      {worker === null && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          The pipeline worker isn&apos;t running. Start everything with <code>./start.sh</code>.
        </p>
      )}
      {worker?.last_error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{worker.last_error}</p>
      )}

      <div className="flex items-center gap-3">
        {recordingHere ? (
          <Button size="lg" variant="destructive" disabled={busy} onClick={() => act("stop")}>
            <Square className="size-4" aria-hidden />
            Stop
          </Button>
        ) : (
          <Button size="lg" disabled={busy || !worker || Boolean(recordingElsewhere)} onClick={() => act("start")}>
            <Mic className="size-4" aria-hidden />
            Start
          </Button>
        )}
        {recordingHere && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            Listening… session {worker?.recording?.session}
          </span>
        )}
        {recordingElsewhere && (
          <span className="text-sm text-muted-foreground">Another campaign is recording right now.</span>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" disabled={!worker} onClick={() => act("apply-answers")}>
          <Wand2 className="size-4" aria-hidden />
          Apply answers now
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {[...sessions].reverse().map((s) => (
              <li key={s.number} className="space-y-2 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Session {s.number}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.started_at).toLocaleDateString()}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    {ACTIVE.has(s.status) && s.status !== "recording" && (
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                    )}
                    {s.status === "error" ? `Error: ${s.error}` : s.message || s.status}
                  </span>
                </div>
                {ACTIVE.has(s.status) && s.status !== "recording" && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${s.progress * 100}%` }} />
                  </div>
                )}
                {!ACTIVE.has(s.status) && (
                  <div className="flex gap-1">
                    {s.has_audio && (
                      <Button variant="ghost" size="sm" disabled={!worker} onClick={() => act("process", s.number)}>
                        <RotateCw className="size-3.5" aria-hidden />
                        {s.status === "error" ? "Retry" : "Re-process"}
                      </Button>
                    )}
                    {s.has_audio && (
                      <Button variant="ghost" size="sm" onClick={() => deleteAudio(s.number)}>
                        <Trash2 className="size-3.5" aria-hidden />
                        Delete recording
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
