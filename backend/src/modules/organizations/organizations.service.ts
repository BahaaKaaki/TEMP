import { query, transaction } from '../../config/database';
import { ApiError } from '../../common/middleware/error.middleware';
import { Organization, OrganizationMember, Team, UserRole } from '../../common/types/index';
import { v4 as uuidv4 } from 'uuid';

interface CreateOrganizationInput {
  name: string;
  slug?: string;
  userId: string;
}

interface UpdateOrganizationInput {
  name?: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) + '-' + uuidv4().slice(0, 8);
}

// Create a new organization
export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const { name, slug, userId } = input;
  const finalSlug = slug || generateSlug(name);

  // Check slug uniqueness
  const existing = await query('SELECT id FROM organizations WHERE slug = $1', [finalSlug]);
  if (existing.rows.length > 0) {
    throw ApiError.conflict('Organization slug already exists');
  }

  const result = await transaction(async (client) => {
    // Create organization
    const orgResult = await client.query(
      `INSERT INTO organizations (name, slug)
       VALUES ($1, $2)
       RETURNING *`,
      [name, finalSlug]
    );

    const org = orgResult.rows[0] as {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      settings: Record<string, unknown>;
      sso_enabled: boolean;
      sso_provider: string | null;
      sso_config: Record<string, unknown> | null;
      tier: string;
      created_at: Date;
      updated_at: Date;
    };

    // Add creator as owner
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [org.id, userId]
    );

    return org;
  });

  return {
    id: result.id,
    name: result.name,
    slug: result.slug,
    logoUrl: result.logo_url,
    settings: result.settings,
    ssoEnabled: result.sso_enabled,
    ssoProvider: result.sso_provider,
    ssoConfig: result.sso_config,
    tier: result.tier as Organization['tier'],
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

// Get organization by ID
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const result = await query<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    settings: Record<string, unknown>;
    sso_enabled: boolean;
    sso_provider: string | null;
    sso_config: Record<string, unknown> | null;
    tier: string;
    created_at: Date;
    updated_at: Date;
  }>('SELECT * FROM organizations WHERE id = $1', [orgId]);

  if (result.rows.length === 0) return null;

  const org = result.rows[0]!;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url,
    settings: org.settings,
    ssoEnabled: org.sso_enabled,
    ssoProvider: org.sso_provider,
    ssoConfig: org.sso_config,
    tier: org.tier as Organization['tier'],
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}

// Update organization
export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (input.logoUrl !== undefined) {
    updates.push(`logo_url = $${idx++}`);
    values.push(input.logoUrl);
  }
  if (input.settings !== undefined) {
    updates.push(`settings = $${idx++}`);
    values.push(JSON.stringify(input.settings));
  }

  if (updates.length === 0) {
    const org = await getOrganization(orgId);
    if (!org) throw ApiError.notFound('Organization');
    return org;
  }

  values.push(orgId);
  const result = await query<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    settings: Record<string, unknown>;
    sso_enabled: boolean;
    sso_provider: string | null;
    sso_config: Record<string, unknown> | null;
    tier: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Organization');
  }

  const org = result.rows[0]!;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url,
    settings: org.settings,
    ssoEnabled: org.sso_enabled,
    ssoProvider: org.sso_provider,
    ssoConfig: org.sso_config,
    tier: org.tier as Organization['tier'],
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}

// Delete organization
export async function deleteOrganization(orgId: string): Promise<void> {
  const result = await query('DELETE FROM organizations WHERE id = $1', [orgId]);
  if (result.rowCount === 0) {
    throw ApiError.notFound('Organization');
  }
}

// Get user's organizations
export async function getUserOrganizations(userId: string): Promise<(Organization & { role: UserRole })[]> {
  const result = await query<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    settings: Record<string, unknown>;
    sso_enabled: boolean;
    sso_provider: string | null;
    sso_config: Record<string, unknown> | null;
    tier: string;
    created_at: Date;
    updated_at: Date;
    role: string;
  }>(
    `SELECT o.*, om.role
     FROM organizations o
     JOIN organization_members om ON o.id = om.organization_id
     WHERE om.user_id = $1
     ORDER BY o.name`,
    [userId]
  );

  return result.rows.map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url,
    settings: org.settings,
    ssoEnabled: org.sso_enabled,
    ssoProvider: org.sso_provider,
    ssoConfig: org.sso_config,
    tier: org.tier as Organization['tier'],
    createdAt: org.created_at,
    updatedAt: org.updated_at,
    role: org.role as UserRole,
  }));
}

