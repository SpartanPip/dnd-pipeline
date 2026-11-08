import { listArticles } from "@/lib/content/articles";
import { timelineEvents } from "@/lib/timeline";
import { ArticleCard } from "@/components/article-card";

export const dynamic = "force-dynamic";

export default async function TimelinePage({ params }: PageProps<"/campaigns/[slug]/timeline">) {
  const { slug } = await params;
  const groups = timelineEvents(await listArticles(slug));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Timeline</h2>
        <p className="text-sm text-muted-foreground">Event cards in story order, by session.</p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events yet. Record a session and they&apos;ll show up here.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.session} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {group.session ? `Session ${group.session}` : "Undated"}
            </h3>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.events.map((event) => (
                <li key={event.slug}>
                  <ArticleCard campaignSlug={slug} article={event} />
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
