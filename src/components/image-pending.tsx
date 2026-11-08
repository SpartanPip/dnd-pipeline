import { Hourglass } from "lucide-react";

/** Placeholder for a card whose image waits until there's enough detail to draw it. */
export function ImagePending() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <Hourglass className="size-6" aria-hidden />
      <span className="text-xs">Image pending</span>
    </div>
  );
}