// Get organization members
export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  const result = await query<{
    id: string;
    organization_id: string;
    user_id: string;
    role: string;
    invited_by: string | null;
    joined_at: Date;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }>(
    `SELECT om.*, u.email, u.first_name, u.last_name, u.avatar_url
     FROM organization_members om
     JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1
     ORDER BY om.joined_at`,
    [orgId]
  );

  return result.rows.map(row => ({
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role as UserRole,
    invitedBy: row.invited_by,
    joinedAt: row.joined_at,
    user: {
      id: row.user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
    } as any,
  }));
}

// Add member to organization
export async function addMember(
  orgId: string,
  userId: string,
  role: UserRole,
  invitedBy: string
): Promise<OrganizationMember> {
  const result = await query<{
    id: string;
    organization_id: string;
    user_id: string;
    role: string;
    invited_by: string | null;
    joined_at: Date;
  }>(
    `INSERT INTO organization_members (organization_id, user_id, role, invited_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orgId, userId, role, invitedBy]
  );

  const row = result.rows[0]!;
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role as UserRole,
    invitedBy: row.invited_by,
    joinedAt: row.joined_at,
  };
}

// Update member role
export async function updateMemberRole(
  orgId: string,
  userId: string,
  newRole: UserRole
): Promise<void> {
  const result = await query(
    `UPDATE organization_members SET role = $1
     WHERE organization_id = $2 AND user_id = $3`,
    [newRole, orgId, userId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound('Member');
  }
}

// Remove member from organization
export async function removeMember(orgId: string, userId: string): Promise<void> {
  // Check if this is the last owner
  const owners = await query(
    `SELECT user_id FROM organization_members
     WHERE organization_id = $1 AND role = 'owner'`,
    [orgId]
  );

  if (owners.rows.length === 1 && owners.rows[0]?.user_id === userId) {
    throw ApiError.badRequest('Cannot remove the last owner');
  }

  const result = await query(
    `DELETE FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound('Member');
  }
}

// Create team
export async function createTeam(
  orgId: string,
  name: string,
  description?: string
): Promise<Team> {
  const result = await query<{
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    settings: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO teams (organization_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [orgId, name, description || null]
  );

  const team = result.rows[0]!;
  return {
    id: team.id,
    organizationId: team.organization_id,
    name: team.name,
    description: team.description,
    settings: team.settings,
    createdAt: team.created_at,
    updatedAt: team.updated_at,
  };
}

// Get organization teams
export async function getOrganizationTeams(orgId: string): Promise<Team[]> {
  const result = await query<{
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    settings: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    'SELECT * FROM teams WHERE organization_id = $1 ORDER BY name',
    [orgId]
  );

  return result.rows.map(team => ({
    id: team.id,
    organizationId: team.organization_id,
    name: team.name,
    description: team.description,
    settings: team.settings,
    createdAt: team.created_at,
    updatedAt: team.updated_at,
  }));
}

// ==========================================
// Invitation System
// ==========================================

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
}

// Extract domain from email
export function getEmailDomain(email: string): string {
  return email.toLowerCase().split('@')[1] || '';
}

// Check if two emails share the same domain
export function isSameDomain(email1: string, email2: string): boolean {
  return getEmailDomain(email1) === getEmailDomain(email2);
}

// Get the organization's allowed domain (from owner's email)
export async function getOrganizationDomain(orgId: string): Promise<string | null> {
  const members = await getOrganizationMembers(orgId);
  const owner = members.find(m => m.role === 'owner');
  if (owner && owner.user) {
    return getEmailDomain(owner.user.email);
  }
  return null;
}

