import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth/session";
import { TIER_LIMITS } from "@/types/kit";
import { apiHandler } from "@/lib/api";

/**
 * Custom image uploads.
 *
 * Production: images go to Vercel Blob (custom-cloth-blob store) and the
 * returned URL is a public CDN link. Serverless functions cannot write to
 * the local filesystem, so Blob is the only durable option there.
 *
 * Development: falls back to writing under `public/uploads/<userId>/` so the
 * local dev server can serve the file directly.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export const POST = apiHandler("uploads", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limits = TIER_LIMITS[session.tier] ?? TIER_LIMITS[0];
  const maxImages =
    session.premium && session.tier === 0 ? 50 : limits.maxCustomImages;
  if (maxImages === 0) {
    return NextResponse.json(
      { error: "uploads_require_membership" },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "unsupported_type", allowed: [...ALLOWED] },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", maxBytes: MAX_BYTES },
      { status: 413 },
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const safeExtension = /^[a-z0-9]{2,5}$/.test(extension) ? extension : "png";
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExtension}`;
  const pathname = `uploads/${session.id}/${filename}`;

  // Production: Vercel Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
    });
    return NextResponse.json({
      url: blob.url,
      name: file.name,
      size: file.size,
    });
  }

  // Development fallback: local filesystem under public/uploads.
  const uploadDir = process.env.UPLOAD_DIR ?? "public/uploads";
  const targetDir = `${uploadDir}/${session.id}`;
  const fs = await import("node:fs/promises");
  await fs.mkdir(targetDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(`${targetDir}/${filename}`, buffer);

  return NextResponse.json({
    url: `/uploads/${session.id}/${filename}`,
    name: file.name,
    size: file.size,
  });
});
