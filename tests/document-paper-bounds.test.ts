import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paperBounds } from "../src/lib/document-image";

function rgbaPage(
  width: number,
  height: number,
  fill: (x: number, y: number) => number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const g = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = g;
      data[i + 1] = g;
      data[i + 2] = g;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe("document paperBounds", () => {
  it("crops a white page sitting on a dark table", () => {
    const width = 200;
    const height = 280;
    // Page inset ~20% from each edge.
    const data = rgbaPage(width, height, (x, y) => {
      const onPage =
        x >= 40 && x < 160 && y >= 50 && y < 230;
      return onPage ? 230 : 40;
    });

    const bounds = paperBounds(data, width, height);
    assert.ok(bounds);
    assert.ok(bounds!.x0 <= 45, `x0=${bounds!.x0}`);
    assert.ok(bounds!.x1 >= 155, `x1=${bounds!.x1}`);
    assert.ok(bounds!.y0 <= 55, `y0=${bounds!.y0}`);
    assert.ok(bounds!.y1 >= 225, `y1=${bounds!.y1}`);
    const area =
      (bounds!.x1 - bounds!.x0 + 1) * (bounds!.y1 - bounds!.y0 + 1);
    assert.ok(area < width * height * 0.75, "should drop most of the table");
  });

  it("returns null when the page already fills the frame", () => {
    const width = 160;
    const height = 220;
    const data = rgbaPage(width, height, () => 235);
    assert.equal(paperBounds(data, width, height), null);
  });
});
