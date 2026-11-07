/**
 * Mobile app UI tokens — single source for buttons, insets, and common controls.
 * Reuse these in new work; do not invent new sizes/fonts per page.
 *
 * Buttons are always outline (never `bg-primary` fill).
 */

export const appPageShell = "mx-auto min-w-0 max-w-lg";

/** List cards / expiry-style rows */
export const appListInset = "px-1.5";

/** Headers, search rows when wider chrome is intended */
export const appChromeInset = "px-4";

/**
 * Soft primary glow under the app header — one look on every MobilePageHeader screen.
 * Parent must be `relative`.
 */
export const appPageTopGlowClass =
  "pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_70%_0%,rgb(52_211_153/0.14),transparent_55%)]";

const appButtonCore =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border bg-transparent px-3 py-2.5 text-sm font-semibold disabled:opacity-50";

export const appButtonPrimary = `${appButtonCore} border-primary text-primary`;
export const appButtonNeutral = `${appButtonCore} border-card-border text-foreground`;
export const appButtonDanger = `${appButtonCore} border-danger text-danger`;
/** Outline warning / write-off (yellow). */
export const appButtonWarning = `${appButtonCore} border-warning-fg text-warning-fg`;

export const appButtonCancel = `${appButtonCore} border-white text-white`;

export const appButtonPrimaryFull = `w-full ${appButtonPrimary}`;
export const appButtonNeutralFull = `w-full ${appButtonNeutral}`;
export const appButtonDangerFull = `w-full ${appButtonDanger}`;
export const appButtonWarningFull = `w-full ${appButtonWarning}`;
export const appButtonCancelFull = `w-full ${appButtonCancel}`;

const appButtonRowCore =
  "inline-flex w-full items-center justify-between rounded-xl border bg-transparent px-3 py-2.5 text-sm font-semibold disabled:opacity-50";

export const appButtonRowPrimary = `${appButtonRowCore} border-primary text-primary`;
export const appButtonRowNeutral = `${appButtonRowCore} border-card-border text-foreground`;

export const appFooterButtonGrid = "grid grid-cols-2 gap-2";

export const appSearchInput =
  "h-9 rounded-lg border border-input-border bg-input pl-2.5 text-base text-foreground";

export const appFormInput =
  "w-full rounded-xl border border-input-border bg-input px-3 py-2.5 text-base text-foreground";

export const appStatIconWrap =
  "flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/45 text-primary";

/** Search-row companion (Scan / Export) — same height as `appSearchInput`. */
export const appButtonToolbar =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary bg-transparent px-3 text-sm font-semibold text-primary disabled:opacity-50";

export const appButtonToolbarActive = `${appButtonToolbar} bg-selected`;

/** Outline switch track (never solid primary fill). */
export const appToggleTrackOff =
  "relative h-6 w-10 shrink-0 rounded-full border border-card-border bg-transparent transition-colors";
export const appToggleTrackOn =
  "relative h-6 w-10 shrink-0 rounded-full border border-primary bg-selected transition-colors";
export const appToggleKnob =
  "absolute top-0.5 size-5 rounded-full bg-white transition-transform";
export const appToggleKnobOff = `${appToggleKnob} left-0.5`;
export const appToggleKnobOn = `${appToggleKnob} left-4`;
