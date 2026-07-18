import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { userCanAccessRetailStore } from "@/lib/store-access";
import {
  extractDocumentRows,
  extractDocumentRowsFromPath,
  isDocumentAiConfigured,
} from "@/lib/document-ai";
import { matchDocumentRows } from "@/lib/document-match";
import { deleteLocalUpload } from "@/lib/upload";
import { apiT } from "@/i18n";

const parseSchema = z
  .object({
    storeId: z.string().min(1),
    dataUrl: z.string().min(32).optional(),
    imagePath: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.dataUrl || value.imagePath), {
    message: "image required",
  });

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  if (!isDocumentAiConfigured()) {
    return NextResponse.json(
      { error: apiT(request, "errors.documentAiNotConfigured") },
      { status: 503 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = parseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessRetailStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  try {
    const rows = parsed.data.imagePath
      ? await extractDocumentRowsFromPath(parsed.data.imagePath)
      : await extractDocumentRows(parsed.data.dataUrl!);

    if (parsed.data.imagePath) {
      await deleteLocalUpload(parsed.data.imagePath);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: apiT(request, "errors.documentNoItems") },
        { status: 422 },
      );
    }
    const items = await matchDocumentRows(parsed.data.storeId, rows);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_IMAGE") {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidImage") },
        { status: 400 },
      );
    }
    console.error("document parse failed", error);
    return NextResponse.json(
      { error: apiT(request, "errors.documentParseFailed") },
      { status: 502 },
    );
  }
}