"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useT } from "@/components/i18n-provider";
import {
  AdminField,
  AdminSection,
  adminDangerButtonClass,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { appButtonPrimary, appButtonNeutral } from "@/lib/app-ui";

const adminActionButtonClass =
  "rounded-xl border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary disabled:opacity-50";
const adminGhostButtonClass =
  "rounded-xl border border-card-border bg-transparent px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50";

export type MinimartStoreRow = {
  id: string;
  externalId: string;
  title: string;
  street: string;
  city: string;
  postalCode: string | null;
  lat: number;
  lng: number;
  marked: boolean;
  comment: string;
  syncedAt: string;
  manual?: boolean;
};

type FilterMode = "all" | "marked" | "unmarked";

type Draft = {
  title: string;
  street: string;
  city: string;
  marked: boolean;
  comment: string;
  lat: number;
  lng: number;
};

function draftFromStore(store: MinimartStoreRow): Draft {
  return {
    title: store.title,
    street: store.street,
    city: store.city,
    marked: store.marked,
    comment: store.comment,
    lat: store.lat,
    lng: store.lng,
  };
}

export function MinimartLocatorPanel() {
  const { t } = useT();
  const [stores, setStores] = useState<MinimartStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNewPin, setIsNewPin] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const fittedRef = useRef(false);
  const placeModeRef = useRef(placeMode);

  const selected = useMemo(
    () => stores.find((s) => s.id === selectedId) ?? null,
    [stores, selectedId],
  );

  useEffect(() => {
    placeModeRef.current = placeMode;
  }, [placeMode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filter === "marked") params.set("marked", "1");
      if (filter === "unmarked") params.set("marked", "0");
      const response = await fetch(
        `/api/admin/minimart-locator?${params.toString()}`,
      );
      const data = (await response.json()) as {
        stores?: MinimartStoreRow[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("errors.saveFailed"));
        setStores([]);
        return;
      }
      setStores(data.stores ?? []);
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [filter, q, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isNewPin) return;
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft(draftFromStore(selected));
  }, [selected, isNewPin]);

  useEffect(() => {
    let cancelled = false;

    async function ensureMap() {
      if (!mapRef.current || mapInstance.current) return;
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center: [42.7, 25.4],
        zoom: 7,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (event) => {
        if (!placeModeRef.current) return;
        const { lat, lng } = event.latlng;
        setIsNewPin(true);
        setSelectedId(null);
        setDraft({
          title: "Minimart",
          street: "",
          city: "",
          marked: true,
          comment: "",
          lat,
          lng,
        });
        setPlaceMode(false);
        setMessage(t("admin.minimartPinPlaced"));
      });

      mapInstance.current = map;
    }

    void ensureMap();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const map = mapInstance.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const nextIds = new Set(stores.map((s) => s.id));
    for (const [id, marker] of markersRef.current) {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const store of stores) {
      let marker = markersRef.current.get(store.id);
      if (!marker) {
        marker = L.marker([store.lat, store.lng], { draggable: true });
        marker.addTo(map);
        marker.on("click", () => {
          setIsNewPin(false);
          setSelectedId(store.id);
        });
        marker.on("dragend", () => {
          const pos = marker!.getLatLng();
          setIsNewPin(false);
          setSelectedId(store.id);
          setDraft((current) => ({
            title: current?.title ?? store.title,
            street: current?.street ?? store.street,
            city: current?.city ?? store.city,
            marked: current?.marked ?? store.marked,
            comment: current?.comment ?? store.comment,
            lat: pos.lat,
            lng: pos.lng,
          }));
        });
        markersRef.current.set(store.id, marker);
      } else {
        marker.setLatLng([store.lat, store.lng]);
      }
      const tick = store.marked ? "✓ " : "";
      const label = store.city || store.title;
      marker.bindTooltip(`${tick}${label} · ${store.street || "—"}`, {
        direction: "top",
      });
      marker.setOpacity(store.marked ? 1 : 0.7);
    }

    if (!fittedRef.current && stores.length > 0) {
      const bounds = L.latLngBounds(
        stores.map((s) => [s.lat, s.lng] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.12));
      fittedRef.current = true;
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [stores]);

  useEffect(() => {
    if (!draft || !mapInstance.current) return;
    mapInstance.current.setView([draft.lat, draft.lng], Math.max(mapInstance.current.getZoom(), 14), {
      animate: true,
    });
  }, [draft?.lat, draft?.lng]);

  async function syncFromMinimart() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/minimart-locator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = (await response.json()) as {
        upserted?: number;
        count?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("admin.minimartSyncFailed"));
        return;
      }
      fittedRef.current = false;
      setMessage(
        t("admin.minimartSyncOk", {
          upserted: data.upserted ?? 0,
          count: data.count ?? 0,
        }),
      );
      await load();
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setSyncing(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.city.trim()) {
      setError(t("admin.minimartCityRequired"));
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (isNewPin || !selectedId) {
        const response = await fetch("/api/admin/minimart-locator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            title: draft.title.trim() || "Store",
            street: draft.street.trim(),
            city: draft.city.trim(),
            lat: draft.lat,
            lng: draft.lng,
            marked: draft.marked,
            comment: draft.comment,
          }),
        });
        const data = (await response.json()) as {
          store?: MinimartStoreRow;
          error?: string;
        };
        if (!response.ok || !data.store) {
          setError(data.error ?? t("errors.saveFailed"));
          return;
        }
        setStores((current) => [...current, data.store!]);
        setSelectedId(data.store.id);
        setIsNewPin(false);
        setDraft(draftFromStore(data.store));
        setMessage(t("admin.minimartCreated"));
        return;
      }

      const response = await fetch("/api/admin/minimart-locator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          title: draft.title.trim() || "Store",
          street: draft.street.trim(),
          city: draft.city.trim(),
          lat: draft.lat,
          lng: draft.lng,
          marked: draft.marked,
          comment: draft.comment,
        }),
      });
      const data = (await response.json()) as {
        store?: MinimartStoreRow;
        error?: string;
      };
      if (!response.ok || !data.store) {
        setError(data.error ?? t("errors.saveFailed"));
        return;
      }
      setStores((current) =>
        current.map((row) => (row.id === data.store!.id ? data.store! : row)),
      );
      setMessage(t("admin.minimartSaved"));
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!selectedId || isNewPin) {
      setDraft(null);
      setIsNewPin(false);
      setSelectedId(null);
      return;
    }
    if (!window.confirm(t("admin.minimartConfirmDelete"))) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/minimart-locator?id=${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setStores((current) => current.filter((row) => row.id !== selectedId));
      setSelectedId(null);
      setDraft(null);
      setMessage(t("admin.minimartDeleted"));
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  const markedCount = stores.filter((s) => s.marked).length;

  return (
    <div className="space-y-4">
      <AdminSection title={t("admin.minimartLocator")}>
        <p className="mb-3 text-sm text-muted">{t("admin.minimartLocatorHint")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <AdminField label={t("common.search")}>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className={adminInputClass}
                placeholder={t("admin.minimartSearchPlaceholder")}
              />
            </AdminField>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", t("admin.minimartFilterAll")],
                ["marked", t("admin.minimartFilterMarked")],
                ["unmarked", t("admin.minimartFilterUnmarked")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`${appButtonNeutral} ${
                  filter === id ? "border-primary text-primary" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${adminGhostButtonClass} ${
              placeMode ? "border-primary text-primary" : ""
            }`}
            onClick={() => {
              setPlaceMode((value) => !value);
              setMessage(
                placeMode ? "" : t("admin.minimartPlaceHint"),
              );
            }}
          >
            {placeMode ? t("admin.minimartPlaceCancel") : t("admin.minimartPlacePin")}
          </button>
          <button
            type="button"
            className={adminGhostButtonClass}
            onClick={() => void load()}
            disabled={loading}
          >
            {t("admin.refresh")}
          </button>
          <button
            type="button"
            className={adminActionButtonClass}
            onClick={() => void syncFromMinimart()}
            disabled={syncing}
          >
            {syncing ? t("admin.minimartSyncing") : t("admin.minimartSync")}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {t("admin.minimartCounts", {
            total: stores.length,
            marked: markedCount,
          })}
        </p>
        {message ? (
          <p className="mt-2 text-sm text-primary">{message}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </AdminSection>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div
          ref={mapRef}
          className={`h-[28rem] w-full overflow-hidden rounded-2xl border border-card-border bg-card-border/20 lg:h-[36rem] ${
            placeMode ? "cursor-crosshair ring-2 ring-primary/40" : ""
          }`}
        />

        <div className="flex max-h-[36rem] flex-col gap-3">
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-2xl border border-card-border p-2">
            {loading ? (
              <p className="p-2 text-sm text-muted">{t("common.loading")}</p>
            ) : stores.length === 0 ? (
              <p className="p-2 text-sm text-muted">{t("admin.minimartEmpty")}</p>
            ) : (
              stores.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => {
                    setIsNewPin(false);
                    setSelectedId(store.id);
                  }}
                  className={`flex w-full flex-col rounded-xl border px-2.5 py-2 text-left text-sm ${
                    selectedId === store.id && !isNewPin
                      ? "border-primary/50 bg-primary/10"
                      : "border-transparent hover:bg-transparent"
                  }`}
                >
                  <span className="font-medium text-foreground">
                    {store.marked ? "✓ " : ""}
                    {store.city || store.title}
                    {store.manual ? (
                      <span className="ml-1 text-[10px] text-muted">
                        ({t("admin.minimartManual")})
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">
                    {store.street || "—"}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-card-border p-3">
            {draft ? (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  {isNewPin
                    ? t("admin.minimartNewPin")
                    : t("admin.minimartEditPin")}
                  {" · "}
                  {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </p>
                <AdminField label={t("common.name")}>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label={t("admin.minimartCity")}>
                  <input
                    value={draft.city}
                    onChange={(event) =>
                      setDraft({ ...draft, city: event.target.value })
                    }
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label={t("common.address")}>
                  <input
                    value={draft.street}
                    onChange={(event) =>
                      setDraft({ ...draft, street: event.target.value })
                    }
                    className={adminInputClass}
                  />
                </AdminField>
                <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                  <span>{t("admin.minimartMarked")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.marked}
                    onClick={() =>
                      setDraft({ ...draft, marked: !draft.marked })
                    }
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      draft.marked
                        ? "bg-primary"
                        : "border border-card-border bg-transparent"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
                        draft.marked ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </label>
                <AdminField label={t("admin.minimartComment")}>
                  <textarea
                    value={draft.comment}
                    onChange={(event) =>
                      setDraft({ ...draft, comment: event.target.value })
                    }
                    rows={4}
                    className={`${adminInputClass} resize-y`}
                    placeholder={t("admin.minimartCommentPlaceholder")}
                  />
                </AdminField>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`${appButtonPrimary} w-full`}
                    disabled={saving}
                    onClick={() => void saveDraft()}
                  >
                    {saving ? t("admin.saving") : t("common.save")}
                  </button>
                  <button
                    type="button"
                    className={adminDangerButtonClass}
                    disabled={saving}
                    onClick={() => void deleteSelected()}
                  >
                    {t("common.delete")}
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  {t("admin.minimartDragHint")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">{t("admin.minimartPickStore")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
