import { SLIDE_TEMPLATES } from './slideTemplates';

function normalizeTemplate(templateOrId) {
  if (!templateOrId) return null;
  if (typeof templateOrId === 'string') return SLIDE_TEMPLATES[templateOrId] || null;
  return templateOrId;
}

export function resolveTemplateCustomCSS(templateOrId, html = '') {
  const template = normalizeTemplate(templateOrId);
  const templateId = template?.id || (typeof templateOrId === 'string' ? templateOrId : null);
  const css = template?.css || '';
  return {
    templateId,
    customCSS: css,
    source: css ? 'template.css' : 'none',
    bytes: css.length,
    htmlBytes: html?.length || 0,
  };
}

export function getTemplateCustomCSS(templateOrId, html = '') {
  return resolveTemplateCustomCSS(templateOrId, html).customCSS;
}
