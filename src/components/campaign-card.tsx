"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EditableImage } from "@/components/editable-image";
import type { Campaign } from "@/lib/content/schema";

/** Home page grid card: cover image + title + description, links into the campaign. */
export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const router = useRouter();

  async function handleUploaded(path: string) {
    await fetch(`/api/campaigns/${campaign.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImage: path }),
    });
    router.refresh();
  }

  return (
    <Card className="overflow-hidden p-0 transition-shadow hover:shadow-md">
      <EditableImage
        src={campaign.coverImage}
        alt={campaign.title}
        campaignSlug={campaign.slug}
        imageKind="cover"
        onUploaded={handleUploaded}
        aspectClassName="aspect-[4/3]"
      />
      <Link href={`/campaigns/${campaign.slug}`} className="block">
        <CardHeader className="pb-4">
          <CardTitle>{campaign.title}</CardTitle>
          {campaign.description && (
            <CardDescription>{campaign.description}</CardDescription>
          )}
        </CardHeader>
      </Link>
    </Card>
  );
}
