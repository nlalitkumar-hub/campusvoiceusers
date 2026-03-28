import { Request, Response } from 'express'
import { db } from '../config/firebase'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiResponse } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'
import { uploadBase64Image } from '../services/cloudinary.service'
import { verifyComplaint as aiVerify } from '../services/ai.service'
import { updateUserPoints, POINTS } from '../services/gamification.service'

export const getComplaints = asyncHandler(async (req: Request, res: Response) => {
  const filter = (req.query.filter as string) || 'all'
  let query: any = db.collection('complaints')
  if (filter === 'in_progress') query = query.where('status', '==', 'in_progress')
  else if (filter === 'resolved') query = query.where('status', '==', 'resolved')
  else if (filter === 'pending') query = query.where('status', '==', 'pending')
  else if (filter === 'my_institute' && req.user?.institute) query = query.where('institute', '==', req.user.institute)

  const snapshot = await query.get()
  let complaints = snapshot.docs.map((doc: any) => ({
    id: doc.id, ...doc.data(),
    isUpvotedByUser: req.user ? (doc.data().upvotes || []).includes(req.user.id) : false
  }))

  if (filter === 'trending') {
    complaints = complaints.sort((a: any, b: any) => (b.upvoteCount || 0) - (a.upvoteCount || 0))
  } else {
    complaints = complaints.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  }

  return res.status(200).json(new ApiResponse(200, { complaints, total: complaints.length }, 'Complaints fetched'))
})

export const getComplaintById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const doc = await db.collection('complaints').doc(id).get()
  if (!doc.exists) throw new ApiError(404, 'Complaint not found')
  const commentsSnap = await db.collection('comments').where('complaintId', '==', id).get()
  const comments = commentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
  return res.status(200).json(new ApiResponse(200, { complaint: { id: doc.id, ...doc.data() }, comments }, 'Complaint fetched'))
})

export const verifyComplaintHandler = asyncHandler(async (req: Request, res: Response) => {
  const { imageBase64, description, category } = req.body
  if (!imageBase64 || !description) throw new ApiError(400, 'Image and description required')
  const result = await aiVerify(imageBase64, description, category)
  return res.status(200).json(new ApiResponse(200, result, 'Verification complete'))
})

export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, category, location, imageBase64, coordinates } = req.body
  if (!title || !description || !category) throw new ApiError(400, 'Title, description, category required')
  if (!req.user?.id) throw new ApiError(401, 'Not authenticated')

  // Get user's actual name from Firestore
  let submitterName = req.user.email
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get()
    if (userDoc.exists) submitterName = userDoc.data()!.name || req.user.email
  } catch (e) { /* fallback to email */ }

  let imageUrl = 'https://placehold.co/600x400?text=Complaint'
  let imagePublicId = `placeholder_${Date.now()}`
  let imageData: string | null = null  // base64 fallback when Cloudinary fails

  if (imageBase64) {
    const uploaded = await uploadBase64Image(imageBase64, 'campusvoice/complaints')
    if (!uploaded.url.includes('placehold.co')) {
      // Cloudinary succeeded
      imageUrl = uploaded.url
      imagePublicId = uploaded.publicId
    } else {
      // Cloudinary failed — store base64 directly (compressed)
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
      imageData = `data:image/jpeg;base64,${base64Data}`
      imageUrl = imageData  // use base64 as the URL directly
      console.log('Cloudinary unavailable — storing image as base64')
    }
  }

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const complaintRef = db.collection('complaints').doc()
  const complaintData = {
    id: complaintRef.id, title: title.trim(), description: description.trim(),
    category, location: location?.trim() || '', coordinates: coordinates || null,
    imageUrl, imagePublicId, imageData: imageData || null, submittedBy: req.user.id, submittedByName: submitterName,
    institute: req.user.institute, status: 'pending', upvotes: [], upvoteCount: 0,
    isEndorsed: false, endorsedBy: null, aiVerified: true, satisfactionRating: null,
    deadline, deadlineDays: 7, daysElapsed: 0, daysRemaining: 7, isOverdue: false,
    escalationLevel: 0, resolvedAt: null, daysToResolve: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
  await complaintRef.set(complaintData)
  // Award points for raising complaint
  console.log(`Awarding points to: ${req.user!.id}`)
  await updateUserPoints(req.user!.id, POINTS.RAISE_COMPLAINT + POINTS.AI_VERIFIED, 'First Complaint')
  // Increment complaintsRaised counter
  try {
    const userSnap = await db.collection('users').doc(req.user!.id).get()
    if (userSnap.exists) {
      const current = userSnap.data()!.complaintsRaised || 0
      await db.collection('users').doc(req.user!.id).update({ complaintsRaised: current + 1 })
    }
  } catch (e: any) {
    console.error('complaintsRaised update error:', e.message)
  }
  return res.status(201).json(new ApiResponse(201, complaintData, 'Complaint submitted successfully'))
})

