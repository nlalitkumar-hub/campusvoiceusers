import { Request, Response } from 'express'
import { db } from '../config/firebase'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiResponse } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'

export const getFacultyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const facultyEmail = req.user!.id
  const facultyInstitute = req.user!.institute

  if (req.user!.role !== 'faculty') {
    throw new ApiError(403, 'Access denied. Faculty only.')
  }

  const allSnap = await db.collection('complaints').get()
  const all = allSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

  const endorsed = all.filter(c => c.endorsedBy === facultyEmail)
  const endorsedResolved = endorsed.filter(c => c.status === 'resolved')
  const endorsedPending = endorsed.filter(c => c.status !== 'resolved' && c.status !== 'rejected')

  const instituteComplaints = all.filter(c => c.institute === facultyInstitute)
  const instituteResolved = instituteComplaints.filter(c => c.status === 'resolved').length
  const instituteInProgress = instituteComplaints.filter(c => c.status === 'in_progress').length
  const institutePending = instituteComplaints.filter(c => c.status === 'pending').length
  const instituteRejected = instituteComplaints.filter(c => c.status === 'rejected').length

  const raisedByFaculty = all.filter(c => c.submittedBy === facultyEmail)
  const reopenedByFaculty = all.filter(c => c.facultyReopenedBy === facultyEmail)

  const awaitingReview = instituteComplaints
    .filter(c => c.status === 'pending' || c.status === 'in_progress')
    .sort((a, b) => {
      if (a.isEndorsed && !b.isEndorsed) return -1
      if (!a.isEndorsed && b.isEndorsed) return 1
      return (b.upvoteCount || 0) - (a.upvoteCount || 0)
    })

  const endorsedWithNames = await Promise.all(
    endorsed.map(async c => {
      let submitterName = c.submittedByName || c.submittedBy?.split('@')[0] || 'Unknown'
      try {
        const userDoc = await db.collection('users').doc(c.submittedBy).get()
        if (userDoc.exists) submitterName = userDoc.data()!.name || submitterName
      } catch {}
      return { ...c, submitterName }
    })
  )

  const resolutionRate = instituteComplaints.length > 0
    ? Math.round((instituteResolved / instituteComplaints.length) * 100)
    : 0

  return res.status(200).json(new ApiResponse(200, {
    stats: {
      endorsedCount: endorsed.length,
      endorsedResolved: endorsedResolved.length,
      endorsedPending: endorsedPending.length,
      awaitingReview: awaitingReview.length,
      raisedByFaculty: raisedByFaculty.length
    },
    endorsedComplaints: endorsedWithNames.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    ),
    awaitingReview: awaitingReview.slice(0, 20),
    reopenedComplaints: reopenedByFaculty,
    departmentStats: {
      total: instituteComplaints.length,
      resolved: instituteResolved,
      inProgress: instituteInProgress,
      pending: institutePending,
      rejected: instituteRejected,
      resolutionRate
    }
  }, 'Faculty dashboard loaded'))
})
