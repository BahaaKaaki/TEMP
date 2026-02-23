import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { query } from '../../config/database';
import { ApiError } from './error.middleware';
import { AuthRequest, AuthUser, UserRole } from '../types/index';

interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

// Verify JWT token and attach user to request
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (decoded.type !== 'access') {
      throw ApiError.unauthorized('Invalid token type');
    }

    // Get user from database
    const result = await query<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      is_active: boolean;
    }>(
      'SELECT id, email, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    const user = result.rows[0];
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.is_active) {
      throw ApiError.forbidden('Account is disabled');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Token expired'));
    } else {
      next(error);
    }
  }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  try {
    await authenticate(req, res, next);
  } catch {
    // Silently continue without auth
    next();
  }
}

// Require organization context
export async function requireOrganization(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    // Get organization ID from header or query
    const orgId = req.headers['x-organization-id'] as string || req.query.organizationId as string;

    if (!orgId) {
      throw ApiError.badRequest('Organization ID required');
    }

    // Verify user is member of organization
    const result = await query<{ role: UserRole }>(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, req.user.id]
    );

    if (result.rows.length === 0) {
      throw ApiError.forbidden('Not a member of this organization');
    }

    req.organizationId = orgId;
    req.user.organizationId = orgId;
    req.user.organizationRole = result.rows[0]?.role;

    next();
  } catch (error) {
    next(error);
  }
}

// Role-based access control
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.organizationRole) {
      return next(ApiError.forbidden('Organization context required'));
    }

    if (!allowedRoles.includes(req.user.organizationRole)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }

    next();
  };
}

// Convenience middleware for common role checks
export const requireAdmin = requireRole('owner', 'admin');
export const requireEditor = requireRole('owner', 'admin', 'editor');
export const requireViewer = requireRole('owner', 'admin', 'editor', 'viewer');
