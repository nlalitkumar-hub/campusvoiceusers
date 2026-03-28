const BASE_URL = 'http://localhost:5001/api'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
})

const request = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string> || {}) }
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Request failed')
  return data
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

// Notifications
export const getNotificationsAPI = () => request('/notifications')
export const markNotificationReadAPI = (id: string) => request(`/notifications/${id}/read`, { method: 'POST' })
