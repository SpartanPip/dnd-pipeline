"use client";

/**
 * Pannable/zoomable campaign map. Cells are addressed by integer (x, y)
 * coordinates centered on (0, 0); only occupied cells render an icon.
 * Hovering a cell shows its name; clicking it opens a curated search (or a
 * specific article) for whatever that icon represents.
 */
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getMapIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { MapCell } from "@/lib/content/schema";

const CELL_SIZE = 56;
const PADDING = 2;

function buildCellHref(campaignSlug: string, cell: MapCell): string {
  if (cell.articleSlug) {
    return `/campaigns/${campaignSlug}/articles/${cell.articleSlug}`;
  }
  const params = new URLSearchParams();
  if (cell.search.text) params.set("q", cell.search.text);
  if (cell.search.tags.length > 0) params.set("tags", cell.search.tags.join(","));
  const query = params.toString();
  return `/campaigns/${campaignSlug}/search${query ? `?${query}` : ""}`;
}

export function MapGrid({
  campaignSlug,
  cells,
}: {
  campaignSlug: string;
  cells: MapCell[];
}) {
  const xs = cells.map((c) => c.x).concat(0);
  const ys = cells.map((c) => c.y).concat(0);
  const minX = Math.min(...xs) - PADDING;
  const maxX = Math.max(...xs) + PADDING;
  const minY = Math.min(...ys) - PADDING;
  const maxY = Math.max(...ys) + PADDING;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  const cellByCoord = new Map(cells.map((c) => [`${c.x},${c.y}`, c]));

  const grid: Array<{ x: number; y: number; cell?: MapCell }> = [];
  for (let row = 0; row < height; row++) {
    // North (+y) renders at the top, matching how a party would read a map.
    const y = maxY - row;
    for (let col = 0; col < width; col++) {
      const x = minX + col;
      grid.push({ x, y, cell: cellByCoord.get(`${x},${y}`) });
    }
  }

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-lg border bg-muted/30">
      <TransformWrapper initialScale={1} minScale={0.25} maxScale={3} centerOnInit>
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!p-12">
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${width}, ${CELL_SIZE}px)` }}
          >
            {grid.map(({ x, y, cell }) => {
              const isOrigin = x === 0 && y === 0;

              if (!cell) {
                return (
                  <div
                    key={`${x},${y}`}
                    className={cn(
                      "flex items-center justify-center border border-border/30 bg-background/40 text-[9px] text-muted-foreground/40",
                      isOrigin && "border-primary/50",
                    )}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                  >
                    {isOrigin && "0,0"}
                  </div>
                );
              }

              const Icon = getMapIcon(cell.icon);
              return (
                <Tooltip key={`${x},${y}`}>
                  <TooltipTrigger asChild>
                    <Link
                      href={buildCellHref(campaignSlug, cell)}
                      aria-label={cell.label}
                      className="flex items-center justify-center border border-border bg-background transition-colors hover:bg-accent"
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    >
                      <Icon className="size-6 text-foreground" aria-hidden />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{cell.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
