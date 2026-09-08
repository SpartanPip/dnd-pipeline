import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/** A tag rendered as a badge that deep-links into the campaign's search page filtered to that tag. */
export function TagBadge({
  campaignSlug,
  tag,
}: {
  campaignSlug: string;
  tag: string;
}) {
  return (
    <Link href={`/campaigns/${campaignSlug}/search?tags=${encodeURIComponent(tag)}`}>
      <Badge variant="secondary" className="hover:bg-secondary/70">
        {tag}
      </Badge>
    </Link>
  );
}
