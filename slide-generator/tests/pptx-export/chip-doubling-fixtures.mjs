// Local reproduction harness for the chip-doubling bug in PPTX export.
// Runs pure Node + pptxgenjs, no LLM, no html2canvas.
//
// USAGE
//   cd slide-generator
//   node tests/pptx-export/chip-doubling-fixtures.mjs
//
// WHAT IT TESTS
// - Construct a PptxGenJS slide that simulates what the LLM emitted
//   (chip ellipse + body text), mirroring V31 / V33 export patterns.
// - Manually add an addImage at the chip position to simulate what the
//   pptxSvgIconInjector post-pass would emit.
// - Run dedupeShapesUnderImages — the function inlined below mirrors the
//   one in src/services/pptxSvgIconInjector.js. Keep them in sync; if the
//   production heuristic changes, update this file too.
// - Write a real .pptx, unzip, inspect slide XML, assert the chip ellipse
//   is gone and only the image remains.
//
// WHEN A FIXTURE FAILS
// The dedupe heuristic has two knobs (minOverlapFraction, maxAreaRatio).
// Tune them in pptxSvgIconInjector.js, then mirror the values here.

import PptxGenJS from 'pptxgenjs';
import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

// ── Tiny 1x1 transparent PNG to stand in for the rasterized icon ────────────
const PIXEL_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

// ── The post-processor under test ───────────────────────────────────────────
// Iterates a slide's _slideObjects, finds rasterized images, and removes any
// primitive shape (rect / ellipse / roundRect) that is mostly covered by an
// image. Returns the count of removed shapes (for assertions).
function dedupeShapesUnderImages(slide, opts = {}) {
  // Threshold tuned against:
  //  - perfect overlap (V33 slide 3/4): 1.0 — catches at any threshold
  //  - 0.25in offset (V31): ~0.63 — needs threshold <= 0.5 to catch
  //  - icon glyph inside chip (rasterizer SVG-only path): ~0.37 — must NOT be caught
  // 0.5 sits comfortably between the misalignment-overlap and glyph-inside-chip cases.
  const minOverlapFraction = opts.minOverlapFraction ?? 0.5;
  const maxAreaRatio = opts.maxAreaRatio ?? 5;
  const objs = slide?._slideObjects;
  if (!Array.isArray(objs)) return 0;

  // First pass: collect rasterized-image bboxes.
  const imageBoxes = [];
  for (const obj of objs) {
    if (obj?._type !== 'image') continue;
    const o = obj.options || {};
    if (typeof o.x !== 'number' || typeof o.y !== 'number'
      || typeof o.w !== 'number' || typeof o.h !== 'number') continue;
    imageBoxes.push({ x: o.x, y: o.y, w: o.w, h: o.h });
  }
  if (imageBoxes.length === 0) return 0;

  // Second pass: walk shapes, drop those that overlap heavily with an image.
  // pptxgenjs stores primitive shapes with _type='text' and a shape string,
  // so we filter on that.
  const PRIMITIVE_SHAPES = new Set(['rect', 'roundRect', 'ellipse', 'oval', 'roundedRect']);
  let removed = 0;
  for (let i = objs.length - 1; i >= 0; i--) {
    const obj = objs[i];
    if (obj?._type !== 'text') continue;
    if (!obj.shape || !PRIMITIVE_SHAPES.has(obj.shape)) continue;
    // Shapes that contain text (titles, banners) are content, not chip
    // backgrounds — keep them.
    if (obj.text && (typeof obj.text === 'string' ? obj.text.trim() : obj.text.length > 0)) continue;
    const o = obj.options || {};
    if (typeof o.x !== 'number' || typeof o.y !== 'number'
      || typeof o.w !== 'number' || typeof o.h !== 'number') continue;
    const shapeArea = Math.max(o.w * o.h, 1e-6);
    for (const img of imageBoxes) {
      const ox = Math.max(o.x, img.x);
      const oy = Math.max(o.y, img.y);
      const ex = Math.min(o.x + o.w, img.x + img.w);
      const ey = Math.min(o.y + o.h, img.y + img.h);
      if (ex <= ox || ey <= oy) continue;
      const overlap = (ex - ox) * (ey - oy);
      const imgArea = Math.max(img.w * img.h, 1e-6);
      if (overlap / shapeArea < minOverlapFraction) continue;
      // Don't remove shapes much larger than the image (banner headers,
      // card frames). Image must be within maxAreaRatio of shape area.
      if (imgArea > shapeArea * maxAreaRatio) continue;
      if (imgArea * maxAreaRatio < shapeArea) continue;
      objs.splice(i, 1);
      removed += 1;
      break;
    }
  }
  return removed;
}

