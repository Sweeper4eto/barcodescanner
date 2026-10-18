/** Second tap must be a separate press, not the same finger's bounce. */
const MIN_GAP_MS = 40;
/** Two taps closer than this count as a double tap. */
export const DOUBLE_TAP_MS = 350;
/**
 * A phone tap also emits a mouse event. Ignore that mouse echo so one
 * physical tap cannot open the larger photo.
 */
const GHOST_MOUSE_MS = 700;

export type DoubleTapState = {
  at: number;
  pointerType: string;
};

export type PointerTap = {
  pointerType: string;
  button?: number;
};

export function emptyDoubleTapState(): DoubleTapState {
  return { at: 0, pointerType: "" };
}

/**
 * Returns whether this pointer-up completes a double tap, and the state to
 * keep for the next one. A non-primary mouse button and a mouse echo after a
 * touch leave the previous state unchanged.
 */
export function applyPointerTap(
  state: DoubleTapState,
  event: PointerTap,
  now: number,
): { doubleTap: boolean; state: DoubleTapState } {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return { doubleTap: false, state };
  }
  if (
    event.pointerType === "mouse" &&
    state.pointerType === "touch" &&
    now - state.at < GHOST_MOUSE_MS
  ) {
    return { doubleTap: false, state };
  }
  const gap = now - state.at;
  const doubleTap =
    gap >= MIN_GAP_MS &&
    gap < DOUBLE_TAP_MS &&
    state.pointerType === event.pointerType;
  return {
    doubleTap,
    state: { at: now, pointerType: event.pointerType },
  };
}
