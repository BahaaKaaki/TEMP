// Vendored from joker-duzhong/html-to-pptx@main (MIT).
// Source: https://github.com/joker-duzhong/html-to-pptx/blob/main/src/analyze.ts
// Converted from TS to JS (types stripped).
//
// Local patches vs upstream:
//   1. `html2pptx(pageClass, options)` accepts options.pptx (bring-your-own instance
//      with caller-defined layout/master) and options.layout/width/height. Defaults
//      to widescreen LAYOUT_WIDE (13.333x7.5in) to match slide-generator conventions.
//   2. When a caller-supplied pptx instance is passed, its existing layout is
//      respected and not overwritten.
//   3. Default theme headFontFace set only when creating a fresh PptxGenJS
//      instance (upstream always overwrote it).

import PptxGenJS from "pptxgenjs";
import { getComputedElementStyle, colorToHex } from "./styleTransform";
import { getElementAnimation } from "./animationTransform";

const DEFAULT_PPT_LAYOUT = {
  name: "LAYOUT_WIDE",
  width: 13.333,
  height: 7.5,
};

// Walks text nodes via Range.getBoundingClientRect() to derive one PPTX textbox
// per rendered line/fragment. Uses parent element's computed style for fonts/colors.
function parseRichText(rootElement, pageRect, globalScale, pageTransformScale) {
  const shapes = [];
  const consumedElements = new Set();

  function traverse(node, parentStyle) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || "";
      if (!textContent.trim()) return;

      const range = document.createRange();
      range.selectNode(node);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) return;

      const x = ((rect.left - pageRect.left) / pageTransformScale) * globalScale;
      const y = ((rect.top - pageRect.top) / pageTransformScale) * globalScale;

      const w = (rect.width / pageTransformScale) * globalScale + 0.05;
      const h = (rect.height / pageTransformScale) * globalScale;

      const pxSize = parseFloat(parentStyle.fontSize || "14");
      const ptSize = pxSize * globalScale * 72;
      const bgColor = colorToHex(parentStyle.backgroundColor);

      shapes.push({
        text: textContent,
        options: {
          x,
          y,
          w,
          h,
          fontSize: ptSize,
          color: colorToHex(parentStyle.color),
          fontFace: parentStyle.fontFamily?.split(",")[0].replace(/['"]/g, ""),
          bold: parseInt(parentStyle.fontWeight) >= 600 || parentStyle.fontWeight === "bold",
          italic: parentStyle.fontStyle === "italic",
          underline: parentStyle.textDecoration.includes("underline") ? { style: "sng" } : undefined,
          strike: parentStyle.textDecoration.includes("line-through"),
          highlight: bgColor ? bgColor : undefined,
          subscript: parentStyle.verticalAlign === "sub",
          superscript: parentStyle.verticalAlign === "super",
          align: "left",
          valign: "top",
          autoFit: false,
          wrap: true,
          inset: 0,
        },
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;

      const stopTags = ["TABLE", "IMG", "CANVAS", "SVG", "VIDEO", "IFRAME"];
      if (stopTags.includes(el.tagName)) {
        return;
      }
      const style = window.getComputedStyle(el);
      if (el.tagName === "BR") {
        consumedElements.add(el);
        return;
      }

      const isBlock =
        style.display === "block" ||
        style.display === "flex" ||
        style.display === "grid" ||
        style.display === "inline-block" ||
        style.position === "absolute" ||
        style.position === "fixed";

      const isStyleTag = ["SPAN", "B", "STRONG", "I", "EM", "U", "FONT", "SUB", "SUP", "A", "SMALL", "BIG"].includes(el.tagName);

      if (isBlock && !isStyleTag) {
        return;
      }

      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        consumedElements.add(el);
        return;
      }

      consumedElements.add(el);
      el.childNodes.forEach((child) => traverse(child, style));
    }
  }

  const rootStyle = window.getComputedStyle(rootElement);
  rootElement.childNodes.forEach((child) => traverse(child, rootStyle));

  return { shapes, consumedElements };
}

