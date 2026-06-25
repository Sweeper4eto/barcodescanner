"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type PushState =
  | "unsupported"
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
      if (
        typeof window === "undefined" ||
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
    <section className="mt-6 rounded-xl border border-input-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">{t("push.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("push.description")}</p>

      {state === "denied" ? (
        <p className="mt-3 text-sm text-warning-fg">{t("push.denied")}</p>
      ) : null}

      {state === "enabled" ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-success-fg">{t("push.enabled")}</p>
          <button
            type="button"
            onClick={() => void disableNotifications()}
            className="rounded-lg border border-input-border px-3 py-2 text-sm text-foreground"
          >
            {t("push.disable")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void enableNotifications()}
          className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
        >
          {t("push.enable")}
        </button>
      )}

      {error ? <p className="mt-2 text-sm text-danger-fg">{error}</p> : null}
    </section>
  );
}
