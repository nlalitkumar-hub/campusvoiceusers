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
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'trending', label: 'Trending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'my_institute', label: 'My Institute' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-cv-amber/10 text-cv-amber',
  resolved: 'bg-cv-green/10 text-cv-green',
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

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const notifSnap = await getDocs(
        query(collection(db, 'notifications'), orderBy('sentAt', 'desc'), limit(20))
      );
      const readIds: string[] = JSON.parse(localStorage.getItem('read_notifications') || '[]');
      const allNotifs = notifSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        isRead: readIds.includes(d.id),
      }));
      setNotifications(allNotifs);
      setUnreadCount(allNotifs.filter(n => !n.isRead).length);
    } catch (error: any) {
      console.error('Notifications fetch error:', error.message);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notification-bell]')) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleBellClick = () => {
    const opening = !showNotifications;
    setShowNotifications(opening);
    if (opening) {
      // Mark all as read when opening
      const readIds = notifications.map(n => n.id);
      localStorage.setItem('read_notifications', JSON.stringify(readIds));
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  const handleMarkAllRead = () => {
    const readIds = notifications.map(n => n.id);
    localStorage.setItem('read_notifications', JSON.stringify(readIds));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const normalizeComplaint = (data: any, id: string) => {
    const upvotes: string[] = Array.isArray(data.upvotes) ? data.upvotes : [];
    const upvoteCount = typeof data.upvoteCount === 'number'
      ? data.upvoteCount
      : upvotes.length;
    return {
      ...data,
      id,
      upvotes,
      upvoteCount,
    };
  };

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const apiFilter = filter === 'trending' ? 'all' : filter;
      const response = await fetch(`http://localhost:5000/api/complaints?filter=${apiFilter}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      const json = await response.json();

      let data: any[] = [];
      if (Array.isArray(json)) data = json;
      else if (Array.isArray(json?.data?.complaints)) data = json.data.complaints;
      else if (Array.isArray(json?.data)) data = json.data;
      else if (Array.isArray(json?.complaints)) data = json.complaints;

      data = data.map(c => normalizeComplaint(c, c.id));

      if (filter === 'trending') {
        data = [...data].sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
      }
      setComplaints(data);
    } catch (err: any) {
      console.error('Feed API error:', err.message);
      // Firebase fallback
      try {
        const { getComplaints: fbGetComplaints } = await import('../lib/firestore');
        let data = await fbGetComplaints(filter === 'trending' ? 'all' : filter, user?.institute);
        data = data.map((c: any) => normalizeComplaint(c, c.id));
        if (filter === 'trending') {
          data = [...data].sort((a: any, b: any) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
        }
        setComplaints(data);
      } catch (fbErr: any) {
        console.error('Firebase fallback error:', fbErr.message);
        setError('Could not load complaints. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [filter, user?.institute]);

  // Real-time listener: keeps upvoteCount in sync without full refetch
  useEffect(() => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComplaints(prev => {
        if (prev.length === 0) return prev; // wait for initial API load
        const liveMap = new Map(snapshot.docs.map(d => [d.id, d.data()]));
        return prev.map(c => {
          const live = liveMap.get(c.id);
          if (!live) return c;
          const upvotes: string[] = Array.isArray(live.upvotes) ? live.upvotes : [];
          const upvoteCount = typeof live.upvoteCount === 'number' ? live.upvoteCount : upvotes.length;
          return { ...c, upvotes, upvoteCount };
        });
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

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
      if (!isUpvoted) {
        updateUser({ points: (user.points || 0) + POINT_VALUES.GIVE_UPVOTE });
      }
      setComplaints(prev =>
        prev.map(c => {
          if (c.id !== complaint.id) return c;
          const current: string[] = Array.isArray(c.upvotes) ? c.upvotes : [];
          const updated = isUpvoted
            ? current.filter((u: string) => u !== user.id)
            : [...current, user.id];
          return { ...c, upvotes: updated, upvoteCount: updated.length };
        })
      );
    } catch (e) {
      console.error('Upvote failed:', e);
    }
  };

  const filteredComplaints = searchQuery.trim()
    ? complaints.filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : complaints;

  const SkeletonCard = () => (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden animate-pulse">
      <div className="h-40 bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar
        onSearchClick={() => {
          setShowSearch(prev => {
            if (prev) setSearchQuery('');
            else setTimeout(() => searchInputRef.current?.focus(), 100);
            return !prev;
          });
        }}
        searchActive={showSearch}
        notifications={notifications}
        unreadCount={unreadCount}
        showNotifications={showNotifications}
        onBellClick={handleBellClick}
        onMarkAllRead={handleMarkAllRead}
        onCloseNotifications={() => setShowNotifications(false)}
      />
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding: '8px 16px 4px', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#F3F4F6', borderRadius: '12px', padding: '10px 14px', gap: '10px', border: '1.5px solid #E5E7EB' }}>
            <Search size={16} color="#9CA3AF" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search complaints by title..."
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '14px', color: '#111827' }}
            />
            {searchQuery.length > 0 && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery.length > 0 && (
            <p style={{ fontSize: '12px', color: '#6B7280', margin: '6px 4px 0' }}>
              {filteredComplaints.length} result{filteredComplaints.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
          )}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setSearchQuery(''); setShowSearch(false); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground shadow-indigo'
                  : 'bg-card text-muted-foreground shadow-card hover:shadow-card-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
            {error}
            <button onClick={fetchComplaints} className="ml-2 underline font-medium">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && complaints.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No complaints yet</p>
            <p className="text-muted-foreground text-sm mt-1">Be the first to raise one!</p>
          </div>
        )}

        {/* No search results */}
        {!loading && filteredComplaints.length === 0 && searchQuery.length > 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
            <Search size={48} color="#D1D5DB" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>No complaints found</p>
            <p style={{ fontSize: '14px', color: '#9CA3AF' }}>No complaints match "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              style={{ marginTop: '16px', padding: '8px 20px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Cards */}
        {!loading && filteredComplaints.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {filteredComplaints.map((c, i) => (
              <div
                key={c.id}
                onClick={() => navigate(`/complaint/${c.id}`)}
                className="bg-card rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden cursor-pointer"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Image */}
                <div className="relative h-40 bg-muted">
                  {c.imageUrl && !c.imageUrl.includes('placehold.co') ? (
                    <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <span className="text-muted-foreground/30 text-4xl font-bold">📷</span>
                    </div>
                  )}
                  <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${STATUS_STYLES[c.status] || STATUS_STYLES.pending}`}>
                    {(c.status || 'pending').replace('_', ' ')}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 space-y-2.5">
                  <h3 className="font-bold text-foreground text-sm line-clamp-1">{c.title}</h3>
                  <p className="text-muted-foreground text-xs line-clamp-2">{c.description}</p>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-md bg-muted font-medium">{c.category}</span>
                    {c.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {c.location}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {getRelativeTime(c.createdAt ? (typeof c.createdAt?.toDate === 'function' ? c.createdAt.toDate() : new Date(c.createdAt)) : undefined)}
                    </div>

                    <div className="flex items-center gap-3">
                      {c.isEndorsed && user?.role === 'student' && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Shield className="w-3.5 h-3.5" />
                          Endorsed
                        </span>
                      )}
                      <button
                        onClick={(e) => handleUpvote(e, c)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          (c.upvotes || []).includes(user?.id)
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground hover:bg-primary/5'
                        }`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{c.upvoteCount || 0}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Feed;
