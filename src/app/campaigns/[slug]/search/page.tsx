import { listArticles } from "@/lib/content/articles";
import { allTags } from "@/lib/search";
import { SearchExperience } from "@/components/search-experience";

export const dynamic = "force-dynamic";

export default async function CampaignSearchPage({
  params,
  searchParams,
}: PageProps<"/campaigns/[slug]/search">) {
  const { slug } = await params;
  const sp = await searchParams;

  const articles = await listArticles(slug);
  const initialQuery = typeof sp.q === "string" ? sp.q : "";
  const initialTags =
    typeof sp.tags === "string" ? sp.tags.split(",").filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Search</h2>
        <p className="text-sm text-muted-foreground">
          Search by title, tag, or keyword. Suggestions update as you type.
        </p>
      </div>
      <SearchExperience
        campaignSlug={slug}
        allTags={allTags(articles)}
        initialQuery={initialQuery}
        initialTags={initialTags}
      />
    </div>
  );
}
