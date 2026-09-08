"use client";

/**
 * The dedicated Search view for a campaign: a debounced search box with a
 * live autocomplete dropdown (recent searches when empty, matching articles
 * while typing), clickable tag filter chips, and a results grid. Powered by
 * `GET /api/campaigns/[slug]/search`, which runs the MiniSearch index in
 * `src/lib/search`.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArticleCard } from "@/components/article-card";
import { cn } from "@/lib/utils";
import type { ArticleSearchResult } from "@/lib/search";

const RECENT_SEARCHES_LIMIT = 6;

function recentSearchesKey(campaignSlug: string) {
  return `dnd-lore:recent-searches:${campaignSlug}`;
}

function readRecentSearches(campaignSlug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(recentSearchesKey(campaignSlug));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function useRecentSearches(campaignSlug: string) {
  const key = recentSearchesKey(campaignSlug);
  const [recent, setRecent] = useState<string[]>(() => readRecentSearches(campaignSlug));

  function push(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((r) => r !== trimmed)].slice(
        0,
        RECENT_SEARCHES_LIMIT,
      );
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private browsing, etc.) — non-fatal
      }
      return next;
    });
  }

  function clear() {
    setRecent([]);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  return { recent, push, clear };
}

export function SearchExperience({
  campaignSlug,
  allTags,
  initialQuery = "",
  initialTags = [],
}: {
  campaignSlug: string;
  allTags: string[];
  initialQuery?: string;
  initialTags?: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [activeTags, setActiveTags] = useState<string[]>(initialTags);
  const [results, setResults] = useState<ArticleSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { recent, push: pushRecent, clear: clearRecent } = useRecentSearches(campaignSlug);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (activeTags.length > 0) params.set("tags", activeTags.join(","));

      const res = await fetch(
        `/api/campaigns/${campaignSlug}/search?${params.toString()}`,
      );
      const data = (await res.json()) as { results: ArticleSearchResult[] };
      setResults(data.results ?? []);
      setLoading(false);

      const search = params.toString();
      router.replace(search ? `?${search}` : "?", { scroll: false });
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTags, campaignSlug, router]);

  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function goToArticle(slug: string, chosenQuery: string) {
    pushRecent(chosenQuery);
    setShowDropdown(false);
    router.push(`/campaigns/${campaignSlug}/articles/${slug}`);
  }

  const suggestions = query.trim() ? results.slice(0, RECENT_SEARCHES_LIMIT) : [];

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    const items = query.trim() ? suggestions : recent;
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (query.trim()) {
        const chosen = suggestions[highlighted];
        if (chosen) goToArticle(chosen.slug, chosen.title);
      } else {
        setQuery(items[highlighted] as string);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="relative">
          <SearchIcon
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
              setHighlighted(0);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={onKeyDown}
            placeholder="Search articles by title, tag, or keyword…"
            className="pl-9"
            aria-label="Search articles"
          />
        </div>

        {showDropdown && query.trim() && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-md border bg-popover py-1 shadow-md">
            {suggestions.map((s, i) => (
              <li key={s.slug}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToArticle(s.slug, s.title)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm",
                    i === highlighted && "bg-accent",
                  )}
                >
                  <span className="font-medium">{s.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {s.summary}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {showDropdown && !query.trim() && recent.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-md border bg-popover py-1 shadow-md">
            <li className="flex items-center justify-between px-3 py-1 text-xs text-muted-foreground">
              Recent searches
              <button
                type="button"
                className="underline hover:no-underline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearRecent}
              >
                Clear
              </button>
            </li>
            {recent.map((q, i) => (
              <li key={q}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQuery(q)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    i === highlighted && "bg-accent",
                  )}
                >
                  <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <Badge
                key={tag}
                variant={active ? "default" : "secondary"}
                className="cursor-pointer select-none"
                onClick={() => toggleTag(tag)}
              >
                {tag}
                {active && <X className="ml-1 size-3" aria-hidden />}
              </Badge>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No articles found. Try a different search or tag.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <ArticleCard
              key={r.slug}
              campaignSlug={campaignSlug}
              article={{
                slug: r.slug,
                title: r.title,
                summary: r.summary,
                tags: r.tags,
                image: r.image,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