export const upvoteComplaint = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const userId = req.user!.id
  const ref = db.collection('complaints').doc(id)
  const doc = await ref.get()
  if (!doc.exists) throw new ApiError(404, 'Complaint not found')
  const data = doc.data()!
  const upvotes = data.upvotes || []
  const isUpvoted = upvotes.includes(userId)
  const newUpvotes = isUpvoted ? upvotes.filter((u: string) => u !== userId) : [...upvotes, userId]
  await ref.update({ upvotes: newUpvotes, upvoteCount: newUpvotes.length, updatedAt: new Date().toISOString() })
  if (!isUpvoted) {
    // Adding upvote — award points
    await updateUserPoints(userId, POINTS.GIVE_UPVOTE)
    console.log(`✅ Upvote point awarded to ${userId}`)
    if (data.submittedBy && data.submittedBy !== userId) {
      await updateUserPoints(data.submittedBy as string, POINTS.UPVOTE_RECEIVED)
      console.log(`✅ Upvote received points to ${data.submittedBy}`)
    }
    // Increment upvotesGiven
    try {
      const voterSnap = await db.collection('users').doc(userId).get()
      if (voterSnap.exists) {
        await db.collection('users').doc(userId).update({ upvotesGiven: (voterSnap.data()!.upvotesGiven || 0) + 1 })
      }
    } catch (e) { /* non-critical */ }
  } else {
    // Removing upvote — deduct point
    await updateUserPoints(userId, -POINTS.GIVE_UPVOTE)
  }
  return res.status(200).json(new ApiResponse(200, { upvoted: !isUpvoted, upvoteCount: newUpvotes.length }, !isUpvoted ? 'Upvoted' : 'Upvote removed'))
})

export const endorseComplaint = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const ref = db.collection('complaints').doc(id)
  const doc = await ref.get()
  if (!doc.exists) throw new ApiError(404, 'Complaint not found')
  const data = doc.data()!
  if (data.submittedBy === req.user!.id) throw new ApiError(400, 'Cannot endorse your own complaint')
  await ref.update({ isEndorsed: true, endorsedBy: req.user!.id, endorsedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  if (data.submittedBy) await updateUserPoints(data.submittedBy as string, POINTS.FACULTY_ENDORSEMENT)
  return res.status(200).json(new ApiResponse(200, { id, isEndorsed: true }, 'Complaint endorsed'))
})

export const rateComplaint = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { rating } = req.body
  if (!rating || rating < 1 || rating > 10) throw new ApiError(400, 'Rating must be 1-10')
  const ref = db.collection('complaints').doc(id)
  const doc = await ref.get()
  if (!doc.exists) throw new ApiError(404, 'Complaint not found')
  await ref.update({ satisfactionRating: Number(rating), ratedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  await updateUserPoints(req.user!.id, POINTS.RATE_RESOLUTION)
  return res.status(200).json(new ApiResponse(200, { rating }, 'Rating submitted'))
})

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { text } = req.body
  if (!text?.trim()) throw new ApiError(400, 'Comment text required')
  const commentRef = db.collection('comments').doc()
  const commentData = { id: commentRef.id, complaintId: id, userId: req.user!.id, userName: req.user!.email, text: text.trim(), createdAt: new Date().toISOString() }
  await commentRef.set(commentData)
  return res.status(201).json(new ApiResponse(201, commentData, 'Comment added'))
})
