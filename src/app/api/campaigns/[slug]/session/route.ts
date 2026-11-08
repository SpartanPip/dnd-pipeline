import { NextResponse } from "next/server";
import { z } from "zod";
import { campaignExists } from "@/lib/content/campaigns";
import { listSessions } from "@/lib/content/sessions";
import { WORKER_DOWN_MESSAGE, workerFetch } from "@/lib/worker";

type Params = { params: Promise<{ slug: string }> };

const actionSchema = z.object({
  action: z.enum(["start", "stop", "process", "apply-answers"]),
  session: z.number().int().positive().optional(),
});

/** Worker status plus this campaign's sessions; `worker` is null when the worker is down. */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const res = await workerFetch("/status");
  const worker = res?.ok ? await res.json() : null;
  return NextResponse.json({ worker, sessions: await listSessions(slug) });
}

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  if (!(await campaignExists(slug))) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const { action, session } = parsed.data;
  if (action === "process" && !session) {
    return NextResponse.json({ error: "session is required" }, { status: 400 });
  }

  const json = { "Content-Type": "application/json" };
  const res =
    action === "start"
      ? await workerFetch(
          "/sessions/start",
          { method: "POST", headers: json, body: JSON.stringify({ campaign: slug }) },
          20000,
        )
      : action === "stop"
        ? await workerFetch("/sessions/stop", { method: "POST" })
        : action === "process"
          ? await workerFetch(`/campaigns/${slug}/sessions/${session}/process`, { method: "POST" })
          : await workerFetch(`/campaigns/${slug}/apply-answers`, { method: "POST" });

  if (!res) return NextResponse.json({ error: WORKER_DOWN_MESSAGE }, { status: 503 });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data.detail ?? "The worker rejected that request" }, { status: res.status });
  }
  return NextResponse.json(data);
}
