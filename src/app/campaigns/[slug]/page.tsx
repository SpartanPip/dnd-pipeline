import { redirect } from "next/navigation";

export default async function CampaignIndexPage({
  params,
}: PageProps<"/campaigns/[slug]">) {
  const { slug } = await params;
  redirect(`/campaigns/${slug}/articles`);
}
