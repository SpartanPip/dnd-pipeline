"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Names } from "@/lib/content/schema";

function toLines(names: Names): string {
  return names.known.map((k) => (k.aliases.length ? `${k.name} (${k.aliases.join(", ")})` : k.name)).join("\n");
}

function fromLines(text: string): Names["known"] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*\((.*)\)\s*$/);
      if (!match) return { name: line, aliases: [] };
      return {
        name: match[1].trim(),
        aliases: match[2].split(",").map((a) => a.trim()).filter(Boolean),
      };
    });
}

export function NamesEditor({ campaignSlug, initialNames }: { campaignSlug: string; initialNames: Names }) {
  const [listening, setListening] = useState(initialNames.listening.join(", "));
  const [known, setKnown] = useState(toLines(initialNames));
  const [status, setStatus] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(`/api/campaigns/${campaignSlug}/names`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        known: fromLines(known),
        listening: listening.split(",").map((n) => n.trim()).filter(Boolean),
      }),
    });
    setStatus(res.ok ? "Saved." : "Couldn't save names.");
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Character names</h3>
        <p className="text-xs text-muted-foreground">
          The listening list helps transcription spell names right. The known pool is used when organizing, and new
          names get added automatically.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="listening">Expected this session (comma separated)</Label>
        <Textarea id="listening" value={listening} onChange={(e) => setListening(e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="known">Known pool (one per line, aliases in parentheses)</Label>
        <Textarea id="known" value={known} onChange={(e) => setKnown(e.target.value)} rows={6} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" size="sm">
          Save names
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </form>
  );
}
