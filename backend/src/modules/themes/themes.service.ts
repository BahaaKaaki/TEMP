import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../config/database';
import { ApiError } from '../../common/middleware/error.middleware';

// Slide size configuration
export interface SlideSize {
  width: number;
  height: number;
  unit: 'px' | 'in' | 'cm';
  name: string; // e.g., 'Widescreen 16:9', 'Standard 4:3', 'Custom'
}

// Color palette configuration
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  success?: string;
  warning?: string;
  error?: string;
  [key: string]: string | undefined;
}

// Typography configuration
export interface Typography {
  headingFont: string;
  bodyFont: string;
  headingSizes: {
    h1: string;
    h2: string;
    h3: string;
    h4?: string;
  };
  bodySizes: {
    large: string;
    normal: string;
    small: string;
  };
  fontWeights: {
    normal: number;
    medium: number;
    bold: number;
  };
  lineHeights: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

// Layout configuration
export interface LayoutConfig {
  columnGap: string;
  rowGap: string;
  padding: {
    slide: string;
    content: string;
  };
  margins: {
    header: string;
    footer: string;
  };
  maxContentWidth?: string;
}

// Writing style configuration
export interface WritingStyle {
  tone: 'formal' | 'professional' | 'casual' | 'friendly' | 'technical';
  formality: 'high' | 'medium' | 'low';
  bulletStyle: 'dash' | 'dot' | 'arrow' | 'number' | 'custom';
  bulletChar?: string;
  sentenceCase: 'sentence' | 'title' | 'upper' | 'lower';
  maxBulletsPerSlide?: number;
  maxWordsPerBullet?: number;
  preferredVoice?: 'active' | 'passive';
  avoidWords?: string[];
  preferredTerms?: Record<string, string>;
}

// Default template configuration
export interface DefaultTemplateConfig {
  titleSlide: {
    titlePosition: 'center' | 'left' | 'right';
    subtitlePosition: 'below' | 'above' | 'right';
    showLogo: boolean;
    logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };
  contentSlide: {
    headerPosition: 'top' | 'top-left' | 'top-center';
    headerHeight: string;
    contentArea: 'full' | 'with-sidebar' | 'with-footer';
    footerContent?: string;
  };
  sectionSlide: {
    titlePosition: 'center' | 'left';
    showNumber: boolean;
    backgroundStyle: 'solid' | 'gradient' | 'image';
  };
}

// Theme configuration (all settings in one place)
export interface ThemeConfig {
  slideSize: SlideSize;
  colors: ColorPalette;
  typography: Typography;
  layout: LayoutConfig;
  writingStyle: WritingStyle;
  defaultTemplate: DefaultTemplateConfig;
}

export interface Theme {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  createdBy: string;
  htmlContent: string;
  cssVariables: Record<string, string>;
  extractedStyles: ExtractedStyles;
  config: ThemeConfig;
  defaultTemplateId: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedStyles {
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    [key: string]: string | undefined;
  };
  fonts: {
    heading?: string;
    body?: string;
    [key: string]: string | undefined;
  };
  spacing: {
    small?: string;
    medium?: string;
    large?: string;
    [key: string]: string | undefined;
  };
  borders: {
    radius?: string;
    color?: string;
    [key: string]: string | undefined;
  };
  customVariables: Record<string, string>;
}

// Default theme configuration
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  slideSize: {
    width: 1920,
    height: 1080,
    unit: 'px',
    name: 'Widescreen 16:9',
  },
  colors: {
    primary: '#E4002B',
    secondary: '#1A1A1A',
    accent: '#FFD100',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1A1A1A',
    textMuted: '#666666',
  },
  typography: {
    headingFont: 'Georgia, serif',
    bodyFont: 'Arial, sans-serif',
    headingSizes: {
      h1: '48px',
      h2: '36px',
      h3: '28px',
      h4: '24px',
    },
    bodySizes: {
      large: '20px',
      normal: '16px',
      small: '14px',
    },
    fontWeights: {
      normal: 400,
      medium: 500,
      bold: 700,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.8,
    },
  },
  layout: {
    columnGap: '24px',
    rowGap: '16px',
    padding: {
      slide: '48px',
      content: '24px',
    },
    margins: {
      header: '24px',
      footer: '16px',
    },
  },
  writingStyle: {
    tone: 'professional',
    formality: 'high',
    bulletStyle: 'dash',
    sentenceCase: 'sentence',
    maxBulletsPerSlide: 5,
    maxWordsPerBullet: 15,
    preferredVoice: 'active',
  },
  defaultTemplate: {
    titleSlide: {
      titlePosition: 'center',
      subtitlePosition: 'below',
      showLogo: true,
      logoPosition: 'bottom-right',
    },
    contentSlide: {
      headerPosition: 'top-left',
      headerHeight: '80px',
      contentArea: 'full',
    },
    sectionSlide: {
      titlePosition: 'center',
      showNumber: true,
      backgroundStyle: 'solid',
    },
  },
};

