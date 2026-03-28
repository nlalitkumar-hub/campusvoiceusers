import { Router } from 'express'
import { getFacultyDashboard } from '../controllers/faculty.controller'
import { authenticateUser, requireRole } from '../middleware/auth.middleware'

const router = Router()
router.get('/dashboard', authenticateUser, requireRole('faculty'), getFacultyDashboard)
export default router
