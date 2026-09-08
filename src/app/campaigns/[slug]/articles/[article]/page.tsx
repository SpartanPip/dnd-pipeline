import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { articleExists, getArticle, listArticles } from "@/lib/content/articles";
import { renderMarkdown } from "@/lib/content/markdown";
import { relatedArticles } from "@/lib/search";
import { TagBadge } from "@/components/tag-badge";
import { ArticleImageEditor } from "@/components/article-image-editor";
import { ArticleEditorDialog } from "@/components/article-editor-dialog";
import { ArticleDeleteButton } from "@/components/article-delete-button";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: PageProps<"/campaigns/[slug]/articles/[article]">) {
  const { slug, article: articleSlug } = await params;

  if (!(await articleExists(slug, articleSlug))) {
    notFound();
  }

  const [article, allArticles] = await Promise.all([
    getArticle(slug, articleSlug),
    listArticles(slug),
  ]);
  const html = await renderMarkdown(article.body);
  const related = relatedArticles(article, allArticles);

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <ArticleImageEditor campaignSlug={slug} article={article} />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
          <p className="text-muted-foreground">{article.summary}</p>
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {article.tags.map((tag) => (
                <TagBadge key={tag} campaignSlug={slug} tag={tag} />
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <ArticleEditorDialog
            campaignSlug={slug}
            article={article}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            }
          />
          <ArticleDeleteButton campaignSlug={slug} articleSlug={article.slug} />
        </div>
      </div>

      <div
        className="prose prose-neutral dark:prose-invert prose-sm max-w-none"
        // Content is authored by us or the campaign-ramble skill, not
        // untrusted users — see the note in `lib/content/markdown.ts`.
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {related.length > 0 && (
        <div className="space-y-3 border-t pt-6">
          <h2 className="text-sm font-medium text-muted-foreground">Related articles</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((a) => (
              <ArticleCard key={a.slug} campaignSlug={slug} article={a} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
