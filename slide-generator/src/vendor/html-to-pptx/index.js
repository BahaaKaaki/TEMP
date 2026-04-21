// Vendored from joker-duzhong/html-to-pptx@main (MIT).
// Source: https://github.com/joker-duzhong/html-to-pptx/blob/main/src/index.ts
// Converted from TS to JS; forwards options to html2pptx (see analyze.js).

import { html2pptx } from "./analyze";

export { html2pptx };

export async function exportHtmlToPpt(pageClassName = "page", outputType = "blob", options = {}) {
  const pptx = await html2pptx(pageClassName, options);
  return pptx.write({ outputType });
}

export async function downloadHtmlToPpt(pageClassName = "page", fileName = "presentation", options = {}) {
  const pptx = await html2pptx(pageClassName, options);
  await pptx.writeFile({ fileName: fileName.endsWith(".pptx") ? fileName : fileName + ".pptx" });
}
