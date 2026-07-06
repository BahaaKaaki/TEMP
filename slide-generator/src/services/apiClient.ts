/**
 * API Client for Slide Generator Backend
 * Handles authentication, token refresh, and API calls
 */

// Detect API URL for cloud development environments
function getApiUrl(): string {
  // If explicitly set, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In cloud environments, transform the frontend URL to backend URL
  // e.g., https://5173-xyz.cloudworkstations.dev -> https://3001-xyz.cloudworkstations.dev
  if (typeof window !== 'undefined') {
    const currentHost = window.location.host;
    const currentOrigin = window.location.origin;

    // Check for cloud development environment patterns
    // Pattern: port-based subdomain (e.g., 5173-workspace.domain.com)
    const portMatch = currentHost.match(/^(\d+)-(.+)$/);
    if (portMatch && portMatch[1] === '5173') {
      return `${window.location.protocol}//3001-${portMatch[2]}`;
    }

    // Pattern: port in path or subdomain variation
    if (currentHost.includes('-5173-') || currentHost.includes('-5173.')) {
      return currentOrigin.replace('-5173-', '-3001-').replace('-5173.', '-3001.');
    }
  }

  // Default: use relative URLs (works with Vite proxy on localhost)
  return '';
}

let API_URL = getApiUrl();

// Debug: log the API URL being used
console.log('[apiClient] API_URL:', API_URL || '(relative URLs)');
console.log('[apiClient] window.location:', typeof window !== 'undefined' ? window.location.href : 'SSR');

// Validate the constructed API URL is reachable; fall back to relative URLs if not.
// This prevents net::ERR_NAME_NOT_RESOLVED errors when the cloud-environment URL
// pattern produces a hostname that doesn't exist in DNS.
async function validateApiUrl(): Promise<void> {
  if (!API_URL) return; // already using relative URLs
  try {
    const resp = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      console.log('[apiClient] Backend reachable at', API_URL);
      return;
    }
  } catch {
    // DNS failure, network error, or timeout
  }
  console.warn(
    `[apiClient] Backend unreachable at ${API_URL} — falling back to relative URLs. ` +
    'Set VITE_API_URL if running in a cloud environment.'
  );
  API_URL = '';
}

// Fire-and-forget; the first real API call may still use the old URL if it
// races ahead, but isBackendAvailable() is called early and will also fail
// gracefully.
validateApiUrl();

// Token storage keys
const ACCESS_TOKEN_KEY = 'sg_access_token';
const REFRESH_TOKEN_KEY = 'sg_refresh_token';

