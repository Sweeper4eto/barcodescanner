"use client";

import { useRouter } from "next/navigation";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  DocumentNavIcon,
  ExpiryNavIcon,
  MergedItemsStatIcon,
  NewItemsStatIcon,
  RefreshIcon,
} from "@/components/app-nav-icons";
import { CameraCapture, prepareDocumentImage } from "@/components/camera-capture";
import { assessDocumentPhotoQuality } from "@/lib/document-image";
import { DocumentDraftDetailSheet } from "@/components/document-draft-detail-sheet";
import { DocumentPageSection } from "@/components/document-page-section";
import { DocumentProcessingPanel } from "@/components/document-processing-panel";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { LocationConfirmDialog } from "@/components/location-confirm-dialog";
import { MobilePageHeader, listPageChromeClassName } from "@/components/mobile-page-header";
import { useNavigationLeaveGuard } from "@/components/navigation-leave-guard";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import { goBackOrApp, navigateApp } from "@/lib/app-navigation";
import {
  appButtonCancelFull,
  appButtonPrimaryFull,
  appButtonNeutralFull,
  appFooterButtonGrid,
  appListInset,
  appSearchInput,
  appStatIconWrap,
} from "@/lib/app-ui";
import { useBrowserBackStack } from "@/lib/browser-back";
import { useAppStoreId, useLockStoreSelection } from "@/hooks/use-app-store-id";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";
import {
  type DocumentDraftItem,
  type DocumentPageDraft,
  documentPagesCanImport,
  documentPagesImportItems,
  draftMissingExpiry,
  filterDocumentPagesBySearch,
  flattenDocumentPageItems,
  markDocumentPageProcessing,
  removeDocumentPageItem,
  removeDocumentPageItemsWithoutExpiry,
  removeDocumentPagesItemsWithoutExpiry,
  replaceDocumentPageContent,
  setDocumentPageError,
  updateDocumentPageItem,
} from "@/lib/document-draft";

/** Full-height review shell — no horizontal pad (content uses appListInset). */
const reviewPageShellClassName =
  "mx-auto flex h-[calc(100svh-var(--app-bottom-nav-frame)-env(safe-area-inset-bottom,0px))] min-h-0 w-full max-w-lg flex-col overflow-x-visible pt-1";

const MAX_REATTACH_BYTES = 12 * 1024 * 1024;

type Step =
  | "confirmLocation"
  | "camera"
  | "processing"
  | "review"
  | "replacePage"
  | "done";

