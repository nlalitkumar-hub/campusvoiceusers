import { Router } from 'express'
import { sendOTP, verifyOTP, register } from '../controllers/auth.controller'

const router = Router()
router.post('/send-otp', sendOTP)
router.post('/verify-otp', verifyOTP)
router.post('/register', register)
export default router
