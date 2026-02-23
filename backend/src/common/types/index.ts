import { Request } from 'express';

// User roles
export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type TeamRole = 'lead' | 'member';

// Organization tiers
export type OrganizationTier = 'free' | 'pro' | 'enterprise';

// Deck visibility
export type DeckVisibility = 'private' | 'team' | 'organization' | 'public';

// Deck status
export type DeckStatus = 'draft' | 'review' | 'approved' | 'archived';

// Share permission
export type SharePermission = 'view' | 'comment' | 'edit';

// Authenticated user info attached to request
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organizationId?: string;
  organizationRole?: UserRole;
}

// Extended Express Request with auth
export interface AuthRequest extends Request {
  user?: AuthUser;
  organizationId?: string;
}

// Pagination params
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// API Error response
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// API Success response
export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

// Common entity timestamps
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// User entity
export interface User extends Timestamps {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  ssoProvider: string | null;
  ssoSubjectId: string | null;
  preferences: Record<string, unknown>;
  lastLoginAt: Date | null;
}

// Organization entity
export interface Organization extends Timestamps {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  settings: Record<string, unknown>;
  ssoEnabled: boolean;
  ssoProvider: string | null;
  ssoConfig: Record<string, unknown> | null;
  tier: OrganizationTier;
}

// Organization member
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  invitedBy: string | null;
  joinedAt: Date;
  user?: User;
}

// Team entity
export interface Team extends Timestamps {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
}

// Template entity
export interface Template extends Timestamps {
  id: string;
  organizationId: string | null;
  categoryId: string | null;
  masterId: string | null;
  templateKey: string;
  title: string;
  description: string | null;
  note: string | null;
  type: string | null;
  htmlContent: string;
  pptxRendererCode: string | null;
  thumbnailUrl: string | null;
  version: number;
  isPublished: boolean;
  isSystem: boolean;
  tags: string[];
  createdBy: string | null;
}

// Deck entity
export interface Deck extends Timestamps {
  id: string;
  organizationId: string;
  teamId: string | null;
  name: string;
  description: string | null;
  visibility: DeckVisibility;
  shareToken: string | null;
  sharedCss: string;
  storyline: unknown[];
  status: DeckStatus;
  createdBy: string;
}

// Slide entity
export interface Slide extends Timestamps {
  id: string;
  deckId: string;
  templateId: string | null;
  title: string | null;
  type: string | null;
  htmlContent: string;
  customCss: string;
  pptxExportCode: string | null;
  summary: string | null;
  position: number;
  parentId: string | null;
  storyPointId: string | null;
  isSkeleton: boolean;
  skeletonApproved: boolean;
  createdBy: string | null;
}
