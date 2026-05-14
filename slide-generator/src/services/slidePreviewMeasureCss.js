/**
 * CSS fragments shared by SlidePreview and export-time measurement DOM.
 * The actual slide system is still the global slides.css import; these
 * fragments provide only the preview container and client chrome wrappers.
 */

export function getSlideMeasureContainerCss() {
  return `
/* Container sizing only - slides.css handles all .slide content styling */
.slide-render-container {
  width: 960px;
  height: 540px;
  position: relative;
  overflow: hidden;
}

/* Fallback for content without .slide wrapper */
.slide-render-container:not(:has(.slide)) {
  background: #fff;
  padding: 35px;
  font-family: Arial, sans-serif;
  color: #111111;
}
`;
}

export function getSlideMeasureClientChromeCss() {
  return `
.slide[data-client-profile="stc"] .client-chrome {
  position: absolute;
  z-index: 8;
  pointer-events: none;
  user-select: none;
}

.slide[data-client-profile="stc"] .client-chrome-stc-logo {
  left: 14px;
  top: 2px;
  width: 35px;
  height: 18px;
  object-fit: contain;
}

.slide[data-client-profile="stc"] .client-chrome-stc-wordmark {
  left: 14px;
  top: 2px;
  width: 35px;
  height: 18px;
  font: 700 16px/1 "STC Forward", Arial, sans-serif;
  color: var(--accent);
  letter-spacing: -1px;
}

.slide[data-client-profile="pif"] .client-chrome {
  position: absolute;
  z-index: 8;
  pointer-events: none;
  user-select: none;
}

.slide[data-client-profile="pif"] .client-chrome-pif-logo {
  left: 35px;
  top: 23px;
  width: 80px;
  height: 36px;
  object-fit: contain;
}

.slide[data-client-profile="pif"] .client-chrome-pif-wordmark {
  left: 35px;
  top: 23px;
  width: 80px;
  height: 36px;
  font: 400 24px/1 "Fund Light", "Fund Regular", Arial, sans-serif;
  color: #005C4D;
}

.slide[data-client-profile="dge"] .client-chrome {
  position: absolute;
  z-index: 8;
  pointer-events: none;
  user-select: none;
}

.slide[data-client-profile="dge"] .client-chrome-dge-logo {
  left: 709px;
  top: 31px;
  width: 218px;
  height: 51px;
  object-fit: contain;
  object-position: right center;
}

.slide[data-client-profile="dge"] .client-chrome-dge-wordmark {
  left: 709px;
  top: 31px;
  width: 218px;
  height: 51px;
  font: 600 14px/1.1 "Noto Sans", "Segoe UI", Arial, sans-serif;
  color: #063360;
  text-align: right;
}
`;
}