// Create invitation
export async function createInvitation(
  orgId: string,
  email: string,
  role: UserRole,
  invitedBy: string,
  skipDomainCheck: boolean = false
): Promise<Invitation> {
  // Get the organization to verify it exists
  const org = await getOrganization(orgId);
  if (!org) {
    throw ApiError.notFound('Organization');
  }

  // Check domain restriction (unless skipped)
  if (!skipDomainCheck) {
    const allowedDomain = await getOrganizationDomain(orgId);
    if (allowedDomain) {
      const inviteeDomain = getEmailDomain(email);
      if (inviteeDomain !== allowedDomain) {
        throw ApiError.badRequest(
          `Only colleagues with @${allowedDomain} email addresses can be invited to this organization`
        );
      }
    }
  }

  // Check if already a member
  const existingMembers = await getOrganizationMembers(orgId);
  const alreadyMember = existingMembers.find(m => m.user?.email?.toLowerCase() === email.toLowerCase());
  if (alreadyMember) {
    throw ApiError.conflict('User is already a member of this organization');
  }

  // Check for existing pending invitation
  const existingInvite = await query<{ id: string }>(
    'SELECT id FROM organization_invitations WHERE organization_id = $1 AND email = $2 AND status = \'pending\'',
    [orgId, email.toLowerCase()]
  );
  if (existingInvite.rows.length > 0) {
    throw ApiError.conflict('An invitation is already pending for this email');
  }

  // Create invitation (expires in 7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const id = uuidv4();
  const result = await query<{
    id: string;
    organization_id: string;
    email: string;
    role: string;
    invited_by: string;
    status: string;
    expires_at: Date;
    created_at: Date;
  }>(
    `INSERT INTO organization_invitations (id, organization_id, email, role, invited_by, status, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, orgId, email.toLowerCase(), role, invitedBy, 'pending', expiresAt, new Date()]
  );

  const row = result.rows[0]!;
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role as UserRole,
    invitedBy: row.invited_by,
    status: row.status as Invitation['status'],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// Get invitations for an organization
export async function getOrganizationInvitations(orgId: string): Promise<Invitation[]> {
  const result = await query<{
    id: string;
    organization_id: string;
    email: string;
    role: string;
    invited_by: string;
    status: string;
    expires_at: Date;
    created_at: Date;
  }>(
    'SELECT * FROM organization_invitations WHERE organization_id = $1 ORDER BY created_at DESC',
    [orgId]
  );

  return result.rows.map(row => ({
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role as UserRole,
    invitedBy: row.invited_by,
    status: row.status as Invitation['status'],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

// Get pending invitations for a user email
export async function getPendingInvitationsForUser(email: string): Promise<(Invitation & { organizationName: string })[]> {
  const result = await query<{
    id: string;
    organization_id: string;
    email: string;
    role: string;
    invited_by: string;
    status: string;
    expires_at: Date;
    created_at: Date;
  }>(
    'SELECT * FROM organization_invitations WHERE email = $1 AND status = \'pending\'',
    [email.toLowerCase()]
  );

  const invitations: (Invitation & { organizationName: string })[] = [];
  for (const row of result.rows) {
    // Check if expired
    if (new Date(row.expires_at) < new Date()) {
      // Mark as expired
      await query('UPDATE organization_invitations SET status = $1 WHERE id = $2', ['expired', row.id]);
      continue;
    }

    const org = await getOrganization(row.organization_id);
    if (org) {
      invitations.push({
        id: row.id,
        organizationId: row.organization_id,
        email: row.email,
        role: row.role as UserRole,
        invitedBy: row.invited_by,
        status: row.status as Invitation['status'],
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        organizationName: org.name,
      });
    }
  }

  return invitations;
}

// Get invitation by ID
export async function getInvitation(id: string): Promise<Invitation | null> {
  const result = await query<{
    id: string;
    organization_id: string;
    email: string;
    role: string;
    invited_by: string;
    status: string;
    expires_at: Date;
    created_at: Date;
  }>(
    'SELECT * FROM organization_invitations WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0]!;
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role as UserRole,
    invitedBy: row.invited_by,
    status: row.status as Invitation['status'],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// Accept invitation
export async function acceptInvitation(invitationId: string, userId: string): Promise<OrganizationMember> {
  const invitation = await getInvitation(invitationId);
  if (!invitation) {
    throw ApiError.notFound('Invitation');
  }

  if (invitation.status !== 'pending') {
    throw ApiError.badRequest(`Invitation is ${invitation.status}`);
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    await query('UPDATE organization_invitations SET status = $1 WHERE id = $2', ['expired', invitationId]);
    throw ApiError.badRequest('Invitation has expired');
  }

  // Add member to organization
  const member = await addMember(
    invitation.organizationId,
    userId,
    invitation.role,
    invitation.invitedBy
  );

  // Mark invitation as accepted
  await query('UPDATE organization_invitations SET status = $1 WHERE id = $2', ['accepted', invitationId]);

  return member;
}

// Revoke invitation
export async function revokeInvitation(invitationId: string, revokedBy: string): Promise<void> {
  const invitation = await getInvitation(invitationId);
  if (!invitation) {
    throw ApiError.notFound('Invitation');
  }

  if (invitation.status !== 'pending') {
    throw ApiError.badRequest(`Cannot revoke invitation that is ${invitation.status}`);
  }

  await query('UPDATE organization_invitations SET status = $1 WHERE id = $2', ['revoked', invitationId]);
}
