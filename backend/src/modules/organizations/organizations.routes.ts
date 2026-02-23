import { Router } from 'express';
import * as orgController from './organizations.controller';
import { authenticate, requireOrganization, requireAdmin } from '../../common/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Organization CRUD
router.get('/', orgController.listOrganizations);
router.post('/', orgController.createOrganization);
router.get('/:id', requireOrganization, orgController.getOrganization);
router.patch('/:id', requireOrganization, requireAdmin, orgController.updateOrganization);
router.delete('/:id', requireOrganization, requireAdmin, orgController.deleteOrganization);

// Members
router.get('/:id/members', requireOrganization, orgController.listMembers);
router.post('/:id/members', requireOrganization, requireAdmin, orgController.addMember);
router.patch('/:id/members/:userId', requireOrganization, requireAdmin, orgController.updateMemberRole);
router.delete('/:id/members/:userId', requireOrganization, requireAdmin, orgController.removeMember);

// Invitations
router.get('/:id/invitations', requireOrganization, orgController.listInvitations);
router.delete('/:id/invitations/:invitationId', requireOrganization, requireAdmin, orgController.revokeInvitation);

// Organization domain
router.get('/:id/domain', requireOrganization, orgController.getOrganizationDomain);

// Teams
router.get('/:id/teams', requireOrganization, orgController.listTeams);
router.post('/:id/teams', requireOrganization, requireAdmin, orgController.createTeam);

export default router;
