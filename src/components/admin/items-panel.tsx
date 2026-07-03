"use client";

import { FormEvent, useCallback, useEffect, useState, type ChangeEvent } from "react";
import {
  AdminEmptyState,
  AdminField,
  AdminSection,
  adminButtonRowClass,
  adminDangerButtonClass,
  adminInputClass,
  adminPaginationClass,
  adminSearchInputClass,
} from "@/components/admin/admin-ui";
import { PrimaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";

type Product = {
  id: string;
  name: string;
  barcode: string;
  imagePath: string | null;
  _count: { inventory: number };
};

type Props = {
  onRefresh?: () => void;
};

export function ItemsPanel({ onRefresh }: Props) {
  const { t } = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [edit, setEdit] = useState({ name: "", barcode: "", imagePath: "" });
  const [savedEdit, setSavedEdit] = useState<typeof edit | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (query) params.set("q", query);
    const response = await fetch(`/api/admin/products?${params}`);
    const data = await response.json();
    setProducts(data.products ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
  }, [page, query]);

  const itemDirty =
    selectedId !== null &&
    savedEdit !== null &&
    (edit.name !== savedEdit.name ||
      edit.barcode !== savedEdit.barcode ||
      edit.imagePath !== savedEdit.imagePath);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (itemDirty && saveMessage === t("admin.saveSuccess")) {
      setSaveMessage("");
    }
  }, [itemDirty, saveMessage, t]);

  function selectProduct(product: Product) {
    setSelectedId(product.id);
    const snapshot = {
      name: product.name,
      barcode: product.barcode,
      imagePath: product.imagePath ?? "",
    };
    setEdit(snapshot);
    setSavedEdit(snapshot);
    setSaveMessage("");
  }

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("errors.uploadFailed"));
      setEdit((current) => ({ ...current, imagePath: data.path }));
    } catch (error) {
      alert(error instanceof Error ? error.message : t("errors.uploadFailed"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function saveProduct() {
    if (!selectedId || !itemDirty) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          name: edit.name,
          barcode: edit.barcode,
          imagePath: edit.imagePath || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      const snapshot = { ...edit };
      setSavedEdit(snapshot);
      setSaveMessage(t("admin.saveSuccess"));
      await loadProducts();
      onRefresh?.();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!selectedId) return;
    if (!confirm(t("admin.confirmDeleteProduct"))) return;
    const response = await fetch(`/api/admin/products?id=${selectedId}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error ?? t("errors.invalidData"));
      return;
    }
    setSelectedId(null);
    await loadProducts();
    onRefresh?.();
  }

  const selectedProduct = products.find((product) => product.id === selectedId);
  const safePage = Math.min(page, totalPages);

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-12">
      <div className="min-w-0 md:col-span-4">
        <AdminSection title={t("admin.items")}>
          <form className="mb-4 flex min-w-0 gap-2" onSubmit={onSearch}>
            <input
              className={adminSearchInputClass}
              placeholder={t("admin.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg"
            >
              {t("common.search")}
            </button>
          </form>
          <div className="space-y-2">
            {products.length === 0 ? (
              <AdminEmptyState message={t("admin.noItemsFound")} />
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => selectProduct(product)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selectedId === product.id
                      ? "border-primary bg-primary/5"
                      : "border-card-border bg-background hover:bg-subtle"
                  }`}
                >
                  {product.imagePath ? (
                    <img
                      src={product.imagePath}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-subtle text-xs text-muted">
                      {t("admin.noImage")}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{product.name}</p>
                    <p className="truncate text-sm text-muted">{product.barcode}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          {totalPages > 1 ? (
            <div className={`mt-4 ${adminPaginationClass}`}>
              <p className="text-sm text-muted">
                {t("admin.pageOf", { page: safePage, totalPages })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {t("admin.previous")}
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {t("admin.next")}
                </button>
              </div>
            </div>
          ) : null}
          {total > 0 ? (
            <p className="mt-2 text-xs text-muted">
              {t("admin.itemsTotal", { count: total })}
            </p>
          ) : null}
        </AdminSection>
      </div>

      <div className="min-w-0 md:col-span-8">
        {!selectedId ? (
          <AdminEmptyState message={t("admin.selectItem")} />
        ) : (
          <div className="rounded-2xl border border-card-border bg-background p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {t("admin.editItem")}
            </h2>
            <div className="mx-auto max-w-md space-y-4">
              <div className="flex justify-center">
                {edit.imagePath ? (
                  <img
                    src={edit.imagePath}
                    alt=""
                    className="h-40 w-40 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-subtle text-sm text-muted">
                    {t("admin.noImage")}
                  </div>
                )}
              </div>
              <AdminField label={t("admin.changeImage")}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full text-sm text-foreground"
                  disabled={uploading}
                  onChange={(event) => void onImageChange(event)}
                />
                {uploading ? (
                  <p className="mt-1 text-xs text-muted">{t("admin.uploadingImage")}</p>
                ) : null}
              </AdminField>
              <AdminField label={t("common.name")}>
                <input
                  className={adminInputClass}
                  value={edit.name}
                  onChange={(event) => setEdit({ ...edit, name: event.target.value })}
                />
              </AdminField>
              <AdminField label={t("common.barcode")}>
                <input
                  className={adminInputClass}
                  value={edit.barcode}
                  onChange={(event) => setEdit({ ...edit, barcode: event.target.value })}
                />
              </AdminField>
              {selectedProduct ? (
                <p className="text-sm text-muted">
                  {t("admin.itemInventoryCount", {
                    count: selectedProduct._count.inventory,
                  })}
                </p>
              ) : null}
              {saveMessage ? (
                <p
                  className={`text-sm ${
                    saveMessage === t("admin.saveSuccess")
                      ? "text-emerald-700"
                      : "text-error"
                  }`}
                >
                  {saveMessage}
                </p>
              ) : null}
              <div className={adminButtonRowClass}>
                <PrimaryButton
                  disabled={!itemDirty || saving || uploading}
                  onClick={() => void saveProduct()}
                >
                  {saving ? t("admin.saving") : t("common.save")}
                </PrimaryButton>
                <button
                  type="button"
                  className={adminDangerButtonClass}
                  onClick={() => void deleteProduct()}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
