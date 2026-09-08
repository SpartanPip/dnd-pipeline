import { NextResponse } from "next/server";
import { z } from "zod";
import { campaignExists, getCampaign, updateCampaign } from "@/lib/content/campaigns";
import { campaignSchema } from "@/lib/content/schema";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  if (!(await campaignExists(slug))) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  const campaign = await getCampaign(slug);
  return NextResponse.json({ campaign });
}

const patchInput = campaignSchema
  .pick({ title: true, description: true, coverImage: true })
  .partial();

export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params;
  const body = await request.json();
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  try {
    const campaign = await updateCampaign(slug, parsed.data);
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update campaign" },
      { status: 400 },
    );
  }
}
