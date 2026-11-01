"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminField,
  AdminSection,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { useT } from "@/components/i18n-provider";
import { appButtonNeutral, appButtonPrimary } from "@/lib/app-ui";

type RegistrationCodeRow = {
  id: string;
  code: string;
  createdAt: string;
  createdByUsername: string;
  usedAt: string | null;
  usedByUsername: string | null;
  note: string;
};

export function RegistrationCodesPanel() {
  const { t } = useT();
  const [codes, setCodes] = useState<RegistrationCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [latestCode, setLatestCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/registration-codes");
      const data = (await response.json()) as {
        codes?: RegistrationCodeRow[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("errors.saveFailed"));
        setCodes([]);
        return;
      }
      setCodes(data.codes ?? []);
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateCode() {
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/registration-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = (await response.json()) as {
        code?: RegistrationCodeRow;
        error?: string;
      };
      if (!response.ok || !data.code) {
        setError(data.error ?? t("admin.registrationCodeGenerateFailed"));
        return;
      }
      setLatestCode(data.code.code);
      setNote("");
      setMessage(
        t("admin.registrationCodeGenerated", { code: data.code.code }),
      );
      setCodes((current) => [data.code!, ...current]);
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(t("admin.registrationCodeCopied", { code }));
    } catch {
      setError(t("errors.networkError"));
    }
  }

  const unused = codes.filter((row) => !row.usedAt);
  const used = codes.filter((row) => row.usedAt);

  return (
    <AdminSection title={t("admin.registrationCodes")}>
      <p className="mb-3 text-sm text-muted">{t("admin.registrationCodesHint")}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <AdminField label={t("admin.registrationCodeNote")}>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={adminInputClass}
              placeholder={t("admin.registrationCodeNotePlaceholder")}
              maxLength={200}
              autoComplete="off"
            />
          </AdminField>
        </div>
        <button
          type="button"
          className={`${appButtonPrimary} shrink-0`}
          disabled={generating}
          onClick={() => void generateCode()}
        >
          {generating
            ? t("admin.registrationCodeGenerating")
            : t("admin.registrationCodeGenerate")}
        </button>
      </div>

      {latestCode ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
          <span className="font-mono text-lg font-semibold tracking-widest text-foreground">
            {latestCode}
          </span>
          <button
            type="button"
            className={appButtonNeutral}
            onClick={() => void copyCode(latestCode)}
          >
            {t("admin.registrationCodeCopy")}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-2 text-sm text-primary" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("admin.registrationCodesUnused")} ({unused.length})
          </h3>
          {loading ? (
            <p className="mt-1 text-sm text-muted">{t("common.loading")}</p>
          ) : unused.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              {t("admin.registrationCodesUnusedEmpty")}
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {unused.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-card-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-base font-semibold tracking-wider">
                      {row.code}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(row.createdAt).toLocaleString()} ·{" "}
                      {row.createdByUsername}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={appButtonNeutral}
                    onClick={() => void copyCode(row.code)}
                  >
                    {t("admin.registrationCodeCopy")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {used.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("admin.registrationCodesUsed")} ({used.length})
            </h3>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {used.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg px-2 py-1.5 text-xs text-muted"
                >
                  <span className="font-mono tracking-wider">{row.code}</span>
                  {" · "}
                  {row.usedByUsername ?? "—"}
                  {" · "}
                  {row.usedAt
                    ? new Date(row.usedAt).toLocaleString()
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </AdminSection>
  );
}
