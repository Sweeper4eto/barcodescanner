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
import { MenuSelect } from "@/components/menu-select";
import {
  MINIMART_STATUSES,
  MINIMART_STATUS_COLORS,
  type MinimartVisitStatus,
} from "@/lib/minimart-locator";

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
  status: MinimartVisitStatus;
  comment: string;
  clientId: string | null;
  clientName: string | null;
  clientHomeUser: boolean | null;
  syncedAt: string;
  manual?: boolean;
};

type ClientOption = {
  id: string;
  name: string;
  homeUser: boolean;
  active: boolean;
};

type FilterMode = "all" | MinimartVisitStatus;

const NO_CLIENT = "__none__";
const NO_LOCATION = "__none_location__";

type Draft = {
  title: string;
  street: string;
  city: string;
  status: MinimartVisitStatus;
  comment: string;
  clientId: string | null;
  lat: number;
  lng: number;
};

function draftFromStore(store: MinimartStoreRow): Draft {
  return {
    title: store.title,
    street: store.street,
    city: store.city,
    status: store.status,
    comment: store.comment,
    clientId: store.clientId,
    lat: store.lat,
    lng: store.lng,
  };
}

function statusMarkerHtml(status: MinimartVisitStatus): string {
  const color = MINIMART_STATUS_COLORS[status];
  return `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`;
}

function storeLabel(store: MinimartStoreRow): string {
  const place = store.city || store.title;
  const street = store.street?.trim() || "—";
  return `${place} · ${street}`;
}

