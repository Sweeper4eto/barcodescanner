/**
 * Document-scan getUserMedia helpers.
 *
 * iPhone / iPad Safari often returns a live track with a black <video> when we
 * immediately apply max resolution + focusMode/exposure advanced constraints,
 * or when we stop the granted stream and reopen by deviceId. Keep iOS preview
 * soft; push quality only (gently) right before capture on non-iOS / at capture.
 */

export type MaximizeQualityPlan =
  | { mode: "skip" }
  | {
      mode: "apply";
      widthIdeal: number;
      heightIdeal: number;
      advanced: Record<string, string>[];
    };

export function isIosLikeUserAgent(
  userAgent: string,
  platform = "",
  maxTouchPoints = 0,
): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ may report as Mac with touch
  return platform === "MacIntel" && maxTouchPoints > 1;
}

/** Soft rear-first constraints for Safari; high-res ideals stay for Android/Chrome. */
export function facingCameraConstraints(ios: boolean): MediaStreamConstraints[] {
  if (ios) {
    return [
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
      { video: { facingMode: { ideal: "user" } }, audio: false },
      { video: true, audio: false },
    ];
  }

  return [
    {
      video: {
        facingMode: { exact: "environment" },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    {
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: "user" } }, audio: false },
    { video: true, audio: false },
  ];
}

export function deviceIdCameraConstraints(
  deviceId: string,
  ios: boolean,
): MediaStreamConstraints[] {
  if (ios) {
    return [
      { video: { deviceId: { ideal: deviceId } }, audio: false },
      {
        video: {
          deviceId: { ideal: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
    ];
  }

  return [
    {
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
      },
      audio: false,
    },
    {
      video: {
        deviceId: { ideal: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    { video: { deviceId: { ideal: deviceId } }, audio: false },
  ];
}

/**
 * Android multi-lens phones often need a post-permission deviceId switch
 * (ultrawide → main). On iOS that stop/restart commonly blacks the preview.
 */
export function shouldRepickCameraAfterOpen(ios: boolean): boolean {
  return !ios;
}

/**
 * Whether to nudge focusMode before a still. Safari black-screens when we
 * apply single-shot/continuous after the preview is already live.
 */
export function shouldApplySingleShotFocus(ios: boolean): boolean {
  return !ios;
}

/**
 * Preview: skip constraint thrashing on iOS.
 * Capture: gentle resolution only on iOS; full max + continuous modes elsewhere.
 */
export function planMaximizeTrackQuality(args: {
  ios: boolean;
  phase: "preview" | "capture";
  widthMax?: number;
  heightMax?: number;
  focusModes?: string[];
  exposureModes?: string[];
  whiteBalanceModes?: string[];
}): MaximizeQualityPlan {
  const { ios, phase, widthMax, heightMax, focusModes, exposureModes, whiteBalanceModes } =
    args;

  if (ios && phase === "preview") {
    return { mode: "skip" };
  }

  if (ios && phase === "capture") {
    return {
      mode: "apply",
      widthIdeal: Math.min(widthMax ?? 1920, 1920),
      heightIdeal: Math.min(heightMax ?? 1080, 1080),
      advanced: [],
    };
  }

  const advanced: Record<string, string>[] = [];
  if (Array.isArray(focusModes)) {
    if (focusModes.includes("continuous")) advanced.push({ focusMode: "continuous" });
    else if (focusModes.includes("single-shot")) {
      advanced.push({ focusMode: "single-shot" });
    }
  }
  if (Array.isArray(exposureModes) && exposureModes.includes("continuous")) {
    advanced.push({ exposureMode: "continuous" });
  }
  if (
    Array.isArray(whiteBalanceModes) &&
    whiteBalanceModes.includes("continuous")
  ) {
    advanced.push({ whiteBalanceMode: "continuous" });
  }

  return {
    mode: "apply",
    widthIdeal: widthMax ?? 4032,
    heightIdeal: heightMax ?? 3024,
    advanced,
  };
}
