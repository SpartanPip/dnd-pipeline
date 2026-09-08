import { NextResponse } from "next/server";
import { z } from "zod";
import { createCampaign, listCampaigns } from "@/lib/content/campaigns";
import { campaignSchema } from "@/lib/content/schema";

export async function GET() {
  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns });
}

const createCampaignInput = campaignSchema.pick({
  slug: true,
  title: true,
  description: true,
  coverImage: true,
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createCampaignInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const campaign = await createCampaign(parsed.data);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create campaign" },
      { status: 409 },
    );
  }
}
