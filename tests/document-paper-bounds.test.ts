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
      const onPage = x >= 40 && x < 160 && y >= 50 && y < 230;
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

  it("keeps shadowed last rows instead of cutting under the bright band", () => {
    const width = 200;
    const height = 300;
    const data = rgbaPage(width, height, (x, y) => {
      const onPage = x >= 40 && x < 160 && y >= 40 && y < 250;
      if (!onPage) return 35;
      // Bottom of the page sits in phone shadow (dim paper + dark text marks).
      if (y >= 210) {
        if (x >= 45 && x < 70 && y % 6 < 2) return 45;
        return 95;
      }
      if (x >= 45 && x < 70 && y % 6 < 2) return 40;
      return 230;
    });

    const bounds = paperBounds(data, width, height);
    assert.ok(bounds);
    assert.ok(
      bounds!.y1 >= 245,
      `shadowed tail should stay in crop y1=${bounds!.y1}`,
    );
  });

  it("keeps the page when shadow sits across the middle", () => {
    const width = 200;
    const height = 300;
    const data = rgbaPage(width, height, (x, y) => {
      const onPage = x >= 40 && x < 160 && y >= 40 && y < 250;
      if (!onPage) return 35;
      // Mid-page phone shadow band.
      if (y >= 120 && y < 170) {
        if (x >= 45 && x < 70 && y % 5 < 2) return 45;
        return 90;
      }
      if (x >= 45 && x < 70 && y % 6 < 2) return 40;
      return 230;
    });

    const bounds = paperBounds(data, width, height);
    assert.ok(bounds);
    assert.ok(bounds!.y0 <= 50, `y0=${bounds!.y0}`);
    assert.ok(bounds!.y1 >= 240, `y1=${bounds!.y1}`);
  });

  it("keeps the page when a large shadow covers ~20% of the sheet", () => {
    const width = 200;
    const height = 300;
    const data = rgbaPage(width, height, (x, y) => {
      const onPage = x >= 40 && x < 160 && y >= 40 && y < 250;
      if (!onPage) return 35;
      // Large bottom shadow (~20% of page height), deeper than a thin band.
      if (y >= 175) {
        if (x >= 45 && x < 70 && y % 5 < 2) return 40;
        return 80;
      }
      if (x >= 45 && x < 70 && y % 6 < 2) return 40;
      return 230;
    });

    const bounds = paperBounds(data, width, height);
    assert.ok(bounds);
    assert.ok(
      bounds!.y1 >= 245,
      `large shadow tail should stay y1=${bounds!.y1}`,
    );
  });

  it("keeps the page when shadow sits on the top and right", () => {
    const width = 200;
    const height = 300;
    const data = rgbaPage(width, height, (x, y) => {
      const onPage = x >= 40 && x < 160 && y >= 40 && y < 250;
      if (!onPage) return 35;
      if (y < 90 || x >= 130) {
        if (x >= 45 && x < 70 && y % 6 < 2) return 45;
        return 92;
      }
      if (x >= 45 && x < 70 && y % 6 < 2) return 40;
      return 230;
    });

    const bounds = paperBounds(data, width, height);
    assert.ok(bounds);
    assert.ok(bounds!.y0 <= 50, `top shadow y0=${bounds!.y0}`);
    assert.ok(bounds!.x1 >= 150, `right shadow x1=${bounds!.x1}`);
  });

  it("returns null when the page already fills the frame", () => {
    const width = 160;
    const height = 220;
    const data = rgbaPage(width, height, () => 235);
    assert.equal(paperBounds(data, width, height), null);
  });
});