// Token management
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Types
export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  preferences: Record<string, unknown>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  settings: Record<string, unknown>;
  tier: 'free' | 'pro' | 'enterprise';
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// API Error class
export class ApiRequestError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Check if backend is available
export async function isBackendAvailable(): Promise<boolean> {
  try {
    // Use relative URL to go through proxy
    const url = API_URL ? `${API_URL}/health` : '/health';
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Base request function
async function request<T>(
  method: string,
  path: string,
  data?: unknown,
  options: {
    skipAuth?: boolean;
    organizationId?: string;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Add organization context
  if (options.organizationId) {
    headers['X-Organization-Id'] = options.organizationId;
  }

  const url = `${API_URL}${path}`;
  console.log(`[apiClient] ${method} ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (networkErr) {
    // DNS resolution failure or network error — provide actionable message
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error(`[apiClient] Network error for ${url}:`, msg);
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      `Cannot reach backend at ${url || '(relative)'}. Check that the server is running and the URL is correct. (${msg})`
    );
  }

  console.log(`[apiClient] Response: ${response.status} ${response.statusText}`);

  // Handle token refresh on 401
  if (response.status === 401 && !options.skipAuth) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry request with new token
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      const retryResponse = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });
      return handleResponse<T>(retryResponse);
    }
    // Refresh failed - clear tokens
    clearTokens();
    throw new ApiRequestError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
  }

  return handleResponse<T>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const error = await response.json();
      throw new ApiRequestError(
        response.status,
        error.error?.code || 'UNKNOWN_ERROR',
        error.error?.message || 'An error occurred',
        error.error?.details
      );
    }
    throw new ApiRequestError(
      response.status,
      'UNKNOWN_ERROR',
      `Request failed with status ${response.status}`
    );
  }

  if (isJson) {
    const result = await response.json();
    return result.data !== undefined ? result.data : result;
  }

  return {} as T;
}

// Token refresh
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const result = await response.json();
    const tokens = result.data?.tokens;
    if (tokens) {
      setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ==========================================
// Auth API
// ==========================================

export const authApi = {
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ user: User; tokens: AuthTokens }> {
    const result = await request<{ user: User; tokens: AuthTokens }>(
      'POST',
      '/api/v1/auth/register',
      data,
      { skipAuth: true }
    );
    setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    return result;
  },

  async login(data: { email: string; password: string }): Promise<{ user: User; tokens: AuthTokens }> {
    const result = await request<{ user: User; tokens: AuthTokens }>(
      'POST',
      '/api/v1/auth/login',
      data,
      { skipAuth: true }
    );
    setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    return result;
  },

  async logout(): Promise<void> {
    try {
      await request('POST', '/api/v1/auth/logout');
    } finally {
      clearTokens();
    }
  },

  async getMe(): Promise<{ user: User }> {
    return request('GET', '/api/v1/auth/me');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request('PUT', '/api/v1/auth/password', { currentPassword, newPassword });
  },

  async forgotPassword(email: string): Promise<void> {
    await request('POST', '/api/v1/auth/forgot-password', { email }, { skipAuth: true });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await request('POST', '/api/v1/auth/reset-password', { token, password }, { skipAuth: true });
  },

  async getMyInvitations(): Promise<Invitation[]> {
    return request('GET', '/api/v1/auth/invitations');
  },

  async acceptInvitation(invitationId: string): Promise<{ message: string }> {
    return request('POST', `/api/v1/auth/invitations/${invitationId}/accept`);
  },
};

// ==========================================
// Invitation Types
// ==========================================

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  organizationName?: string;
}

// ==========================================
// Organizations API
// ==========================================

export const organizationsApi = {
  async list(): Promise<Organization[]> {
    return request('GET', '/api/v1/organizations');
  },

  async create(data: { name: string; slug?: string }): Promise<Organization> {
    return request('POST', '/api/v1/organizations', data);
  },

  async get(id: string): Promise<Organization> {
    return request('GET', `/api/v1/organizations/${id}`, undefined, { organizationId: id });
  },

  async update(id: string, data: { name?: string; logoUrl?: string; settings?: Record<string, unknown> }): Promise<Organization> {
    return request('PATCH', `/api/v1/organizations/${id}`, data, { organizationId: id });
  },

  async delete(id: string): Promise<void> {
    await request('DELETE', `/api/v1/organizations/${id}`, undefined, { organizationId: id });
  },

  async getMembers(id: string): Promise<unknown[]> {
    return request('GET', `/api/v1/organizations/${id}/members`, undefined, { organizationId: id });
  },

  async getTeams(id: string): Promise<unknown[]> {
    return request('GET', `/api/v1/organizations/${id}/teams`, undefined, { organizationId: id });
  },

  async createTeam(id: string, data: { name: string; description?: string }): Promise<unknown> {
    return request('POST', `/api/v1/organizations/${id}/teams`, data, { organizationId: id });
  },

  async getDomain(id: string): Promise<{ domain: string | null }> {
    return request('GET', `/api/v1/organizations/${id}/domain`, undefined, { organizationId: id });
  },

  async getInvitations(id: string): Promise<Invitation[]> {
    return request('GET', `/api/v1/organizations/${id}/invitations`, undefined, { organizationId: id });
  },

  async sendInvitation(id: string, data: { email: string; role: string; skipDomainCheck?: boolean }): Promise<Invitation> {
    return request('POST', `/api/v1/organizations/${id}/members`, data, { organizationId: id });
  },

  async revokeInvitation(orgId: string, invitationId: string): Promise<{ message: string }> {
    return request('DELETE', `/api/v1/organizations/${orgId}/invitations/${invitationId}`, undefined, { organizationId: orgId });
  },
};

// ==========================================
// Themes API
// ==========================================

// Theme configuration types
export interface SlideSize {
  width: number;
  height: number;
  unit: 'px' | 'in' | 'cm';
  name: string;
}

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

export interface Typography {
  headingFont: string;
  bodyFont: string;
  headingSizes: { h1: string; h2: string; h3: string; h4?: string };
  bodySizes: { large: string; normal: string; small: string };
  fontWeights: { normal: number; medium: number; bold: number };
  lineHeights: { tight: number; normal: number; relaxed: number };
}

export interface LayoutConfig {
  columnGap: string;
  rowGap: string;
  padding: { slide: string; content: string };
  margins: { header: string; footer: string };
  maxContentWidth?: string;
}

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
  extractedStyles: {
    colors: Record<string, string>;
    fonts: Record<string, string>;
    spacing: Record<string, string>;
    borders: Record<string, string>;
    customVariables: Record<string, string>;
  };
  config: ThemeConfig;
  defaultTemplateId: string | null;
  generatedCSS: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedTheme {
  cssVariables: Record<string, string>;
  extractedStyles: {
    colors: Record<string, string>;
    fonts: Record<string, string>;
    spacing: Record<string, string>;
    borders: Record<string, string>;
    customVariables: Record<string, string>;
  };
  generatedCSS: string;
}

export const themesApi = {
  async list(): Promise<Theme[]> {
    return request('GET', '/api/v1/themes');
  },

  async get(id: string): Promise<Theme> {
    return request('GET', `/api/v1/themes/${id}`);
  },

  async create(data: {
    name: string;
    description?: string;
    htmlContent: string;
    organizationId?: string;
    isPublic?: boolean;
  }): Promise<Theme> {
    return request('POST', '/api/v1/themes', data);
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    htmlContent?: string;
    isPublic?: boolean;
  }): Promise<Theme> {
    return request('PATCH', `/api/v1/themes/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await request('DELETE', `/api/v1/themes/${id}`);
  },

  async parse(htmlContent: string): Promise<ParsedTheme> {
    return request('POST', '/api/v1/themes/parse', { htmlContent });
  },

  async exportTheme(id: string): Promise<ThemeExport> {
    return request('GET', `/api/v1/themes/${id}/export`);
  },

  async importTheme(data: ThemeExport): Promise<{ theme: Theme; templates: Template[] }> {
    return request('POST', '/api/v1/themes/import', data);
  },

  async getTemplates(id: string): Promise<{ data: Template[]; byCategory: Record<string, Template[]> }> {
    return request('GET', `/api/v1/themes/${id}/templates`);
  },
};

// ==========================================
// Templates API
// ==========================================

export interface Template {
  id: string;
  themeId: string | null;
  name: string;
  description: string | null;
  type: string;
  master: string;
  category: string;
  html: string;
  pptxRendererCode: string | null;
  note: string | null;
  thumbnail: string | null;
  organizationId: string | null;
  createdBy: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeExport {
  version: string;
  exportedAt?: string;
  theme: {
    name: string;
    description?: string | null;
    htmlContent: string;
    cssVariables?: Record<string, string>;
    extractedStyles?: Theme['extractedStyles'];
    isPublic?: boolean;
  };
  templates?: Array<{
    name: string;
    description?: string | null;
    type: string;
    master: string;
    category: string;
    html: string;
    note?: string | null;
    thumbnail?: string | null;
  }>;
}

export const templatesApi = {
  async list(themeId?: string): Promise<{ data: Template[]; byCategory: Record<string, Template[]> }> {
    const query = themeId ? `?themeId=${themeId}` : '';
    return request('GET', `/api/v1/templates${query}`);
  },

  async get(id: string): Promise<Template> {
    return request('GET', `/api/v1/templates/${id}`);
  },

  async create(data: {
    themeId?: string;
    name: string;
    description?: string;
    type: string;
    master: string;
    category: string;
    html: string;
    note?: string;
    thumbnail?: string;
    organizationId?: string;
    isPublic?: boolean;
  }): Promise<Template> {
    return request('POST', '/api/v1/templates', data);
  },

  async createBulk(templates: Array<{
    themeId?: string;
    name: string;
    description?: string;
    type: string;
    master: string;
    category: string;
    html: string;
    note?: string;
    thumbnail?: string;
    organizationId?: string;
    isPublic?: boolean;
  }>): Promise<Template[]> {
    const result = await request<{ data: Template[] }>('POST', '/api/v1/templates/bulk', templates);
    return Array.isArray(result) ? result : (result as any).data || result;
  },

  async update(id: string, data: {
    themeId?: string | null;
    name?: string;
    description?: string;
    type?: string;
    master?: string;
    category?: string;
    html?: string;
    note?: string;
    thumbnail?: string;
    isPublic?: boolean;
  }): Promise<Template> {
    return request('PATCH', `/api/v1/templates/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await request('DELETE', `/api/v1/templates/${id}`);
  },
};

// Export a convenient API object
export const api = {
  auth: authApi,
  organizations: organizationsApi,
  themes: themesApi,
  templates: templatesApi,
  isBackendAvailable,
  getAccessToken,
  getRefreshToken,
  clearTokens,
};

export default api;
