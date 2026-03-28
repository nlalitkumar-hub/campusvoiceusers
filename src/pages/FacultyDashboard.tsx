import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';

interface Stats {
  endorsedCount: number;
  endorsedResolved: number;
  awaitingReview: number;
  raisedByMe: number;
}

interface DeptStats {
  total: number;
  resolved: number;
  inProgress: number;
  pending: number;
  resolutionRate: number;
}

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: '#FEF3C7', color: '#D97706', label: 'Pending' },
  in_progress: { bg: '#EFF6FF', color: '#3B82F6', label: 'In Progress' },
  resolved:    { bg: '#D1FAE5', color: '#059669', label: 'Resolved' },
  rejected:    { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
};

const daysSince = (val: any): number => {
  if (!val) return 0;
  const d = val?.toDate ? val.toDate() : new Date(val);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ endorsedCount: 0, endorsedResolved: 0, awaitingReview: 0, raisedByMe: 0 });
  const [endorsedComplaints, setEndorsedComplaints] = useState<any[]>([]);
  const [pendingReview, setPendingReview] = useState<any[]>([]);
  const [deptStats, setDeptStats] = useState<DeptStats>({ total: 0, resolved: 0, inProgress: 0, pending: 0, resolutionRate: 0 });
  const [endorsedTab, setEndorsedTab] = useState<'all' | 'resolved' | 'pending' | 'in_progress'>('all');

  const loadFacultyDashboard = async () => {
    setLoading(true);
    try {
      // Try backend first
      const token = localStorage.getItem('token') || '';
      if (token && !token.startsWith('firebase_')) {
        try {
          const response = await fetch('http://localhost:5000/api/faculty/dashboard', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (response.ok) {
            const data = await response.json();
            const d = data.data;
            setStats({
              endorsedCount: d.stats.endorsedCount,
              endorsedResolved: d.stats.endorsedResolved,
              awaitingReview: d.stats.awaitingReview,
              raisedByMe: d.stats.raisedByFaculty
            });
            setEndorsedComplaints(d.endorsedComplaints);
            setPendingReview(d.awaitingReview);
            setDeptStats(d.departmentStats);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('Backend unavailable, using Firebase');
        }
      }

      // Firebase fallback
      const savedUser = JSON.parse(localStorage.getItem('campusvoice_user') || '{}');
      const userEmail = savedUser.email || savedUser.id || user?.email || user?.id || '';
      const userInstitute = savedUser.institute || user?.institute || '';
      const { db } = await import('../lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');

      const allSnap = await getDocs(collection(db, 'complaints'));
      const all = allSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      const endorsed = all.filter(c => c.endorsedBy === userEmail);
      const endorsedResolved = endorsed.filter(c => c.status === 'resolved');
      const institutePending = all
        .filter(c => c.institute === userInstitute && (c.status === 'pending' || c.status === 'in_progress'))
        .sort((a, b) => {
          if (a.isEndorsed !== b.isEndorsed) return a.isEndorsed ? -1 : 1;
          return (b.upvoteCount || 0) - (a.upvoteCount || 0);
        });
      const raisedByMe = all.filter(c => c.submittedBy === userEmail);
      const instituteAll = all.filter(c => c.institute === userInstitute);

      const total = instituteAll.length;
      const resolved = instituteAll.filter(c => c.status === 'resolved').length;
      const inProgress = instituteAll.filter(c => c.status === 'in_progress').length;
      const pending = instituteAll.filter(c => c.status === 'pending').length;

      setStats({ endorsedCount: endorsed.length, endorsedResolved: endorsedResolved.length, awaitingReview: institutePending.length, raisedByMe: raisedByMe.length });
      setEndorsedComplaints(endorsed);
      setPendingReview(institutePending);
      setDeptStats({ total, resolved, inProgress, pending, resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0 });
    } catch (err: any) {
      console.error('Faculty dashboard error:', err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadFacultyDashboard(); }, []);

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'F';

  const filteredEndorsed = endorsedTab === 'all'
    ? endorsedComplaints
    : endorsedComplaints.filter(c => c.status === endorsedTab);

  const kpis = [
    { icon: '⭐', label: 'Complaints Endorsed', value: stats.endorsedCount, color: '#7C3AED', bg: '#EDE9FE' },
    { icon: '✅', label: 'Endorsements Resolved', value: stats.endorsedResolved, color: '#10B981', bg: '#D1FAE5' },
    { icon: '🔍', label: 'Awaiting Review', value: stats.awaitingReview, color: '#F59E0B', bg: '#FEF3C7' },
    { icon: '📢', label: 'Raised by You', value: stats.raisedByMe, color: '#3B82F6', bg: '#EFF6FF' },
  ];

  const ComplaintRow = ({ c, showEndorse }: { c: any; showEndorse?: boolean }) => {
    const pill = STATUS_PILL[c.status] || STATUS_PILL.pending;
    const days = daysSince(c.createdAt);
    const img = c.imageUrl && !c.imageUrl.includes('placehold.co') ? c.imageUrl : c.imageData || null;
    return (
      <div
        onClick={() => navigate(`/complaint/${c.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
      >
        <div style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', background: '#F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <span style={{ fontSize: 24, opacity: 0.3 }}>📷</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ background: pill.bg, color: pill.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pill.label}</span>
            {c.category && <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{c.category}</span>}
            {days > 5 && <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 600 }}>{days}d ago</span>}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {showEndorse
            ? c.isEndorsed
              ? <span style={{ background: '#FCD34D', color: '#78350F', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>Endorsed ✓</span>
              : <span style={{ background: '#7C3AED', color: 'white', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>Endorse</span>
            : <span style={{ background: '#FCD34D', color: '#78350F', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>Endorsed ✓</span>
          }
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh' }}>
        <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/campus-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: -2 }} />
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: -1 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Backgrounds */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/campus-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: -2 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: -1 }} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: 80 }}>
        {/* Navbar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 64, maxWidth: 600, margin: '0 auto' }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#7C3AED' }}>CampusVoice</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Faculty Dashboard</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bell size={20} color="#6B7280" />
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#7C3AED', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{initials}</div>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 0' }}>

          {/* Welcome card */}
          <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#111827' }}>Welcome, {user?.name}</div>
            <div style={{ color: '#6B7280', fontSize: 14, marginTop: 2 }}>Faculty Dashboard</div>
            {user?.institute && (
              <span style={{ display: 'inline-block', marginTop: 10, background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{user.institute}</span>
            )}
          </div>

          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Endorsed complaints */}
          <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 14 }}>Your Endorsed Complaints</div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {(['all', 'resolved', 'pending', 'in_progress'] as const).map(tab => (
                <button key={tab} onClick={() => setEndorsedTab(tab)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: endorsedTab === tab ? '#7C3AED' : '#F3F4F6', color: endorsedTab === tab ? 'white' : '#6B7280' }}>
                  {tab === 'in_progress' ? 'In Progress' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {filteredEndorsed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⭐</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>No endorsed complaints yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Endorse complaints to boost their priority</div>
              </div>
            ) : (
              filteredEndorsed.map(c => <ComplaintRow key={c.id} c={c} />)
            )}
          </div>

          {/* Pending review */}
          <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 4 }}>Complaints Needing Attention</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Unresolved complaints in your institute</div>
            {pendingReview.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>All caught up!</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>No pending complaints in your institute</div>
              </div>
            ) : (
              pendingReview.map(c => <ComplaintRow key={c.id} c={c} showEndorse />)
            )}
          </div>

          {/* Department stats */}
          <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 16 }}>Department Statistics</div>
            {/* Resolution rate */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#7C3AED', lineHeight: 1 }}>{deptStats.resolutionRate}%</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>of complaints resolved</div>
            </div>
            {[
              { label: 'Resolved', value: deptStats.resolved, color: '#10B981', bg: '#D1FAE5' },
              { label: 'In Progress', value: deptStats.inProgress, color: '#3B82F6', bg: '#EFF6FF' },
              { label: 'Pending', value: deptStats.pending, color: '#F59E0B', bg: '#FEF3C7' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
                <div style={{ height: 8, borderRadius: 8, background: item.bg, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 8, background: item.color, width: `${deptStats.total > 0 ? Math.round((item.value / deptStats.total) * 100) : 0}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>

        </div>

        <BottomNav />
      </div>
    </div>
  );
};

export default FacultyDashboard;