type ImportResult = { created: number; merged: number };
type SessionTotals = { scans: number; created: number; merged: number };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AddDocumentContent() {
  const { t } = useT();
  const router = useRouter();
  const { ready, user } = useAppSession();
  const { storeId } = useAppStoreId();
  const reattachInputRef = useRef<HTMLInputElement>(null);
  /** After retake/reattach, keep the review list on that page section. */
  const restoreReviewPageIdRef = useRef<string | null>(null);
  /** Ignore stale retake/reattach completions when a newer attempt started. */
  const replaceAttemptRef = useRef(0);

  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("confirmLocation");
  const [cameraSession, setCameraSession] = useState(0);

  // After Yes on location confirm, lock the picker — no second confirm if they switch.
  useLockStoreSelection(step !== "confirmLocation");
  useScreenWakeLock(
    step === "confirmLocation" ||
      step === "camera" ||
      step === "processing" ||
      step === "review" ||
      step === "replacePage",
  );

  // Bottom nav Scan / Expiry would wipe unsaved OCR review — confirm first.
  useNavigationLeaveGuard(step === "review" || step === "replacePage", {
    title: t("addDocument.leaveReviewTitle"),
    message: t("addDocument.leaveReviewMessage"),
    stayLabel: t("addDocument.leaveReviewStay"),
    leaveLabel: t("addDocument.leaveReviewLeave"),
  });

  const locationName = useMemo(() => {
    const match = user?.stores.find((store) => store.id === storeId);
    return match?.name ?? storeId;
  }, [storeId, user?.stores]);

  const [pages, setPages] = useState<DocumentPageDraft[]>([]);
  const [replacePageId, setReplacePageId] = useState<string | null>(null);
  const [reattachPageId, setReattachPageId] = useState<string | null>(null);
  const [pageActionBusy, setPageActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [confirmRemoveNoExpiry, setConfirmRemoveNoExpiry] = useState(false);
  const [confirmRemoveNoExpiryPageId, setConfirmRemoveNoExpiryPageId] = useState<
    string | null
  >(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [sessionTotals, setSessionTotals] = useState<SessionTotals>({
    scans: 0,
    created: 0,
    merged: 0,
  });
  const [processingProgress, setProcessingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);

  const items = useMemo(() => flattenDocumentPageItems(pages), [pages]);

  const detailItem = useMemo(
    () => items.find((item) => item.key === detailKey) ?? null,
    [detailKey, items],
  );

  const confirmRemoveItem = useMemo(
    () => items.find((item) => item.key === removeKey) ?? null,
    [removeKey, items],
  );

  const replacePageIndex = useMemo(() => {
    if (!replacePageId) return -1;
    return pages.findIndex((page) => page.id === replacePageId);
  }, [pages, replacePageId]);

  useBrowserBackStack([
    {
      id: "draft-detail",
      open: detailKey !== null,
      close: () => setDetailKey(null),
    },
    {
      id: "draft-remove",
      open: removeKey !== null,
      close: () => setRemoveKey(null),
    },
    {
      id: "draft-remove-no-expiry",
      open: confirmRemoveNoExpiry,
      close: () => setConfirmRemoveNoExpiry(false),
    },
    {
      id: "replace-page",
      open: step === "replacePage",
      close: () => {
        setReplacePageId(null);
        setStep("review");
      },
    },
  ]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.homeUser) {
      router.replace(
        storeId
          ? `/app/expiry?storeId=${encodeURIComponent(storeId)}`
          : "/app",
      );
      return;
    }
    setChecking(false);
  }, [ready, user, router, storeId]);

  type ParsedItem = {
    name?: string;
    barcode?: string | null;
    articul?: string | null;
    expiryYmd?: string | null;
    quantity?: number;
    productId?: string | null;
    productImagePath?: string | null;
    matchSource?: "barcode" | "name" | "articul" | null;
  };

  type ProcessResult =
    | { ok: true; items: ParsedItem[] }
    | { ok: false; error: string; retryable?: boolean };

  async function parseDocument(dataUrl: string, attempt = 0): Promise<Response> {
    // Client-side ceiling so a finished server OCR cannot leave the phone spinning
    // forever when the response never arrives (flaky mobile network / half-open socket).
    const timeoutMs = 120_000;
    let response: Response;
    try {
      response = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, dataUrl }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new Error(t("errors.documentTimeout"));
      }
      throw error;
    }
    if (
      attempt < 1 &&
      (response.status === 502 ||
        response.status === 503 ||
        response.status === 504)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return parseDocument(dataUrl, attempt + 1);
    }
    return response;
  }

  function toDraftItems(parsed: ParsedItem[]): DocumentDraftItem[] {
    return parsed.map((item) => ({
      key: newKey(),
      name: item.name ?? "",
      barcode: item.barcode ?? "",
      articul: item.articul ?? "",
      expiryYmd: item.expiryYmd ?? "",
      quantity: String(item.quantity && item.quantity >= 1 ? item.quantity : 1),
      productId: item.productId ?? null,
      productImagePath: item.productImagePath ?? null,
      matchSource: item.matchSource ?? null,
    }));
  }

  function makePage(
    dataUrl: string,
    label: string,
    draftItems: DocumentDraftItem[],
  ): DocumentPageDraft {
    return {
      id: newKey(),
      label,
      imageDataUrl: dataUrl,
      status: "ready",
      items: draftItems,
      error: null,
    };
  }

  /**
   * Never throws — network/parse failures are converted into a ProcessResult
   * so callers (including the retry wrapper) don't need their own try/catch.
   */
  async function processDocumentImage(dataUrl: string): Promise<ProcessResult> {
    try {
      // Let React paint the processing / review spinner before heavy canvas work
      // freezes the main thread (otherwise Retake feels stuck on the still preview).
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      // Local design/testing uses OCR mocks — don't block on photo quality.
      if (process.env.NODE_ENV === "production") {
        const quality = await assessDocumentPhotoQuality(dataUrl);
        if (!quality.ok) {
          const key =
            quality.reason === "blurry"
              ? "errors.documentPhotoBlurry"
              : quality.reason === "glare"
                ? "errors.documentPhotoGlare"
                : quality.reason === "tooDark"
                  ? "errors.documentPhotoTooDark"
                  : "errors.documentPhotoTooSmall";
          // Deterministic result of the same image — retrying won't help.
          return { ok: false, error: t(key), retryable: false };
        }
      }

      const prepared = await prepareDocumentImage(dataUrl);
      const response = await parseDocument(prepared);
      if (response.status === 413) {
        return { ok: false, error: t("errors.documentTooLarge"), retryable: false };
      }
      if (response.status === 504) {
        return { ok: false, error: t("errors.documentTimeout") };
      }

      const rawText = await response.text();
      let data: { error?: string; items?: ParsedItem[] } | null = null;
      try {
        data = JSON.parse(rawText) as { error?: string; items?: ParsedItem[] };
      } catch {
        return {
          ok: false,
          error:
            response.ok
              ? t("errors.documentParseFailed")
              : response.status === 502 || response.status === 503
                ? t("errors.documentTimeout")
                : t("errors.documentParseFailed"),
        };
      }
      if (!response.ok || !data?.items) {
        return {
          ok: false,
          error:
            typeof data?.error === "string" && data.error
              ? data.error
              : t("errors.documentParseFailed"),
        };
      }
      return { ok: true, items: data.items };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Proxy/browser often drops the socket while the server is still cascading
      // Gemini models after free-tier 429s — surface a timeout, not "Failed to fetch".
      if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return { ok: false, error: t("errors.documentTimeout") };
      }
      return { ok: false, error: message || t("errors.documentParseFailed") };
    }
  }

  /** Retries once when the failure could plausibly be transient (network/AI hiccup). */
  async function processDocumentImageWithRetry(dataUrl: string): Promise<ProcessResult> {
    const first = await processDocumentImage(dataUrl);
    if (first.ok || first.retryable === false) return first;
    return processDocumentImage(dataUrl);
  }

  async function onCapture(dataUrl: string) {
    if (!storeId) return;
    setError("");
    setFailedFiles([]);
    setStep("processing");
    setProcessingProgress(null);
    const result = await processDocumentImageWithRetry(dataUrl);
    if (!result.ok) {
      setError(result.error);
      setStep("camera");
      return;
    }
    setPages([
      makePage(dataUrl, t("addDocument.pageLabel", { n: 1 }), toDraftItems(result.items)),
    ]);
    setSearch("");
    setStep("review");
  }

  async function onMultipleCapture(
    capturePages: { dataUrl: string; name: string }[],
  ) {
    if (!storeId || capturePages.length === 0) return;
    setError("");
    setFailedFiles([]);
    setStep("processing");
    const collected: DocumentPageDraft[] = [];
    let failed = 0;
    for (let index = 0; index < capturePages.length; index += 1) {
      setProcessingProgress({ current: index + 1, total: capturePages.length });
      const page = capturePages[index];
      const label =
        page.name.trim() ||
        t("addDocument.pageLabel", { n: index + 1 });
      const result = await processDocumentImageWithRetry(page.dataUrl);
      if (result.ok) {
        collected.push(
          makePage(page.dataUrl, label, toDraftItems(result.items)),
        );
      } else {
        failed += 1;
        setFailedFiles((current) => [...current, label]);
      }
    }
    setProcessingProgress(null);

    if (collected.length === 0) {
      setError(t("errors.documentParseFailed"));
      setStep("camera");
      setFailedFiles([]);
      return;
    }

    setPages(collected);
    setSearch("");
    setStep("review");
    setFailedFiles([]);
    if (failed > 0) {
      setError(
        t("addDocument.multiPartialFailure", {
          failed,
          total: capturePages.length,
        }),
      );
    }
  }

  async function replacePageWithImage(
    pageId: string,
    dataUrl: string,
    label?: string,
  ) {
    const attempt = ++replaceAttemptRef.current;
    setError("");
    setPageActionBusy(true);
    // Swap thumbnail immediately so Retake doesn't look frozen on the old photo.
    setPages((current) =>
      markDocumentPageProcessing(current, pageId, {
        imageDataUrl: dataUrl,
        label,
      }),
    );
    setStep("review");
    setReplacePageId(null);

    try {
      const result = await processDocumentImageWithRetry(dataUrl);
      if (attempt !== replaceAttemptRef.current) return;

      if (!result.ok) {
        setPages((current) =>
          setDocumentPageError(current, pageId, result.error),
        );
        setError(result.error);
        return;
      }

      let draftItems: DocumentDraftItem[];
      try {
        draftItems = toDraftItems(result.items);
      } catch {
        const message = t("errors.documentParseFailed");
        setPages((current) => setDocumentPageError(current, pageId, message));
        setError(message);
        return;
      }

      setPages((current) =>
        replaceDocumentPageContent(current, pageId, {
          imageDataUrl: dataUrl,
          label,
          items: draftItems,
        }),
      );
      setDetailKey(null);
    } catch (error) {
      if (attempt !== replaceAttemptRef.current) return;
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("errors.documentParseFailed");
      setPages((current) => setDocumentPageError(current, pageId, message));
      setError(message);
    } finally {
      if (attempt !== replaceAttemptRef.current) return;
      setPageActionBusy(false);
      // Safety net: never leave the page spinning after this attempt ends
      // (hung fetch after server OCR, or a throw between result and setPages).
      setPages((current) =>
        current.map((page) =>
          page.id === pageId && page.status === "processing"
            ? {
                ...page,
                status: "ready" as const,
                error: page.error ?? t("errors.documentTimeout"),
              }
            : page,
        ),
      );
    }
  }

  function startRetakePage(pageId: string) {
    setError("");
    restoreReviewPageIdRef.current = pageId;
    setReplacePageId(pageId);
    setStep("replacePage");
    setCameraSession((n) => n + 1);
  }

  function startReattachPage(pageId: string) {
    setError("");
    restoreReviewPageIdRef.current = pageId;
    setReattachPageId(pageId);
    reattachInputRef.current?.click();
  }

  useLayoutEffect(() => {
    if (step !== "review") return;
    const pageId = restoreReviewPageIdRef.current;
    if (!pageId) return;
    const el = document.getElementById(`doc-review-page-${pageId}`);
    if (!el) return;
    el.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
    const page = pages.find((entry) => entry.id === pageId);
    // Drop the pin once that page is idle again so later edits don't yank scroll.
    if (page?.status === "ready" && !pageActionBusy) {
      restoreReviewPageIdRef.current = null;
    }
  }, [step, pages, pageActionBusy]);

  async function onReattachFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const pageId = reattachPageId;
    setReattachPageId(null);
    if (!file || !pageId) {
      if (!file) restoreReviewPageIdRef.current = null;
      return;
    }

    if (!/^image\//i.test(file.type) && !/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)) {
      setError(t("errors.invalidFileFormat"));
      return;
    }
    if (file.size > MAX_REATTACH_BYTES) {
      setError(t("errors.fileTooLarge"));
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("read failed"));
        };
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(file);
      });
      await replacePageWithImage(pageId, dataUrl, file.name);
    } catch {
      setError(t("errors.uploadFailed"));
    }
  }

  function updateItem(key: string, patch: Partial<DocumentDraftItem>) {
    setPages((current) => updateDocumentPageItem(current, key, patch));
  }

  function removeItem(key: string) {
    setPages((current) => removeDocumentPageItem(current, key));
    setRemoveKey(null);
    if (detailKey === key) setDetailKey(null);
  }

  function removeItemsWithoutExpiry() {
    setPageActionBusy(false);
    setPages((current) =>
      removeDocumentPagesItemsWithoutExpiry(current).map((page) =>
        page.status === "processing"
          ? { ...page, status: "ready" as const }
          : page,
      ),
    );
    setDetailKey(null);
    setConfirmRemoveNoExpiry(false);
  }

  function removePageItemsWithoutExpiry(pageId: string) {
    setPageActionBusy(false);
    setPages((current) =>
      removeDocumentPageItemsWithoutExpiry(current, pageId).map((page) =>
        page.status === "processing"
          ? { ...page, status: "ready" as const }
          : page,
      ),
    );
    setDetailKey(null);
    setConfirmRemoveNoExpiryPageId(null);
  }

  function clearReviewAndRestart() {
    restoreReviewPageIdRef.current = null;
    setPages([]);
    setSearch("");
    setDetailKey(null);
    setReplacePageId(null);
    setConfirmRemoveNoExpiry(false);
    setConfirmRemoveNoExpiryPageId(null);
    setError("");
    setStep("camera");
    setCameraSession((n) => n + 1);
  }

  const visiblePages = useMemo(
    () => filterDocumentPagesBySearch(pages, search),
    [pages, search],
  );

  const noExpiryCount = useMemo(
    () => items.filter((item) => draftMissingExpiry(item)).length,
    [items],
  );

  const confirmRemoveNoExpiryPage = useMemo(
    () =>
      confirmRemoveNoExpiryPageId
        ? pages.find((page) => page.id === confirmRemoveNoExpiryPageId) ?? null
        : null,
    [confirmRemoveNoExpiryPageId, pages],
  );

  const pageNoExpiryCount = useMemo(
    () =>
      confirmRemoveNoExpiryPage
        ? confirmRemoveNoExpiryPage.items.filter((item) =>
            draftMissingExpiry(item),
          ).length
        : 0,
    [confirmRemoveNoExpiryPage],
  );

  const canImport = !pageActionBusy && documentPagesCanImport(pages);

  async function confirmImport() {
    if (!canImport || !storeId || importing) return;
    const importItems = documentPagesImportItems(pages);
    if (importItems.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          items: importItems.map((item) => ({
            name: item.name.trim(),
            barcode: item.barcode.trim() || null,
            articul: item.articul.trim() || null,
            expiryYmd: item.expiryYmd,
            quantity: Number(item.quantity),
            productId: item.productId,
          })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      const created = Number(data?.created ?? 0);
      const merged = Number(data?.merged ?? 0);
      setLastResult({ created, merged });
      setSessionTotals((totals) => ({
        scans: totals.scans + 1,
        created: totals.created + created,
        merged: totals.merged + merged,
      }));
      setPages([]);
      setSearch("");
      setDetailKey(null);
      setStep("done");
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setImporting(false);
    }
  }

  const isReviewStep = step === "review";

  if (checking) {
    return (
      <div className="mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-6 pt-1">
        <MobilePageHeader title={t("addDocument.title")} sticky />
        <LoadingSpinnerBlock wrapperClassName="flex justify-center py-6" />
      </div>
    );
  }

  const showCamera = step === "confirmLocation" || step === "camera";

  return (
    <>
      <input
        ref={reattachInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(event) => void onReattachFileSelected(event)}
      />

      <div
        className={
          isReviewStep
            ? reviewPageShellClassName
            : "mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-5 pt-1"
        }
      >
        {!isReviewStep ? (
          <MobilePageHeader
            title={
              step === "processing" || step === "done"
                ? undefined
                : step === "replacePage"
                  ? t("addDocument.replacePageTitle", {
                      n: Math.max(1, replacePageIndex + 1),
                    })
                  : t("addDocument.title")
            }
            sticky
          />
        ) : null}

      {showCamera ? (
        <div className="space-y-3">
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <CameraCapture
            variant="document"
            autoStart
            allowFileUpload
            allowMultipleFiles
            showViewfinder
            onCapture={(dataUrl) => {
              if (step !== "camera") return;
              void onCapture(dataUrl);
            }}
            onMultipleCapture={(pagesBatch) => {
              if (step !== "camera") return;
              void onMultipleCapture(pagesBatch);
            }}
            onNewDocument={() => {
              if (step !== "camera") return;
              setError("");
              // CameraCapture retakes in place (keeps MediaStream). Only remount
              // if the child could not reuse a live stream.
              setCameraSession((n) => n + 1);
            }}
            onCancel={() => {
              if (step === "confirmLocation") {
                goBackOrApp("/app");
                return;
              }
              navigateApp("/app");
            }}
            key={cameraSession}
          />
        </div>
      ) : null}

      {step === "replacePage" && replacePageId ? (
        <div className="space-y-3">
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <CameraCapture
            variant="document"
            autoStart
            allowFileUpload
            allowMultipleFiles={false}
            showViewfinder
            onCapture={(dataUrl) => {
              void replacePageWithImage(replacePageId, dataUrl);
            }}
            onCancel={() => {
              setReplacePageId(null);
              setStep("review");
            }}
            key={`replace-${replacePageId}-${cameraSession}`}
          />
        </div>
      ) : null}

      {step === "processing" ? (
        <DocumentProcessingPanel
          current={processingProgress?.current}
          total={processingProgress?.total}
          failedFiles={failedFiles}
        />
      ) : null}

      {step === "review" ? (
        <>
          <div className={`${listPageChromeClassName} ${appListInset}`}>
            <MobilePageHeader className="mb-0 border-0 pb-0" />
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${appListInset} pb-3 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0`}>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-foreground">
                      {t("addDocument.reviewTitle")}
                    </h2>
                    <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-sm font-bold tabular-nums text-primary-fg">
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {pages.length > 1
                      ? t("addDocument.reviewHintMulti", { pages: pages.length })
                      : t("addDocument.reviewHint")}
                  </p>
                </div>
              </div>
              {error ? <p className="text-sm text-error">{error}</p> : null}

              <div className="flex items-center gap-1.5">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder={t("addDocument.searchPlaceholder")}
                  aria-label={t("addDocument.searchPlaceholder")}
                  inputClassName={appSearchInput}
                />
                <button
                  type="button"
                  disabled={noExpiryCount === 0 || pageActionBusy}
                  onClick={() => setConfirmRemoveNoExpiry(true)}
                  title={t("addDocument.removeNoExpiryHint", { count: noExpiryCount })}
                  aria-label={t("addDocument.removeNoExpiryHint", { count: noExpiryCount })}
                  className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-primary/50 bg-transparent px-2 text-[10px] font-medium leading-none text-primary disabled:opacity-40"
                >
                  {t("addDocument.removeNoExpiry")}
                  {noExpiryCount > 0 ? (
                    <span className="tabular-nums">({noExpiryCount})</span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-3">
              {visiblePages.length === 0 ? (
                <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
                  {pages.length === 0
                    ? t("addDocument.emptyReview")
                    : t("addDocument.noResults")}
                </p>
              ) : (
                visiblePages.map((page) => {
                  const pageIndex = pages.findIndex((entry) => entry.id === page.id);
                  return (
                    <DocumentPageSection
                      key={page.id}
                      page={page}
                      pageIndex={pageIndex >= 0 ? pageIndex : 0}
                      search={search}
                      busy={pageActionBusy}
                      onRetake={() => startRetakePage(page.id)}
                      onReattach={() => startReattachPage(page.id)}
                      onRemoveNoExpiry={() =>
                        setConfirmRemoveNoExpiryPageId(page.id)
                      }
                      onOpenItem={(key) => setDetailKey(key)}
                      onRemoveItem={(key) => setRemoveKey(key)}
                    />
                  );
                })
              )}
            </div>
          </div>

          <div
            className={`shrink-0 ${appListInset} border-t border-card-border bg-background pt-3 pb-2 ${appFooterButtonGrid}`}
          >
            <button
              type="button"
              className={appButtonCancelFull}
              disabled={pageActionBusy}
              onClick={clearReviewAndRestart}
            >
              <RefreshIcon className="size-4 shrink-0" />
              {pages.length > 1
                ? t("addDocument.startOver")
                : t("addDocument.retake")}
            </button>
            <button
              type="button"
              disabled={!canImport || importing}
              className={`${appButtonPrimaryFull} disabled:opacity-50`}
              onClick={() => void confirmImport()}
            >
              {!importing ? (
                <ExpiryNavIcon className="size-4 shrink-0" />
              ) : null}
              {importing ? t("addDocument.importing") : t("addDocument.confirmImport")}
            </button>
          </div>
        </>
      ) : null}

      {step === "done" ? (
        <div className="space-y-4 pb-2 pt-1">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/brand-mark.png?v=3"
              alt=""
              width={96}
              height={96}
              decoding="async"
              className="mx-auto size-24 object-contain"
            />
            <h2 className="mt-4 text-2xl font-semibold text-foreground">
              {t("addDocument.doneTitle")}
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-snug text-muted">
              {t("addDocument.doneHint")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-card-border p-2.5">
              <div className="flex items-center gap-2">
                <div className={appStatIconWrap}>
                  <NewItemsStatIcon className="size-3.5" />
                </div>
                <p className="text-3xl font-bold leading-none tabular-nums text-primary">
                  {lastResult?.created ?? 0}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold leading-tight text-foreground">
                {t("addDocument.newLabel")}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {t("addDocument.newHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-card-border p-2.5">
              <div className="flex items-center gap-2">
                <div className={appStatIconWrap}>
                  <MergedItemsStatIcon className="size-3.5" />
                </div>
                <p className="text-3xl font-bold leading-none tabular-nums text-primary">
                  {lastResult?.merged ?? 0}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold leading-tight text-foreground">
                {t("addDocument.mergedLabel")}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {t("addDocument.mergedHint")}
              </p>
            </div>
          </div>

          {sessionTotals.scans > 1 ? (
            <div className="rounded-2xl border border-card-border p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("addDocument.doneSessionTitle", { scans: sessionTotals.scans })}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t("addDocument.doneSessionAdded", { count: sessionTotals.created })}
              </p>
              <p className="text-sm text-muted">
                {t("addDocument.doneSessionMerged", { count: sessionTotals.merged })}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <button
              type="button"
              className={appButtonPrimaryFull}
              onClick={() => {
                setStep("camera");
                setCameraSession((n) => n + 1);
              }}
            >
              <DocumentNavIcon className="size-4" />
              {t("addDocument.scanAnother")}
            </button>
            <button
              type="button"
              className={appButtonNeutralFull}
              onClick={() =>
                router.push(`/app/expiry?storeId=${encodeURIComponent(storeId)}`)
              }
            >
              <ExpiryNavIcon className="size-4 text-primary" />
              {t("addDocument.goToExpiry")}
            </button>
          </div>
        </div>
      ) : null}
      </div>

      {step === "confirmLocation" ? (
        <LocationConfirmDialog
          title={t("addDocument.locationConfirmation")}
          locationLabel={t("addDocument.locationName")}
          locationName={locationName || "—"}
          yesLabel={t("common.yes")}
          noLabel={t("common.no")}
          onYes={() => setStep("camera")}
          onNo={() => goBackOrApp("/app")}
        />
      ) : null}

      {detailItem ? (
        <DocumentDraftDetailSheet
          item={detailItem}
          onClose={() => setDetailKey(null)}
          onSave={(patch) => updateItem(detailItem.key, patch)}
        />
      ) : null}

      {removeKey && confirmRemoveItem ? (
        <RemoveConfirmDialog
          title={t("addDocument.confirmTitle")}
          message={t("addDocument.confirmMessage")}
          itemLabel={`${confirmRemoveItem.name.trim() || t("common.noName")} (${confirmRemoveItem.quantity} ${t("expiry.pieces")})`}
          cancelLabel={t("expiry.confirmCancel")}
          removeLabel={t("expiry.remove")}
          onCancel={() => setRemoveKey(null)}
          onConfirm={() => removeItem(removeKey)}
        />
      ) : null}
      {confirmRemoveNoExpiry ? (
        <RemoveConfirmDialog
          title={t("addDocument.removeNoExpiryTitle")}
          message={t("addDocument.removeNoExpiryMessage")}
          itemLabel={
            noExpiryCount === 1
              ? t("addDocument.removeNoExpiryItemLabelOne")
              : t("addDocument.removeNoExpiryItemLabel", {
                  count: noExpiryCount,
                })
          }
          cancelLabel={t("expiry.confirmCancel")}
          removeLabel={t("expiry.remove")}
          onCancel={() => setConfirmRemoveNoExpiry(false)}
          onConfirm={removeItemsWithoutExpiry}
        />
      ) : null}
      {confirmRemoveNoExpiryPageId && confirmRemoveNoExpiryPage ? (
        <RemoveConfirmDialog
          title={t("addDocument.removeNoExpiryPageTitle")}
          message={t("addDocument.removeNoExpiryPageMessage")}
          itemLabel={
            pageNoExpiryCount === 1
              ? t("addDocument.removeNoExpiryItemLabelOne")
              : t("addDocument.removeNoExpiryItemLabel", {
                  count: pageNoExpiryCount,
                })
          }
          cancelLabel={t("expiry.confirmCancel")}
          removeLabel={t("expiry.remove")}
          onCancel={() => setConfirmRemoveNoExpiryPageId(null)}
          onConfirm={() =>
            removePageItemsWithoutExpiry(confirmRemoveNoExpiryPageId)
          }
        />
      ) : null}
    </>
  );
}

export default function AddDocumentPage() {
  return (
    <Suspense>
      <AddDocumentContent />
    </Suspense>
  );
}
