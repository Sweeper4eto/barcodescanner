"use client";

import { useEffect, useState } from "react";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { CheckIcon } from "@/components/app-nav-icons";
import { HubTemperatureIcon } from "@/components/home-hub-icons";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import {
  appButtonDanger,
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appContentMaxW,
  appFooterButtonGrid,
  appFormInput,
} from "@/lib/app-ui";
import type { TemperaturePointDto } from "@/lib/temperature";

export type TemperatureDraft = {
  title: string;
  note: string;
  minCelsius: string;
  maxCelsius: string;
  comment: string;
  celsius: string;
};

type Props = {
  mode: "create" | "edit" | "view";
  isOwner: boolean;
  initial?: TemperaturePointDto | null;
  canComplete?: boolean;
  onClose: () => void;
  onSave?: (draft: TemperatureDraft) => Promise<void>;
  onSaveComment?: (draft: { comment: string }) => Promise<void>;
  onToggleDone?: (draft: { comment: string; celsius: string }) => Promise<void>;
  onRemove?: () => void;
};

function emptyDraft(): TemperatureDraft {
  return {
    title: "",
    note: "",
    minCelsius: "",
    maxCelsius: "",
    comment: "",
    celsius: "",
  };
}

function draftFromPoint(point: TemperaturePointDto): TemperatureDraft {
  return {
    title: point.title,
    note: point.note ?? "",
    minCelsius:
      point.minCelsius != null && Number.isFinite(point.minCelsius)
        ? String(point.minCelsius)
        : "",
    maxCelsius:
      point.maxCelsius != null && Number.isFinite(point.maxCelsius)
        ? String(point.maxCelsius)
        : "",
    comment: point.comment ?? "",
    celsius:
      point.celsius != null && Number.isFinite(point.celsius)
        ? String(point.celsius)
        : "",
  };
}

export function TemperaturePointSheet({
  mode,
  isOwner,
  initial,
  canComplete = true,
  onClose,
  onSave,
  onSaveComment,
  onToggleDone,
  onRemove,
}: Props) {
  const { t } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const [draft, setDraft] = useState<TemperatureDraft>(() =>
    initial ? draftFromPoint(initial) : emptyDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial ? draftFromPoint(initial) : emptyDraft());
    setError(null);
  }, [initial, mode]);

  const checked = Boolean(initial?.completed);
  const title =
    mode === "create"
      ? t("temperature.newPoint")
      : mode === "edit"
        ? t("temperature.editPoint")
        : t("temperature.pointDetails");

  async function handleSave() {
    if (!onSave) return;
    if (!draft.title.trim()) {
      setError(t("temperature.titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.invalidData"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveComment() {
    if (!onSaveComment) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveComment({ comment: draft.comment });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.invalidData"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!onToggleDone) return;
    setSaving(true);
    setError(null);
    try {
      await onToggleDone({ comment: draft.comment, celsius: draft.celsius });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.invalidData"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      style={{ paddingTop: offsetTop, paddingBottom: keyboardInset }}
    >
      <div
        className={`mx-auto flex min-h-0 w-full ${appContentMaxW} flex-1 flex-col px-4 pt-1`}
      >
        <MobilePageHeader className="mb-2" onBack={onClose} />
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg border border-card-border text-sky-300">
            <HubTemperatureIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
          {isOwner || mode === "create" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-foreground">
                  {t("temperature.title")}
                </span>
                <input
                  className={appFormInput}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  maxLength={200}
                  autoFocus={mode === "create"}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-foreground">
                  {t("temperature.note")}
                </span>
                <textarea
                  className={`${appFormInput} min-h-20`}
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, note: e.target.value }))
                  }
                  maxLength={2000}
                  placeholder={t("temperature.notePlaceholder")}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-foreground">
                    {t("temperature.minCelsius")}
                  </span>
                  <input
                    className={appFormInput}
                    inputMode="decimal"
                    value={draft.minCelsius}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        minCelsius: e.target.value,
                      }))
                    }
                    placeholder="2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-foreground">
                    {t("temperature.maxCelsius")}
                  </span>
                  <input
                    className={appFormInput}
                    inputMode="decimal"
                    value={draft.maxCelsius}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        maxCelsius: e.target.value,
                      }))
                    }
                    placeholder="8"
                  />
                </label>
              </div>
              <p className="text-xs text-muted">{t("temperature.rangeHint")}</p>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {initial?.title}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {initial?.note?.trim() || t("temperature.noDescription")}
                </p>
                {(initial?.minCelsius != null || initial?.maxCelsius != null) && (
                  <p className="mt-1 text-sm text-muted">
                    {t("temperature.rangeLabel", {
                      min:
                        initial.minCelsius != null
                          ? String(initial.minCelsius)
                          : "–",
                      max:
                        initial.maxCelsius != null
                          ? String(initial.maxCelsius)
                          : "–",
                    })}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted">
                {t("temperature.commentStaffHint")}
              </p>
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foreground">
              {t("temperature.celsius")}
            </span>
            <input
              className={appFormInput}
              inputMode="decimal"
              value={draft.celsius}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, celsius: e.target.value }))
              }
              placeholder={t("temperature.celsiusPlaceholder")}
              disabled={!canComplete && !checked}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foreground">
              {t("temperature.comment")}
            </span>
            <textarea
              className={`${appFormInput} min-h-16`}
              value={draft.comment}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, comment: e.target.value }))
              }
              maxLength={2000}
              placeholder={t("temperature.commentPlaceholder")}
            />
          </label>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-card-border pt-3 pb-3">
          {mode !== "create" && canComplete ? (
            <button
              type="button"
              disabled={saving}
              className={`${appButtonNeutralFull} inline-flex items-center justify-center gap-2`}
              onClick={() => void handleToggle()}
            >
              <CheckIcon className="size-4" />
              {checked
                ? t("temperature.markNotDone")
                : t("temperature.markDone")}
            </button>
          ) : null}

          {isOwner || mode === "create" ? (
            <div className={appFooterButtonGrid}>
              <ConfirmButton
                type="button"
                className={appButtonPrimaryFull}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {t("common.save")}
              </ConfirmButton>
              <CancelButton type="button" onClick={onClose} disabled={saving}>
                {t("common.cancel")}
              </CancelButton>
            </div>
          ) : (
            <div className={appFooterButtonGrid}>
              <ConfirmButton
                type="button"
                className={appButtonPrimaryFull}
                disabled={saving}
                onClick={() => void handleSaveComment()}
              >
                {t("common.save")}
              </ConfirmButton>
              <CancelButton type="button" onClick={onClose} disabled={saving}>
                {t("common.cancel")}
              </CancelButton>
            </div>
          )}

          {isOwner && mode === "edit" && onRemove ? (
            <button
              type="button"
              className={appButtonDanger}
              disabled={saving}
              onClick={onRemove}
            >
              {t("temperature.remove")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
