"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ArticleDeleteButton({
  campaignSlug,
  articleSlug,
}: {
  campaignSlug: string;
  articleSlug: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this article? This can't be undone.")) return;
    setDeleting(true);
    await fetch(`/api/campaigns/${campaignSlug}/articles/${articleSlug}`, {
      method: "DELETE",
    });
    router.push(`/campaigns/${campaignSlug}/articles`);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
      <Trash2 className="size-4" aria-hidden />
      {deleting ? "Deleting…" : "Delete"}
    </Button>
  );
}
