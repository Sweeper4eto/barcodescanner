import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  deskewDocumentDataUrl,
  estimateDocumentSkewDegrees,
  rowProjectionScore,
} from "../src/lib/document-deskew";

async function makeLinedPage(width = 400, height = 560): Promise<Buffer> {
  // White page with several dark horizontal text-like bands.
  const gray = Buffer.alloc(width * height, 245);
  for (let row = 0; row < 12; row += 1) {
    const y0 = 40 + row * 40;
    for (let y = y0; y < y0 + 8 && y < height; y += 1) {
      for (let x = 30; x < width - 30; x += 1) {
        gray[y * width + x] = 30;
      }
    }
  }
  return sharp(gray, { raw: { width, height, channels: 1 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("document deskew", () => {
  it("rowProjectionScore prefers horizontal bands over tilted ones", async () => {
    const flat = await makeLinedPage();
    const { data: flatRaw, info: flatInfo } = await sharp(flat)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const flatScore = rowProjectionScore(
      flatRaw,
      flatInfo.width,
      flatInfo.height,
    );

    const tilted = await sharp(flat)
      .rotate(4, { background: "#ffffff" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const tiltedScore = rowProjectionScore(
      tilted.data,
      tilted.info.width,
      tilted.info.height,
    );

    assert.ok(
      flatScore > tiltedScore,
      `expected flat ${flatScore} > tilted ${tiltedScore}`,
    );
  });

  it("estimateDocumentSkewDegrees returns ~0 for a flat page", async () => {
    const flat = await makeLinedPage();
    const angle = await estimateDocumentSkewDegrees(flat);
    assert.equal(angle, 0);
  });

  it("estimateDocumentSkewDegrees recovers corrective rotation for a tilted page", async () => {
    const flat = await makeLinedPage();
    // Image appears tilted +5° clockwise; corrective rotate should be near -5
    // when scoring rotates the probe (bestAngle is the straighten amount).
    const tilted = await sharp(flat)
      .rotate(5, { background: "#ffffff" })
      .jpeg({ quality: 95 })
      .toBuffer();

    const angle = await estimateDocumentSkewDegrees(tilted);
    assert.notEqual(angle, 0);
    // Should straighten by roughly -5° (opposite of the applied tilt).
    assert.ok(
      Math.abs(angle - -5) <= 1.1,
      `expected ~-5°, got ${angle}`,
    );
  });

  it("deskewDocumentDataUrl leaves flat photos unchanged", async () => {
    const flat = await makeLinedPage();
    const dataUrl = `data:image/jpeg;base64,${flat.toString("base64")}`;
    const result = await deskewDocumentDataUrl(dataUrl);
    assert.equal(result.applied, false);
    assert.equal(result.dataUrl, dataUrl);
  });

  it("deskewDocumentDataUrl is opt-in via DOCUMENT_AI_DESKEW", async () => {
    const flat = await makeLinedPage();
    const tilted = await sharp(flat)
      .rotate(6, { background: "#ffffff" })
      .jpeg({ quality: 95 })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${tilted.toString("base64")}`;

    const prev = process.env.DOCUMENT_AI_DESKEW;
    try {
      delete process.env.DOCUMENT_AI_DESKEW;
      const off = await deskewDocumentDataUrl(dataUrl);
      assert.equal(off.applied, false);

      process.env.DOCUMENT_AI_DESKEW = "1";
      const on = await deskewDocumentDataUrl(dataUrl);
      assert.equal(on.applied, true);
      assert.notEqual(on.dataUrl, dataUrl);
      assert.ok(on.dataUrl.startsWith("data:image/jpeg;base64,"));
      assert.notEqual(on.angleDegrees, 0);
    } finally {
      if (prev === undefined) delete process.env.DOCUMENT_AI_DESKEW;
      else process.env.DOCUMENT_AI_DESKEW = prev;
    }
  });
});
