import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { AuthRequest } from '../../common/types/index';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/v1/auth/register
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    res.status(201).json({
      data: {
        user: result.user,
        tokens: result.tokens,
      },
      message: 'Registration successful',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/login
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.json({
      data: {
        user: result.user,
        tokens: result.tokens,
      },
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/refresh
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refreshTokens(refreshToken);

    res.json({
      data: { tokens },
      message: 'Tokens refreshed',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/logout
export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await authService.logout(token);
    }

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/logout-all
export async function logoutAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    await authService.logoutAll(req.user.id);

    res.json({
      message: 'Logged out from all devices',
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/v1/auth/password
export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/forgot-password
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const resetToken = await authService.requestPasswordReset(email);

    // In production, send email instead of returning token
    // For dev, we return the token
    res.json({
      message: 'If an account exists, a password reset link has been sent',
      // Only include token in development
      ...(process.env.NODE_ENV === 'development' && resetToken ? { resetToken } : {}),
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/reset-password
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, password);

    res.json({
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/auth/me
export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    res.json({
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
}
