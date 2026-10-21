"use client";

import { CameraIcon, RefreshIcon } from "@/components/app-nav-icons";
import { DocumentDraftListCard } from "@/components/document-draft-list-card";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { useT } from "@/components/i18n-provider";
import {
  type DocumentDraftItem,
  type DocumentPageDraft,
  draftMatchesSearch,
} from "@/lib/document-draft";
import { appButtonNeutral, appButtonPrimary } from "@/lib/app-ui";

type Props = {
  page: DocumentPageDraft;
  pageIndex: number;
  search: string;
  busy: boolean;
  onRetake: () => void;
  onReattach: () => void;
  onOpenItem: (key: string) => void;
  onRemoveItem: (key: string) => void;
};

export function DocumentPageSection({
  page,
  pageIndex,
  search,
  busy,
  onRetake,
  onReattach,
  onOpenItem,
  onRemoveItem,
}: Props) {
  const { t } = useT();
  const filtered = page.items.filter((item) => draftMatchesSearch(item, search));
  const processing = page.status === "processing";
  const title = t("addDocument.pageSectionTitle", {
    n: pageIndex + 1,
    count: page.items.length,
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-card-border">
      <div className="flex items-center gap-2 border-b border-card-border px-2 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={page.imageDataUrl}
          alt=""
          className="size-12 shrink-0 rounded-lg border border-card-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {page.label.trim() ? (
            <p className="truncate text-xs text-muted">{page.label}</p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 px-2 py-2">
        <button
          type="button"
          disabled={busy || processing}
          onClick={onRetake}
          className={`${appButtonPrimary} flex-1 py-2 text-xs`}
        >
          <CameraIcon className="size-3.5 shrink-0" />
          {t("addDocument.retakePage")}
        </button>
        <button
          type="button"
          disabled={busy || processing}
          onClick={onReattach}
          className={`${appButtonNeutral} flex-1 py-2 text-xs`}
        >
          <RefreshIcon className="size-3.5 shrink-0" />
          {t("addDocument.reattachPage")}
        </button>
      </div>

      {page.error ? (
        <p className="px-2 pb-2 text-sm text-error">{page.error}</p>
      ) : null}

      {processing ? (
        <div className="px-2 pb-3">
          <LoadingSpinnerBlock wrapperClassName="flex justify-center py-4" />
          <p className="text-center text-sm text-muted">
            {t("addDocument.processingPage")}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 px-1.5 pb-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">
              {page.items.length === 0
                ? t("addDocument.emptyPageReview")
                : t("addDocument.noResults")}
            </p>
          ) : (
            filtered.map((item: DocumentDraftItem) => (
              <DocumentDraftListCard
                key={item.key}
                item={item}
                onOpen={() => onOpenItem(item.key)}
                onRemove={() => onRemoveItem(item.key)}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
