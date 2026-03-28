import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/lib/firebase'
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

interface SatisfactionPortalProps {
  complaint: any
  onSubmitRating: (rating: number, feedback: string) => Promise<void>
  onRaiseAgain: (description: string) => Promise<void>
}

const RATING_LABELS = ['', '😞 Very Unsatisfied', '😕 Unsatisfied', '😐 Neutral', '😊 Satisfied', '😄 Very Satisfied']
const RATING_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981']

export const SatisfactionPortal = ({ complaint }: SatisfactionPortalProps) => {
  const navigate = useNavigate()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // Step 1: save rating then show dialog — do NOT call parent's onSubmitRating
  // because that triggers loadComplaint() which unmounts this component
  const handleSubmit = async () => {
    if (rating === 0) return
    setSubmitting(true)
    try {
      await updateDoc(doc(db, 'complaints', complaint.id), {
        satisfactionRating: rating,
        satisfactionFeedback: feedback,
        feedbackGiven: true,
        ratedAt: new Date().toISOString(),
      })
      setShowDialog(true)
    } catch (e) {
      console.error('Failed to save rating:', e)
    }
    setSubmitting(false)
  }

  // Step 2a: No, I'm Satisfied — archive and close
  const handleNotSatisfied = async () => {
    setDialogLoading(true)
    try {
      await updateDoc(doc(db, 'complaints', complaint.id), {
        archivedFromFeed: true,
        raisedAgain: false,
      })
      setShowDialog(false)
      setDone(true)
      showToast('Complaint archived')
    } catch (e) {
      console.error(e)
    }
    setDialogLoading(false)
  }

  // Step 2b: Yes, Raise Again — create new complaint, archive original, navigate
  const handleRaiseAgain = async () => {
    setDialogLoading(true)
    try {
      const snap = await getDoc(doc(db, 'complaints', complaint.id))
      const orig = snap.data() || {}

      await addDoc(collection(db, 'complaints'), {
        title: orig.title,
        description: orig.description,
        category: orig.category,
        location: orig.location || '',
        imageUrl: orig.imageUrl || '',
        status: 'pending',
        submittedBy: orig.submittedBy,
        submittedByName: orig.submittedByName,
        createdAt: serverTimestamp(),
        upvotes: [],
        upvoteCount: 0,
        endorsed: false,
        feedbackGiven: false,
        archivedFromFeed: false,
        raisedAgainFrom: complaint.id,
        resolutionNote: null,
        resolutionImageUrl: null,
        resolvedAt: null,
        satisfactionRating: null,
        rejectionReason: null,
        deadlineExceeded: false,
      })

      await updateDoc(doc(db, 'complaints', complaint.id), {
        archivedFromFeed: true,
        raisedAgain: true,
      })

      setShowDialog(false)
      setDone(true)
      showToast('Complaint raised again!')
      setTimeout(() => navigate('/feed', { state: { refresh: true } }), 1000)
    } catch (e) {
      console.error(e)
    }
    setDialogLoading(false)
  }

  const activeRating = hoveredRating || rating

  // After done, show a thank-you state
  if (done) {
    return (
      <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '16px', padding: '24px', textAlign: 'center', marginTop: '16px' }}>
        {toastMsg && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, zIndex: 9999 }}>
            {toastMsg}
          </div>
        )}
        <p style={{ fontSize: '40px' }}>🎉</p>
        <p style={{ fontWeight: 700, color: '#065F46', fontSize: '18px', marginTop: '8px' }}>Thank you for your feedback!</p>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>Your response has been recorded.</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '2px solid #E5E7EB', borderRadius: '16px', padding: '20px', marginTop: '16px' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, zIndex: 9999 }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⭐</div>
        <div>
          <p style={{ fontWeight: 700, color: '#111827', fontSize: '16px', margin: 0 }}>How was the resolution?</p>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>Your feedback helps us improve</p>
        </div>
      </div>

      {/* Resolution proof */}
      {complaint.resolutionImageUrl && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Resolution proof from authorities:</p>
          <img src={complaint.resolutionImageUrl} alt="Resolution proof"
            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E5E7EB' }} />
          {complaint.resolutionNote && (
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px', padding: '10px', background: '#F9FAFB', borderRadius: '8px' }}>
              📝 {complaint.resolutionNote}
            </p>
          )}
        </div>
      )}

      {/* Star Rating */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Rate the resolution:</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '8px' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '36px', padding: '4px', transition: 'transform 0.1s', transform: activeRating >= star ? 'scale(1.2)' : 'scale(1)', filter: activeRating >= star ? 'brightness(1)' : 'grayscale(1) opacity(0.4)' }}>
              ⭐
            </button>
          ))}
        </div>
        {activeRating > 0 && (
          <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, color: RATING_COLORS[activeRating], marginTop: '4px' }}>
            {RATING_LABELS[activeRating]}
          </p>
        )}
      </div>

      {/* Feedback textarea */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
          Additional feedback (optional):
        </label>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
          placeholder="Tell us about your experience with the resolution..." rows={3}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </div>

      {/* Submit button */}
      <button disabled={rating === 0 || submitting} onClick={handleSubmit}
        style={{ width: '100%', padding: '12px', background: rating === 0 ? '#E5E7EB' : '#7C3AED', color: rating === 0 ? '#9CA3AF' : 'white', border: 'none', borderRadius: '10px', cursor: rating === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '15px' }}>
        {submitting ? '⏳ Submitting...' : '✅ Submit Feedback'}
      </button>

      {/* Dialog — shown after rating is saved */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!dialogLoading) setShowDialog(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Want to raise this complaint again?</DialogTitle>
            <DialogDescription>
              The issue was resolved. Do you want to report it again?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              onClick={handleRaiseAgain}
              disabled={dialogLoading}
              style={{ width: '100%', padding: '12px', background: 'white', color: '#7C3AED', border: '2px solid #7C3AED', borderRadius: '10px', cursor: dialogLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px' }}
            >
              {dialogLoading ? '⏳ Processing...' : '🔄 Yes, Raise Again'}
            </button>
            <button
              onClick={handleNotSatisfied}
              disabled={dialogLoading}
              style={{ width: '100%', padding: '12px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: '10px', cursor: dialogLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px' }}
            >
              {dialogLoading ? '⏳ Processing...' : "✅ No, I'm Satisfied"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