// ── Test fixtures ───────────────────────────────────────────────────────────
const FIXTURES = [
  {
    name: 'V33 slide 3: 4 pink ellipse chips + 4 raster icons',
    setup(slide) {
      // Simulate LLM drawing 4 pink ellipse chips at known positions.
      for (let i = 0; i < 4; i++) {
        const x = 1 + i * 3;
        slide.addShape('ellipse', { x, y: 1.5, w: 0.66, h: 0.66, fill: { color: 'F8E3E3' } });
      }
      // Simulate rasterizer adding 4 PNGs at the SAME positions (host capture).
      for (let i = 0; i < 4; i++) {
        const x = 1 + i * 3;
        slide.addImage({ data: PIXEL_DATA, x, y: 1.5, w: 0.667, h: 0.667 });
      }
    },
    expectShapesRemoved: 4,
    expectShapesRemaining: ['none of the pink ellipses'],
    expectImagesRemaining: 4,
  },
  {
    name: 'V33 slide 4: 3 pink rounded-rect chips + 3 raster icons',
    setup(slide) {
      for (let i = 0; i < 3; i++) {
        const x = 1 + i * 3;
        slide.addShape('roundRect', { x, y: 1.5, w: 0.5, h: 0.5, fill: { color: 'F8E3E3' }, rectRadius: 0.05 });
      }
      for (let i = 0; i < 3; i++) {
        const x = 1 + i * 3;
        slide.addImage({ data: PIXEL_DATA, x, y: 1.5, w: 0.5, h: 0.5 });
      }
    },
    expectShapesRemoved: 3,
    expectShapesRemaining: [],
    expectImagesRemaining: 3,
  },
  {
    name: 'NEGATIVE: card frame rect (much larger than icon) -- must NOT be removed',
    setup(slide) {
      // Card frame: huge rounded rect spanning the card
      slide.addShape('roundRect', { x: 0.5, y: 1.5, w: 4, h: 4.5, fill: { color: 'F7F9FB' }, rectRadius: 0.05 });
      // Icon raster inside the card (small, top-left)
      slide.addImage({ data: PIXEL_DATA, x: 0.75, y: 1.75, w: 0.5, h: 0.5 });
    },
    expectShapesRemoved: 0,
    expectShapesRemaining: ['the card frame'],
    expectImagesRemaining: 1,
  },
  {
    name: 'NEGATIVE: banner rect with title text -- must NOT be removed',
    setup(slide) {
      // Maroon banner: long, contains text
      slide.addShape('rect', { x: 0.5, y: 0.5, w: 12, h: 0.6, fill: { color: '8E1E1E' } });
      // The banner has text on top of it (LLM drew a separate addText) -- does not affect logic
      // No image overlapping with the banner; banner remains.
    },
    expectShapesRemoved: 0,
    expectShapesRemaining: ['the banner'],
    expectImagesRemaining: 0,
  },
  {
    name: 'NEGATIVE: emoji-icon chip (no SVG => no rasterization, no image) -- LLM ellipse must remain',
    setup(slide) {
      // Emoji-chip slide path: LLM drew ellipse + addText emoji, rasterizer
      // didn't fire (no SVG present in that branch).
      slide.addShape('ellipse', { x: 1, y: 1.5, w: 0.5, h: 0.5, fill: { color: 'F8E3E3' } });
      slide.addText('🎯', { x: 1, y: 1.5, w: 0.5, h: 0.5, fontSize: 16 });
      // No addImage -- nothing to dedupe.
    },
    expectShapesRemoved: 0,
    expectShapesRemaining: ['the emoji chip ellipse'],
    expectImagesRemaining: 0,
  },
  {
    name: 'V31 0.25in horizontal drift between LLM chip and rasterizer image',
    setup(slide) {
      // LLM drew at x=5.695, rasterizer captured at x=5.444 (V31 actual offset).
      // ~63% overlap. Must still remove the chip ellipse to eliminate the halo.
      slide.addShape('ellipse', { x: 5.695, y: 2.638, w: 0.66, h: 0.66, fill: { color: 'F8E3E3' } });
      slide.addImage({ data: PIXEL_DATA, x: 5.444, y: 2.639, w: 0.667, h: 0.667 });
    },
    expectShapesRemoved: 1,
    expectShapesRemaining: [],
    expectImagesRemaining: 1,
  },
  {
    name: 'CRITICAL: small icon glyph inside larger chip (rasterizer SVG-only path) -- chip must REMAIN',
    setup(slide) {
      // What happens when rasterizer captures only the SVG (not the host):
      // chip ellipse is 0.66×0.66, icon glyph PNG is 0.4×0.4 centered inside.
      // The chip is the visible visual; the glyph sits on top transparently.
      // Removing the chip would lose the brand background.
      slide.addShape('ellipse', { x: 1, y: 1.5, w: 0.66, h: 0.66, fill: { color: 'F8E3E3' } });
      slide.addImage({ data: PIXEL_DATA, x: 1.13, y: 1.63, w: 0.4, h: 0.4 });
    },
    expectShapesRemoved: 0,
    expectShapesRemaining: ['the chip ellipse'],
    expectImagesRemaining: 1,
  },
  {
    name: 'EDGE: numbered circle (e.g. roadmap stop) — has text inside, must REMAIN even if image overlaps',
    setup(slide) {
      // Roadmap stop: maroon circle with number "1" inside, plus an icon
      // raster sitting at roughly the same position. The shape carries text,
      // so the dedupe must skip it.
      slide.addText('1', { x: 1, y: 1.5, w: 0.5, h: 0.5, shape: 'ellipse', fill: { color: '8E1E1E' }, color: 'FFFFFF', align: 'center' });
      slide.addImage({ data: PIXEL_DATA, x: 1, y: 1.5, w: 0.5, h: 0.5 });
    },
    expectShapesRemoved: 0,
    expectShapesRemaining: ['the numbered circle (has text)'],
    expectImagesRemaining: 1,
  },
];

