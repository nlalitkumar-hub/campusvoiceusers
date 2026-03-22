import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getLeaderboard } from '@/lib/firestore';
import { getLeaderboardAPI } from '@/lib/api';
import { getLevel } from '@/lib/gamification';
import BottomNav from '@/components/BottomNav';

const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let data: any[];
        try {
          const res = await getLeaderboardAPI();
          data = res.data || res;
        } catch {
          data = await getLeaderboard();
        }
        setLeaders(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const top3 = leaders.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumIcons = [Medal, Trophy, Award];
  const podiumColors = ['text-muted-foreground', 'text-cv-amber', 'text-cv-amber/60'];
  const podiumSizes = ['w-16 h-16', 'w-20 h-20', 'w-16 h-16'];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Campus Champions</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="flex justify-center gap-4 items-end">
              {[1, 2, 3].map(i => <div key={i} className="w-20 h-28 bg-card rounded-2xl shadow-card" />)}
            </div>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-card rounded-2xl shadow-card" />)}
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No champions yet</p>
            <p className="text-muted-foreground text-sm mt-1">Start raising complaints to earn points!</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 3 && (
              <div className="flex justify-center items-end gap-3 pt-6 pb-4">
                {podiumOrder.map((l, i) => {
                  const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                  const Icon = podiumIcons[i];
                  const initials = (l.name || l.id || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                  const level = getLevel(l.points || 0);
                  return (
                    <div key={l.id} className={`flex flex-col items-center gap-2 ${i === 1 ? '-mt-6' : ''}`}>
                      <Icon className={`w-6 h-6 ${podiumColors[i]}`} />
                      <div className={`${podiumSizes[i]} rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-extrabold`}>
                        {initials}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-foreground truncate max-w-[80px]">{l.name || l.id}</p>
                        <p className="text-lg font-extrabold text-primary tabular-nums">{l.points || 0}</p>
                        <p className="text-[10px] text-muted-foreground">{level.title}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-muted text-xs font-bold text-muted-foreground">#{rank}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full Table */}
            <div className="bg-card rounded-2xl shadow-card overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_auto_auto_auto] gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground border-b border-border">
                <span>#</span>
                <span>Name</span>
                <span>Level</span>
                <span>Points</span>
                <span>Badges</span>
              </div>
              {leaders.map((l, i) => {
                const isMe = l.id === user?.id;
                const level = getLevel(l.points || 0);
                return (
                  <div
                    key={l.id}
                    className={`grid grid-cols-[40px_1fr_auto_auto_auto] gap-2 px-4 py-3 items-center text-sm ${
                      isMe ? 'bg-primary/5' : ''
                    } ${i < leaders.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <span className="font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{l.name || l.id}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{l.institute || ''}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold whitespace-nowrap">
                      Lv.{level.level}
                    </span>
                    <span className="font-bold text-foreground tabular-nums">{l.points || 0}</span>
                    <span className="text-xs tabular-nums">{(l.badges || []).length}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Leaderboard;
