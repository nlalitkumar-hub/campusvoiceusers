import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/env'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

export const authenticateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization as string
  if (!authHeader?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required')
  const token = authHeader.substring(7)
  if (!token || token === 'null' || token === 'undefined') throw new ApiError(401, 'Invalid token')
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as any
    req.user = { id: decoded.id || decoded.email, email: decoded.email, role: decoded.role, institute: decoded.institute }
    next()
  } catch {
    throw new ApiError(401, 'Invalid or expired token')
  }
})

export const optionalAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization as string
    if (!authHeader?.startsWith('Bearer ')) return next()
    const token = authHeader.substring(7)
    if (!token || token === 'null') return next()
    const decoded = jwt.verify(token, config.JWT_SECRET) as any
    req.user = { id: decoded.id || decoded.email, email: decoded.email, role: decoded.role, institute: decoded.institute }
  } catch { /* silent */ }
  next()
})

export const requireRole = (...roles: string[]) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw new ApiError(403, 'Access denied')
    next()
  })
