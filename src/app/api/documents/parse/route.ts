export const maxDuration = 120;

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { userCanAccessRetailStore } from "@/lib/store-access";
import {
  extractDocumentRows,
  extractDocumentRowsFromPath,
  getDocumentAiStatus,
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

function publicOcrError(request: Request, message: string): string {
  if (message.startsWith("OCR_PROVIDER:")) {
    const detail = message.slice("OCR_PROVIDER:".length).trim();
    return detail
      ? `Document AI error: ${detail}`
      : apiT(request, "errors.documentParseFailed");
  }
  if (message.startsWith("OCR_EMPTY:")) {
    return apiT(request, "errors.documentParseFailed");
  }
  if (message === "OCR_PARSE_FAILED") {
    return apiT(request, "errors.documentParseFailed");
  }
  if (message === "OCR_NOT_CONFIGURED") {
    return apiT(request, "errors.documentAiNotConfigured");
  }
  return apiT(request, "errors.documentParseFailed");
}

export async function POST(request: Request) {
  // Outer guard: never let an unhandled throw become an HTML 500 (which the
  // client cannot parse and mis-reports as a body-size error).
  try {
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
    if (!json) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    const parsed = parseSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    let store;
    try {
      store = await userCanAccessRetailStore(
        session.userId,
        parsed.data.storeId,
      );
    } catch (error) {
      console.error("document parse: store access check failed", error);
      return NextResponse.json(
        { error: apiT(request, "errors.pageLoadFailed") },
        { status: 503 },
      );
    }
    if (!store) {
      return NextResponse.json(
        { error: apiT(request, "errors.noStoreAccess") },
        { status: 403 },
      );
    }

    try {
      const extractStart = Date.now();
      const rows = parsed.data.imagePath
        ? await extractDocumentRowsFromPath(parsed.data.imagePath)
        : await extractDocumentRows(parsed.data.dataUrl!);
      const extractMs = Date.now() - extractStart;

      if (parsed.data.imagePath) {
        await deleteLocalUpload(parsed.data.imagePath);
      }

      if (rows.length === 0) {
        return NextResponse.json(
          { error: apiT(request, "errors.documentNoItems") },
          { status: 422 },
        );
      }
      const matchStart = Date.now();
      const items = await matchDocumentRows(parsed.data.storeId, rows);
      console.log(
        `document parse timing: extract=${extractMs}ms match=${Date.now() - matchStart}ms rows=${rows.length}`,
      );
      return NextResponse.json({ items });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "INVALID_IMAGE") {
        return NextResponse.json(
          { error: apiT(request, "errors.invalidImage") },
          { status: 400 },
        );
      }
      const status = getDocumentAiStatus();
      console.error("document parse failed", {
        message,
        provider: status.provider,
        model: status.model,
        error,
      });
      return NextResponse.json(
        { error: publicOcrError(request, message) },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("document parse: unhandled error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? `Server error: ${error.message}`
            : apiT(request, "errors.documentParseFailed"),
      },
      { status: 500 },
    );
  }
}