function processElement(element, slide, pageRect, globalScale, pageTransformScale) {
  if (element.getAttribute("hidden") !== null) return;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
  const pptStyle = getComputedElementStyle(element, pageRect, globalScale, pageTransformScale);
  const animation = getElementAnimation(element);

  const chartConfigStr = element.getAttribute("data-pptx-chart-config");
  if (chartConfigStr) {
    try {
      const chartConfig = JSON.parse(chartConfigStr);

      const finalOptions = {
        x: pptStyle.x,
        y: pptStyle.y,
        w: pptStyle.w,
        h: pptStyle.h,
        ...chartConfig.options,
      };

      slide.addChart(chartConfig.type, chartConfig.data, finalOptions);

      return;
    } catch (e) {
      console.warn("[html-to-pptx] failed to parse data-pptx-chart-config, falling back:", e);
    }
  }

  if (element.tagName === "IMG") {
    const imgEl = element;
    if (imgEl.src) {
      slide.addImage({
        path: imgEl.src,
        x: pptStyle.x,
        y: pptStyle.y,
        w: pptStyle.w,
        h: pptStyle.h,
        sizing: { type: "contain", w: pptStyle.w, h: pptStyle.h },
        ...(animation ? { animate: { type: animation.type, duration: animation.duration } } : {}),
      });
    }
    return;
  }

  if (element.tagName === "CANVAS") {
    try {
      const canvas = element;
      const imgData = canvas.toDataURL("image/png");
      slide.addImage({
        data: imgData,
        x: pptStyle.x,
        y: pptStyle.y,
        w: pptStyle.w,
        h: pptStyle.h,
        ...(animation ? { animate: { type: animation.type, duration: animation.duration } } : {}),
      });
    } catch (e) {
      console.warn("[html-to-pptx] canvas export failed:", e);
    }
    return;
  }

  if (element.tagName === "TABLE") {
    const tableElement = element;
    const rows = Array.from(tableElement.querySelectorAll("tr"));
    if (rows.length === 0) return;

    const colWidthsPx = [];
    let maxCols = 0;
    rows.forEach((row) => {
      let currentCols = 0;
      Array.from(row.children).forEach((cell) => {
        currentCols += parseInt(cell.getAttribute("colspan") || "1");
      });
      if (currentCols > maxCols) maxCols = currentCols;
    });

    for (let i = 0; i < maxCols; i++) colWidthsPx.push(0);

    rows.forEach((row) => {
      let currentColIdx = 0;
      Array.from(row.children).forEach((cell) => {
        const cellRect = cell.getBoundingClientRect();
        const colSpan = parseInt(cell.getAttribute("colspan") || "1");
        const cellPxWidth = cellRect.width;
        const avgColWidth = cellPxWidth / colSpan;
        for (let i = 0; i < colSpan; i++) {
          if (colWidthsPx[currentColIdx + i] === 0 || avgColWidth > colWidthsPx[currentColIdx + i]) {
            colWidthsPx[currentColIdx + i] = avgColWidth;
          }
        }
        currentColIdx += colSpan;
      });
    });

    const colW = colWidthsPx.map((px) => (px / pageTransformScale) * globalScale);

    const totalPptColWidth = colW.reduce((sum, val) => sum + val, 0);
    if (totalPptColWidth > 0 && Math.abs(totalPptColWidth - pptStyle.w) > 0.01) {
      const scaleFactor = pptStyle.w / totalPptColWidth;
      for (let i = 0; i < colW.length; i++) colW[i] *= scaleFactor;
    } else if (colW.length === 0 && rows.length > 0) {
      colW.push(...Array(maxCols > 0 ? maxCols : 1).fill(pptStyle.w / (maxCols > 0 ? maxCols : 1)));
    }

    const rowH = [];
    rows.forEach((row) => {
      const rowRect = row.getBoundingClientRect();
      rowH.push((rowRect.height / pageTransformScale) * globalScale);
    });

    const tableData = [];
    rows.forEach((row) => {
      const rowData = [];
      const cells = Array.from(row.querySelectorAll("td, th"));

      cells.forEach((cell) => {
        const cellStyle = getComputedElementStyle(cell, pageRect, globalScale, pageTransformScale);
        const cellTxt = cell.textContent || "";

        rowData.push({
          text: cellTxt,
          options: {
            fill: cellStyle.fill,
            color: cellStyle.color,
            bold: cellStyle.bold,
            italic: cellStyle.italic,
            underline: cellStyle.underline,
            strike: cellStyle.strike,
            align: cellStyle.align,
            valign: cellStyle.valign,
            margin: cellStyle.padding,
            border: cellStyle.border
              ? {
                  pt: cellStyle.border.pt,
                  color: cellStyle.border.color,
                  type: cellStyle.border.type,
                }
              : undefined,
            rowspan: parseInt(cell.getAttribute("rowspan") || "1"),
            colspan: parseInt(cell.getAttribute("colspan") || "1"),
            fontSize: cellStyle.fontSize,
            fontFace: cellStyle.fontFace,
            lineSpacing: cellStyle.lineSpacing,
            charSpacing: cellStyle.charSpacing,
            wrap: true,
            autoFit: false,
          },
        });
      });
      if (rowData.length) tableData.push(rowData);
    });

    if (tableData.length) {
      slide.addTable(tableData, {
        x: pptStyle.x,
        y: pptStyle.y,
        w: pptStyle.w,
        colW: colW.length > 0 ? colW : undefined,
        rowH: rowH.length > 0 ? rowH : undefined,
        fill: pptStyle.fill,
        line: pptStyle.border,
      });
    }
    return;
  }

  const { shapes, consumedElements } = parseRichText(element, pageRect, globalScale, pageTransformScale);

  const hasBackground = pptStyle.fill && pptStyle.fill.color;
  const hasBorder = pptStyle.border;
  if (hasBackground || hasBorder || (shapes.length === 0 && !["SPAN", "B", "I", "U", "STRONG", "EM"].includes(element.tagName))) {
    slide.addShape(pptStyle.shapeType, {
      x: pptStyle.x,
      y: pptStyle.y,
      w: pptStyle.w,
      h: pptStyle.h,
      fill: pptStyle.fill,
      line: pptStyle.border,
      rectRadius: pptStyle.rectRadius,
      rotate: pptStyle.rotate,
      ...(animation ? { animate: { type: animation.type, duration: animation.duration } } : {}),
    });
  }

  if (shapes.length > 0) {
    shapes.forEach((shape) => {
      slide.addText(shape.text, {
        ...shape.options,
        ...(animation ? { animate: { type: animation.type, duration: animation.duration } } : {}),
        rotate: pptStyle.rotate,
      });
    });
  }

  Array.from(element.children).forEach((child) => {
    if (consumedElements.has(child)) return;
    processElement(child, slide, pageRect, globalScale, pageTransformScale);
  });
}

