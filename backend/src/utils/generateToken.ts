import jwt from 'jsonwebtoken'
import { config } from '../config/env'

export const generateToken = (userId: string, email: string, role: string, institute: string): string => {
  return jwt.sign({ id: userId, email, role, institute }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as any })
}
