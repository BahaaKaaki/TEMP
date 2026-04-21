// Vendored from joker-duzhong/html-to-pptx@main (MIT).
// Source: https://github.com/joker-duzhong/html-to-pptx/blob/main/src/styleTransform.ts
// Converted from TS to JS (types stripped). No behavior changes.

export function colorToHex(color) {
  if (!color || color === "transparent" || color === "inherit") return "";
  if (color.startsWith("#")) return color.replace("#", "").toUpperCase();
  if (color.startsWith("rgb")) {
    const rgba = color.match(/(\d+(\.\d+)?)/g);
    if (rgba && rgba.length >= 3) {
      if (rgba.length > 3 && parseFloat(rgba[3]) === 0) return "";
      const r = parseInt(rgba[0], 10).toString(16).padStart(2, "0");
      const g = parseInt(rgba[1], 10).toString(16).padStart(2, "0");
      const b = parseInt(rgba[2], 10).toString(16).padStart(2, "0");
      return (r + g + b).toUpperCase();
    }
  }
  return "000000";
}

// Combined CSS opacity + RGBA alpha -> PPTX transparency (0=opaque, 100=transparent).
function getMixedTransparency(colorStr, cssOpacity) {
  let alpha = 1;
  const elementOpacity = parseFloat(cssOpacity);
  if (!isNaN(elementOpacity)) {
    alpha *= elementOpacity;
  }
  if (colorStr && colorStr.startsWith("rgba")) {
    const rgba = colorStr.match(/(\d+(\.\d+)?)/g);
    if (rgba && rgba.length >= 4) {
      const colorAlpha = parseFloat(rgba[3]);
      alpha *= colorAlpha;
    }
  }
  if (alpha >= 1) return undefined;
  return Math.round((1 - alpha) * 100);
}

// Maps a DOM element's computed style + bounding rect to a PptxGenJS shape/text descriptor.
// Coordinates (x/y/w/h) are in inches; text metrics (fontSize/lineSpacing/charSpacing) in points.
export function getComputedElementStyle(element, pageRect, globalScale, pageTransformScale) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const x = ((rect.left - pageRect.left) / pageTransformScale) * globalScale;
  const y = ((rect.top - pageRect.top) / pageTransformScale) * globalScale;
  const w = (rect.width / pageTransformScale) * globalScale;
  const h = (rect.height / pageTransformScale) * globalScale;

  const pxFontSize = parseFloat(style.fontSize) || 14;
  const fontSize = pxFontSize * globalScale * 72;

  const fontFace = style.fontFamily?.split(",")[0].replace(/['"]/g, "");

  const color = colorToHex(style.color);

  const align = (() => {
    switch (style.textAlign) {
      case "left":
      case "start":
        return "left";
      case "center":
        return "center";
      case "right":
      case "end":
        return "right";
      case "justify":
        return "justify";
      default:
        return undefined;
    }
  })();

  const valign = (() => {
    switch (style.verticalAlign) {
      case "top":
        return "top";
      case "middle":
      case "center":
        return "middle";
      case "bottom":
        return "bottom";
      default:
        return "top";
    }
  })();

  let lineSpacing;
  const lh = style.lineHeight;
  if (lh === "normal" || !lh) {
    lineSpacing = fontSize * 1.2;
  } else if (/^\d+(\.\d+)?$/.test(lh)) {
    lineSpacing = fontSize * parseFloat(lh);
  } else {
    const pxLineHeight = parseFloat(lh);
    if (!isNaN(pxLineHeight)) {
      lineSpacing = pxLineHeight * 0.75;
    }
  }

  let charSpacing;
  const ls = style.letterSpacing;
  if (ls && ls !== "normal") {
    const pxLs = parseFloat(ls);
    if (!isNaN(pxLs)) {
      charSpacing = pxLs * 0.75;
    }
  }

  let rotate;
  if (style.transform && style.transform !== "none") {
    const values = style.transform.split("(")[1]?.split(")")[0].split(",");
    if (values && values.length >= 4) {
      const a = parseFloat(values[0]);
      const b = parseFloat(values[1]);
      const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
      if (angle !== 0) rotate = angle;
    }
  }

  const cssOpacity = style.opacity || "1";
  const opacityVal = parseFloat(cssOpacity);

  const bgColor = colorToHex(style.backgroundColor);
  const fill =
    bgColor && bgColor !== ""
      ? {
          color: bgColor,
          transparency: getMixedTransparency(style.backgroundColor, cssOpacity),
        }
      : undefined;

  let border;
  const borderWidth = parseFloat(style.borderWidth);
  if (borderWidth > 0 && style.borderStyle !== "none" && style.borderColor) {
    border = {
      pt: borderWidth * 0.75,
      color: colorToHex(style.borderColor),
      type: style.borderStyle === "dashed" ? "dash" : "solid",
    };
  }

  const borderRadiusRaw = style.borderRadius || "0px";
  const radiusPx = parseFloat(borderRadiusRaw);
  const minSide = Math.min(rect.width, rect.height);
  let shapeType = "rect";
  let rectRadius;
  if (radiusPx > 0 && minSide > 0) {
    const isSquare = Math.abs(rect.width - rect.height) < 1.5;
    const isFullRound = radiusPx >= minSide / 2 - 0.5;
    if (isSquare && isFullRound) {
      shapeType = "ellipse";
      rectRadius = undefined;
    } else {
      shapeType = "roundRect";
      let ratio = radiusPx / 130;
      if (ratio > 0.5) ratio = 0.5;
      rectRadius = ratio;
    }
  }

  const bold = parseInt(style.fontWeight || "400", 10) >= 600 || style.fontWeight === "bold";
  const italic = style.fontStyle === "italic";
  const underline = style.textDecoration.includes("underline");
  const strike = style.textDecoration.includes("line-through");

  let padding;
  const pt = (v) => (parseFloat(v || "0") || 0) * 0.75;
  const ptTop = pt(style.paddingTop);
  const ptRight = pt(style.paddingRight);
  const ptBottom = pt(style.paddingBottom);
  const ptLeft = pt(style.paddingLeft);
  if (ptTop || ptRight || ptBottom || ptLeft) {
    padding = [ptTop, ptRight, ptBottom, ptLeft];
  }

  return {
    x,
    y,
    w,
    h,
    fontSize,
    fontFace,
    color,
    align,
    valign,
    lineSpacing,
    charSpacing,
    fill,
    border,
    bold,
    italic,
    underline,
    strike,
    padding,
    shapeType,
    rectRadius,
    opacity: opacityVal,
    rotate,
  };
}
