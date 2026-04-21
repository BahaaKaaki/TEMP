// Vendored from joker-duzhong/html-to-pptx@main (MIT).
// Source: https://github.com/joker-duzhong/html-to-pptx/blob/main/src/animationTransform.ts
// Converted from TS to JS (types stripped). No behavior changes.

const ANIMATION_MAP = {
  fadeIn: "fadeIn",
  fadeInUp: "flyInBottom",
  fadeInDown: "flyInTop",
  fadeInLeft: "flyInLeft",
  fadeInRight: "flyInRight",
  zoomIn: "zoomIn",
  bounceIn: "bounce",
  slideInUp: "flyInBottom",
  slideInDown: "flyInTop",
  slideInLeft: "flyInLeft",
  slideInRight: "flyInRight",
};

// Prefers explicit data-pptx-animation attribute, else derives from CSS animation-name.
export function getElementAnimation(element) {
  const style = window.getComputedStyle(element);

  const dataAnim = element.getAttribute("data-pptx-animation");
  if (dataAnim) {
    const duration = parseInt(element.getAttribute("data-pptx-duration") || "1000", 10) / 1000;
    const delay = parseInt(element.getAttribute("data-pptx-delay") || "0", 10) / 1000;
    return { type: dataAnim, duration, delay };
  }

  const animName = style.animationName;
  if (animName && animName !== "none") {
    const primaryAnim = animName.split(",")[0].trim();

    let pptAnimType = ANIMATION_MAP[primaryAnim];

    if (!pptAnimType) {
      const key = Object.keys(ANIMATION_MAP).find((k) => primaryAnim.toLowerCase().includes(k.toLowerCase()));
      if (key) pptAnimType = ANIMATION_MAP[key];
    }

    if (pptAnimType) {
      const durationStr = style.animationDuration.split(",")[0] ?? "1s";
      const delayStr = style.animationDelay.split(",")[0] ?? "0s";
      const parseTime = (t) => {
        const val = parseFloat(t);
        return t.includes("ms") ? val / 1000 : val;
      };

      return {
        type: pptAnimType,
        duration: parseTime(durationStr) || 1,
        delay: parseTime(delayStr) || 0,
      };
    }
  }

  return undefined;
}
