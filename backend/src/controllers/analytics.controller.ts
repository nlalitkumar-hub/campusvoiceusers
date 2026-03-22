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
