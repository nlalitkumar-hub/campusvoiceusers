import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getComplaints } from '@/lib/firestore';
import { getMyComplaintsAPI } from '@/lib/api';
import { getRelativeTime } from '@/lib/timeUtils';
import BottomNav from '@/components/BottomNav';

const TABS = ['All', 'Pending', 'In Progress', 'Resolved'];
const TAB_FILTER: Record<string, string> = {
  'All': 'all',
  'Pending': 'pending',
  'In Progress': 'in_progress',
  'Resolved': 'resolved',
};
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-cv-amber/10 text-cv-amber',
  resolved: 'bg-cv-green/10 text-cv-green',
};

const MyComplaints: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('All');
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        let data: any[];
        try {
          const res = await getMyComplaintsAPI(TAB_FILTER[tab] !== 'all' ? TAB_FILTER[tab] : undefined);
          data = res.data || res;
        } catch {
          const all = await getComplaints(TAB_FILTER[tab]);
          data = all.filter((c: any) => c.submittedBy === user.id);
        }
        setComplaints(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id, tab]);

  const archivedCount = complaints.filter(c => c.archivedFromFeed).length;
  const visibleComplaints = complaints.filter(c => !c.archivedFromFeed);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">My Complaints</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                tab === t ? 'bg-primary text-primary-foreground shadow-indigo' : 'bg-card text-muted-foreground shadow-card'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-2xl shadow-card p-4 animate-pulse flex gap-4">
                <div className="w-20 h-20 bg-muted rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && visibleComplaints.length === 0 && archivedCount === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No complaints found</p>
          </div>
        )}

        {!loading && archivedCount > 0 && (
          <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#6D28D9' }}>
            ?? {archivedCount} resolved complaint{archivedCount !== 1 ? 's' : ''} archived. Check Authorities app for full history.
          </div>
        )}

        {!loading && visibleComplaints.map(c => (
          <div
            key={c.id}
            onClick={() => navigate(`/complaint/${c.id}`)}
            className="bg-card rounded-2xl shadow-card hover:shadow-card-hover transition-all p-4 flex gap-4 cursor-pointer"
          >
            {c.imageUrl && (
              <img src={c.imageUrl} alt={c.title} className="w-20 h-20 rounded-xl object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-sm text-foreground truncate">{c.title}</h3>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize shrink-0 ${STATUS_STYLES[c.status] || STATUS_STYLES.pending}`}>
                  {(c.status || 'pending').replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{getRelativeTime(c.createdAt ? (typeof c.createdAt?.toDate === 'function' ? c.createdAt.toDate() : new Date(c.createdAt)) : undefined)}</span>
                {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
              </div>
              {c.status === 'resolved' && !c.satisfactionRating && (
                <div
                  onClick={e => { e.stopPropagation(); navigate(`/complaint/${c.id}`); }}
                  style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', padding: '8px 12px', marginTop: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span style={{ fontSize: '16px' }}>?</span>
                  <p style={{ fontSize: '13px', color: '#92400E', fontWeight: 600, margin: 0 }}>
                    Rate the resolution — tap to give feedback
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default MyComplaints;
