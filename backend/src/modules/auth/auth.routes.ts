import { Router } from 'express';
import * as authController from './auth.controller';
import * as orgController from '../organizations/organizations.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authLimiter } from '../../common/middleware/rate-limit.middleware';

const router = Router();

// Public routes (with rate limiting)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.put('/password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.getMe);

// User invitations
router.get('/invitations', authenticate, orgController.getMyInvitations);
router.post('/invitations/:invitationId/accept', authenticate, orgController.acceptInvitation);

export default router;
