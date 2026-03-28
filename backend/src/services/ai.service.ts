import { config } from '../config/env'

export interface AIVerificationResult {
  campusDetected: boolean
  descriptionMatches: boolean
  isReal: boolean
  overallVerified: boolean
  reason: string
}

export const verifyComplaint = async (imageBase64: string, description: string, category?: string): Promise<AIVerificationResult> => {
  const defaultResult: AIVerificationResult = { campusDetected: false, descriptionMatches: false, isReal: false, overallVerified: false, reason: 'Verification service unavailable' }

  // Try Python triage backend first
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const response = await fetch(`${config.PYTHON_AI_URL}/api/verify-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, description, category: category || 'Infrastructure' }),
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Python AI triage used — specialist:', data.specialist_model)
      return { campusDetected: data.campusDetected, descriptionMatches: data.descriptionMatches, isReal: data.isReal, overallVerified: data.overallVerified, reason: data.reason }
    }
    // 400 = privacy violation or irrelevant image — propagate the error message
    if (response.status === 400) {
      const err = await response.json()
      const msg = err.detail?.message || err.message || 'Verification failed'
      return { campusDetected: false, descriptionMatches: false, isReal: false, overallVerified: false, reason: msg }
    }
  } catch {
    console.log('⚠️ Python backend unavailable')
  }

  return defaultResult
}
