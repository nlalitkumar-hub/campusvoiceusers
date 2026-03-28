import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, MessageSquare, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getLevel, getPreviousThreshold } from '@/lib/gamification';
import BottomNav from '@/components/BottomNav';

const Profile: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const savedUser = JSON.parse(localStorage.getItem('campusvoice_user') || '{}');
        const userEmail = savedUser.email || savedUser.id || user?.email || user?.id || '';
        const token = localStorage.getItem('token') || '';
        if (token && !token.startsWith('firebase_') && token.length > 20) {
          try {
            const res = await fetch('http://localhost:5000/api/profile', {
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            if (res.ok) {
              const data = await res.json();
              const u = data.data?.user || data.user;
              if (u) {
                setUserData(u);
                localStorage.setItem('campusvoice_user', JSON.stringify({ ...savedUser, ...u }));
                updateUser({ points: u.points ?? 0, badges: u.badges ?? [] });
                setLoading(false); return;
              }
            }
          } catch {}
        }
        if (!userEmail) { setUserData(savedUser); setLoading(false); return; }
        const { db } = await import('../lib/firebase');
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', userEmail));
        if (userDoc.exists()) {
          const freshUser = { id: userDoc.id, ...userDoc.data() } as any;
          setUserData(freshUser);
          updateUser({ points: freshUser.points ?? 0, badges: freshUser.badges ?? [] });
          localStorage.setItem('campusvoice_user', JSON.stringify({ ...savedUser, ...freshUser }));
        } else {
          setUserData(savedUser);
        }
      } catch {
        const saved = localStorage.getItem('campusvoice_user');
        if (saved) setUserData(JSON.parse(saved));
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  if (!user) return null;

  const points = userData?.points ?? user.points ?? 0;
  const levelInfo = getLevel(points);
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url(/campus-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: -2 }} />
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.85)', zIndex: -1 }} />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Sticky header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-16 max-w-md mx-auto">
          <div className="w-10" />
          <h1 className="text-xl font-bold text-purple-600">CampusVoice</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="w-full max-w-md mx-auto px-6 pt-8 space-y-6">
        {/* Profile header */}
        <section className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-extrabold border-4 border-white shadow-lg"
              style={{ background: '#7C3AED' }}
            >
              {initials}
            </div>
            {/* Verified badge */}
            <div
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white"
              style={{ background: '#7C3AED' }}
            >
              <span className="text-white text-xs font-bold">✓</span>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{user.name}</h2>
            <p className="text-gray-500 font-medium text-sm mt-0.5">{user.collegeId}</p>
          </div>
        </section>

        {/* Campus Merit card */}
        <section
          className="rounded-2xl p-6 shadow-md relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #630ed4)' }}
        >
          {/* Background decoration */}
          <div className="absolute -right-6 -top-6 opacity-20 transform rotate-12 text-9xl select-none">🏅</div>

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Badge */}
            <div className="bg-white/20 px-4 py-1 rounded-full mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white">Campus Merit</span>
            </div>

            {/* Points */}
            <h3 className="text-4xl font-extrabold text-white mb-1">
              {points} <span className="text-xl font-normal">pts</span>
            </h3>
            <p className="text-sm font-semibold text-white mb-5">Total Points</p>

            {/* Mini stat chips */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center backdrop-blur-sm border border-white/10">
                <span className="text-xs font-bold text-white">+15</span>
                <span className="text-[10px] text-white/90 leading-tight mt-0.5">For raising</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center backdrop-blur-sm border border-white/10">
                <span className="text-xs font-bold text-white">+1</span>
                <span className="text-[10px] text-white/90 leading-tight mt-0.5">For upvote</span>
              </div>
            </div>
          </div>
        </section>

        {/* Activities & Support section */}
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-3">
            Activities &amp; Support
          </h4>

          <div className="space-y-3">
            {/* My Complaints */}
            <button
              onClick={() => navigate('/my-complaints')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <MessageSquare size={18} />
                </div>
                <span className="font-semibold text-gray-900">My Complaints</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>

            {/* Contact Us */}
            <button
              className="w-full flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Mail size={18} />
                </div>
                <span className="font-semibold text-gray-900">Contact Us</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>

            {/* Log Out */}
            <button
              onClick={() => setShowLogout(true)}
              className="w-full flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                  <LogOut size={18} />
                </div>
                <span className="font-semibold text-red-500">Log Out</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-300 font-medium pb-4">
          CampusVoice v1.0
        </p>
      </main>

      {/* Logout confirmation modal */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Logout?</h3>
            <p className="text-sm text-gray-500">Are you sure you want to logout?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={logout}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
      </div>
    </div>
  );
};

export default Profile;
