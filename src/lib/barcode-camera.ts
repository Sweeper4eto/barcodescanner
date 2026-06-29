import type { Html5Qrcode } from "html5-qrcode";

type FocusConstraint = MediaTrackConstraintSet & {
  focusMode?: ConstrainDOMString;
};

const FOCUS_MODES: FocusConstraint[] = [
  { focusMode: "continuous" },
  { focusMode: "single-shot" },
];

function buildFocusConstraints(): MediaTrackConstraints {
  return {
    advanced: FOCUS_MODES,
    focusMode: { ideal: "continuous" },
  } as unknown as MediaTrackConstraints;
}

export async function optimizeBarcodeCamera(scanner: Html5Qrcode): Promise<void> {
  try {
    await scanner.applyVideoConstraints(buildFocusConstraints());
  } catch {
    // Some browsers reject advanced focus constraints.
  }

  try {
    const zoom = scanner.getRunningTrackCameraCapabilities().zoomFeature();
    if (zoom.isSupported()) {
      const target = Math.min(zoom.max(), Math.max(zoom.min(), 1.6));
      await zoom.apply(target);
    }
  } catch {
    // Zoom is optional.
  }
}

export async function refocusBarcodeCamera(scanner: Html5Qrcode): Promise<void> {
  try {
    await scanner.applyVideoConstraints({
      advanced: [{ focusMode: "single-shot" }],
    } as unknown as MediaTrackConstraints);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await scanner.applyVideoConstraints(buildFocusConstraints());
  } catch {
    await optimizeBarcodeCamera(scanner);
  }
}

export async function toggleBarcodeTorch(
  scanner: Html5Qrcode,
  enabled: boolean,
): Promise<boolean> {
  try {
    const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
    if (!torch.isSupported()) return false;
    await torch.apply(enabled);
    return true;
  } catch {
    return false;
  }
}
