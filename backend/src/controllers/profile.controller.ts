import { Request, Response } from 'express'
import { db } from '../config/firebase'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiResponse } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userDoc = await db.collection('users').doc(req.user!.id).get()
  if (!userDoc.exists) throw new ApiError(404, 'User not found')
  const complaintsSnap = await db.collection('complaints').where('submittedBy', '==', req.user!.id).get()
  const complaints = complaintsSnap.docs.map((d: any) => d.data())
  const stats = {
    totalComplaints: complaints.length,
    resolvedComplaints: complaints.filter(c => c.status === 'resolved').length,
    pendingRatings: complaints.filter(c => c.status === 'resolved' && !c.satisfactionRating).length,
    overdueComplaints: complaints.filter(c => c.isOverdue).length
  }
  return res.status(200).json(new ApiResponse(200, { user: { id: userDoc.id, ...userDoc.data() }, stats }, 'Profile fetched'))
})

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, department } = req.body
  const updateData: any = { updatedAt: new Date().toISOString() }
  if (name) updateData.name = name
  if (department) updateData.department = department
  await db.collection('users').doc(req.user!.id).update(updateData)
  const updated = await db.collection('users').doc(req.user!.id).get()
  return res.status(200).json(new ApiResponse(200, { id: updated.id, ...updated.data() }, 'Profile updated'))
})

export const getMyComplaints = asyncHandler(async (req: Request, res: Response) => {
  let query: any = db.collection('complaints').where('submittedBy', '==', req.user!.id)
  if (req.query.status) query = query.where('status', '==', req.query.status as string)
  const snap = await query.get()
  const complaints = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  return res.status(200).json(new ApiResponse(200, complaints, 'My complaints fetched'))
})

export const getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  const snap = await db.collection('users').get()
  const leaderboard = snap.docs
    .map((d: any) => ({ id: d.id, name: d.data().name, institute: d.data().institute, points: d.data().points || 0, level: d.data().level || 1, levelTitle: d.data().levelTitle || 'Newcomer', badges: d.data().badges || [], role: d.data().role }))
    .sort((a, b) => b.points - a.points).slice(0, 10)
  return res.status(200).json(new ApiResponse(200, leaderboard, 'Leaderboard fetched'))
})
