"use client";

/**
 * An image slot that can be edited in place: hover to reveal an edit
 * button, then drag-and-drop (or click to browse for) a replacement image.
 * The new file is uploaded to `/api/upload` and saved under
 * `public/uploads/...` so it persists across restarts. The caller supplies
 * `onUploaded` to persist the returned path into the owning campaign or
 * article's data.
 */
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { GiTreasureMap } from "react-icons/gi";
import { Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditableImageProps {
  src?: string;
  alt: string;
  /** Query params identifying where the uploaded file should be stored. */
  campaignSlug: string;
  imageKind: "cover" | "article";
  articleSlug?: string;
  onUploaded: (path: string) => void | Promise<void>;
  className?: string;
  /** Tailwind aspect-ratio class, e.g. "aspect-video" or "aspect-square". */
  aspectClassName?: string;
}

export function EditableImage({
  src,
  alt,
  campaignSlug,
  imageKind,
  articleSlug,
  onUploaded,
  className,
  aspectClassName = "aspect-video",
}: EditableImageProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("campaignSlug", campaignSlug);
        form.append("imageKind", imageKind);
        if (articleSlug) form.append("articleSlug", articleSlug);

        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error(await res.text());
        const { path } = (await res.json()) as { path: string };
        await onUploaded(path);
      } catch {
        setError("Upload failed. Try a different image.");
      } finally {
        setUploading(false);
      }
    },
    [campaignSlug, imageKind, articleSlug, onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    noClick: true,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-muted",
        aspectClassName,
        isDragActive && "ring-2 ring-primary",
        className,
      )}
    >
      <input {...getInputProps()} />

      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <GiTreasureMap className="size-10" aria-hidden />
        </div>
      )}

      <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onDrop([file]);
          }}
        />
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-white" aria-hidden />
        ) : (
          <span className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium text-black">
            <Pencil className="size-3.5" aria-hidden />
            {src ? "Replace image" : "Add image"}
          </span>
        )}
      </label>

      {error && (
        <p className="absolute inset-x-0 bottom-0 bg-destructive/90 px-2 py-1 text-center text-xs text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
