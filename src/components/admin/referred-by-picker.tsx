"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminField, adminInputClass } from "@/components/admin/admin-ui";
import { useT } from "@/components/i18n-provider";

type BusinessOption = { id: string; name: string };

const NONE = "__none__";

/**
 * Searchable “referred by” picker for business clients.
 */
export function ReferredByPicker({
  clientId,
  value,
  onChange,
  disabled,
}: {
  clientId: string;
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const [options, setOptions] = useState<BusinessOption[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/clients?businessOnly=1");
      const data = await response.json().catch(() => null);
      if (cancelled) return;
      const list = ((data?.clients ?? []) as BusinessOption[]).filter(
        (row) => row.id !== clientId,
      );
      setOptions(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((row) => row.name.toLowerCase().includes(needle));
  }, [filter, options]);

  const selectValue = value ?? NONE;

  return (
    <AdminField label={t("admin.referredBy")}>
      <input
        className={`${adminInputClass} mb-2`}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder={t("admin.referredBySearch")}
        disabled={disabled}
      />
      <select
        className={adminInputClass}
        value={selectValue}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === NONE ? null : next);
        }}
      >
        <option value={NONE}>{t("admin.referredByNone")}</option>
        {filtered.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted">{t("admin.referredByHint")}</p>
    </AdminField>
  );
}
