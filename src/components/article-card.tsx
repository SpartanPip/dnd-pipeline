import Link from "next/link";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TagBadge } from "@/components/tag-badge";
import { ImagePending } from "@/components/image-pending";
import type { Article } from "@/lib/content/schema";

/** Compact article preview used on the Articles index and in search results. */
export function ArticleCard({
  campaignSlug,
  article,
}: {
  campaignSlug: string;
  article: Pick<Article, "slug" | "title" | "summary" | "tags" | "image"> &
    Partial<Pick<Article, "imageStatus">>;
}) {
  return (
    <Card className="overflow-hidden p-0 transition-shadow hover:shadow-md">
      <Link href={`/campaigns/${campaignSlug}/articles/${article.slug}`} className="block">
        {!article.image && article.imageStatus === "pending" && (
          <div className="aspect-[16/9] w-full bg-muted">
            <ImagePending />
          </div>
        )}
        {article.image && (
          <div className="relative aspect-[16/9] w-full bg-muted">
            <Image
              src={article.image}
              alt={article.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        )}
        <CardHeader>
          <CardTitle>{article.title}</CardTitle>
          <CardDescription>{article.summary}</CardDescription>
        </CardHeader>
      </Link>
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-6 pb-6">
          {article.tags.map((tag) => (
            <TagBadge key={tag} campaignSlug={campaignSlug} tag={tag} />
          ))}
        </div>
      )}
    </Card>
  );
}