export function MinimartLocatorPanel() {
  const { t } = useT();
  const [stores, setStores] = useState<MinimartStoreRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [toolsOpen, setToolsOpen] = useState(false);
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
  const detailsRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => stores.find((s) => s.id === selectedId) ?? null,
    [stores, selectedId],
  );

  const clientOptions = useMemo(
    () => [
      { value: NO_CLIENT, label: t("admin.minimartNoClient") },
      ...clients
        .filter((client) => !client.homeUser)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((client) => ({
          value: client.id,
          label: client.active
            ? client.name
            : `${client.name} (${t("team.inactive")})`,
        })),
    ],
    [clients, t],
  );

  const statusLabel = useCallback((status: MinimartVisitStatus) => {
    switch (status) {
      case "ACCEPTED":
        return t("admin.minimartStatusAccepted");
      case "THINKING":
        return t("admin.minimartStatusThinking");
      case "REJECTED":
        return t("admin.minimartStatusRejected");
      default:
        return t("admin.minimartStatusNotVisited");
    }
  }, [t]);

  const locationOptions = useMemo(
    () => [
      { value: NO_LOCATION, label: t("admin.minimartPickStore") },
      ...stores.map((store) => ({
        value: store.id,
        label: `${statusLabel(store.status)} · ${storeLabel(store)}${
          store.clientName ? ` · ${store.clientName}` : ""
        }`,
      })),
    ],
    [statusLabel, stores, t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(qInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    placeModeRef.current = placeMode;
  }, [placeMode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/clients");
        const data = (await response.json()) as {
          clients?: ClientOption[];
        };
        if (!cancelled) setClients(data.clients ?? []);
      } catch {
        if (!cancelled) setClients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filter !== "all") params.set("status", filter);
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
      const list = data.stores ?? [];
      setStores(
        [...list].sort((a, b) => {
          const aKey = `${a.city} ${a.street}`;
          const bKey = `${b.city} ${b.street}`;
          return aKey.localeCompare(bKey, undefined, {
            sensitivity: "base",
            numeric: true,
          });
        }),
      );
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

      if (!document.getElementById("minimart-marker-css")) {
        const style = document.createElement("style");
        style.id = "minimart-marker-css";
        style.textContent =
          ".minimart-status-marker{background:transparent!important;border:none!important}";
        document.head.appendChild(style);
      }

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
          status: "NOT_VISITED",
          comment: "",
          clientId: null,
          lat,
          lng,
        });
        setPlaceMode(false);
        setMessage(t("admin.minimartPinPlaced"));
        queueMicrotask(() => {
          detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
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
      const icon =
        store.status === "NOT_VISITED"
          ? new L.Icon.Default()
          : L.divIcon({
              className: "minimart-status-marker",
              html: statusMarkerHtml(store.status),
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });

      let marker = markersRef.current.get(store.id);
      if (!marker) {
        marker = L.marker([store.lat, store.lng], {
          draggable: true,
          icon,
        });
        marker.addTo(map);
        marker.on("click", () => {
          setIsNewPin(false);
          setSelectedId(store.id);
          queueMicrotask(() => {
            detailsRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          });
        });
        marker.on("dragend", () => {
          const pos = marker!.getLatLng();
          setIsNewPin(false);
          setSelectedId(store.id);
          setDraft((current) => ({
            title: current?.title ?? store.title,
            street: current?.street ?? store.street,
            city: current?.city ?? store.city,
            status: current?.status ?? store.status,
            comment: current?.comment ?? store.comment,
            clientId:
              current?.clientId !== undefined
                ? current.clientId
                : store.clientId,
            lat: pos.lat,
            lng: pos.lng,
          }));
        });
        markersRef.current.set(store.id, marker);
      } else {
        marker.setLatLng([store.lat, store.lng]);
        marker.setIcon(icon);
      }
      const label = store.city || store.title;
      marker.bindTooltip(
        `${statusLabel(store.status)} · ${label} · ${store.street || "—"}`,
        { direction: "top" },
      );
    }

    if (!fittedRef.current && stores.length > 0) {
      const bounds = L.latLngBounds(
        stores.map((s) => [s.lat, s.lng] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.12));
      fittedRef.current = true;
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [stores, statusLabel]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const id = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
    return () => window.cancelAnimationFrame(id);
  }, [placeMode, toolsOpen, draft]);

  useEffect(() => {
    if (!draft || !mapInstance.current) return;
    mapInstance.current.setView(
      [draft.lat, draft.lng],
      Math.max(mapInstance.current.getZoom(), 14),
      { animate: true },
    );
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
            status: draft.status,
            comment: draft.comment,
            clientId: draft.clientId,
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
          [...current, data.store!].sort((a, b) => {
            const aKey = `${a.city} ${a.street}`;
            const bKey = `${b.city} ${b.street}`;
            return aKey.localeCompare(bKey, undefined, {
              sensitivity: "base",
              numeric: true,
            });
          }),
        );
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
          status: draft.status,
          comment: draft.comment,
          clientId: draft.clientId,
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

  const acceptedCount = stores.filter((s) => s.status === "ACCEPTED").length;
  const filterButtons: { id: FilterMode; label: string }[] = [
    { id: "all", label: t("admin.minimartFilterAll") },
    ...MINIMART_STATUSES.map((status) => ({
      id: status as FilterMode,
      label: statusLabel(status),
    })),
  ];

  return (
    <div className="space-y-3">
      <AdminSection title={t("admin.minimartLocator")}>
        <p className="mb-2 text-xs text-muted sm:text-sm">
          {t("admin.minimartCounts", {
            total: stores.length,
            accepted: acceptedCount,
          })}
        </p>

        <button
          type="button"
          className={`${adminGhostButtonClass} flex w-full items-center justify-between gap-2 sm:w-auto`}
          aria-expanded={toolsOpen}
          aria-label={
            toolsOpen ? t("admin.minimartToolsHide") : t("admin.minimartToolsShow")
          }
          onClick={() => setToolsOpen((open) => !open)}
        >
          <span>{t("admin.minimartTools")}</span>
          <span aria-hidden className="text-[0.65rem] text-muted">
            {toolsOpen ? "▲" : "▼"}
          </span>
        </button>

        {toolsOpen ? (
          <div className="mt-3 space-y-3 rounded-2xl border border-card-border p-3">
            <p className="text-xs text-muted sm:text-sm">
              {t("admin.minimartLocatorHint")}
            </p>
            <AdminField label={t("common.search")}>
              <input
                value={qInput}
                onChange={(event) => setQInput(event.target.value)}
                className={adminInputClass}
                placeholder={t("admin.minimartSearchPlaceholder")}
                autoComplete="off"
              />
            </AdminField>
            <div className="flex flex-wrap gap-1.5">
              {filterButtons.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`${appButtonNeutral} ${
                    filter === id ? "border-primary text-primary" : ""
                  }`}
                >
                  {id !== "all" ? (
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block size-2 rounded-full"
                      style={{
                        background:
                          MINIMART_STATUS_COLORS[id as MinimartVisitStatus],
                      }}
                    />
                  ) : null}
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${adminGhostButtonClass} ${
                  placeMode ? "border-primary text-primary" : ""
                }`}
                onClick={() => {
                  setPlaceMode((value) => !value);
                  setMessage(placeMode ? "" : t("admin.minimartPlaceHint"));
                }}
              >
                {placeMode
                  ? t("admin.minimartPlaceCancel")
                  : t("admin.minimartPlacePin")}
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
          </div>
        ) : null}

        {message ? (
          <p className="mt-2 text-sm text-primary">{message}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </AdminSection>

      <div
        className={`overflow-hidden rounded-2xl border border-card-border ${
          placeMode
            ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
            : ""
        }`}
      >
        <div
          ref={mapRef}
          className={`h-[min(55vh,22rem)] w-full bg-card-border/20 sm:h-[28rem] lg:h-[32rem] ${
            placeMode ? "cursor-crosshair" : ""
          }`}
        />
      </div>

      <div
        ref={detailsRef}
        className="space-y-3 rounded-2xl border border-card-border p-3"
      >
        <AdminField label={t("admin.minimartPickLocation")}>
          <MenuSelect
            label={t("admin.minimartPickLocation")}
            value={isNewPin ? NO_LOCATION : (selectedId ?? NO_LOCATION)}
            options={locationOptions}
            searchable
            searchPlaceholder={t("admin.minimartLocationSearch")}
            onChange={(next) => {
              if (next === NO_LOCATION) {
                setSelectedId(null);
                setIsNewPin(false);
                setDraft(null);
                return;
              }
              setIsNewPin(false);
              setSelectedId(next);
            }}
            buttonClassName={`${adminInputClass} mt-1 flex items-center justify-between gap-2 text-left`}
            disabled={loading || isNewPin}
          />
        </AdminField>

        {draft ? (
          <div className="space-y-3 border-t border-card-border pt-3">
            <p className="text-xs text-muted">
              {isNewPin
                ? t("admin.minimartNewPin")
                : t("admin.minimartEditPin")}
              {" · "}
              {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
            </p>
            <AdminField label={t("admin.minimartLocationName")}>
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                className={adminInputClass}
                autoComplete="off"
              />
            </AdminField>
            <AdminField label={t("admin.minimartCity")}>
              <input
                value={draft.city}
                onChange={(event) =>
                  setDraft({ ...draft, city: event.target.value })
                }
                className={adminInputClass}
                autoComplete="off"
              />
            </AdminField>
            <AdminField label={t("common.address")}>
              <input
                value={draft.street}
                onChange={(event) =>
                  setDraft({ ...draft, street: event.target.value })
                }
                className={adminInputClass}
                autoComplete="off"
              />
            </AdminField>
            <AdminField label={t("admin.minimartStatus")}>
              <MenuSelect
                label={t("admin.minimartStatus")}
                value={draft.status}
                options={MINIMART_STATUSES.map((status) => ({
                  value: status,
                  label: statusLabel(status),
                }))}
                onChange={(status) => setDraft({ ...draft, status })}
                buttonClassName={`${adminInputClass} mt-1 flex items-center justify-between gap-2 text-left`}
              />
            </AdminField>
            <AdminField label={t("admin.minimartLinkedClient")}>
              <MenuSelect
                label={t("admin.minimartLinkedClient")}
                value={draft.clientId ?? NO_CLIENT}
                options={clientOptions}
                sortByLabel
                pinnedValues={[NO_CLIENT]}
                searchable
                searchPlaceholder={t("admin.minimartAccountSearch")}
                onChange={(next) =>
                  setDraft({
                    ...draft,
                    clientId: next === NO_CLIENT ? null : next,
                  })
                }
                buttonClassName={`${adminInputClass} mt-1 flex items-center justify-between gap-2 text-left`}
              />
              <p className="mt-1 text-[11px] text-muted">
                {t("admin.minimartLinkedClientHint")}
              </p>
            </AdminField>
            <AdminField label={t("admin.minimartComment")}>
              <textarea
                value={draft.comment}
                onChange={(event) =>
                  setDraft({ ...draft, comment: event.target.value })
                }
                rows={3}
                className={`${adminInputClass} resize-y`}
                placeholder={t("admin.minimartCommentPlaceholder")}
              />
            </AdminField>
            <p className="text-[11px] text-muted">
              {t("admin.minimartDragHint")}
            </p>
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
          </div>
        ) : (
          <p className="text-sm text-muted">{t("admin.minimartPickStore")}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted">{t("common.loading")}</p>
        ) : null}
        {!loading && stores.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.minimartEmpty")}</p>
        ) : null}
      </div>
    </div>
  );
}
