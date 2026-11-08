"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Question } from "@/lib/content/schema";

function QuestionRow({
  campaignSlug,
  articleSlug,
  question,
}: {
  campaignSlug: string;
  articleSlug: string;
  question: Question;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState(question.answer ?? "");
  const [editing, setEditing] = useState(!question.answer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignSlug}/articles/${articleSlug}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: question.id, answer }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save that answer.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <li className="space-y-1.5">
      <p className="flex items-start gap-2 text-sm">
        <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        {question.text}
      </p>
      {editing ? (
        <form onSubmit={save} className="flex gap-2 pl-6">
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer"
            aria-label={`Answer: ${question.text}`}
          />
          <Button type="submit" size="sm" disabled={saving || !answer.trim()}>
            Save
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2 pl-6 text-sm">
          <Check className="size-4 text-muted-foreground" aria-hidden />
          <span>{question.answer}</span>
          <span className="text-xs text-muted-foreground">
            {question.appliedAt ? "· applied" : "· used next time the pipeline runs"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
      )}
      {error && <p className="pl-6 text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function CardQuestions({
  campaignSlug,
  articleSlug,
  questions,
}: {
  campaignSlug: string;
  articleSlug: string;
  questions: Question[];
}) {
  if (questions.length === 0) return null;
  const open = questions.filter((q) => !q.answer).length;
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">
        Open questions{open > 0 && <span className="text-muted-foreground"> · {open} unanswered</span>}
      </h2>
      <ul className="space-y-4">
        {questions.map((q) => (
          <QuestionRow key={q.id} campaignSlug={campaignSlug} articleSlug={articleSlug} question={q} />
        ))}
      </ul>
    </section>
  );
}
