/**
 * Shared slide chrome injection for preview, PDF/HTML export, and measurement DOM.
 */

import { getActiveClientProfile } from './clientDesignProfiles.js';

function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripClientProfileChrome(html = '') {
  return html
    .replace(/<img\b[^>]*class="[^"]*\bclient-chrome-[a-z0-9_-]+-logo\b[^"]*"[^>]*>/gi, '')
    .replace(/<div\b[^>]*class="[^"]*\bclient-chrome-[a-z0-9_-]+-wordmark\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/\s*data-client-profile="[^"]*"/gi, '');
}

function stripNeomTopLogoDuplicates(html = '') {
  return html
    .replace(
      /(<div[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>)\s*<img\b(?![^>]*\bclient-chrome-neom-logo\b)[^>]*>/gi,
      '$1',
    )
    .replace(
      /(<h1[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>)([\s\S]*?)(<\/h1>)/gi,
      (_m, open, body, close) => `${open}${body.replace(/<img\b[^>]*>/gi, '')}${close}`,
    )
    .replace(
      /(<h2[^>]*class="[^"]*\bsubtitle\b[^"]*"[^>]*>)([\s\S]*?)(<\/h2>)/gi,
      (_m, open, body, close) => `${open}${body.replace(/<img\b[^>]*>/gi, '')}${close}`,
    )
    .replace(
      /<img\b(?![^>]*\bclient-chrome-neom-logo\b)[^>]*\b(?:\blogo\b|\bbrand\b|neom-logo)\b[^>]*>/gi,
      '',
    );
}

function getLogoPlacement(profile) {
  if (profile?.chrome?.logoPlacement) return profile.chrome.logoPlacement;
  if (profile?.id === 'stc') return 'top-left';
  return 'bottom-left';
}

export function injectFooterBranding(html, branding) {
  const label = String(branding || '').trim();
  if (!label || !html) return html;

  const footerBody = html.match(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>([\s\S]*?)<\/footer>/i);
  const firstSpanText = footerBody?.[1]?.match(/<span[^>]*>([^<]*)<\/span>/i)?.[1];
  if (String(firstSpanText || '').trim()) return html;

  return html.replace(
    /(<footer[^>]*class="[^"]*footer[^"]*"[^>]*>\s*)<span([^>]*)>([^<]*)<\/span>/i,
    (match, pre, attrs, content) => {
      if (String(content || '').trim()) return match;
      return `${pre}<span${attrs}>${escapeHtmlText(label)}</span>`;
    },
  );
}

export function injectPageNumber(html, pageNumber) {
  if (!html || !pageNumber) return html;
  const pageText = String(pageNumber);
  return html.replace(
    /(<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*<span(?:\s[^>]*)?>)[^<]*(<\/span>\s*<\/footer>)/i,
    `$1${pageText}$2`,
  );
}

export function injectClientProfileChrome(html, profile, logoUrl) {
  let cleanedHtml = stripClientProfileChrome(html || '');
  if (!profile?.id || profile.id === 'strategy' || !cleanedHtml) return cleanedHtml;

  if (profile.id === 'neom') {
    cleanedHtml = stripNeomTopLogoDuplicates(cleanedHtml);
  }

  const isSpecialMaster = /\b(master-cover|master-blank|master-emptyPage)\b/i.test(cleanedHtml)
    || /cover-slide|cover-branding|section-divider-slide|separator-slide/i.test(cleanedHtml);
  const withProfile = cleanedHtml.replace(
    /class="slide([^"]*)"/,
    `class="slide$1" data-client-profile="${escapeHtmlAttr(profile.id)}"`,
  );
  if (isSpecialMaster) return withProfile;

  if (profile.chrome?.injectPreviewLogo === false) return withProfile;

  const wordmarkLabel = profile.id === 'pif'
    ? 'PIF'
    : profile.id === 'stc'
      ? 'stc'
      : (profile.navLabel || profile.name || profile.id);
  const logoMarkup = logoUrl
    ? `<img class="client-chrome client-chrome-${escapeHtmlAttr(profile.id)}-logo" data-no-edit src="${escapeHtmlAttr(logoUrl)}" alt="${escapeHtmlAttr(profile.name || profile.id)}" />`
    : `<div class="client-chrome client-chrome-${escapeHtmlAttr(profile.id)}-wordmark" data-no-edit>${escapeHtmlText(wordmarkLabel)}</div>`;

  const placement = getLogoPlacement(profile);
  if (placement === 'bottom-left' && /<footer[^>]*class="[^"]*footer/i.test(withProfile)) {
    return withProfile.replace(/(<footer[^>]*class="[^"]*footer)/i, `${logoMarkup}$1`);
  }

  return withProfile.replace(/(<div\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>)/i, `$1${logoMarkup}`);
}

/**
 * Apply preview/export parity transforms to stored slide HTML.
 */
export function prepareSlideHtmlForRender(html, {
  profile = null,
  logoUrl = null,
  pageNumber = null,
  footerBranding = '',
  stripCoverFooter = true,
} = {}) {
  if (!html) return '';

  let next = html;
  if (stripCoverFooter && (next.includes('cover-slide') || next.includes('cover-branding'))) {
    next = next.replace(/<footer[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/footer>/gi, '');
  }

  const branding = footerBranding
    || profile?.footerBranding
    || profile?.chrome?.footerText
    || '';
  next = injectFooterBranding(next, branding);
  if (pageNumber) next = injectPageNumber(next, pageNumber);
  next = injectClientProfileChrome(next, profile, logoUrl);
  return next;
}

export function getClientLogoAssetPath(profile) {
  const hasBundledLogo = profile?.chrome?.positions?.logo
    && profile?.pptxMaster?.serverSync === 'backend-profile-default';
  if (!hasBundledLogo || !profile?.id) return null;
  const logoVersion = profile?.pptxMaster?.assetVersion || profile?.status || '1';
  return `/api/assets/client-templates/${profile.id}/logo.png?v=${encodeURIComponent(logoVersion)}`;
}

export async function fetchClientLogoObjectUrl(profile, authFetch) {
  const assetPath = getClientLogoAssetPath(profile);
  if (!assetPath || typeof authFetch !== 'function') return null;

  const res = await authFetch(assetPath);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function resolveRenderProfile(settings) {
  return getActiveClientProfile(settings || {});
}
