import { Router } from 'express'
import { getComplaints, getComplaintById, verifyComplaintHandler, createComplaint, upvoteComplaint, endorseComplaint, rateComplaint, addComment } from '../controllers/complaint.controller'
import { authenticateUser, optionalAuth, requireRole } from '../middleware/auth.middleware'

const router = Router()
router.get('/', optionalAuth, getComplaints)
router.post('/verify', authenticateUser, verifyComplaintHandler)
router.post('/create', authenticateUser, createComplaint)
router.get('/:id', optionalAuth, getComplaintById)
router.post('/:id/upvote', authenticateUser, upvoteComplaint)
router.post('/:id/endorse', authenticateUser, requireRole('faculty'), endorseComplaint)
router.post('/:id/rate', authenticateUser, rateComplaint)
router.post('/:id/comment', authenticateUser, addComment)
export default router
