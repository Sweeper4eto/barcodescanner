"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { isIosDevice, isPwaInstalled } from "@/lib/pwa-install";

type PushState =
  | "unsupported"
  | "iosNeedsInstall"
  | "unconfigured"
  | "default"
  | "denied"
  | "enabled"
  | "loading";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PushNotifications() {
  const { t, locale } = useT();
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (typeof window === "undefined") return;

      // iOS Safari never exposes PushManager in a regular browser tab —
      // it only becomes available once the site is installed to the Home
      // Screen and opened from there (iOS 16.4+). Show install instructions
      // instead of silently hiding the whole section.
      if (isIosDevice() && !isPwaInstalled()) {
        if (!cancelled) setState("iosNeedsInstall");
        return;
      }

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }

      const keyResponse = await fetch("/api/push/vapid-public-key");
      const keyData = (await keyResponse.json()) as {
        configured?: boolean;
      };
      if (cancelled) return;

      if (!keyData.configured) {
        setState("unconfigured");
        return;
      }

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (cancelled) return;

      setState(existing ? "enabled" : "default");
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enableNotifications() {
    setError("");
    setState("loading");

    try {
      const keyResponse = await fetch("/api/push/vapid-public-key");
      const keyData = (await keyResponse.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!keyData.configured || !keyData.publicKey) {
        setState("unconfigured");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            keyData.publicKey,
          ) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("Invalid subscription");
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          locale,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? t("push.subscribeError"));
      }

      setState("enabled");
    } catch {
      setError(t("push.subscribeError"));
      setState("default");
    }
  }

  async function disableNotifications() {
    setError("");
    setState("loading");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("default");
    } catch {
      setError(t("push.unsubscribeError"));
      setState("enabled");
    }
  }

  if (state === "loading") return null;
  if (state === "unsupported" || state === "unconfigured") return null;

  return (
    <section className="mb-3 flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3.5">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-selected text-primary"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17H9a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4Z" />
          <path d="M9 21h6" strokeLinecap="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">{t("push.title")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("push.description")}</p>

        {state === "iosNeedsInstall" ? (
          <p className="mt-2 rounded-lg border border-card-border bg-subtle px-2.5 py-1.5 text-xs text-foreground">
            {t("push.iosInstallRequired")}
          </p>
        ) : null}

        {state === "denied" ? (
          <p className="mt-2 text-xs text-warning-fg">{t("push.denied")}</p>
        ) : null}

        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>

      {state === "iosNeedsInstall" || state === "denied" ? null : (
        <button
          type="button"
          role="switch"
          aria-checked={state === "enabled"}
          aria-label={state === "enabled" ? t("push.disable") : t("push.enable")}
          onClick={() =>
            void (state === "enabled" ? disableNotifications() : enableNotifications())
          }
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            state === "enabled" ? "bg-primary" : "bg-subtle border border-card-border"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
              state === "enabled" ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      )}
    </section>
  );
}
