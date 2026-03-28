import { Router } from 'express'
import { getSummary, getPersonalAnalytics } from '../controllers/analytics.controller'
import { authenticateUser } from '../middleware/auth.middleware'

const router = Router()
router.get('/summary', authenticateUser, getSummary)
router.get('/personal', authenticateUser, getPersonalAnalytics)
export default router
