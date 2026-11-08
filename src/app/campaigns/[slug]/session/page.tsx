import { getNames } from "@/lib/content/names";
import { listSessions } from "@/lib/content/sessions";
import { SessionControls } from "@/components/session-controls";
import { NamesEditor } from "@/components/names-editor";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: PageProps<"/campaigns/[slug]/session">) {
  const { slug } = await params;
  const [names, sessions] = await Promise.all([getNames(slug), listSessions(slug)]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Session</h2>
        <p className="text-sm text-muted-foreground">
          Press Start when the game begins. When you press Stop, the notes keep processing on this Mac.
        </p>
      </div>
      <SessionControls campaignSlug={slug} initialSessions={sessions} />
      <NamesEditor campaignSlug={slug} initialNames={names} />
    </div>
  );
}
