"use client";

import { useState } from "react";
import { Paintbrush } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";

export function RedrawDialog({ campaignSlug, articleSlug }: { campaignSlug: string; articleSlug: string }) {
  const [open, setOpen] = useState(false);
  const [change, setChange] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignSlug}/articles/${articleSlug}/redraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Couldn't start the redraw.");
      return;
    }
    setOpen(false);
    setChange("");
    toast("Redraw queued. Refresh in a minute or two to see it.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Paintbrush className="size-4" aria-hidden />
          Redraw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Redraw with changes</DialogTitle>
            <DialogDescription>
              Describe what&apos;s different, like a new scar or a disguise. The note is saved on the card.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={change}
            onChange={(e) => setChange(e.target.value)}
            placeholder="Now wears a black eyepatch and a red cloak"
            aria-label="What changed"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting || !change.trim()}>
              Redraw
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
