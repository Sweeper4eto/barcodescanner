"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_RMS = 0.01;
const SILENCE_MS = 1400;
const MIN_MS_BEFORE_SILENCE = 1100;
const MAX_MS = 20_000;

export type VoiceRecorderPhase = "idle" | "recording" | "stopping";

export type VoiceRecorderErrorKey =
  | ""
  | "permission"
  | "insecure"
  | "unsupported"
  | "unavailable"
  | "cancelled";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read failed"));
    };
    reader.readAsDataURL(blob);
  });
}

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{
      isFinal: boolean;
      0: { transcript: string };
    }>;
  }) => void) | null;
  onerror: (() => void) | null;
};

function createBrowserSpeechRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    const rec = new Ctor();
    rec.lang = "bg-BG";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    return rec;
  } catch {
    return null;
  }
}

export function classifyMicrophoneError(error: unknown): VoiceRecorderErrorKey {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "insecure";
  }
  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    message.includes("permission") ||
    message.includes("not allowed")
  ) {
    return "permission";
  }
  if (name === "NotFoundError" || message.includes("requested device not found")) {
    return "unavailable";
  }
  if (
    name === "NotReadableError" ||
    name === "AbortError" ||
    message.includes("could not start")
  ) {
    return "unavailable";
  }
  return "unavailable";
}

/**
 * Call this as the *first* await inside a click/tap handler.
 * iOS Safari drops the user-gesture if React setState / camera teardown runs first,
 * which yields NotAllowedError with no permission dialog.
 */
export async function requestMicrophoneStream(): Promise<{
  stream: MediaStream | null;
  errorKey: VoiceRecorderErrorKey;
}> {
  if (typeof window === "undefined" || !window.isSecureContext) {
    return { stream: null, errorKey: "insecure" };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null, errorKey: "unsupported" };
  }
  // MediaRecorder is only needed later for capture — don't block the permission
  // prompt if the check is oddly unavailable during the gesture window.
  try {
    // Prefer clean mono speech capture for Gemini STT (noise/echo off when possible).
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return { stream, errorKey: "" };
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { stream, errorKey: "" };
    } catch (err) {
      return { stream: null, errorKey: classifyMicrophoneError(err) };
    }
  }
}

/**
 * Hold-free voice capture: tap start → auto-stop on silence → return audio data URL.
 *
 * Mic permission: call `requestMicrophoneStream()` as the first await inside the
 * mic button click (see BarcodeScanner), then pass the stream to `record`.
 */
