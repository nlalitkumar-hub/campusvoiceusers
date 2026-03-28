import { Request, Response } from 'express'
import { db } from '../config/firebase'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiResponse } from '../utils/ApiResponse'

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const snap = await db.collection('complaints').get()
  const all = snap.docs.map((d: any) => d.data())
  const total = all.length
  const resolved = all.filter(c => c.status === 'resolved').length
  const inProgress = all.filter(c => c.status === 'in_progress').length
  const pending = all.filter(c => c.status === 'pending').length
  const rejected = all.filter(c => c.status === 'rejected').length
  const overdue = all.filter(c => c.isOverdue).length

  const now = new Date()
  const weeklyTrends = Array.from({ length: 6 }, (_, i) => {
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - (5 - i) * 7)
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7)
    return {
      week: `Week ${i + 1}`,
      submitted: all.filter(c => { const d = new Date(c.createdAt || 0); return d >= weekStart && d < weekEnd }).length,
      resolved: all.filter(c => { const d = new Date(c.resolvedAt || 0); return c.status === 'resolved' && d >= weekStart && d < weekEnd }).length
    }
  })

  const categoryMap: Record<string, string> = { Infrastructure: 'Facilities', Safety: 'Security', Technology: 'IT Services', Academic: 'Academic', Health: 'Student Services', Hygiene: 'Facilities', Other: 'Student Services' }
  const depts = ['Security', 'IT Services', 'Facilities', 'Academic', 'Student Services']
  const departmentPerformance = depts.map(dept => {
    const dc = all.filter(c => categoryMap[c.category] === dept)
    return { department: dept, resolved: dc.filter(c => c.status === 'resolved').length, pending: dc.filter(c => c.status !== 'resolved').length }
  })

  return res.status(200).json(new ApiResponse(200, {
    totals: { total, resolved, inProgress, pending, rejected, overdue },
    weeklyTrends,
    categoryDistribution: [
      { name: 'Resolved', value: resolved, color: '#10B981' },
      { name: 'In Progress', value: inProgress, color: '#3B82F6' },
      { name: 'Rejected', value: rejected, color: '#EF4444' }
    ],
    departmentPerformance
  }, 'Analytics fetched'))
})

export const getPersonalAnalytics = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userEmail = (req as any).user?.email

    const snapshot = await db.collection('complaints').where('submittedBy', '==', userEmail).get()
    const complaints = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))

    const totalRaised = complaints.length
    const resolved = complaints.filter(c => c.status === 'resolved').length
    const inProgress = complaints.filter(c =>
      c.status === 'in_progress' || c.status === 'in-progress' || c.status === 'In Progress'
    ).length
    const pending = complaints.filter(c =>
      c.status === 'pending' || c.status === 'Pending'
    ).length
    const rejected = complaints.filter(c =>
      c.status === 'rejected' || c.status === 'Rejected'
    ).length

    const categoryMap: Record<string, number> = {}
    complaints.forEach(c => {
      const cat = c.category || 'Other'
      categoryMap[cat] = (categoryMap[cat] || 0) + 1
    })
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    const statusDistribution = [
      { status: 'Pending', count: pending, color: '#F59E0B' },
      { status: 'In Progress', count: inProgress, color: '#3B82F6' },
      { status: 'Resolved', count: resolved, color: '#10B981' },
      { status: 'Rejected', count: rejected, color: '#EF4444' },
    ]

    const resolutionRate = totalRaised > 0 ? Math.round((resolved / totalRaised) * 100) : 0

    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthName = date.toLocaleString('default', { month: 'short' })
      const year = date.getFullYear()
      const month = date.getMonth()
      const count = complaints.filter(c => {
        const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt)
        return createdAt.getMonth() === month && createdAt.getFullYear() === year
      }).length
      monthlyTrend.push({ month: monthName, count })
    }

    return res.status(200).json(new ApiResponse(200, {
      totalRaised, resolved, inProgress, pending, rejected,
      resolutionRate, categoryBreakdown, statusDistribution, monthlyTrend
    }, 'Personal analytics fetched'))
  } catch (error) {
    console.error('Personal analytics error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch personal analytics' })
  }
})
