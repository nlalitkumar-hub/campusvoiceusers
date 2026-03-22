import { Router } from 'express'
import { getNotifications, markAsRead } from '../controllers/notification.controller'
import { authenticateUser } from '../middleware/auth.middleware'

const router = Router()
router.get('/', authenticateUser, getNotifications)
router.post('/:id/read', authenticateUser, markAsRead)
export default router
