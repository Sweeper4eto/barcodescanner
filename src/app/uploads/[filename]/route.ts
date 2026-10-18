import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canViewUpload } from "@/lib/upload-access";
import {
  isSafeUploadFilename,
  resolveLocalUploadPath,
} from "@/lib/upload";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!isSafeUploadFilename(filename)) return notFound();

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return notFound();

  const session = await getSession();
  if (!session) return notFound();

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { active: true, role: true },
  });
  if (!user?.active) return notFound();
  if (!(await canViewUpload(session.userId, user.role, filename))) {
    return notFound();
  }

  const filePath = await resolveLocalUploadPath(`/uploads/${filename}`);
  if (!filePath) return notFound();

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