interface CreateThemeInput {
  name: string;
  description?: string;
  htmlContent?: string;
  config?: Partial<ThemeConfig>;
  organizationId?: string;
  createdBy: string;
  isPublic?: boolean;
  defaultTemplateId?: string;
}

// Merge partial config with defaults
function mergeConfig(partial?: Partial<ThemeConfig>): ThemeConfig {
  if (!partial) return { ...DEFAULT_THEME_CONFIG };

  return {
    slideSize: { ...DEFAULT_THEME_CONFIG.slideSize, ...partial.slideSize },
    colors: { ...DEFAULT_THEME_CONFIG.colors, ...partial.colors },
    typography: {
      ...DEFAULT_THEME_CONFIG.typography,
      ...partial.typography,
      headingSizes: { ...DEFAULT_THEME_CONFIG.typography.headingSizes, ...partial.typography?.headingSizes },
      bodySizes: { ...DEFAULT_THEME_CONFIG.typography.bodySizes, ...partial.typography?.bodySizes },
      fontWeights: { ...DEFAULT_THEME_CONFIG.typography.fontWeights, ...partial.typography?.fontWeights },
      lineHeights: { ...DEFAULT_THEME_CONFIG.typography.lineHeights, ...partial.typography?.lineHeights },
    },
    layout: {
      ...DEFAULT_THEME_CONFIG.layout,
      ...partial.layout,
      padding: { ...DEFAULT_THEME_CONFIG.layout.padding, ...partial.layout?.padding },
      margins: { ...DEFAULT_THEME_CONFIG.layout.margins, ...partial.layout?.margins },
    },
    writingStyle: { ...DEFAULT_THEME_CONFIG.writingStyle, ...partial.writingStyle },
    defaultTemplate: {
      ...DEFAULT_THEME_CONFIG.defaultTemplate,
      ...partial.defaultTemplate,
      titleSlide: { ...DEFAULT_THEME_CONFIG.defaultTemplate.titleSlide, ...partial.defaultTemplate?.titleSlide },
      contentSlide: { ...DEFAULT_THEME_CONFIG.defaultTemplate.contentSlide, ...partial.defaultTemplate?.contentSlide },
      sectionSlide: { ...DEFAULT_THEME_CONFIG.defaultTemplate.sectionSlide, ...partial.defaultTemplate?.sectionSlide },
    },
  };
}

