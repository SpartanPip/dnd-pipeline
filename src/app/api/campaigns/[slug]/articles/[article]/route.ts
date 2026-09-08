import { NextResponse } from "next/server";
import { z } from "zod";
import {
  articleExists,
  deleteArticle,
  getArticle,
  saveArticle,
} from "@/lib/content/articles";
import { articleSchema } from "@/lib/content/schema";

type Params = { params: Promise<{ slug: string; article: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug, article: articleSlug } = await params;
  if (!(await articleExists(slug, articleSlug))) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  const article = await getArticle(slug, articleSlug);
  return NextResponse.json({ article });
}

/** Full update (title/tags/summary/image/body). The slug in the body must match the route. */
export async function PATCH(request: Request, { params }: Params) {
  const { slug, article: articleSlug } = await params;
  const body = await request.json();
  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  if (parsed.data.slug !== articleSlug) {
    return NextResponse.json({ error: "slug in body must match route" }, { status: 400 });
  }

  const article = await saveArticle(slug, parsed.data);
  return NextResponse.json({ article });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug, article: articleSlug } = await params;
  await deleteArticle(slug, articleSlug);
  return new NextResponse(null, { status: 204 });
}