// ── Test runner ─────────────────────────────────────────────────────────────
function describeSlide(slide) {
  const objs = slide._slideObjects || [];
  const summary = { images: 0, ellipses: 0, rects: 0, roundRects: 0, texts: 0, other: 0 };
  for (const o of objs) {
    if (o._type === 'image') summary.images++;
    else if (o._type === 'text' && o.shape === 'ellipse') summary.ellipses++;
    else if (o._type === 'text' && o.shape === 'rect') summary.rects++;
    else if (o._type === 'text' && o.shape === 'roundRect') summary.roundRects++;
    else if (o._type === 'text') summary.texts++;
    else summary.other++;
  }
  return summary;
}

let totalPass = 0;
let totalFail = 0;

for (const fix of FIXTURES) {
  const pres = new PptxGenJS();
  pres.defineSlideMaster({ title: 'BLANK', objects: [] });
  const slide = pres.addSlide({ masterName: 'BLANK' });
  fix.setup(slide);

  const before = describeSlide(slide);
  const removed = dedupeShapesUnderImages(slide);
  const after = describeSlide(slide);

  console.log(`\n=== ${fix.name} ===`);
  console.log(`  before: ${JSON.stringify(before)}`);
  console.log(`  after : ${JSON.stringify(after)}`);
  console.log(`  removed: ${removed}`);

  if (fix.tuningCase) {
    console.log(`  (tuning case — observed result, not a hard assertion)`);
    continue;
  }

  let pass = true;
  if (removed !== fix.expectShapesRemoved) {
    console.log(`  FAIL: expected ${fix.expectShapesRemoved} shapes removed, got ${removed}`);
    pass = false;
  }
  if (after.images !== fix.expectImagesRemaining) {
    console.log(`  FAIL: expected ${fix.expectImagesRemaining} images remaining, got ${after.images}`);
    pass = false;
  }
  if (pass) { totalPass += 1; console.log(`  PASS ✓`); }
  else      { totalFail += 1; }
}

