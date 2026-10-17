# expire365 business cards — print brief (QR Media)

Specs from [QR Media · Визитки](https://qrmedia.bg/digitalen-pechat/vizitki/):

| Zone | Size |
|------|------|
| Trim (cut) | **90 × 50 mm** |
| Bleed (file) | **96 × 56 mm** (3 mm each side) |
| Safe margin | **≥ 5 mm** from trim edge (text/logo) |
| Resolution | **250–300 dpi** |
| Colour | **CMYK** for final print PDF (previews here are RGB) |
| Stock (recommended) | 350 g chrome matte, double-sided (**4+4**) |
| Finish | Matte laminate optional |

## What to give the print shop

**Best: PDF** (front + back), 96×56 mm, CMYK, fonts outlined.  
**Also accepted by [QR Media](https://qrmedia.bg/digitalen-pechat/vizitki/):** TIFF / EPS / JPG at print quality.

| Give them? | Format | Notes |
|------------|--------|--------|
| **Yes (ideal)** | **PDF** | Export from Illustrator/Inkscape/Affinity from the SVG |
| **OK** | **JPG @ 300 dpi** (`preview-*.jpg` from the build script) | Full bleed 96×56 mm (1134×661 px) |
| **Usually no** | Raw SVG alone | Prefer PDF/JPG for the shop; SVG is the editable source |

## Files in this folder

| File | Purpose |
|------|---------|
| `front-bleed.svg` / `back-bleed.svg` | Editable source (logo embedded) — open in browser/Inkscape |
| `preview-front*.jpg` / `preview-back*.jpg` | Regenerated from SVG at 300 dpi |
| `build-svg.mjs` | Writes **SVG + JPG together** — always run this after edits |

```bash
node assets/business-card/build-svg.mjs
```

## Copy on cards

| Side | Language | Content |
|------|----------|---------|
| **Front** (`front-en-bleed.svg`) | English | Tagline + Georgi Nikolov + site + email |
| **Back** (`back-bg-bleed.svg`) | Bulgarian | Homepage lines + Георги Николов + site + email |

- Name: **Georgi Nikolov** / **Георги Николов**
- Phone: **+359 887 628 654**
- Site: **expire365.com**
- Email: **expire365@gmail.com**
- EN: *Track expiry before it's too late*
- BG: *Следи срока, преди да е късно*

## Handoff checklist

1. Export **PDF** from the SVG (or high-res JPG/TIFF).  
2. Ask prepress for **CMYK** (mint `#34d399` is RGB on screen).  
3. Background to full **96×56**; type ≥5 mm inside the cut.  
4. Stock tip: **350 g двустранен хром мат**, **4+4**.  
5. Contact: [office@qrmedia.bg](mailto:office@qrmedia.bg)
