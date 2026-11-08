import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion, articleExists } from "@/lib/content/articles";

type Params = { params: Promise<{ slug: string; article: string }> };

const answerSchema = z.object({ id: z.string().min(1), answer: z.string().trim().min(1).max(1000) });

export async function POST(request: Request, { params }: Params) {
  const { slug, article: articleSlug } = await params;
  if (!(await articleExists(slug, articleSlug))) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  const parsed = answerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }
  try {
    const article = await answerQuestion(slug, articleSlug, parsed.data.id, parsed.data.answer);
    return NextResponse.json({ article });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
