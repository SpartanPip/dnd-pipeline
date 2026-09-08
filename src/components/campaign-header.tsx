"use client";

/**
 * Header shown on every /campaigns/[slug]/* page. Gives one-click access to
 * the three campaign views (Map, Articles, Search) plus a way back to the
 * campaign grid — this is the "easy access" nav required alongside each
 * feature's dedicated page.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, ScrollText, Search, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function CampaignHeader({
  campaignSlug,
  campaignTitle,
}: {
  campaignSlug: string;
  campaignTitle: string;
}) {
  const pathname = usePathname();
  const base = `/campaigns/${campaignSlug}`;

  const links = [
    { href: `${base}/map`, label: "Map", icon: Map },
    { href: `${base}/articles`, label: "Articles", icon: ScrollText },
    { href: `${base}/search`, label: "Search", icon: Search },
  ];

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Home className="size-4" aria-hidden />
          Campaigns
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="truncate text-sm font-medium">{campaignTitle}</span>

        <nav className="ml-auto flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