// Walks all elements matching `.${pageClass}`, appending one PPTX slide per match.
// Options:
//   - pptx: an existing PptxGenJS instance to append to (otherwise a new one is
//     created). Caller-configured layout/master is preserved.
//   - layout: pptxgenjs layout string (e.g. "LAYOUT_WIDE") or a defineLayout name.
//   - width/height: in inches. Used to compute globalScale and, if no pptx
//     instance is supplied, to define a custom layout.
export function html2pptx(pageClass, options = {}) {
  const {
    pptx: providedPptx,
    layout = DEFAULT_PPT_LAYOUT.name,
    width = DEFAULT_PPT_LAYOUT.width,
    height = DEFAULT_PPT_LAYOUT.height,
  } = options;

  let ppt = providedPptx;
  if (!ppt) {
    ppt = new PptxGenJS();
    if (layout === "LAYOUT_WIDE") {
      ppt.defineLayout({ name: "CUSTOM_WIDE", width, height });
      ppt.layout = "CUSTOM_WIDE";
    } else {
      ppt.layout = layout;
    }
  }

  const pages = document.querySelectorAll(`.${pageClass}`);

  if (pages.length === 0) {
    console.warn(`[html-to-pptx] no elements matched .${pageClass}`);
    return ppt;
  }

  pages.forEach((dom) => {
    const element = dom;
    if (element.offsetWidth === 0 || element.offsetHeight === 0) return;

    const pageRect = element.getBoundingClientRect();
    const pageTransformScale = pageRect.width / element.offsetWidth;

    if (pageTransformScale === 0) return;

    const unscaledPageWidth = element.offsetWidth;
    const globalScale = width / unscaledPageWidth;

    const slide = ppt.addSlide();

    const bgStyle = window.getComputedStyle(element);
    const bgImg = bgStyle.backgroundImage;
    const bgColor = colorToHex(bgStyle.backgroundColor);
    if (bgImg && bgImg.includes("url(")) {
      const match = bgImg.match(/url\s*\(['"]?(.*?)['"]?\)/);
      const imageUrl = match && match[1] ? match[1] : undefined;
      if (imageUrl) {
        slide.addImage({ x: 0, y: 0, w: "100%", h: "100%", path: imageUrl });
      }
    } else if (bgColor) {
      slide.background = { color: bgColor };
    }

    Array.from(element.children).forEach((child) => {
      processElement(child, slide, pageRect, globalScale, pageTransformScale);
    });
  });

  return ppt;
}
