type ScannerViewfinderVariant = "barcode" | "document";

export function ScannerViewfinderOverlay({
  variant = "barcode",
  /** Moving line is for barcode only; document framing uses corners alone. */
  showScanLine,
}: {
  variant?: ScannerViewfinderVariant;
  showScanLine?: boolean;
}) {
  const lineVisible = showScanLine ?? variant !== "document";

  return (
    <div className="scanner-overlay" aria-hidden>
      <div
        className={`scanner-viewfinder${
          variant === "document" ? " scanner-viewfinder-document" : ""
        }`}
      >
        <span className="scanner-corner scanner-corner-tl" />
        <span className="scanner-corner scanner-corner-tr" />
        <span className="scanner-corner scanner-corner-bl" />
        <span className="scanner-corner scanner-corner-br" />
        {lineVisible ? <span className="scanner-line" /> : null}
      </div>
    </div>
  );
}