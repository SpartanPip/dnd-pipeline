import type { Article } from "@/lib/content/schema";

export interface TimelineGroup {
  session: number;
  events: Article[];
}

export function timelineEvents(articles: Article[]): TimelineGroup[] {
  const groups = new Map<number, Article[]>();
  for (const article of articles) {
    if (article.kind !== "event") continue;
    const session = article.sessions[0] ?? 0;
    groups.set(session, [...(groups.get(session) ?? []), article]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([session, events]) => ({
      session,
      events: events.sort((x, y) => (x.order ?? 0) - (y.order ?? 0)),
    }));
}
