import { NextResponse } from "next/server";
import { listArticles } from "@/lib/content/articles";
import { searchArticles } from "@/lib/search";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const tags = (url.searchParams.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const articles = await listArticles(slug);
  const results = searchArticles(articles, query, tags);
  return NextResponse.json({ results });
}
