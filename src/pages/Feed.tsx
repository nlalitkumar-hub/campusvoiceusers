import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ArrowUp, Shield, Clock, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toggleUpvote, updateUserPoints } from '@/lib/firestore';
import { upvoteComplaintAPI } from '@/lib/api';
import { POINT_VALUES } from '@/lib/gamification';
import { getRelativeTime } from '@/lib/timeUtils';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, limit, onSnapshot } from 'firebase/firestore';
import BottomNav from '@/components/BottomNav';
import Navbar from '@/components/Navbar';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'trending', label: 'Trending 🔥' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#F3F4F6', text: '#6B7280', label: 'Pending' },
  in_progress: { bg: '#FEF3C7', text: '#D97706', label: 'In Progress' },
  resolved: { bg: '#D1FAE5', text: '#059669', label: 'Resolved' },
  rejected: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
};

const Feed: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState('all');
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const notifSnap = await getDocs(query(collection(db, 'notifications'), orderBy('sentAt', 'desc'), limit(20)));
      const readIds: string[] = JSON.parse(localStorage.getItem('read_notifications') || '[]');
      const allNotifs = notifSnap.docs.map(d => ({ id: d.id, ...d.data(), isRead: readIds.includes(d.id) }));
      setNotifications(allNotifs);
      setUnreadCount(allNotifs.filter(n => !n.isRead).length);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifications();
    const i = setInterval(loadNotifications, 30000);
    return () => clearInterval(i);
  }, [loadNotifications]);

  const normalizeComplaint = (data: any, id: string) => {
    const upvotes: string[] = Array.isArray(data.upvotes) ? data.upvotes : [];
    return { ...data, id, upvotes, upvoteCount: typeof data.upvoteCount === 'number' ? data.upvoteCount : upvotes.length };
  };

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const apiFilter = filter === 'trending' ? 'all' : filter;
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/complaints?filter=${apiFilter}`, {
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }
      });
      const json = await response.json();
      let data: any[] = Array.isArray(json) ? json
        : Array.isArray(json?.data?.complaints) ? json.data.complaints
        : Array.isArray(json?.data) ? json.data
        : Array.isArray(json?.complaints) ? json.complaints
        : [];
      data = data.map(c => normalizeComplaint(c, c.id));
      if (filter === 'trending') data = [...data].sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
      setComplaints(data);
    } catch {
      try {
        const { getComplaints: fbGet } = await import('../lib/firestore');
        let data = await fbGet(filter === 'trending' ? 'all' : filter, user?.institute);
        data = data.map((c: any) => normalizeComplaint(c, c.id));
        if (filter === 'trending') data = [...data].sort((a: any, b: any) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
        setComplaints(data);
      } catch {
        setError('Server is offline. Please start the backend.');
      }
    } finally {
      setLoading(false);
    }
  }, [filter, user?.institute]);

  useEffect(() => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, snapshot => {
      setComplaints(prev => {
        if (prev.length === 0) return prev;
        const liveMap = new Map(snapshot.docs.map(d => [d.id, d.data()]));
        return prev.map(c => {
          const live = liveMap.get(c.id);
          if (!live) return c;
          const upvotes: string[] = Array.isArray(live.upvotes) ? live.upvotes : [];
          return { ...c, upvotes, upvoteCount: typeof live.upvoteCount === 'number' ? live.upvoteCount : upvotes.length };
        });
      });
    }, () => { /* network error — silently ignore */ });
    return () => unsub();
  }, []);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  useEffect(() => {
    if (location.state?.refresh) {
      fetchComplaints();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleUpvote = async (e: React.MouseEvent, complaint: any) => {
    e.stopPropagation();
    if (!user) return;
    const upvotedBy: string[] = Array.isArray(complaint.upvotes) ? complaint.upvotes : [];
    const isUpvoted = upvotedBy.includes(user.id);
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
      setComplaints(prev => prev.map(c => {
        if (c.id !== complaint.id) return c;
        const current: string[] = Array.isArray(c.upvotes) ? c.upvotes : [];
        const updated = isUpvoted ? current.filter((u: string) => u !== user.id) : [...current, user.id];
        return { ...c, upvotes: updated, upvoteCount: updated.length };
      }));
    } catch {}
  };

  const visibleComplaints = complaints.filter(c => c.archivedFromFeed !== true);

  const filteredComplaints = searchQuery.trim()
    ? visibleComplaints.filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : visibleComplaints;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url(/campus-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: -2 }} />
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.85)', zIndex: -1 }} />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '80px' }}>
      <Navbar
        onSearchClick={() => {
          setShowSearch(p => {
            if (p) setSearchQuery('');
            else setTimeout(() => searchInputRef.current?.focus(), 100);
            return !p;
          });
        }}
        searchActive={showSearch}
        notifications={notifications}
        unreadCount={unreadCount}
        showNotifications={showNotifications}
        onBellClick={() => {
          const opening = !showNotifications;
          setShowNotifications(opening);
          if (opening) {
            const ids = notifications.map(n => n.id);
            localStorage.setItem('read_notifications', JSON.stringify(ids));
            setUnreadCount(0);
            setNotifications(p => p.map(n => ({ ...n, isRead: true })));
          }
        }}
        onMarkAllRead={() => {
          const ids = notifications.map(n => n.id);
          localStorage.setItem('read_notifications', JSON.stringify(ids));
          setNotifications(p => p.map(n => ({ ...n, isRead: true })));
          setUnreadCount(0);
        }}
        onCloseNotifications={() => setShowNotifications(false)}
      />

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 pt-3 pb-1 bg-white border-b border-gray-100">
          <div className="flex items-center bg-white rounded-xl h-11 px-4 gap-3 border border-gray-200 shadow-sm">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search complaints..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-gray-500 mt-1.5 px-1">
              {filteredComplaints.length} result{filteredComplaints.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
          )}
        </div>
      )}

      <div className="px-4 py-4">
        {/* Filter pills */}
        <div className="max-w-4xl mx-auto px-4 mt-2">
          <div className="flex gap-2 flex-wrap pb-3">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setSearchQuery(''); setShowSearch(false); }}
                className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
                style={{
                  background: filter === f.key ? '#7C3AED' : 'white',
                  color: filter === f.key ? 'white' : '#6B7280',
                  border: filter === f.key ? 'none' : '1px solid #E5E7EB',
                  boxShadow: filter === f.key ? '0 4px 12px rgba(124,58,237,0.2)' : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm mb-4">
            {error}{' '}
            <button onClick={fetchComplaints} className="underline font-medium ml-1">Retry</button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4 mt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse shadow-sm" style={{ maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
                <div className="h-[200px] bg-gray-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && visibleComplaints.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No complaints yet</p>
            <p className="text-gray-400 text-sm mt-1">Be the first to raise one!</p>
          </div>
        )}

        {!loading && filteredComplaints.length === 0 && searchQuery && (
          <div className="text-center py-16">
            <Search size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-700 font-semibold">No complaints found</p>
            <p className="text-sm text-gray-400 mt-1">No results for "{searchQuery}"</p>
            <button onClick={() => setSearchQuery('')} className="mt-4 px-5 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium">
              Clear Search
            </button>
          </div>
        )}

        {/* Complaint cards */}
        {!loading && filteredComplaints.length > 0 && (
          <div className="space-y-4 mt-2">
            {filteredComplaints.map(c => {
              const statusStyle = STATUS_COLORS[c.status] || STATUS_COLORS.pending;
              const isUpvoted = (c.upvotes || []).includes(user?.id);
              return (
                <div key={c.id} style={{ maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}>
                  <article
                    onClick={() => navigate(`/complaint/${c.id}`)}
                    className="bg-white rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                  >
                    {/* Image */}
                    <div className="relative h-[200px] w-full bg-gray-100">
                      {(() => {
                        const src = c.imageUrl && !c.imageUrl.includes('placehold.co')
                          ? c.imageUrl
                          : c.imageData || null;
                        return src ? (
                          <img
                            src={src}
                            alt={c.title}
                            className="w-full h-full object-cover rounded-t-2xl"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center rounded-t-2xl">
                            <span className="text-5xl opacity-20">📷</span>
                          </div>
                        );
                      })()}
                      <span
                        className="absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: statusStyle.bg, color: statusStyle.text }}
                      >
                        {statusStyle.label}
                      </span>
                      {c.isEndorsed && (
                        <span
                          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                          style={{ background: '#FCD34D', color: '#191c1d' }}
                        >
                          ⭐ Priority
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-gray-600" style={{ background: '#e7e8e9' }}>
                          {c.category}
                        </span>
                        {c.aiVerified && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                            ✓ AI VERIFIED
                          </span>
                        )}
                      </div>
                      <h2 className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-2 mb-2">{c.title}</h2>
                      {c.location && (
                        <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
                          <MapPin size={12} />
                          <span>{c.location}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                          <Clock size={11} />
                          <span>
                            {getRelativeTime(c.createdAt
                              ? (typeof c.createdAt?.toDate === 'function' ? c.createdAt.toDate() : new Date(c.createdAt))
                              : undefined)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.isEndorsed && user?.role === 'student' && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-purple-600">
                              <Shield size={12} />Endorsed
                            </span>
                          )}
                          <button
                            onClick={e => handleUpvote(e, c)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                            style={{
                              background: isUpvoted ? '#7C3AED' : 'white',
                              color: isUpvoted ? 'white' : '#4a4455',
                              border: isUpvoted ? 'none' : '1px solid #ccc3d8',
                              boxShadow: isUpvoted ? '0 4px 12px rgba(124,58,237,0.2)' : 'none',
                            }}
                          >
                            <ArrowUp size={14} />
                            <span>{c.upvoteCount || 0}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
      </div>
    </div>
  );
};

export default Feed;
