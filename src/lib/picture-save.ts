export type PictureSaveStatus = "saved" | "preview" | "failed";

/** iOS Safari ignores `<a download>`, so the picture is shown for Photos instead. */
export function isIosSaveTarget(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  return (
    /iPhone|iPad|iPod/i.test(input.userAgent) ||
    (input.platform === "MacIntel" && input.maxTouchPoints > 1)
  );
}

export function readIosSaveTarget(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosSaveTarget({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

/**
 * iOS always previews. Other devices save when the download link was started.
 */
export function pictureSaveStatus(
  ios: boolean,
  downloadStarted: boolean,
): PictureSaveStatus {
  if (ios) return "preview";
  return downloadStarted ? "saved" : "failed";
}