export function useVoiceItemRecorder() {
  const [phase, setPhase] = useState<VoiceRecorderPhase>("idle");
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef(0);
  const startedAtRef = useRef(0);
  const silentSinceRef = useRef<number | null>(null);
  const finishRef = useRef<((dataUrl: string | null) => void) | null>(null);
  const speechRef = useRef<BrowserSpeechRecognition | null>(null);
  const clientTranscriptRef = useRef("");

  const stopBrowserSpeech = useCallback(() => {
    const speech = speechRef.current;
    speechRef.current = null;
    if (!speech) return;
    try {
      speech.onresult = null;
      speech.onerror = null;
      speech.stop();
    } catch {
      try {
        speech.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    stopBrowserSpeech();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    silentSinceRef.current = null;
  }, [stopBrowserSpeech]);

  useEffect(() => () => cleanup(), [cleanup]);

  /** Prefer `requestMicrophoneStream()` from the click handler, then `record(stream)`. */
  const acquireMic = useCallback(async (): Promise<{
    stream: MediaStream | null;
    errorKey: VoiceRecorderErrorKey;
  }> => {
    setError("");
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (typeof MediaRecorder === "undefined") {
      setError("unsupported");
      return { stream: null, errorKey: "unsupported" };
    }
    const result = await requestMicrophoneStream();
    if (result.stream) streamRef.current = result.stream;
    if (result.errorKey) setError(result.errorKey);
    return result;
  }, []);

  const record = useCallback(
    async (stream: MediaStream): Promise<{
      dataUrl: string | null;
      clientTranscript: string;
      errorKey: VoiceRecorderErrorKey;
    }> => {
      setError("");
      clientTranscriptRef.current = "";
      // Reset prior recorder/raf without stopping the newly granted mic stream.
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      stopBrowserSpeech();
      const priorRecorder = recorderRef.current;
      recorderRef.current = null;
      if (priorRecorder && priorRecorder.state !== "inactive") {
        try {
          priorRecorder.stop();
        } catch {
          /* ignore */
        }
      }
      if (streamRef.current && streamRef.current !== stream) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      chunksRef.current = [];
      streamRef.current = stream;

      try {
        if (typeof MediaRecorder === "undefined") {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setError("unsupported");
          return { dataUrl: null, clientTranscript: "", errorKey: "unsupported" };
        }
        const mimeType = pickMimeType();
        // Opus mono ~32 kbps is enough for speech (Google STT / Gemini Transcribe).
        const recorderOpts: MediaRecorderOptions = {
          audioBitsPerSecond: 32_000,
        };
        if (mimeType) recorderOpts.mimeType = mimeType;
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, recorderOpts);
        } catch {
          recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
        }
        recorderRef.current = recorder;

        // Optional on-device bg-BG hint only — often wrong (autocorrects to common
        // foods). Server always prefers Gemini listening to the audio.
        const speech = createBrowserSpeechRecognition();
        if (speech) {
          speechRef.current = speech;
          const finals: string[] = [];
          speech.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const piece = event.results[i];
              if (!piece) continue;
              const text = piece[0]?.transcript?.trim() ?? "";
              if (!text) continue;
              if (piece.isFinal) finals.push(text);
              else interim = text;
            }
            clientTranscriptRef.current = [...finals, interim]
              .filter(Boolean)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
          };
          speech.onerror = () => {
            /* Gemini STT is primary; ignore device STT errors */
          };
          try {
            speech.start();
          } catch {
            speechRef.current = null;
          }
        }

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);

        if (audioContext.state === "suspended") {
          await audioContext.resume().catch(() => undefined);
        }

        const done = new Promise<string | null>((resolve) => {
          finishRef.current = resolve;
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          stopBrowserSpeech();
          void (async () => {
            try {
              await audioContext.close().catch(() => undefined);
              // Strip codecs=… so the data URL mime is clean for Gemini.
              const rawType = recorder.mimeType || mimeType || "audio/webm";
              const type = rawType.split(";")[0] || "audio/webm";
              const blob = new Blob(chunksRef.current, { type });
              // Tiny blobs are almost always silence / failed capture.
              if (blob.size < 800) {
                finishRef.current?.(null);
                return;
              }
              const dataUrl = await blobToDataUrl(blob);
              finishRef.current?.(dataUrl);
            } catch {
              finishRef.current?.(null);
            } finally {
              finishRef.current = null;
              setPhase("idle");
            }
          })();
        };

        startedAtRef.current = Date.now();
        silentSinceRef.current = null;
        setPhase("recording");
        recorder.start(200);

        const tick = () => {
          const recorderLive = recorderRef.current;
          if (!recorderLive || recorderLive.state !== "recording") return;

          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i++) {
            const v = samples[i] ?? 0;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / samples.length);
          const elapsed = Date.now() - startedAtRef.current;

          if (elapsed >= MAX_MS) {
            setPhase("stopping");
            recorderLive.stop();
            return;
          }

          if (elapsed >= MIN_MS_BEFORE_SILENCE) {
            if (rms < SILENCE_RMS) {
              if (silentSinceRef.current == null) {
                silentSinceRef.current = Date.now();
              } else if (Date.now() - silentSinceRef.current >= SILENCE_MS) {
                setPhase("stopping");
                recorderLive.stop();
                return;
              }
            } else {
              silentSinceRef.current = null;
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        const dataUrl = await done;
        const clientTranscript = clientTranscriptRef.current;
        cleanup();
        if (!dataUrl) {
          return { dataUrl: null, clientTranscript: "", errorKey: "cancelled" };
        }
        return { dataUrl, clientTranscript, errorKey: "" };
      } catch (err) {
        cleanup();
        setPhase("idle");
        const key = classifyMicrophoneError(err);
        setError(key);
        return { dataUrl: null, clientTranscript: "", errorKey: key };
      }
    },
    [cleanup, stopBrowserSpeech],
  );

  /** Acquire mic (browser prompt) then record — prefer calling acquireMic separately first. */
  const start = useCallback(async (): Promise<{
    dataUrl: string | null;
    clientTranscript: string;
    errorKey: VoiceRecorderErrorKey;
  }> => {
    const { stream, errorKey } = await acquireMic();
    if (!stream) return { dataUrl: null, clientTranscript: "", errorKey };
    return record(stream);
  }, [acquireMic, record]);

  const cancel = useCallback(() => {
    finishRef.current?.(null);
    finishRef.current = null;
    cleanup();
    setPhase("idle");
  }, [cleanup]);

  return { phase, error, acquireMic, record, start, cancel };
}
