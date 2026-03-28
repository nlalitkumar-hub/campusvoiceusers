import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getLeaderboard } from '@/lib/firestore';
import { getLeaderboardAPI } from '@/lib/api';
import { getLevel } from '@/lib/gamification';
import BottomNav from '@/components/BottomNav';

const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        let data: any[];
        try { const res = await getLeaderboardAPI(); data = res.data || res; }
        catch { data = await getLeaderboard(); }
        setLeaders(data);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const top3 = leaders.slice(0, 3);
  // podium order: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const podiumConfig = [
    {
      rank: 2,
      height: 'h-20',
      avatarSize: 'w-16 h-16',
      gradient: 'linear-gradient(180deg, #E1E3E4 0%, #D9DADB 100%)',
      badge: '2nd',
      badgeBg: '#e7e8e9',
      badgeText: '#191c1d',
      translate: '',
      borderColor: '#D1D5DB',
    },
    {
      rank: 1,
      height: 'h-32',
      avatarSize: 'w-20 h-20',
      gradient: 'linear-gradient(180deg, #7C3AED 0%, #630ED4 100%)',
      badge: '1st',
      badgeBg: '#7C3AED',
      badgeText: 'white',
      translate: '-translate-y-4',
      borderColor: '#7C3AED',
    },
    {
      rank: 3,
      height: 'h-16',
      avatarSize: 'w-14 h-14',
      gradient: 'linear-gradient(180deg, #FFDCC6 0%, #FFB784 100%)',
      badge: '3rd',
      badgeBg: '#ffdcc6',
      badgeText: '#301400',
      translate: '',
      borderColor: '#FCD34D',
    },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url(/campus-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: -2 }} />
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.85)', zIndex: -1 }} />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-purple-700">Campus Voice</h1>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell size={22} className="text-purple-700" />
        </button>
      </header>

      <div className="px-6 pt-6 pb-6 max-w-2xl mx-auto">
        {/* Editorial header */}
        <section className="mb-10">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-purple-600/60 mb-2 block">
            Voice Rankings
          </span>
          <h2 className="text-4xl font-black tracking-tighter text-gray-900 leading-none">
            Campus Leaderboard
          </h2>
          <p className="mt-3 text-gray-500 leading-relaxed text-sm max-w-md opacity-80">
            Celebrating the most active advocates driving change across our academic community this semester.
          </p>
        </section>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="flex justify-center gap-4 items-end h-48">
              {[1, 2, 3].map(i => <div key={i} className="w-24 h-32 bg-white rounded-2xl" />)}
            </div>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-white rounded-2xl" />)}
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No champions yet</p>
            <p className="text-gray-400 text-sm mt-1">Start raising complaints to earn points!</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 3 && (
              <section className="relative flex items-end justify-center gap-4 mb-14 pt-10">
                {podiumOrder.map((l, i) => {
                  const cfg = podiumConfig[i];
                  const initials = (l.name || l.id || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <div key={l.id} className={`flex flex-col items-center flex-1 max-w-[110px] ${cfg.translate}`}>
                      <div className="relative mb-3">
                        {cfg.rank === 1 && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500 text-3xl animate-pulse">
                            👑
                          </div>
                        )}
                        <div
                          className={`${cfg.avatarSize} rounded-full flex items-center justify-center text-lg font-extrabold shadow-lg`}
                          style={{
                            background: cfg.rank === 1 ? '#F5F3FF' : cfg.rank === 2 ? '#F3F4F6' : '#FFF7ED',
                            color: cfg.rank === 1 ? '#7C3AED' : cfg.rank === 2 ? '#374151' : '#92400E',
                            border: `4px solid ${cfg.borderColor}`,
                          }}
                        >
                          {initials}
                        </div>
                        <div
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full shadow-sm whitespace-nowrap"
                          style={{ background: cfg.badgeBg, color: cfg.badgeText }}
                        >
                          {cfg.badge}
                        </div>
                      </div>
                      <div
                        className={`w-full ${cfg.height} rounded-t-2xl flex flex-col items-center justify-end pb-3 shadow-inner`}
                        style={{ background: cfg.gradient }}
                      >
                        <span className="font-black text-2xl opacity-20 text-white">{cfg.rank}</span>
                      </div>
                      <p className="mt-2 text-xs font-bold truncate w-full text-center text-gray-900">
                        {l.name || l.id}
                      </p>
                      <div
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium mt-1"
                        style={{
                          background: cfg.rank === 1 ? '#F5F3FF' : '#e7e8e9',
                          color: cfg.rank === 1 ? '#7C3AED' : '#4a4455',
                        }}
                      >
                        {l.points || 0} pts
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4 px-2 py-3 mb-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rising Voices</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Full ranked list */}
            <div className="space-y-3">
              {leaders.map((l, i) => {
                const isMe = l.id === user?.id;
                const level = getLevel(l.points || 0);
                const initials = (l.name || l.id || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <div
                    key={l.id}
                    className="p-4 rounded-2xl flex items-center gap-4 transition-all active:scale-95"
                    style={{
                      background: isMe ? '#F5F3FF' : 'white',
                      boxShadow: isMe ? '0 2px 8px rgba(124,58,237,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Rank */}
                    <div
                      className="w-8 flex justify-center font-black text-lg italic shrink-0"
                      style={{ color: isMe ? '#7C3AED' : '#4a4455' }}
                    >
                      {i + 1}
                    </div>

                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0"
                      style={{ background: '#F5F3FF', color: '#7C3AED' }}
                    >
                      {initials}
                    </div>

                    {/* Name + level */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 truncate">{l.name || l.id}</span>
                        {isMe && (
                          <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-lg font-bold mt-1 inline-block"
                        style={{ background: isMe ? '#ede9fe' : '#e7e8e9', color: isMe ? '#7C3AED' : '#4a4455' }}
                      >
                        Lv.{level.level} {level.title}
                      </span>
                    </div>

                    {/* Points */}
                    <div className="text-right shrink-0">
                      <p className="font-black text-lg text-purple-600">{l.points || 0}</p>
                      <p className="text-[10px] uppercase tracking-widest font-medium text-purple-600/60">Points</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <BottomNav />
      </div>
    </div>
  );
};

export default Leaderboard;
