export const maxDuration = 60;

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { takeVoiceParseSlot } from "@/lib/voice-rate-limit";
import {
  isVoiceItemAiConfigured,
  parseVoiceItemFromDataUrl,
} from "@/lib/voice-item-ai";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  audioDataUrl: z.string().min(64).max(6_000_000),
  /** Optional on-device bg-BG SpeechRecognition transcript. */
  clientTranscript: z.string().trim().max(500).optional(),
});

function publicVoiceError(request: Request, message: string): string {
  if (message === "VOICE_NOT_CONFIGURED") {
    return apiT(request, "errors.voiceAiNotConfigured");
  }
  if (message === "VOICE_INVALID_AUDIO" || message === "VOICE_AUDIO_TOO_LARGE") {
    return apiT(request, "errors.voiceInvalidAudio");
  }
  if (
    message === "VOICE_PARSE_FAILED" ||
    message === "VOICE_EMPTY" ||
    message.startsWith("VOICE_EMPTY:")
  ) {
    return apiT(request, "errors.voiceParseFailed");
  }
  if (message === "VOICE_PROVIDER_TIMEOUT") {
    return apiT(request, "errors.voiceTimeout");
  }
  // Gemini free-tier / billing quota — not a speech clarity problem.
  if (
    message.startsWith("VOICE_PROVIDER:429") ||
    /quota|rate.?limit|billing/i.test(message)
  ) {
    return apiT(request, "errors.voiceQuotaExceeded");
  }
  if (message.startsWith("VOICE_PROVIDER:")) {
    return apiT(request, "errors.voiceParseFailed");
  }
  return apiT(request, "errors.voiceParseFailed");
}

export async function POST(request: Request) {
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

    if (!isVoiceItemAiConfigured()) {
      return NextResponse.json(
        { error: apiT(request, "errors.voiceAiNotConfigured") },
        { status: 503 },
      );
    }

    // Separate from document OCR rate limit — voice must not block scan-document.
    const retryAfter = takeVoiceParseSlot(session.userId);
    if (retryAfter != null) {
      return NextResponse.json(
        { error: apiT(request, "errors.voiceTryAgainLater") },
        { status: 429 },
      );
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    const item = await parseVoiceItemFromDataUrl(
      parsed.data.audioDataUrl,
      parsed.data.clientTranscript,
    );
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VOICE_PARSE_FAILED";
    console.error("voice parse-item failed", message);
    return NextResponse.json(
      { error: publicVoiceError(request, message) },
      { status: 502 },
    );
  }
}
