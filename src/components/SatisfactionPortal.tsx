import { useState } from 'react'

interface SatisfactionPortalProps {
  complaint: any
  onSubmitRating: (rating: number, feedback: string) => Promise<void>
  onRaiseAgain: (description: string) => Promise<void>
}

const RATING_LABELS = ['', '😞 Very Unsatisfied', '😕 Unsatisfied', '😐 Neutral', '😊 Satisfied', '😄 Very Satisfied']
const RATING_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981']

export const SatisfactionPortal = ({ complaint, onSubmitRating, onRaiseAgain }: SatisfactionPortalProps) => {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [showRaiseAgain, setShowRaiseAgain] = useState(false)
  const [raiseAgainDesc, setRaiseAgainDesc] = useState('The problem is not resolved properly. ')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [raisingAgain, setRaisingAgain] = useState(false)

  if (submitted) {
    return (
      <div style={{
        background: '#F0FDF4', border: '1px solid #86EFAC',
        borderRadius: '16px', padding: '24px', textAlign: 'center', marginTop: '16px'
      }}>
        <p style={{ fontSize: '40px' }}>🎉</p>
        <p style={{ fontWeight: 700, color: '#065F46', fontSize: '18px', marginTop: '8px' }}>
          Thank you for your feedback!
        </p>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
          Your response has been recorded.
        </p>
      </div>
    )
  }

  const activeRating = hoveredRating || rating

  return (
    <div style={{
      background: 'white', border: '2px solid #E5E7EB',
      borderRadius: '16px', padding: '20px', marginTop: '16px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: '#F5F3FF', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '20px'
        }}>⭐</div>
        <div>
          <p style={{ fontWeight: 700, color: '#111827', fontSize: '16px', margin: 0 }}>
            How was the resolution?
          </p>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
            Your feedback helps us improve
          </p>
        </div>
      </div>

      {/* Resolution proof */}
      {complaint.resolutionImageUrl && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Resolution proof from authorities:
          </p>
          <img
            src={complaint.resolutionImageUrl}
            alt="Resolution proof"
            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E5E7EB' }}
          />
          {complaint.resolutionNote && (
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px', padding: '10px', background: '#F9FAFB', borderRadius: '8px' }}>
              📝 {complaint.resolutionNote}
            </p>
          )}
        </div>
      )}

      {/* Star Rating */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
          Rate the resolution:
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '8px' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '36px', padding: '4px', transition: 'transform 0.1s',
                transform: activeRating >= star ? 'scale(1.2)' : 'scale(1)',
                filter: activeRating >= star ? 'brightness(1)' : 'grayscale(1) opacity(0.4)',
              }}
            >
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
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="Tell us about your experience with the resolution..."
          rows={3}
          style={{
            width: '100%', padding: '10px', borderRadius: '8px',
            border: '1px solid #E5E7EB', fontSize: '14px', resize: 'vertical',
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
          }}
        />
      </div>

      {/* Submit */}
      <button
        disabled={rating === 0 || submitting}
        onClick={async () => {
          if (rating === 0) return
          setSubmitting(true)
          try {
            await onSubmitRating(rating, feedback)
            setSubmitted(true)
          } catch (e) {
            console.error(e)
          }
          setSubmitting(false)
        }}
        style={{
          width: '100%', padding: '12px',
          background: rating === 0 ? '#E5E7EB' : '#7C3AED',
          color: rating === 0 ? '#9CA3AF' : 'white',
          border: 'none', borderRadius: '10px',
          cursor: rating === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: '15px', marginBottom: '12px'
        }}
      >
        {submitting ? '⏳ Submitting...' : '✅ Submit Feedback'}
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
        <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Not satisfied?</span>
        <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
      </div>

      {/* Raise Again toggle */}
      {!showRaiseAgain && (
        <button
          onClick={() => setShowRaiseAgain(true)}
          style={{
            width: '100%', padding: '12px', background: 'white',
            color: '#EF4444', border: '2px solid #EF4444',
            borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
          }}
        >
          🔄 Raise Same Complaint Again
        </button>
      )}

      {/* Raise Again form */}
      {showRaiseAgain && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: '12px', padding: '16px', marginTop: '8px'
        }}>
          <p style={{ fontWeight: 700, color: '#DC2626', fontSize: '14px', marginBottom: '10px' }}>
            🔄 Re-raise Complaint
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '10px' }}>
            Describe why the problem is not resolved:
          </p>
          <textarea
            value={raiseAgainDesc}
            onChange={e => setRaiseAgainDesc(e.target.value)}
            rows={4}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px',
              border: '1px solid #FCA5A5', fontSize: '14px', resize: 'vertical',
              outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              disabled={!raiseAgainDesc.trim() || raisingAgain}
              onClick={async () => {
                if (!raiseAgainDesc.trim()) return
                setRaisingAgain(true)
                try {
                  await onRaiseAgain(raiseAgainDesc)
                  setShowRaiseAgain(false)
                  alert('✅ Complaint re-raised! Authorities have been notified.')
                } catch (e: any) {
                  alert('Failed: ' + e.message)
                }
                setRaisingAgain(false)
              }}
              style={{
                flex: 1, padding: '10px', background: '#EF4444',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontWeight: 600, fontSize: '14px'
              }}
            >
              {raisingAgain ? '⏳ Submitting...' : '🔄 Re-raise Complaint'}
            </button>
            <button
              onClick={() => setShowRaiseAgain(false)}
              style={{
                padding: '10px 16px', background: 'white', color: '#6B7280',
                border: '1px solid #E5E7EB', borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
