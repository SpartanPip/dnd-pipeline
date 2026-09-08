import { NextResponse } from "next/server";
import { z } from "zod";
import { getMap, saveMap, upsertMapCell } from "@/lib/content/map";
import { mapCellSchema, mapDataSchema } from "@/lib/content/schema";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const map = await getMap(slug);
  return NextResponse.json({ map });
}

/** Replace the whole map. Prefer POST (upsert one cell) for incremental edits. */
export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params;
  const body = await request.json();
  const parsed = mapDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const map = await saveMap(slug, parsed.data);
  return NextResponse.json({ map });
}

/** Insert or replace a single cell (by x, y). Used by the campaign-ramble skill. */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const body = await request.json();
  const parsed = mapCellSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const map = await upsertMapCell(slug, parsed.data);
  return NextResponse.json({ map }, { status: 201 });
}
