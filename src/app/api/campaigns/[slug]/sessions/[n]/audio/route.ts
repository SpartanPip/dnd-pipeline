import { NextResponse } from "next/server";
import { deleteSessionAudio } from "@/lib/content/sessions";
import { slugSchema } from "@/lib/content/schema";

type Params = { params: Promise<{ slug: string; n: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { slug, n } = await params;
  if (!slugSchema.safeParse(slug).success || !/^\d+$/.test(n)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
  try {
    await deleteSessionAudio(slug, Number(n));
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
