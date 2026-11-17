"use client";

import { useCallback, useEffect, useState } from "react";
import { SecondaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";
import type { BroadcastAudience } from "@/lib/admin-broadcast-push";

type Counts = { all: number; owners: number; members: number };

const fieldClass =
  "w-full rounded-xl border border-input-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export function BroadcastPushPanel() {
  const { t } = useT();
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [titleEn, setTitleEn] = useState("");
  const [titleBg, setTitleBg] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyBg, setBodyBg] = useState("");
  const [url, setUrl] = useState("/app");
  const [counts, setCounts] = useState<Counts>({ all: 0, owners: 0, members: 0 });
  const [pushConfigured, setPushConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const matching =
    audience === "all"
      ? counts.all
      : audience === "owners"
        ? counts.owners
        : counts.members;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/broadcast-push?audience=all");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setPushConfigured(Boolean(data.pushConfigured));
      setCounts({
        all: Number(data?.counts?.all ?? 0),
        owners: Number(data?.counts?.owners ?? 0),
        members: Number(data?.counts?.members ?? 0),
      });
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!titleEn.trim() || !titleBg.trim()) {
      setError(t("admin.broadcastPushTitlesRequired"));
      return;
    }
    const confirmText = t("admin.broadcastPushConfirm", { count: matching });
    if (!window.confirm(confirmText)) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/broadcast-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          titleEn,
          titleBg,
          bodyEn,
          bodyBg,
          url: url.trim() || "/app",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      const result = data?.result as
        | { users?: number; sent?: number; failed?: number; skipped?: boolean }
        | undefined;
      if (result?.skipped) {
        setError(t("admin.broadcastPushNotConfigured"));
        return;
      }
      setMessage(
        t("admin.broadcastPushSent", {
          users: result?.users ?? 0,
          sent: result?.sent ?? 0,
        }),
      );
      setTitleEn("");
      setTitleBg("");
      setBodyEn("");
      setBodyBg("");
      await load();
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-card-border p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("admin.broadcastPushTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("admin.broadcastPushHint")}</p>
      </div>

      {!pushConfigured ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {t("admin.broadcastPushNotConfigured")}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-primary/30 bg-selected px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">
          {t("admin.broadcastPushAudience")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "admin.broadcastPushAudienceAll"],
              ["owners", "admin.broadcastPushAudienceOwners"],
              ["members", "admin.broadcastPushAudienceMembers"],
            ] as const
          ).map(([value, labelKey]) => (
            <label
              key={value}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                audience === value
                  ? "border-primary text-primary"
                  : "border-card-border text-foreground"
              }`}
            >
              <input
                type="radio"
                name="broadcast-audience"
                checked={audience === value}
                onChange={() => setAudience(value)}
                className="accent-primary"
              />
              <span>
                {t(labelKey)}
                <span className="ml-1 text-muted">
                  (
                  {loading
                    ? "…"
                    : value === "all"
                      ? counts.all
                      : value === "owners"
                        ? counts.owners
                        : counts.members}
                  )
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          {t("admin.broadcastPushMatching", { count: matching })}
        </p>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("admin.broadcastPushTitleEn")}
          </span>
          <input
            className={fieldClass}
            value={titleEn}
            maxLength={120}
            onChange={(event) => setTitleEn(event.target.value)}
            placeholder={t("admin.broadcastPushTitleEnPlaceholder")}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("admin.broadcastPushTitleBg")}
          </span>
          <input
            className={fieldClass}
            value={titleBg}
            maxLength={120}
            onChange={(event) => setTitleBg(event.target.value)}
            placeholder={t("admin.broadcastPushTitleBgPlaceholder")}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("admin.broadcastPushBodyEn")}
          </span>
          <textarea
            className={`${fieldClass} min-h-[5rem] resize-y`}
            value={bodyEn}
            maxLength={500}
            onChange={(event) => setBodyEn(event.target.value)}
            placeholder={t("admin.broadcastPushBodyPlaceholder")}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("admin.broadcastPushBodyBg")}
          </span>
          <textarea
            className={`${fieldClass} min-h-[5rem] resize-y`}
            value={bodyBg}
            maxLength={500}
            onChange={(event) => setBodyBg(event.target.value)}
            placeholder={t("admin.broadcastPushBodyPlaceholder")}
          />
        </label>
      </div>

      <label className="block max-w-md space-y-1">
        <span className="text-sm font-semibold text-foreground">
          {t("admin.broadcastPushUrl")}
        </span>
        <input
          className={fieldClass}
          value={url}
          maxLength={300}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="/app"
        />
        <span className="text-xs text-muted">{t("admin.broadcastPushUrlHint")}</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || loading || !pushConfigured}
          onClick={() => void send()}
          className="rounded-xl border border-primary bg-transparent px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
        >
          {busy ? t("admin.broadcastPushSending") : t("admin.broadcastPushSend")}
        </button>
        <SecondaryButton onClick={() => void load()} disabled={busy || loading}>
          {t("admin.refresh")}
        </SecondaryButton>
      </div>
    </section>
  );
}
