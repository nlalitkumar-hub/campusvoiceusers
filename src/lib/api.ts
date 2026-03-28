// Base URLs — driven by .env / .env.production
// Local dev:  VITE_API_URL=http://localhost:5000
// Production: VITE_API_URL=https://campusvoicebackend.onrender.com
export const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'

// Local dev:  VITE_PYTHON_AI_URL=http://localhost:8000
// Production: VITE_PYTHON_AI_URL=https://campusvoiceusersai.onrender.com
export const PYTHON_AI_URL = import.meta.env.VITE_PYTHON_AI_URL || 'http://localhost:8000'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
})

const request = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...getHeaders(), ...(options.headers as Record<string, string> || {}) }
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Request failed')
    return data
  } catch (error: any) {
    console.error(`API Error [${endpoint}]:`, error)
    throw error
  }
}

// Python AI — separate base, no auth header needed
export const aiRequest = async (endpoint: string, body: object) => {
  try {
    const response = await fetch(`${PYTHON_AI_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || data.detail || 'AI request failed')
    return data
  } catch (error: any) {
    console.error(`AI Error [${endpoint}]:`, error)
    throw error
  }
}

// Auth
export const sendOTP = (body: object) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify(body) })
export const verifyOTP = (body: object) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) })

// Complaints
export const getComplaintsAPI = (filter = 'all') => request(`/complaints?filter=${filter}`)
export const getComplaintByIdAPI = (id: string) => request(`/complaints/${id}`)
export const verifyComplaintAI = (body: object) => request('/complaints/verify', { method: 'POST', body: JSON.stringify(body) })
export const createComplaintAPI = (body: object) => request('/complaints/create', { method: 'POST', body: JSON.stringify(body) })
export const upvoteComplaintAPI = (id: string) => request(`/complaints/${id}/upvote`, { method: 'POST' })
export const endorseComplaintAPI = (id: string) => request(`/complaints/${id}/endorse`, { method: 'POST' })
export const rateComplaintAPI = (id: string, rating: number) => request(`/complaints/${id}/rate`, { method: 'POST', body: JSON.stringify({ rating }) })
export const addCommentAPI = (id: string, text: string) => request(`/complaints/${id}/comment`, { method: 'POST', body: JSON.stringify({ text }) })

// Profile
export const getProfileAPI = () => request('/profile')
export const updateProfileAPI = (body: object) => request('/profile', { method: 'PUT', body: JSON.stringify(body) })
export const getMyComplaintsAPI = (status?: string) => request(`/profile/my-complaints${status ? `?status=${status}` : ''}`)
export const getLeaderboardAPI = () => request('/profile/leaderboard')

// Analytics
export const getAnalyticsAPI = () => request('/analytics/summary')
export const getPersonalAnalyticsAPI = () => request('/analytics/personal')

// Notifications
export const getNotificationsAPI = () => request('/notifications')
export const markNotificationReadAPI = (id: string) => request(`/notifications/${id}/read`, { method: 'POST' })


