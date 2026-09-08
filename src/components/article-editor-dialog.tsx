"use client";

/**
 * Create or edit an article. Shared by the "New article" action on the
 * Articles index and the "Edit" action on an article page — pass `article`
 * to edit an existing one, omit it to create a new one.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/content/slug";
import { ARTICLE_WORD_LIMIT } from "@/lib/content/schema";
import { wordCount } from "@/lib/content/markdown";
import type { Article } from "@/lib/content/schema";

export function ArticleEditorDialog({
  campaignSlug,
  article,
  trigger,
}: {
  campaignSlug: string;
  article?: Article;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(article);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(article?.title ?? "");
  const [tags, setTags] = useState(article?.tags.join(", ") ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = wordCount(body);
  const overLimit = words > ARTICLE_WORD_LIMIT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const slug = article?.slug ?? slugify(title);
    const payload = {
      title,
      slug,
      tags: tags
        .split(",")
        .map((t) => slugify(t.trim()))
        .filter(Boolean),
      summary,
      image: article?.image,
      body,
    };

    const url = isEdit
      ? `/api/campaigns/${campaignSlug}/articles/${slug}`
      : `/api/campaigns/${campaignSlug}/articles`;
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't save that article — check the fields and try again.");
      return;
    }

    setOpen(false);
    if (!isEdit) {
      router.push(`/campaigns/${campaignSlug}/articles/${slug}`);
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit article" : "New article"}</DialogTitle>
            <DialogDescription>
              Keep the description to half a page or less — link to other articles by their
              URL, e.g. <code>/campaigns/{campaignSlug}/articles/some-slug</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
            <div className="space-y-2">
              <Label htmlFor="article-title">Title</Label>
              <Input
                id="article-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-tags">Tags (comma-separated)</Label>
              <Input
                id="article-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="location, ruins, arcane"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-summary">One-sentence summary</Label>
              <Input
                id="article-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="article-body">Description (markdown)</Label>
                <span
                  className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {words} / {ARTICLE_WORD_LIMIT} words
                </span>
              </div>
              <textarea
                id="article-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !title.trim() || !summary.trim()}>
              {submitting ? "Saving…" : "Save article"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
