import { Plus } from "lucide-react";
import { listArticles } from "@/lib/content/articles";
import { ArticleCard } from "@/components/article-card";
import { ArticleEditorDialog } from "@/components/article-editor-dialog";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ArticlesPage({
  params,
}: PageProps<"/campaigns/[slug]/articles">) {
  const { slug } = await params;
  const articles = await listArticles(slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Articles</h2>
          <p className="text-sm text-muted-foreground">
            Short, cross-linked lore entries for this campaign.
          </p>
        </div>
        <ArticleEditorDialog
          campaignSlug={slug}
          trigger={
            <Button>
              <Plus className="size-4" aria-hidden />
              New article
            </Button>
          }
        />
      </div>

      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No articles yet — write one, or ramble about your campaign to your AI buddy.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} campaignSlug={slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
