import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../utils/ApiError'

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err.message)
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ success: false, message: err.message, errors: err.errors })
    return
  }
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error'
  })
}
