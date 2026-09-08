import { ICON_ATTRIBUTION } from "@/lib/icons";

/** Required attribution for the CC BY 3.0 licensed game-icons.net map icons. */
export function SiteFooter() {
  return (
    <footer className="border-t py-6">
      <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
        {ICON_ATTRIBUTION.text} (
        <a href={ICON_ATTRIBUTION.href} className="underline" target="_blank" rel="noreferrer">
          game-icons.net
        </a>
        ), licensed{" "}
        <a
          href={ICON_ATTRIBUTION.licenseHref}
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          {ICON_ATTRIBUTION.license}
        </a>
        .
      </p>
    </footer>
  );
}
