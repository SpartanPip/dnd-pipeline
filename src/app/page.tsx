import { listCampaigns } from "@/lib/content/campaigns";
import { CampaignCard } from "@/components/campaign-card";
import { CreateCampaignDialog } from "@/components/create-campaign-dialog";

// Content lives on disk and can change between requests (via the ramble
// skill or the UI), so always read it fresh rather than caching the page.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const campaigns = await listCampaigns();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DnD Lore</h1>
          <p className="text-sm text-muted-foreground">
            Pick a campaign to explore its map, articles, and search.
          </p>
        </div>
        <CreateCampaignDialog />
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No campaigns yet — create one to get started.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.slug} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
