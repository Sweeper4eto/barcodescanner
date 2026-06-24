"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";

type CalendarRow = {
  client: { id: string; name: string; monthlyFeePerStore: number };
  activeStoreCount: number;
  expectedAmount: number;
  paid: boolean;
  payment: {
    discount: number;
    amountPaid: number;
    activeStoreCount: number;
  } | null;
};

export function PaymentsPanel() {
  const { t, monthName } = useT();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");

  async function loadCalendar(y = year, m = month) {
    const response = await fetch(
      `/api/admin/payments/calendar?year=${y}&month=${m}&calendar=1`,
    );
    const data = await response.json();
    setRows(data.rows ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const response = await fetch(
        `/api/admin/payments/calendar?year=${year}&month=${month}&calendar=1`,
      );
      const data = await response.json();
      if (!cancelled) setRows(data.rows ?? []);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  }

  async function markPaid() {
    if (!selectedClientId) return;
    await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClientId,
        year,
        month,
        discount: Number(discount) || 0,
        notes: notes || undefined,
      }),
    });
    setSelectedClientId("");
    setDiscount("0");
    setNotes("");
    await loadCalendar();
  }

  const selected = rows.find((row) => row.client.id === selectedClientId);
  const currency = t("common.currency");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-card-border p-4">
        <div className="flex items-center justify-between">
          <button className="rounded-lg border border-input-border bg-card px-3 py-2 text-foreground" onClick={() => shiftMonth(-1)}>
            ←
          </button>
          <h2 className="text-lg font-medium">
            {monthName(month)} {year}
          </h2>
          <button className="rounded-lg border border-input-border bg-card px-3 py-2 text-foreground" onClick={() => shiftMonth(1)}>
            →
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">{t("admin.paymentFormula")}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <button
              key={row.client.id}
              type="button"
              onClick={() => setSelectedClientId(row.client.id)}
              className={`rounded-xl border p-3 text-left ${row.paid ? "border-success-border bg-success-bg" : "border-card-border"} ${selectedClientId === row.client.id ? "ring-2 ring-primary" : ""}`}
            >
              <p className="font-medium">{row.client.name}</p>
              <p className="text-xs text-muted">
                {t("admin.activeCount", {
                  count: row.activeStoreCount,
                  amount: row.expectedAmount.toFixed(2),
                  currency,
                })}
              </p>
              <p className="text-xs font-medium text-foreground">
                {row.paid
                  ? t("admin.paid", {
                      amount: row.payment?.amountPaid.toFixed(2) ?? "0",
                      currency,
                    })
                  : t("admin.unpaid")}
              </p>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <section className="rounded-2xl border border-card-border p-4">
          <h3 className="font-medium">
            {t("admin.markPayment", { name: selected.client.name })}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t("admin.expectedAmount", {
              amount: selected.expectedAmount.toFixed(2),
              currency,
              stores: selected.activeStoreCount,
              fee: selected.client.monthlyFeePerStore,
            })}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl border border-input-border bg-input text-foreground px-3 py-2"
              placeholder={t("admin.discountPlaceholder", { currency })}
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
            <input
              className="rounded-xl border border-input-border bg-input text-foreground px-3 py-2"
              placeholder={t("admin.notesPlaceholder")}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {t("admin.finalAmount", {
              amount: Math.max(
                0,
                selected.expectedAmount - (Number(discount) || 0),
              ).toFixed(2),
              currency,
            })}
          </p>
          <div className="mt-3">
            <PrimaryButton onClick={() => void markPaid()}>{t("admin.markAsPaid")}</PrimaryButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}
