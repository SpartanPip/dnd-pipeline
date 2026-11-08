import { NextResponse } from "next/server";
import { z } from "zod";
import { campaignExists } from "@/lib/content/campaigns";
import { getNames, saveNames } from "@/lib/content/names";
import { namesSchema } from "@/lib/content/schema";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  if (!(await campaignExists(slug))) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ names: await getNames(slug) });
}

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params;
  if (!(await campaignExists(slug))) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  const parsed = namesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  return NextResponse.json({ names: await saveNames(slug, parsed.data) });
}
