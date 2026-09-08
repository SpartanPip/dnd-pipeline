/**
 * Curated map-icon vocabulary for campaign maps.
 *
 * Icons come from the "Game Icons" set (https://game-icons.net) via the
 * `react-icons/gi` package. That artwork is CC BY 3.0 — see the credit line
 * rendered in `src/components/site-footer.tsx`. Keep this list curated
 * (rather than exposing all 4,000+ icons) so map cells stay visually
 * consistent; extend it as new kinds of locations/entities come up.
 *
 * The `campaign-ramble` skill picks icon names from this file when it adds
 * map cells — see `.cursor/skills/campaign-ramble/icons-reference.md`.
 */
import type { IconType } from "react-icons";
import {
  GiCastle,
  GiVillage,
  GiTreeBranch,
  GiForestCamp,
  GiMountainRoad,
  GiCaveEntrance,
  GiDragonHead,
  GiBroadsword,
  GiAncientRuins,
  GiWaterfall,
  GiIsland,
  GiTombstone,
  GiTowerBridge,
  GiWizardStaff,
  GiPortal,
  GiCampfire,
  GiShipWheel,
  GiThroneKing,
  GiSpiderWeb,
  GiSwordwoman,
  GiChurch,
  GiFarmTractor,
  GiVolcano,
  GiDesert,
  GiSnowflake1,
  GiTreasureMap,
  GiHobbitDoor,
  GiMineWagon,
} from "react-icons/gi";

/** Map cell icon name -> component. `mapCellSchema.icon` must be a key here. */
export const MAP_ICONS: Record<string, IconType> = {
  castle: GiCastle,
  village: GiVillage,
  tree: GiTreeBranch,
  forest: GiForestCamp,
  mountain: GiMountainRoad,
  cave: GiCaveEntrance,
  dragon: GiDragonHead,
  battle: GiBroadsword,
  ruins: GiAncientRuins,
  waterfall: GiWaterfall,
  island: GiIsland,
  graveyard: GiTombstone,
  tower: GiTowerBridge,
  wizard: GiWizardStaff,
  portal: GiPortal,
  camp: GiCampfire,
  port: GiShipWheel,
  throne: GiThroneKing,
  lair: GiSpiderWeb,
  duel: GiSwordwoman,
  temple: GiChurch,
  farmland: GiFarmTractor,
  volcano: GiVolcano,
  desert: GiDesert,
  frost: GiSnowflake1,
  landmark: GiTreasureMap,
  settlement: GiHobbitDoor,
  mine: GiMineWagon,
};

export type MapIconName = keyof typeof MAP_ICONS;

export const DEFAULT_MAP_ICON: MapIconName = "landmark";

export function getMapIcon(name: string): IconType {
  return MAP_ICONS[name] ?? MAP_ICONS[DEFAULT_MAP_ICON];
}

export const ICON_ATTRIBUTION = {
  text: "Map icons by game-icons.net",
  href: "https://game-icons.net",
  license: "CC BY 3.0",
  licenseHref: "https://creativecommons.org/licenses/by/3.0/",
};
