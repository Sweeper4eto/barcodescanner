/**
 * Prefer the main rear lens on multi-camera phones (Samsung A53, S-series, etc.).
 * Chrome often grants `facingMode: environment` to ultrawide/macro — bad for
 * document OCR and barcode decode (weak/no AF, distortion).
 */

export type CameraLabelSource = { id?: string; deviceId?: string; label: string };

export function cameraLabelScore(label: string): number {
  const l = label.toLowerCase();
  let score = 0;
  if (/ultra|\buw\b|wide.?angle|macro|tele|depth|tof/.test(l)) score -= 60;
  if (/front|user|facing front|selfie/.test(l)) score -= 40;
  if (/back|rear|environment|facing back/.test(l)) score += 25;
  if (/main|standard|primary|barcode/.test(l)) score += 20;
  // Samsung often names the main rear "camera2 0, facing back".
  if (/camera2\s*0\b/.test(l) || /\b0,\s*facing back/.test(l)) score += 15;
  return score;
}

export function isLikelyBadCaptureCamera(label: string): boolean {
  const l = label.toLowerCase();
  if (!l.trim()) return false;
  return (
    cameraLabelScore(l) < 0 ||
    /ultra|\buw\b|wide.?angle|macro|tele|depth|front|selfie/.test(l)
  );
}

/** Highest score first (main rear ahead of ultrawide/macro/front). */
export function orderCamerasByLabel<T extends CameraLabelSource>(cameras: T[]): T[] {
  return [...cameras].sort(
    (a, b) => cameraLabelScore(b.label) - cameraLabelScore(a.label),
  );
}

export function pickPreferredCameraId(
  cameras: CameraLabelSource[],
): string | null {
  const ordered = orderCamerasByLabel(cameras);
  const best = ordered[0];
  if (!best) return null;
  return best.deviceId || best.id || null;
}

/** @deprecated Prefer cameraLabelScore — kept for barcode call sites/tests. */
export const barcodeCameraScore = cameraLabelScore;
/** @deprecated Prefer isLikelyBadCaptureCamera */
export const isLikelyBadBarcodeCamera = isLikelyBadCaptureCamera;
/** @deprecated Prefer orderCamerasByLabel */
export function orderBarcodeCameras<T extends { id: string; label: string }>(
  cameras: T[],
): T[] {
  return orderCamerasByLabel(cameras);
}
