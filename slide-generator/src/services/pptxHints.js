// PPTX Hint Comments -- parser, stripper, prompt formatter.
//
// The slide-generation LLM can embed sparse semantic export hints as HTML
// comments immediately before risky elements, for example:
//
//   <!-- pptx chip nowrap exact-text center tight-box -->
//   <div class="d-swatch">TURQUOISE</div>
//
// These hints are lightweight export guidance for elements that often drift in
// PowerPoint (chips, badges, step numbers, tight one-line labels). The HTML and
// CSS remain the primary source of layout and styling; these comments simply
// tell the exporter what must not break.
//
// The module exposes three helpers consumed by pptxService.js:
//
//   parsePptxHints(html)          -> Array of structured hints
//   stripPptxHintComments(html)   -> HTML with the pptx comments removed
//   formatHintsForPrompt(hints)   -> Prompt-ready text block

const HINT_COMMENT_RE = /<!--\s*pptx\b([\s\S]*?)-->/g;
const NEXT_OPEN_TAG_RE = /<([a-zA-Z][\w-]*)\b([^>]*)>/;
const KNOWN_FLAGS = ['chip', 'badge', 'nowrap', 'exact-text', 'step-number', 'tight-box'];
const H_ALIGN = ['left', 'center', 'right'];
const V_ALIGN = ['top', 'middle', 'bottom'];

function parseTokens(str) {
  const tokens = {};
  if (!str) return tokens;
  const re = /(\w[\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const key = m[1];
    const value = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
    if (value === undefined) tokens[key] = true;
    else tokens[key] = value;
  }
  return tokens;
}

function buildHints(tokens) {
  const h = {};
  const flags = KNOWN_FLAGS.filter((flag) => tokens[flag] === true || tokens[flag] === 'true');
  const alignFromKey = tokens.align ? String(tokens.align).toLowerCase() : '';
  const valignFromKey = tokens.valign ? String(tokens.valign).toLowerCase() : '';
  const alignFromFlag = H_ALIGN.find((flag) => tokens[flag] === true || tokens[flag] === 'true') || '';
  const valignFromFlag = V_ALIGN.find((flag) => tokens[flag] === true || tokens[flag] === 'true') || '';
  const align = H_ALIGN.includes(alignFromKey) ? alignFromKey : alignFromFlag;
  const valign = V_ALIGN.includes(valignFromKey) ? valignFromKey : valignFromFlag;

  if (flags.length > 0) h.flags = flags;
  if (align) h.align = align;
  if (valign) h.valign = valign;
  return h;
}

function findNextOpenTag(html, startIdx) {
  const slice = html.slice(startIdx);
  const match = slice.match(NEXT_OPEN_TAG_RE);
  if (!match) return null;
  return {
    tag: match[1].toLowerCase(),
    attrs: match[2] || '',
    offset: startIdx + (match.index || 0),
  };
}

function extractClassName(attrs) {
  const m = attrs && attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return m ? (m[1] || m[2] || '').trim() : '';
}

/**
 * Parse every `<!-- pptx ... -->` comment from an HTML string, pairing each
 * with the element that follows it. Only semantic export flags are recognised.
 * Legacy absolute-schema keys are ignored and therefore produce no hint entry.
 *
 * @param {string} html
 * @returns {Array<{index:number, tag:string, className:string, hints:object, raw:string}>}
 */
export function parsePptxHints(html) {
  if (!html || typeof html !== 'string') return [];
  const results = [];
  HINT_COMMENT_RE.lastIndex = 0;
  let m;
  while ((m = HINT_COMMENT_RE.exec(html)) !== null) {
    const commentEnd = m.index + m[0].length;
    const next = findNextOpenTag(html, commentEnd);
    if (!next) continue;
    const tokens = parseTokens(m[1]);
    const hints = buildHints(tokens);
    if (Object.keys(hints).length === 0) continue;
    results.push({
      index: results.length,
      tag: next.tag,
      className: extractClassName(next.attrs),
      hints,
      raw: m[1].trim(),
    });
  }
  return results;
}

/**
 * Remove only `<!-- pptx ... -->` comments from an HTML string. Any other
 * comments (`<!-- plain note -->`) are preserved. Use this before sending
 * HTML to the exporter LLM so the structured hints block is the single
 * source of truth and the HTML payload is clean.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripPptxHintComments(html) {
  if (!html) return html;
  return html.replace(HINT_COMMENT_RE, '').replace(/\n{3,}/g, '\n\n');
}

function formatOneHint(entry) {
  const { tag, className, hints: k } = entry;
  const selector = className
    ? `${tag}.${className.split(/\s+/).filter(Boolean).join('.')}`
    : tag;
  const parts = [];
  if (Array.isArray(k.flags)) parts.push(...k.flags);
  if (k.align) parts.push(`align=${k.align}`);
  if (k.valign) parts.push(`valign=${k.valign}`);
  return `[${entry.index + 1}] ${selector}\n    ${parts.join(', ')}`;
}

/**
 * Render the hints as a single text block ready to drop into the PPTX
 * export LLM prompt. Returns an empty string when there are no hints so
 * callers can trivially skip the section for unhinted slides.
 *
 * @param {Array<object>} hints
 * @returns {string}
 */
export function formatHintsForPrompt(hints) {
  if (!Array.isArray(hints) || hints.length === 0) return '';
  const header = [
    '========== ELEMENT HINTS (export guidance for risky elements) ==========',
    'Each entry below is a semantic export hint attached to a risky element in the',
    'source HTML. These hints are guidance for how to preserve browser intent when',
    'PowerPoint text boxes tend to drift. They are not measured geometry.',
    '',
    'Hint meanings:',
    '  chip / badge  -> compact label or pill; keep it visually tight and single-line',
    '  nowrap        -> never wrap or stack letters',
    '  exact-text    -> preserve the visible text exactly',
    '  step-number   -> keep the number as one prominent line',
    '  tight-box     -> minimise text margin / inset; use shrink only as a last resort',
    '  align=...     -> prefer this horizontal alignment if the label is small',
    '  valign=...    -> prefer this vertical alignment if the label is small',
    '',
  ].join('\n');
  const body = hints.map(formatOneHint).join('\n');
  return `${header}${body}\n========== END HINTS ==========`;
}
