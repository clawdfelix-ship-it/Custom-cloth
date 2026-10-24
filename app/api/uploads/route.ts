import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { TIER_LIMITS } from "@/types/kit";

/**
 * Custom image uploads.
 *
 * Images are stored on disk under `public/uploads/<userId>/` in development
 * and behind a blob store in production. The response returns a URL the
 * editor can reference as a logo source.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limits = TIER_LIMITS[session.tier] ?? TIER_LIMITS[0];
  const maxImages = session.premium && session.tier === 0 ? 50 : limits.maxCustomImages;
  if (maxImages === 0) {
    return NextResponse.json(
      { error: "uploads_require_membership" },
      { status: 403 },
    );
  }

  const formData = await request.formData();
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

  const uploadDir = process.env.UPLOAD_DIR ?? "public/uploads";
  const targetDir = `${uploadDir}/${session.id}`;
  await import("node:fs/promises").then((fs) => fs.mkdir(targetDir, { recursive: true }));

  const buffer = Buffer.from(await file.arrayBuffer());
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(`${targetDir}/${filename}`, buffer),
  );

  return NextResponse.json({
    url: `/uploads/${session.id}/${filename}`,
    name: file.name,
    size: file.size,
  });
}
