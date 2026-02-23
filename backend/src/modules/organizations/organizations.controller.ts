import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as orgService from './organizations.service';
import { AuthRequest } from '../../common/types/index';
import { ApiError } from '../../common/middleware/error.middleware';

// Validation schemas
const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
  skipDomainCheck: z.boolean().optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']),
});

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

// GET /api/v1/organizations
export async function listOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const organizations = await orgService.getUserOrganizations(req.user.id);

    res.json({
      data: organizations,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/organizations
export async function createOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const input = createOrgSchema.parse(req.body);
    const organization = await orgService.createOrganization({
      name: input.name,
      slug: input.slug,
      userId: req.user.id,
    });

    res.status(201).json({
      data: organization,
      message: 'Organization created',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/organizations/:id
export async function getOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organization = await orgService.getOrganization(id!);

    if (!organization) {
      throw ApiError.notFound('Organization');
    }

    res.json({
      data: organization,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/v1/organizations/:id
export async function updateOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = updateOrgSchema.parse(req.body);
    const organization = await orgService.updateOrganization(id!, input);

    res.json({
      data: organization,
      message: 'Organization updated',
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/v1/organizations/:id
export async function deleteOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await orgService.deleteOrganization(id!);

    res.json({
      message: 'Organization deleted',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/organizations/:id/members
export async function listMembers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const members = await orgService.getOrganizationMembers(id!);

    res.json({
      data: members,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/organizations/:id/members - Send invitation
export async function addMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { id } = req.params;
    const { email, role, skipDomainCheck } = addMemberSchema.parse(req.body);

    // Create invitation with domain check
    const invitation = await orgService.createInvitation(
      id!,
      email,
      role,
      req.user.id,
      skipDomainCheck
    );

    res.status(201).json({
      data: invitation,
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/organizations/:id/invitations
export async function listInvitations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const invitations = await orgService.getOrganizationInvitations(id!);

    res.json({
      data: invitations,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/v1/organizations/:id/invitations/:invitationId
export async function revokeInvitation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { invitationId } = req.params;
    await orgService.revokeInvitation(invitationId!, req.user.id);

    res.json({
      message: 'Invitation revoked',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/auth/invitations - Get pending invitations for current user
export async function getMyInvitations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    // Get user's email from the user record
    const invitations = await orgService.getPendingInvitationsForUser(req.user.email);

    res.json({
      data: invitations,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/invitations/:invitationId/accept - Accept an invitation
export async function acceptInvitation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { invitationId } = req.params;
    const member = await orgService.acceptInvitation(invitationId!, req.user.id);

    res.json({
      data: member,
      message: 'Invitation accepted',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/organizations/:id/domain - Get organization's allowed domain
export async function getOrganizationDomain(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const domain = await orgService.getOrganizationDomain(id!);

    res.json({
      data: { domain },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/v1/organizations/:id/members/:userId
export async function updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id, userId } = req.params;
    const { role } = updateMemberRoleSchema.parse(req.body);

    await orgService.updateMemberRole(id!, userId!, role);

    res.json({
      message: 'Member role updated',
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/v1/organizations/:id/members/:userId
export async function removeMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id, userId } = req.params;
    await orgService.removeMember(id!, userId!);

    res.json({
      message: 'Member removed',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/organizations/:id/teams
export async function listTeams(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const teams = await orgService.getOrganizationTeams(id!);

    res.json({
      data: teams,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/organizations/:id/teams
export async function createTeam(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, description } = createTeamSchema.parse(req.body);

    const team = await orgService.createTeam(id!, name, description);

    res.status(201).json({
      data: team,
      message: 'Team created',
    });
  } catch (error) {
    next(error);
  }
}