console.log('\n' + '='.repeat(60));
console.log(`RESULT: ${totalPass}/${totalPass + totalFail} fixtures pass`);

// ── XML-level verification: write a real .pptx and inspect slide XML ────────
console.log('\n' + '='.repeat(60));
console.log('XML-LEVEL VERIFICATION: writing actual .pptx files for binary check');
console.log('='.repeat(60));

const OUT_DIR = process.env.TMPDIR
  ? process.env.TMPDIR.replace(/\/$/, '')
  : '/tmp';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Re-build "V33 slide 3" scenario as a real file, with and without dedupe.
async function writeAndInspect(scenarioName, setupFn, applyDedupe) {
  const pres = new PptxGenJS();
  pres.defineSlideMaster({ title: 'BLANK', objects: [] });
  const slide = pres.addSlide({ masterName: 'BLANK' });
  setupFn(slide);
  if (applyDedupe) dedupeShapesUnderImages(slide);

  const filename = `${scenarioName}-${applyDedupe ? 'fixed' : 'unfixed'}.pptx`;
  const outPath = `${OUT_DIR}/${filename}`;
  await pres.writeFile({ fileName: outPath });

  const buf = fs.readFileSync(outPath);
  const u8 = new Uint8Array(buf);
  const files = unzipSync(u8);
  const slide1Xml = strFromU8(files['ppt/slides/slide1.xml']);
  const ellipseCount = (slide1Xml.match(/prst="ellipse"/g) || []).length;
  const pinkFillCount = (slide1Xml.match(/F8E3E3/gi) || []).length;
  const picCount = (slide1Xml.match(/<p:pic>/g) || []).length;
  console.log(`\n  ${filename}`);
  console.log(`    ellipse shapes:   ${ellipseCount}`);
  console.log(`    pink fills:       ${pinkFillCount}`);
  console.log(`    pictures (p:pic): ${picCount}`);
  return { ellipseCount, pinkFillCount, picCount };
}

const setup = (slide) => {
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 3;
    slide.addShape('ellipse', { x, y: 1.5, w: 0.66, h: 0.66, fill: { color: 'F8E3E3' } });
  }
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 3;
    slide.addImage({ data: PIXEL_DATA, x, y: 1.5, w: 0.667, h: 0.667 });
  }
};

const before = await writeAndInspect('v33-slide3', setup, false);
const after  = await writeAndInspect('v33-slide3', setup, true);

console.log('\nDelta:');
console.log(`  ellipse shapes:   ${before.ellipseCount} → ${after.ellipseCount}`);
console.log(`  pink fills:       ${before.pinkFillCount} → ${after.pinkFillCount}`);
console.log(`  pictures (p:pic): ${before.picCount} → ${after.picCount}`);

if (after.ellipseCount === 0 && after.pinkFillCount === 0 && after.picCount === 4) {
  console.log('\n✅ XML VERIFICATION: post-processor cleanly removes doubled chips, leaves images intact.');
} else {
  console.log('\n❌ XML VERIFICATION FAILED');
  process.exit(1);
}

process.exit(totalFail > 0 ? 1 : 0);
