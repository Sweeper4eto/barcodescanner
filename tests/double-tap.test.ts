import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPointerTap,
  emptyDoubleTapState,
} from "../src/lib/double-tap";

test("one tap is not a double tap", () => {
  const result = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "touch" },
    1_000,
  );
  assert.equal(result.doubleTap, false);
  assert.equal(result.state.pointerType, "touch");
});

test("a second tap of the same kind within the window is a double tap", () => {
  const first = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "touch" },
    1_000,
  );
  const second = applyPointerTap(first.state, { pointerType: "touch" }, 1_120);
  assert.equal(second.doubleTap, true);
});

test("taps closer than 40ms or farther than 350ms do not count", () => {
  const first = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "mouse", button: 0 },
    1_000,
  );
  assert.equal(
    applyPointerTap(first.state, { pointerType: "mouse", button: 0 }, 1_020)
      .doubleTap,
    false,
  );
  assert.equal(
    applyPointerTap(first.state, { pointerType: "mouse", button: 0 }, 1_400)
      .doubleTap,
    false,
  );
});

test("a mouse echo right after a touch is ignored", () => {
  const touch = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "touch" },
    1_000,
  );
  const echo = applyPointerTap(
    touch.state,
    { pointerType: "mouse", button: 0 },
    1_050,
  );
  assert.equal(echo.doubleTap, false);
  assert.equal(echo.state.pointerType, "touch");
  assert.equal(echo.state.at, 1_000);
});

test("a mouse echo does not turn one touch into a double tap", () => {
  const touch = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "touch" },
    1_000,
  );
  const echo = applyPointerTap(
    touch.state,
    { pointerType: "mouse", button: 0 },
    1_030,
  );
  const later = applyPointerTap(echo.state, { pointerType: "mouse", button: 0 }, 1_200);
  assert.equal(later.doubleTap, false);
});

test("two real touches still enlarge after a ignored mouse echo", () => {
  const first = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "touch" },
    1_000,
  );
  const echo = applyPointerTap(
    first.state,
    { pointerType: "mouse", button: 0 },
    1_020,
  );
  const second = applyPointerTap(echo.state, { pointerType: "touch" }, 1_180);
  assert.equal(second.doubleTap, true);
});

test("a non-primary mouse button never counts", () => {
  const first = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "mouse", button: 0 },
    1_000,
  );
  const right = applyPointerTap(
    first.state,
    { pointerType: "mouse", button: 2 },
    1_100,
  );
  assert.equal(right.doubleTap, false);
  assert.equal(right.state.at, 1_000);
});

test("different pointer types do not form a double tap", () => {
  const pen = applyPointerTap(
    emptyDoubleTapState(),
    { pointerType: "pen" },
    5_000,
  );
  const mouse = applyPointerTap(
    pen.state,
    { pointerType: "mouse", button: 0 },
    5_100,
  );
  assert.equal(mouse.doubleTap, false);
});
