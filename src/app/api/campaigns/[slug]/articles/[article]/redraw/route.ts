import { NextResponse } from "next/server";
import { z } from "zod";
import { WORKER_DOWN_MESSAGE, workerFetch } from "@/lib/worker";

type Params = { params: Promise<{ slug: string; article: string }> };

const redrawSchema = z.object({ change: z.string().trim().min(1).max(500) });

export async function POST(request: Request, { params }: Params) {
  const { slug, article } = await params;
  const parsed = redrawSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const res = await workerFetch(`/campaigns/${slug}/cards/${article}/redraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  if (!res) return NextResponse.json({ error: WORKER_DOWN_MESSAGE }, { status: 503 });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.detail ?? "Redraw failed" }, { status: res.status });
  return NextResponse.json(data, { status: 202 });
}
