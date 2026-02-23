import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../config/database';
import { ApiError } from '../../common/middleware/error.middleware';
import {
  generateTokenPair,
  verifyRefreshToken,
  blacklistToken,
  revokeAllUserTokens,
} from './jwt.service';
import { User } from '../../common/types/index';

const SALT_ROUNDS = 12;

interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

// Register a new user
export async function register(input: RegisterInput): Promise<AuthResult> {
  const { email, password, firstName, lastName } = input;

  // Check if user already exists
  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existing.rows.length > 0) {
    throw ApiError.conflict('Email already registered');
  }

  // Validate password strength
  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user and default organization in transaction
  const result = await transaction(async (client) => {
    // Create user
    const userResult = await client.query<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      is_active: boolean;
      email_verified: boolean;
      preferences: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, avatar_url, is_active,
                 email_verified, preferences, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, firstName || null, lastName || null]
    );

    const user = userResult.rows[0]!;

    // Create personal organization for the user
    const orgSlug = `personal-${user.id.slice(0, 8)}`;
    const orgResult = await client.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, tier)
       VALUES ($1, $2, 'free')
       RETURNING id`,
      [`${firstName || email.split('@')[0]}'s Workspace`, orgSlug]
    );

    const orgId = orgResult.rows[0]!.id;

    // Add user as owner of their personal organization
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [orgId, user.id]
    );

    return user;
  });

  // Generate tokens
  const tokens = generateTokenPair(result.id, result.email);

  // Update last login
  await query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [result.id]
  );

  return {
    user: {
      id: result.id,
      email: result.email,
      firstName: result.first_name,
      lastName: result.last_name,
      avatarUrl: result.avatar_url,
      isActive: result.is_active,
      emailVerified: result.email_verified,
      ssoProvider: null,
      ssoSubjectId: null,
      preferences: result.preferences,
      lastLoginAt: new Date(),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    },
    tokens,
  };
}

// Login with email/password
export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  // Find user by email
  const result = await query<{
    id: string;
    email: string;
    password_hash: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    is_active: boolean;
    email_verified: boolean;
    sso_provider: string | null;
    sso_subject_id: string | null;
    preferences: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, email, password_hash, first_name, last_name, avatar_url,
            is_active, email_verified, sso_provider, sso_subject_id,
            preferences, created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Account is disabled');
  }

  // Check if this is an SSO-only account
  if (!user.password_hash && user.sso_provider) {
    throw ApiError.badRequest(`This account uses ${user.sso_provider} sign-in`);
  }

  if (!user.password_hash) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Generate tokens
  const tokens = generateTokenPair(user.id, user.email);

  // Update last login
  await query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      ssoProvider: user.sso_provider,
      ssoSubjectId: user.sso_subject_id,
      preferences: user.preferences,
      lastLoginAt: new Date(),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    tokens,
  };
}

// Refresh access token
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken);

  // Check if user still exists and is active
  const result = await query<{ id: string; email: string; is_active: boolean }>(
    'SELECT id, email, is_active FROM users WHERE id = $1',
    [payload.userId]
  );

  const user = result.rows[0];
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Account is disabled');
  }

  // Generate new token pair
  return generateTokenPair(user.id, user.email);
}

// Logout (blacklist current token)
export async function logout(accessToken: string): Promise<void> {
  // Blacklist the access token
  await blacklistToken(accessToken, 900); // 15 minutes TTL
}

// Logout from all devices
export async function logoutAll(userId: string): Promise<void> {
  await revokeAllUserTokens(userId);
}

// Change password
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get current password hash
  const result = await query<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  const user = result.rows[0];
  if (!user?.password_hash) {
    throw ApiError.badRequest('Cannot change password for SSO accounts');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  // Validate new password
  if (newPassword.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  // Hash and update
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newHash, userId]
  );

  // Revoke all existing tokens
  await revokeAllUserTokens(userId);
}

// Request password reset
export async function requestPasswordReset(email: string): Promise<string> {
  const result = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND password_hash IS NOT NULL',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    // Don't reveal if email exists
    return '';
  }

  const userId = result.rows[0]!.id;

  // Generate reset token
  const resetToken = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3`,
    [userId, resetToken, expiresAt]
  );

  return resetToken;
}

// Reset password with token
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  // Find valid reset token
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  const userId = result.rows[0]!.user_id;

  // Validate new password
  if (newPassword.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  // Hash and update
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await transaction(async (client) => {
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    await client.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [userId]
    );
  });

  // Revoke all existing tokens
  await revokeAllUserTokens(userId);
}
