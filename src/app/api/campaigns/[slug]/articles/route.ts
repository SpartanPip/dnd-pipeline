import { NextResponse } from "next/server";
import { z } from "zod";
import { listArticles, saveArticle } from "@/lib/content/articles";
import { articleSchema } from "@/lib/content/schema";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const articles = await listArticles(slug);
  return NextResponse.json({ articles });
}

/** Creates a new article. Also used by the campaign-ramble skill. */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const body = await request.json();
  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const article = await saveArticle(slug, parsed.data);
  return NextResponse.json({ article }, { status: 201 });
}
