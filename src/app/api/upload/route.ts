import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import {
  campaignUploadsDir,
  UPLOADS_PUBLIC_PREFIX,
} from "@/lib/content/paths";
import { slugSchema } from "@/lib/content/schema";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/**
 * Saves a dropped/selected image under `public/uploads/<campaign>/...` so it
 * persists on disk across sessions, then returns the public path the caller
 * should PATCH into the owning campaign/article's `image`/`coverImage` field.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const campaignSlug = form.get("campaignSlug");
  const imageKind = form.get("imageKind");
  const articleSlug = form.get("articleSlug");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (typeof campaignSlug !== "string" || !slugSchema.safeParse(campaignSlug).success) {
    return NextResponse.json({ error: "Invalid campaignSlug" }, { status: 400 });
  }
  if (imageKind !== "cover" && imageKind !== "article") {
    return NextResponse.json({ error: "Invalid imageKind" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }
  const ext = ALLOWED_EXTENSIONS[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG, PNG, WebP, GIF, or SVG." },
      { status: 415 },
    );
  }

  const namePart =
    imageKind === "article" && typeof articleSlug === "string" && articleSlug
      ? articleSlug
      : "cover";
  const filename = `${namePart}-${uuid()}.${ext}`;

  const dir = campaignUploadsDir(campaignSlug);
  await fs.mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), bytes);

  const publicPath = `${UPLOADS_PUBLIC_PREFIX}/${campaignSlug}/${filename}`;
  return NextResponse.json({ path: publicPath }, { status: 201 });
}
