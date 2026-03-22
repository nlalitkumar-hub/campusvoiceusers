import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUp, Shield, MapPin, Clock, CheckCircle2, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getComplaintById, toggleUpvote, endorseComplaint,
  rateComplaint, addComment, getComments, updateUserPoints
} from '@/lib/firestore';
import {
  getComplaintByIdAPI, upvoteComplaintAPI, endorseComplaintAPI,
  rateComplaintAPI, addCommentAPI
} from '@/lib/api';
import { POINT_VALUES } from '@/lib/gamification';
import { getRelativeTime } from '@/lib/timeUtils';
import { SatisfactionPortal } from '@/components/SatisfactionPortal';

const STATUS_STEPS = ['Submitted', 'Acknowledged', 'In Progress', 'Resolved'];
const STATUS_MAP: Record<string, number> = { pending: 0, acknowledged: 1, in_progress: 2, resolved: 3 };
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-cv-amber/10 text-cv-amber',
  resolved: 'bg-cv-green/10 text-cv-green',
};

const ComplaintDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [submitterName, setSubmitterName] = useState<string>('');

  const loadComplaint = async () => {
    if (!id) return;
    setLoading(true);
    try {
      let c: any, cmts: any[];
      try {
        const res = await getComplaintByIdAPI(id);
        c = res.data?.complaint || res.data || res;
        cmts = res.data?.comments || c.comments || [];
      } catch {
        [c, cmts] = await Promise.all([getComplaintById(id), getComments(id)]);
      }
      setComplaint(c);
      setComments(cmts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaint();
  }, [id]);

  // Fetch submitter's real name from Firestore using their email
  useEffect(() => {
    if (!complaint?.submittedBy) return;
    const email = complaint.submittedBy;

    // If submittedByName is already a real name (not an email), use it directly
    const stored = complaint.submittedByName;
    if (stored && !stored.includes('@')) {
      setSubmitterName(stored);
      return;
    }

    // Otherwise look up the user document by email
    const lookup = async () => {
      try {
        const { db } = await import('../lib/firebase');
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', email));
        if (userDoc.exists()) {
          const name = userDoc.data()?.name;
          if (name) { setSubmitterName(name); return; }
        }
      } catch { /* ignore */ }
      // Fallback: prettify the email prefix
      const prefix = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      setSubmitterName(prefix);
    };
    lookup();
  }, [complaint?.submittedBy, complaint?.submittedByName]);

  const handleUpvote = async () => {
    if (!user || !complaint) return;
    const isUpvoted = (complaint.upvotes || []).includes(user.id);
    try {
      try {
        await upvoteComplaintAPI(complaint.id);
      } catch {
        await toggleUpvote(complaint.id, user.id, isUpvoted);
        if (!isUpvoted) {
          await updateUserPoints(user.id, POINT_VALUES.GIVE_UPVOTE);
          await updateUserPoints(complaint.submittedBy, POINT_VALUES.UPVOTE_RECEIVED);
        }
      }
      if (!isUpvoted) updateUser({ points: (user.points || 0) + POINT_VALUES.GIVE_UPVOTE });
      setComplaint((prev: any) => ({
        ...prev,
        upvotes: isUpvoted
          ? (prev.upvotes || []).filter((u: string) => u !== user.id)
          : [...(prev.upvotes || []), user.id],
        upvoteCount: (prev.upvoteCount || 0) + (isUpvoted ? -1 : 1),
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndorse = async () => {
    if (!user || !complaint) return;
    setActionLoading(true);
    try {
      try {
        await endorseComplaintAPI(complaint.id);
      } catch {
        await endorseComplaint(complaint.id, user.id, user.name);
        await updateUserPoints(complaint.submittedBy, POINT_VALUES.FACULTY_ENDORSEMENT);
      }
      setComplaint((prev: any) => ({ ...prev, isEndorsed: true, endorsedByName: user.name }));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComment = async () => {
    if (!user || !newComment.trim() || !id) return;
    setActionLoading(true);
    try {
      try {
        await addCommentAPI(id, newComment.trim());
      } catch {
        await addComment(id, user.id, user.name, newComment.trim());
      }
      setComments(prev => [...prev, { userId: user.id, userName: user.name, text: newComment.trim(), createdAt: null }]);
      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
          <div className="h-64 bg-muted rounded-2xl" />
          <div className="h-6 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-full" />
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Complaint not found</p>
      </div>
    );
  }

  const safeDate = (value: any): Date => {
    if (!value) return new Date();
    if (value && typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
  };

  const currentStep = STATUS_MAP[complaint.status] ?? 0;
  const isUpvoted = (complaint.upvotes || []).includes(user?.id);
  const daysToResolve = complaint.resolvedAt && complaint.createdAt
    ? Math.ceil((safeDate(complaint.resolvedAt).getTime() - safeDate(complaint.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* Image */}
        {complaint.imageUrl && (
          <img src={complaint.imageUrl} alt={complaint.title} className="w-full rounded-2xl object-cover max-h-80 shadow-card" />
        )}

        {/* Title & Status */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-foreground">{complaint.title}</h1>
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize shrink-0 ${STATUS_STYLES[complaint.status] || STATUS_STYLES.pending}`}>
              {(complaint.status || 'pending').replace('_', ' ')}
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{complaint.description}</p>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="px-2.5 py-1 rounded-md bg-muted font-medium">{complaint.category}</span>
          {complaint.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{complaint.location}</span>
          )}
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{getRelativeTime(safeDate(complaint.createdAt))}</span>
        </div>

        <p className="text-sm text-muted-foreground">Submitted by{' '}
          <span className="font-medium text-foreground">
            {submitterName || (complaint?.submittedBy ? complaint.submittedBy.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown')}
          </span>
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleUpvote}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isUpvoted ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-primary/5'
            }`}
          >
            <ArrowUp className="w-4 h-4" />
            <span className="tabular-nums">{complaint.upvoteCount || 0}</span>
          </button>

          {complaint.isEndorsed && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold">
              <Shield className="w-4 h-4" />
              Endorsed by {complaint.endorsedByName}
            </span>
          )}

          {user?.role === 'faculty' && !complaint.isEndorsed && complaint.submittedBy !== user.id && (
            <button
              onClick={handleEndorse}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-indigo transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Endorse
            </button>
          )}
        </div>

        {daysToResolve !== null && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cv-green/10 text-cv-green text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Resolved in {daysToResolve} day{daysToResolve !== 1 ? 's' : ''}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-card rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-foreground mb-4">Resolution Timeline</h3>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i <= currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground text-center">{s}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded ${i < currentStep ? 'bg-primary' : 'bg-border'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Satisfaction Portal */}
        {complaint.status === 'resolved' && complaint.submittedBy === user?.id && !complaint.satisfactionRating && (
          <SatisfactionPortal
            complaint={complaint}
            onSubmitRating={async (r, feedbackText) => {
              try {
                const { db } = await import('../lib/firebase');
                const { doc, updateDoc } = await import('firebase/firestore');
                await updateDoc(doc(db, 'complaints', complaint.id), {
                  satisfactionRating: r,
                  satisfactionFeedback: feedbackText,
                  ratedAt: new Date().toISOString(),
                });
                try {
                  await rateComplaintAPI(complaint.id, r);
                } catch { /* backend optional */ }
                await updateUserPoints(user!.id, POINT_VALUES.RATE_RESOLUTION);
                updateUser({ points: (user!.points || 0) + POINT_VALUES.RATE_RESOLUTION });
                await loadComplaint();
              } catch (error: any) {
                throw new Error(error.message);
              }
            }}
            onRaiseAgain={async (description) => {
              try {
                const token = localStorage.getItem('token') || '';
                const response = await fetch('http://localhost:5000/api/complaints/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    title: complaint.title,
                    description,
                    category: complaint.category,
                    location: complaint.location,
                    imageBase64: null,
                    coordinates: complaint.coordinates || null,
                    isReRaise: true,
                    originalComplaintId: complaint.id,
                  }),
                });
                if (!response.ok) throw new Error('Failed to re-raise complaint');
              } catch (error: any) {
                throw new Error(error.message);
              }
            }}
          />
        )}

        {/* Already rated */}
        {complaint.status === 'resolved' && complaint.satisfactionRating && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #86EFAC',
            borderRadius: '12px', padding: '16px', textAlign: 'center'
          }}>
            <p style={{ fontWeight: 700, color: '#065F46', fontSize: '15px', marginBottom: '8px' }}>
              Your Rating
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} style={{
                  fontSize: '28px',
                  filter: star <= complaint.satisfactionRating ? 'none' : 'grayscale(1) opacity(0.3)'
                }}>⭐</span>
              ))}
            </div>
            <p style={{ color: '#6B7280', fontSize: '13px' }}>
              You rated this resolution {complaint.satisfactionRating}/5
            </p>
            {complaint.satisfactionFeedback && (
              <p style={{ color: '#374151', fontSize: '13px', marginTop: '8px', fontStyle: 'italic' }}>
                "{complaint.satisfactionFeedback}"
              </p>
            )}
          </div>
        )}

        {/* Comments */}
        <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
          <h3 className="font-bold text-foreground">Comments ({comments.length})</h3>
          
          {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet</p>}
          
          {comments.map((c, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {c.userName?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{c.userName}</span>
                  <span className="text-xs text-muted-foreground">{getRelativeTime(c.createdAt ? safeDate(c.createdAt) : undefined)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{c.text}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              className="flex-1 p-3 rounded-xl bg-muted ring-1 ring-border focus:ring-2 focus:ring-primary outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={handleComment}
              disabled={!newComment.trim() || actionLoading}
              className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintDetail;
