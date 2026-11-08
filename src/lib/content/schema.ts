/**
 * Zod schemas for everything stored under `content/campaigns/<slug>/`.
 *
 * These are the single source of truth for the shape of campaign/article/map
 * data. Both the app UI and the `campaign-ramble` skill validate against
 * these schemas before writing files, so invalid content never lands on
 * disk. Keep this file dependency-free (no fs access) so it can be imported
 * from client components, tests, and tooling alike.
 */
import { z } from "zod";

/** Lowercase, URL-safe identifier used for campaign, article, and tag slugs. */
export const slugSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "slug must be lowercase letters, numbers, and hyphens only",
  );

/** A single tag rendered as a badge and used for filtering/search boosts. */
export const tagSchema = slugSchema;

export const campaignSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(80),
  /** Short blurb shown under the title on the home page card. */
  description: z.string().max(280).optional(),
  /** Public path (e.g. /uploads/<slug>/cover.jpg) or undefined if unset. */
  coverImage: z.string().optional(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const cardKindSchema = z.enum([
  "character",
  "event",
  "place",
  "faction",
  "item",
  "spell",
  "lore",
  "other",
]);
export type CardKind = z.infer<typeof cardKindSchema>;

/** An open question the pipeline attached to a card; answers feed back into processing. */
export const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  answer: z.string().optional(),
  answeredAt: z.string().optional(),
  appliedAt: z.string().optional(),
});
export type Question = z.infer<typeof questionSchema>;

/** Frontmatter stored at the top of every `content/.../articles/*.md` file. */
export const articleFrontmatterSchema = z.object({
  title: z.string().min(1).max(100),
  slug: slugSchema,
  tags: z.array(tagSchema).default([]),
  /** Exactly one sentence, shown on article cards and in search results. */
  summary: z.string().min(1).max(200),
  /** Public path to an optional hero image. */
  image: z.string().optional(),
  kind: cardKindSchema.optional(),
  /** The pipeline only ever edits articles it created itself. */
  origin: z.enum(["pipeline", "manual"]).default("manual"),
  sessions: z.array(z.number().int().positive()).default([]),
  /** Story order for the timeline: session * 10000 + position within the session. */
  order: z.number().int().optional(),
  imageStatus: z.enum(["pending", "generated"]).optional(),
  /** Appearance details and redraw notes that image prompts are built from. */
  imageNotes: z.string().optional(),
  questions: z.array(questionSchema).default([]),
});
export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>;

/** A fully loaded article: frontmatter + the raw markdown body. */
export const articleSchema = articleFrontmatterSchema.extend({
  /** Markdown body, conventionally half a page (~250 words) or less. */
  body: z.string(),
});
export type Article = z.infer<typeof articleSchema>;

/** What a map cell links to when clicked: a curated, pre-filled search. */
export const mapCellSearchSchema = z.object({
  text: z.string().optional(),
  tags: z.array(tagSchema).default([]),
});
export type MapCellSearch = z.infer<typeof mapCellSearchSchema>;

/**
 * A single occupied cell on the campaign map. `icon` must be a key of
 * `MAP_ICONS` (see `src/lib/icons.ts`). Coordinates are integers with the
 * map centered on (0, 0).
 */
export const mapCellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  icon: z.string().min(1),
  label: z.string().min(1).max(80),
  search: mapCellSearchSchema,
  /** Optional direct link to a specific article instead of a search. */
  articleSlug: slugSchema.optional(),
});
export type MapCell = z.infer<typeof mapCellSchema>;

export const mapDataSchema = z.object({
  cells: z.array(mapCellSchema),
});
export type MapData = z.infer<typeof mapDataSchema>;

export const namesSchema = z.object({
  known: z.array(
    z.object({ name: z.string().min(1), aliases: z.array(z.string()).default([]) }),
  ),
  /** Short list of names expected this session; biases transcription. */
  listening: z.array(z.string().min(1)),
});
export type Names = z.infer<typeof namesSchema>;

/** Mirrors SessionMeta in pipeline/dnd_pipeline/sessions.py (written by the worker). */
export const sessionMetaSchema = z.object({
  number: z.number().int(),
  started_at: z.string(),
  ended_at: z.string().nullish(),
  status: z.enum(["recording", "transcribing", "organizing", "imaging", "done", "error"]),
  step: z.string().default(""),
  progress: z.number().default(0),
  message: z.string().default(""),
  error: z.string().nullish(),
  has_audio: z.boolean().default(true),
});
export type SessionMeta = z.infer<typeof sessionMetaSchema>;

/** Soft content-length guideline enforced by `pnpm lint:content`, not the build. */
export const ARTICLE_WORD_LIMIT = 300;

/** Pipeline cards are snapshots and stay much shorter than hand-written articles. */
export const CARD_WORD_LIMIT = 80;
