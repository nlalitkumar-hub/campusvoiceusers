import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, ChevronRight, Award, Zap, MessageSquare, Star, HelpCircle, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getLevel, getPreviousThreshold, ALL_BADGES } from '@/lib/gamification';
import BottomNav from '@/components/BottomNav';

const Profile: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const savedUser = JSON.parse(localStorage.getItem('campusvoice_user') || '{}');
        const userEmail = savedUser.email || savedUser.id || user?.email || user?.id || '';
        const token = localStorage.getItem('token') || '';

        // Try backend API first
        if (token && !token.startsWith('firebase_') && token.length > 20) {
          try {
            const response = await fetch('http://localhost:5000/api/profile', {
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            if (response.ok) {
              const data = await response.json();
              const u = data.data?.user || data.user;
              const s = data.data?.stats || data.stats;
              if (u) {
                setUserData(u);
                if (s) setStats(s);
                localStorage.setItem('campusvoice_user', JSON.stringify({ ...savedUser, ...u }));
                updateUser({ points: u.points ?? 0, badges: u.badges ?? [] });
                setLoading(false);
                return;
              }
            }
          } catch {
            // backend unavailable, falling back to Firebase
          }
        }

        // Firebase direct fallback
        if (!userEmail) {
          setUserData(savedUser);
          setLoading(false);
          return;
        }

        const { db } = await import('../lib/firebase');
        const { getDoc, doc, collection, query, where, getDocs } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', userEmail));
        if (userDoc.exists()) {
          const freshUser = { id: userDoc.id, ...userDoc.data() } as any;
          setUserData(freshUser);
          updateUser({ points: freshUser.points ?? 0, badges: freshUser.badges ?? [] });
          localStorage.setItem('campusvoice_user', JSON.stringify({ ...savedUser, ...freshUser }));

          const snap = await getDocs(query(collection(db, 'complaints'), where('submittedBy', '==', userEmail)));
          const userComplaints = snap.docs.map(d => d.data());
          setStats({
            totalComplaints: userComplaints.length,
            resolvedComplaints: userComplaints.filter(c => c.status === 'resolved').length,
            pendingRatings: userComplaints.filter(c => c.status === 'resolved' && !c.satisfactionRating).length,
            overdueComplaints: userComplaints.filter(c => c.isOverdue).length,
          });
        }
      } catch (error: any) {
        console.error('Profile error:', error.message);
        const saved = localStorage.getItem('campusvoice_user');
        if (saved) setUserData(JSON.parse(saved));
      }
      setLoading(false);
    };
    loadProfile();
  }, [user?.id]);

  if (!user) return null;

  const points = userData?.points ?? user.points ?? 0;
  const levelInfo = getLevel(points);
  const prevThreshold = getPreviousThreshold(levelInfo.level);
  const progress = levelInfo.nextThreshold > prevThreshold
    ? ((points - prevThreshold) / (levelInfo.nextThreshold - prevThreshold)) * 100
    : 100;
  const badges = userData?.badges ?? user.badges ?? [];
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const menuItems = [
    { label: 'My Complaints', icon: MessageSquare, path: '/my-complaints' },
    { label: 'Leaderboard', icon: Award, path: '/leaderboard' },
    { label: 'Analytics', icon: Zap, path: '/analytics' },
    { label: 'Help & FAQ', icon: HelpCircle, path: '#' },
    { label: 'About', icon: Info, path: '#' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Profile</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6 animate-fade-in">
        {/* Avatar */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-extrabold mx-auto">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
              user.role === 'student' ? 'bg-cv-blue/10 text-cv-blue' : 'bg-primary/10 text-primary'
            }`}>
              {user.role === 'student' ? '🎓 Student' : '👨‍🏫 Faculty'}
            </span>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{user.institute}</p>
            <p className="flex items-center justify-center gap-1">{user.email} ✅</p>
          </div>
        </div>

        {/* Points & Level */}
        <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
          <div className="text-center">
            <p className="text-4xl font-extrabold text-primary tabular-nums">{points}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Points</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 20 }}>
                🎯 {stats?.totalComplaints ?? userData?.complaintsRaised ?? 0} Complaints
              </span>
              <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 20 }}>
                ✅ {stats?.resolvedComplaints ?? userData?.complaintsResolved ?? 0} Resolved
              </span>
              <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 20 }}>
                ⬆️ {userData?.upvotesGiven ?? 0} Upvotes
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-sm font-bold">
              Level {userData?.level ?? levelInfo.level} — {userData?.levelTitle ?? levelInfo.title}
            </span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{points} XP</span>
              <span>{levelInfo.nextThreshold} XP</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
          <h3 className="font-bold text-foreground">Badges</h3>
          <div className="grid grid-cols-3 gap-3">
            {ALL_BADGES.map(badge => {
              const earned = badges.includes(badge.id);
              return (
                <div key={badge.id} className={`p-3 rounded-xl text-center space-y-1 ${earned ? 'bg-primary/5' : 'bg-muted opacity-50'}`}>
                  <span className="text-2xl">{badge.icon}</span>
                  <p className="text-xs font-medium text-foreground">{badge.name}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Raised', value: stats?.totalComplaints ?? userData?.complaintsRaised ?? 0 },
            { label: 'Resolved', value: stats?.resolvedComplaints ?? userData?.complaintsResolved ?? 0 },
            { label: 'Upvotes', value: userData?.upvotesGiven ?? 0 },
            { label: 'Points', value: points },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-2xl shadow-card p-3 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{s.value}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          {menuItems.map((item, i) => (
            <button
              key={item.label}
              onClick={() => item.path !== '#' && navigate(item.path)}
              className={`w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-foreground hover:bg-muted transition-colors ${
                i < menuItems.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                {item.label}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={() => setShowLogout(true)}
          className="w-full py-3.5 rounded-2xl text-destructive font-bold text-sm hover:bg-destructive/5 transition-colors"
        >
          <span className="flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </span>
        </button>

        {showLogout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
            <div className="bg-card rounded-2xl shadow-card-hover p-6 max-w-sm w-full space-y-4 animate-scale-in">
              <h3 className="text-lg font-bold text-foreground">Logout?</h3>
              <p className="text-sm text-muted-foreground">Are you sure you want to logout?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowLogout(false)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium">Cancel</button>
                <button onClick={logout} className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-medium">Logout</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
