import { Router } from 'express'
import { getProfile, updateProfile, getMyComplaints, getLeaderboard } from '../controllers/profile.controller'
import { authenticateUser } from '../middleware/auth.middleware'

const router = Router()
router.get('/', authenticateUser, getProfile)
router.put('/', authenticateUser, updateProfile)
router.get('/my-complaints', authenticateUser, getMyComplaints)
router.get('/leaderboard', authenticateUser, getLeaderboard)
export default router
