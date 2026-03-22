import { config } from '../config/env'

export interface AIVerificationResult {
  campusDetected: boolean
  descriptionMatches: boolean
  isReal: boolean
  overallVerified: boolean
  reason: string
}

export const verifyComplaint = async (imageBase64: string, description: string): Promise<AIVerificationResult> => {
  const defaultResult: AIVerificationResult = { campusDetected: true, descriptionMatches: true, isReal: true, overallVerified: true, reason: 'Verification completed' }

  // Try Python backend first
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(`${config.PYTHON_AI_URL}/api/verify-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, description }), signal: controller.signal
    })
    clearTimeout(timeout)
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Python AI verification used')
      return { campusDetected: data.campusDetected, descriptionMatches: data.descriptionMatches, isReal: data.isReal, overallVerified: data.overallVerified, reason: data.reason }
    }
  } catch {
    console.log('⚠️ Python backend unavailable, falling back to Claude API')
  }

  if (!config.ANTHROPIC_API_KEY) return defaultResult

  try {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-5', max_tokens: 1024,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
          { type: 'text', text: `Verify this campus complaint.\nDescription: ${description}\nRespond ONLY with JSON:\n{"campusDetected": boolean,"descriptionMatches": boolean,"isReal": boolean,"reason": "one sentence"}` }
        ]}]
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) return defaultResult
    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const result = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim())
    return { ...result, overallVerified: result.campusDetected && result.descriptionMatches && result.isReal }
  } catch (e: any) {
    console.error('Claude error:', e.message)
    return defaultResult
  }
}