// Parse HTML style guide and extract CSS variables and styles
export function parseStyleGuideHTML(html: string): { cssVariables: Record<string, string>; extractedStyles: ExtractedStyles } {
  const cssVariables: Record<string, string> = {};
  const extractedStyles: ExtractedStyles = {
    colors: {},
    fonts: {},
    spacing: {},
    borders: {},
    customVariables: {},
  };

  // Extract inline styles from style tags
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  let allCSS = '';

  while ((styleMatch = styleRegex.exec(html)) !== null) {
    allCSS += styleMatch[1] + '\n';
  }

  // Extract CSS custom properties (--var-name: value)
  const cssVarRegex = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let varMatch;

  while ((varMatch = cssVarRegex.exec(allCSS)) !== null) {
    const name = varMatch[1].trim();
    const value = varMatch[2].trim();
    cssVariables[`--${name}`] = value;

    // Categorize the variable
    const nameLower = name.toLowerCase();
    if (nameLower.includes('color') || nameLower.includes('bg') || nameLower.includes('text') ||
        nameLower.includes('primary') || nameLower.includes('secondary') || nameLower.includes('accent') ||
        value.match(/^#[0-9a-fA-F]{3,8}$|^rgb|^hsl/)) {
      // It's a color
      if (nameLower.includes('primary')) extractedStyles.colors.primary = value;
      else if (nameLower.includes('secondary')) extractedStyles.colors.secondary = value;
      else if (nameLower.includes('accent')) extractedStyles.colors.accent = value;
      else if (nameLower.includes('background') || nameLower.includes('bg')) extractedStyles.colors.background = value;
      else if (nameLower.includes('text')) extractedStyles.colors.text = value;
      else extractedStyles.colors[name] = value;
    } else if (nameLower.includes('font') || nameLower.includes('family')) {
      if (nameLower.includes('heading') || nameLower.includes('title')) extractedStyles.fonts.heading = value;
      else if (nameLower.includes('body') || nameLower.includes('text')) extractedStyles.fonts.body = value;
      else extractedStyles.fonts[name] = value;
    } else if (nameLower.includes('spacing') || nameLower.includes('gap') || nameLower.includes('margin') || nameLower.includes('padding')) {
      if (nameLower.includes('small') || nameLower.includes('sm')) extractedStyles.spacing.small = value;
      else if (nameLower.includes('medium') || nameLower.includes('md')) extractedStyles.spacing.medium = value;
      else if (nameLower.includes('large') || nameLower.includes('lg')) extractedStyles.spacing.large = value;
      else extractedStyles.spacing[name] = value;
    } else if (nameLower.includes('radius') || nameLower.includes('border')) {
      if (nameLower.includes('radius')) extractedStyles.borders.radius = value;
      else if (nameLower.includes('color')) extractedStyles.borders.color = value;
      else extractedStyles.borders[name] = value;
    } else {
      extractedStyles.customVariables[name] = value;
    }
  }

  // Also extract from data attributes (common in style guides)
  // e.g., data-color="primary" style="background: #FF0000"
  const dataColorRegex = /data-color="([^"]+)"[^>]*style="[^"]*(?:background|color)\s*:\s*([^;"]+)/gi;
  let dataMatch;
  while ((dataMatch = dataColorRegex.exec(html)) !== null) {
    const colorName = dataMatch[1].trim();
    const colorValue = dataMatch[2].trim();
    extractedStyles.colors[colorName] = colorValue;
    cssVariables[`--color-${colorName}`] = colorValue;
  }

  // Extract color swatches (div with background-color and text content as name)
  const swatchRegex = /<div[^>]*class="[^"]*(?:swatch|color)[^"]*"[^>]*style="[^"]*background(?:-color)?\s*:\s*([^;"]+)[^"]*"[^>]*>([^<]*)</gi;
  while ((dataMatch = swatchRegex.exec(html)) !== null) {
    const colorValue = dataMatch[1].trim();
    const colorName = dataMatch[2].trim().toLowerCase().replace(/\s+/g, '-');
    if (colorName && colorValue) {
      extractedStyles.colors[colorName] = colorValue;
      cssVariables[`--color-${colorName}`] = colorValue;
    }
  }

  // Extract font family from CSS rules
  const fontFamilyRegex = /font-family\s*:\s*([^;]+);/gi;
  while ((varMatch = fontFamilyRegex.exec(allCSS)) !== null) {
    const fontValue = varMatch[1].trim().replace(/['"]/g, '');
    if (!extractedStyles.fonts.body) {
      extractedStyles.fonts.body = fontValue;
    }
  }

  // Extract heading font (h1, h2 rules)
  const headingFontRegex = /h[1-3]\s*\{[^}]*font-family\s*:\s*([^;]+);/gi;
  while ((varMatch = headingFontRegex.exec(allCSS)) !== null) {
    extractedStyles.fonts.heading = varMatch[1].trim().replace(/['"]/g, '');
  }

  return { cssVariables, extractedStyles };
}

// Generate CSS from extracted styles
export function generateCSSFromTheme(theme: Theme): string {
  const lines: string[] = [':root {'];

  // Add all CSS variables
  for (const [key, value] of Object.entries(theme.cssVariables)) {
    lines.push(`  ${key}: ${value};`);
  }

  // Generate standard slide variables from extracted styles
  const { colors, fonts, spacing, borders } = theme.extractedStyles;

  // Map to slide-specific variables
  if (colors.primary) lines.push(`  --main: ${colors.primary};`);
  if (colors.secondary) lines.push(`  --secondary: ${colors.secondary};`);
  if (colors.accent) lines.push(`  --red: ${colors.accent};`);
  if (colors.accent) lines.push(`  --maroon: ${colors.accent};`);
  if (colors.background) lines.push(`  --zone1: ${colors.background};`);
  if (fonts.heading) lines.push(`  --font-heading: ${fonts.heading};`);
  if (fonts.body) lines.push(`  --font-body: ${fonts.body};`);
  if (borders.radius) lines.push(`  --radius: ${borders.radius};`);
  if (spacing.medium) lines.push(`  --gH: ${spacing.medium};`);
  if (spacing.small) lines.push(`  --gV: ${spacing.small};`);

  lines.push('}');

  // Add any additional styles from the original HTML
  return lines.join('\n');
}

// Create a new theme from HTML style guide or config
export async function createTheme(input: CreateThemeInput): Promise<Theme> {
  const { name, description, htmlContent, config, organizationId, createdBy, isPublic, defaultTemplateId } = input;

  // Parse HTML if provided, otherwise use empty
  let cssVariables: Record<string, string> = {};
  let extractedStyles: ExtractedStyles = {
    colors: {},
    fonts: {},
    spacing: {},
    borders: {},
    customVariables: {},
  };

  if (htmlContent) {
    const parsed = parseStyleGuideHTML(htmlContent);
    cssVariables = parsed.cssVariables;
    extractedStyles = parsed.extractedStyles;
  }

  // Merge config with defaults
  const themeConfig = mergeConfig(config);

  // If config colors are provided, use them to populate extractedStyles
  if (config?.colors) {
    extractedStyles.colors = {
      ...extractedStyles.colors,
      primary: config.colors.primary,
      secondary: config.colors.secondary,
      accent: config.colors.accent,
      background: config.colors.background,
      text: config.colors.text,
    };
  }

  // If config typography is provided, use it
  if (config?.typography) {
    extractedStyles.fonts = {
      ...extractedStyles.fonts,
      heading: config.typography.headingFont,
      body: config.typography.bodyFont,
    };
  }

  const id = uuidv4();
  const now = new Date();

  const theme: Theme = {
    id,
    name,
    description: description || null,
    organizationId: organizationId || null,
    createdBy,
    htmlContent: htmlContent || '',
    cssVariables,
    extractedStyles,
    config: themeConfig,
    defaultTemplateId: defaultTemplateId || null,
    isPublic: isPublic ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await query(
    `INSERT INTO themes (id, name, description, organization_id, created_by, html_content, css_variables, extracted_styles, config, default_template_id, is_public, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, name, description, organizationId, createdBy, htmlContent || '', JSON.stringify(cssVariables), JSON.stringify(extractedStyles), JSON.stringify(themeConfig), defaultTemplateId || null, isPublic ?? false, now, now]
  );

  return theme;
}

// Get all organization IDs a user belongs to
async function getUserOrganizationIds(userId: string): Promise<string[]> {
  const result = await query<{ organization_id: string }>(
    `SELECT organization_id FROM organization_members WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map(r => r.organization_id);
}

// Get all themes for a user (their org themes + public themes)
export async function getThemes(userId: string, organizationId?: string): Promise<Theme[]> {
  // Get all organizations the user belongs to
  const userOrgIds = await getUserOrganizationIds(userId);

  const result = await query<any>(
    `SELECT * FROM themes WHERE
     is_public = true
     OR created_by = $1
     OR organization_id = ANY($2::text[])
     ORDER BY created_at DESC`,
    [userId, userOrgIds]
  );

  return result.rows.map(mapRowToTheme);
}

// Check if user has access to a theme
export async function canAccessTheme(userId: string, themeId: string): Promise<boolean> {
  const theme = await getTheme(themeId);
  if (!theme) return false;

  // Public themes are accessible to all
  if (theme.isPublic) return true;

  // User's own themes are accessible
  if (theme.createdBy === userId) return true;

  // Themes from user's organizations are accessible
  if (theme.organizationId) {
    const userOrgIds = await getUserOrganizationIds(userId);
    if (userOrgIds.includes(theme.organizationId)) return true;
  }

  return false;
}

// Get a specific theme by ID
export async function getTheme(id: string): Promise<Theme | null> {
  const result = await query<any>(
    `SELECT * FROM themes WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;
  return mapRowToTheme(result.rows[0]);
}

// Update a theme
export async function updateTheme(id: string, updates: Partial<CreateThemeInput>): Promise<Theme> {
  const existing = await getTheme(id);
  if (!existing) {
    throw ApiError.notFound('Theme');
  }

  let cssVariables = existing.cssVariables;
  let extractedStyles = existing.extractedStyles;

  if (updates.htmlContent) {
    const parsed = parseStyleGuideHTML(updates.htmlContent);
    cssVariables = parsed.cssVariables;
    extractedStyles = parsed.extractedStyles;
  }

  const now = new Date();

  await query(
    `UPDATE themes SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       html_content = COALESCE($3, html_content),
       css_variables = $4,
       extracted_styles = $5,
       updated_at = $6
     WHERE id = $7`,
    [
      updates.name || null,
      updates.description || null,
      updates.htmlContent || null,
      JSON.stringify(cssVariables),
      JSON.stringify(extractedStyles),
      now,
      id
    ]
  );

  return {
    ...existing,
    ...updates,
    cssVariables,
    extractedStyles,
    updatedAt: now,
  };
}

// Delete a theme
export async function deleteTheme(id: string): Promise<void> {
  await query(`DELETE FROM themes WHERE id = $1`, [id]);
}

// Helper to map database row to Theme object
function mapRowToTheme(row: any): Theme {
  const configData = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    htmlContent: row.html_content || '',
    cssVariables: typeof row.css_variables === 'string' ? JSON.parse(row.css_variables) : row.css_variables || {},
    extractedStyles: typeof row.extracted_styles === 'string' ? JSON.parse(row.extracted_styles) : row.extracted_styles || {
      colors: {},
      fonts: {},
      spacing: {},
      borders: {},
      customVariables: {},
    },
    config: configData ? mergeConfig(configData) : DEFAULT_THEME_CONFIG,
    defaultTemplateId: row.default_template_id || null,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
