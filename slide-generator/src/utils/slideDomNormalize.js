/**
 * When AI puts `display:flex` on a prose container, each text node and each
 * `<strong>` / `<em>` becomes a separate flex item and sentences fragment into columns.
 * Wrap mixed inline/text children in one block wrapper so text flows normally.
 */
const INLINE_PROSE_TAGS = new Set([
  'STRONG', 'EM', 'B', 'I', 'SPAN', 'A', 'MARK', 'SMALL', 'SUB', 'SUP', 'BR',
]);

function isAllowedFlexProseChild(node) {
  if (node.nodeType === 3) return true;
  if (node.nodeType !== 1) return false;
  return INLINE_PROSE_TAGS.has(node.tagName);
}

function hasLooseText(childNodes) {
  return childNodes.some(
    (n) => n.nodeType === 3 && (n.textContent || '').replace(/\s/g, '').length > 0
  );
}

function emphasisDirectCount(childNodes) {
  return childNodes.filter(
    (n) => n.nodeType === 1 && /^(STRONG|EM|B|I)$/i.test(n.tagName)
  ).length;
}

function depthUntilAncestor(el, stop) {
  let d = 0;
  let n = el;
  while (n && n !== stop) {
    d += 1;
    n = n.parentElement;
  }
  return d;
}

/**
 * @param {ParentNode | null | undefined} root Mount node (contains `.slide` or `.frame`)
 */
export function normalizeFlexProseInSlideMount(root) {
  if (!root || typeof window === 'undefined') return;

  const frame = root.querySelector('.slide .frame') || root.querySelector('.frame');
  if (!frame) return;

  const candidates = [];

  const walk = frame.querySelectorAll('*');
  for (let i = 0; i < walk.length; i += 1) {
    const el = walk[i];
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;

    let display;
    try {
      display = window.getComputedStyle(el).display;
    } catch {
      continue;
    }
    if (display !== 'flex' && display !== 'inline-flex') continue;

    const childNodes = Array.from(el.childNodes);
    if (childNodes.length < 2) continue;
    if (!childNodes.every(isAllowedFlexProseChild)) continue;

    const loose = hasLooseText(childNodes);
    const emphN = emphasisDirectCount(childNodes);
    const shouldWrap =
      (loose && emphN >= 1) || emphN >= 2;
    if (!shouldWrap) continue;

    candidates.push(el);
  }

  candidates.sort(
    (a, b) => depthUntilAncestor(b, frame) - depthUntilAncestor(a, frame)
  );

  for (let i = 0; i < candidates.length; i += 1) {
    const el = candidates[i];
    if (!el.parentNode || !frame.contains(el)) continue;

    const childNodes = Array.from(el.childNodes);
    if (childNodes.length < 2) continue;
    if (!childNodes.every(isAllowedFlexProseChild)) continue;

    const loose = hasLooseText(childNodes);
    const emphN = emphasisDirectCount(childNodes);
    if (!((loose && emphN >= 1) || emphN >= 2)) continue;

    const wrapper = document.createElement('span');
    wrapper.className = 'slide-prose-flow-wrap';
    wrapper.setAttribute('data-slide-prose-wrap', '1');
    wrapper.style.display = 'block';
    wrapper.style.whiteSpace = 'normal';
    wrapper.style.minWidth = '0';
    wrapper.style.width = '100%';
    wrapper.style.boxSizing = 'border-box';

    while (el.firstChild) {
      wrapper.appendChild(el.firstChild);
    }
    el.appendChild(wrapper);
  }
}
