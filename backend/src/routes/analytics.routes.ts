import { Router } from 'express'
import { getSummary } from '../controllers/analytics.controller'
import { authenticateUser } from '../middleware/auth.middleware'

const router = Router()
router.get('/summary', authenticateUser, getSummary)
export default router
