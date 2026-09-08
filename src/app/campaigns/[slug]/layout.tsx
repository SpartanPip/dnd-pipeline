import { notFound } from "next/navigation";
import { getCampaign, campaignExists } from "@/lib/content/campaigns";
import { CampaignHeader } from "@/components/campaign-header";

export default async function CampaignLayout({
  children,
  params,
}: LayoutProps<"/campaigns/[slug]">) {
  const { slug } = await params;

  if (!(await campaignExists(slug))) {
    notFound();
  }
  const campaign = await getCampaign(slug);

  return (
    <div className="flex flex-1 flex-col">
      <CampaignHeader campaignSlug={campaign.slug} campaignTitle={campaign.title} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
