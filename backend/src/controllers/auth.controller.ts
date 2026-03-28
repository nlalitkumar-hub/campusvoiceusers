import { Request, Response } from 'express'
import { db } from '../config/firebase'
import { generateOTP } from '../utils/generateOTP'
import { generateToken } from '../utils/generateToken'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiResponse } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'
import { sendOTPEmail } from '../services/email.service'

export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email, name, collegeId, role, institute } = req.body
  if (!email || !name || !collegeId || !role || !institute) throw new ApiError(400, 'All fields are required')

  const plainOTP = generateOTP()
  const otpToStore = String(plainOTP).trim()
  await db.collection('otps').doc(email).set({
    otp: otpToStore, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    attempts: 0, createdAt: new Date().toISOString()
  })
  console.log(`✅ OTP saved for ${email}: ${otpToStore}`)
  console.log(`OTP for testing: ${otpToStore}`)
  try { await sendOTPEmail(email, otpToStore, name) } catch (e: any) { console.error('Email failed (non-fatal):', e.message) }

  return res.status(200).json(new ApiResponse(200, { message: `OTP sent to ${email}`, otp: otpToStore }, 'OTP sent successfully'))
})

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, name, collegeId, role, institute } = req.body
  if (!email || !otp || !name || !collegeId || !role || !institute) throw new ApiError(400, 'All fields are required')

  console.log('================')
  console.log('VERIFY OTP REQUEST')
  console.log('Email:', email)
  console.log('OTP received:', String(otp).trim())
  console.log('================')

  const otpDoc = await db.collection('otps').doc(email).get()
  if (!otpDoc.exists) throw new ApiError(400, 'OTP not found or expired')

  const otpData = otpDoc.data()!
  console.log('OTP in DB:', String(otpData.otp).trim())
  console.log('Match:', String(otp).trim() === String(otpData.otp).trim())

  const expiryDate = otpData.expiresAt?.toDate
    ? otpData.expiresAt.toDate()
    : new Date(otpData.expiresAt)

  if (expiryDate < new Date()) {
    await db.collection('otps').doc(email).delete()
    throw new ApiError(400, 'OTP has expired. Please request a new one.')
  }
  if ((otpData.attempts || 0) >= 3) throw new ApiError(429, 'Too many attempts. Request new OTP.')
  await db.collection('otps').doc(email).update({ attempts: (otpData.attempts || 0) + 1 })

  const receivedOTP = String(otp).trim().replace(/\s/g, '')
  const storedOTP = String(otpData.otp).trim().replace(/\s/g, '')
  if (receivedOTP !== storedOTP) {
    const remaining = 3 - (otpData.attempts || 0)
    throw new ApiError(400, `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`)
  }

  await db.collection('users').doc(email).set({
    name, collegeId, role, institute, email, isVerified: true,
    points: 0, level: 1, levelTitle: 'Newcomer', badges: [],
    complaintsRaised: 0, complaintsResolved: 0, upvotesGiven: 0,
    updatedAt: new Date().toISOString()
  }, { merge: true })

  const userDoc = await db.collection('users').doc(email).get()
  const userData = userDoc.data()!
  if (!userData.createdAt) await db.collection('users').doc(email).update({ createdAt: new Date().toISOString() })
  await db.collection('otps').doc(email).delete()

  const token = generateToken(email, email, role, institute)
  const freshUser = await db.collection('users').doc(email).get()
  return res.status(200).json(new ApiResponse(200, { token, user: { id: email, ...freshUser.data() } }, 'Login successful'))
})

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, name, collegeId, role, institute } = req.body
  if (!email || !name || !collegeId || !role || !institute) throw new ApiError(400, 'All fields are required')
  await db.collection('users').doc(email).set({
    name, collegeId, role, institute, email, isVerified: false,
    points: 0, level: 1, levelTitle: 'Newcomer', badges: [],
    complaintsRaised: 0, complaintsResolved: 0, upvotesGiven: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }, { merge: true })
  return res.status(201).json(new ApiResponse(201, { message: 'User registered' }, 'Registration successful'))
})
