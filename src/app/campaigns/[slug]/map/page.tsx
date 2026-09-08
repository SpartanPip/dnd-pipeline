import { getMap } from "@/lib/content/map";
import { MapGrid } from "@/components/map-grid";

export const dynamic = "force-dynamic";

export default async function CampaignMapPage({
  params,
}: PageProps<"/campaigns/[slug]/map">) {
  const { slug } = await params;
  const map = await getMap(slug);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Map</h2>
        <p className="text-sm text-muted-foreground">
          Scroll or pinch to pan and zoom. Hover an icon for its name, click to jump to what
          it represents.
        </p>
      </div>
      {map.cells.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No locations on the map yet. Ramble about your campaign and they&apos;ll show up
          here.
        </p>
      ) : (
        <MapGrid campaignSlug={slug} cells={map.cells} />
      )}
    </div>
  );
}
