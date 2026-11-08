"use client";

import { useRouter } from "next/navigation";
import { EditableImage } from "@/components/editable-image";
import { ImagePending } from "@/components/image-pending";
import type { Article } from "@/lib/content/schema";

/** Hover-to-edit hero image for an article page; persists via a full article PATCH. */
export function ArticleImageEditor({
  campaignSlug,
  article,
}: {
  campaignSlug: string;
  article: Article;
}) {
  const router = useRouter();

  async function handleUploaded(path: string) {
    await fetch(`/api/campaigns/${campaignSlug}/articles/${article.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...article,
        image: path,
        imageStatus: article.imageStatus ? "generated" : undefined,
      }),
    });
    router.refresh();
  }

  return (
    <EditableImage
      src={article.image}
      alt={article.title}
      campaignSlug={campaignSlug}
      imageKind="article"
      articleSlug={article.slug}
      onUploaded={handleUploaded}
      aspectClassName="aspect-[16/9]"
      placeholder={article.imageStatus === "pending" ? <ImagePending /> : undefined}
    />
  );
}
