import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/context/AuthContext';

const Analytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'campus'>('personal');
  const [totals, setTotals] = useState({ total: 0, resolved: 0, inProgress: 0, pending: 0, rejected: 0 });
  const [weeklyTrends, setWeeklyTrends] = useState<any[]>([]);
  const [departmentPerformance, setDepartmentPerformance] = useState<any[]>([]);

  // Personal analytics state
  const [personalData, setPersonalData] = useState<any>(null);
  const [personalLoading, setPersonalLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (token && !token.startsWith('firebase_')) {
          const res = await fetch('http://localhost:5000/api/analytics/summary', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            const a = data.data || data;
            const t = a.totals || {};
            setTotals({ total: t.total || 0, resolved: t.resolved || 0, inProgress: t.inProgress || 0, pending: t.pending || 0, rejected: t.rejected || 0 });
            setWeeklyTrends(a.weeklyTrends || []);
            setDepartmentPerformance(a.departmentPerformance || []);
            setLoading(false); return;
          }
        }
        const { db } = await import('../lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'complaints'));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const total = all.length,
          resolved = all.filter(c => c.status === 'resolved').length,
          inProgress = all.filter(c => c.status === 'in_progress').length,
          pending = all.filter(c => c.status === 'pending').length,
          rejected = all.filter(c => c.status === 'rejected').length;
        setTotals({ total, resolved, inProgress, pending, rejected });
        const now = new Date();
        setWeeklyTrends(Array.from({ length: 6 }, (_, i) => {
          const ws = new Date(now); ws.setDate(now.getDate() - (5 - i) * 7);
          const we = new Date(ws); we.setDate(ws.getDate() + 7);
          const submitted = all.filter(c => {
            const d = c.createdAt?.toDate?.() || (c.createdAt ? new Date(c.createdAt) : null);
            return d && d >= ws && d < we;
          }).length;
          const weekResolved = all.filter(c => {
            if (c.status !== 'resolved') return false;
            const d = c.resolvedAt?.toDate?.() || (c.resolvedAt ? new Date(c.resolvedAt) : null) || c.createdAt?.toDate?.() || (c.createdAt ? new Date(c.createdAt) : null);
            return d && d >= ws && d < we;
          }).length;
          return { week: `W${i + 1}`, submitted, resolved: weekResolved };
        }));
        const deptMap: Record<string, string> = { Infrastructure: 'Facilities', Safety: 'Security', Technology: 'IT', Academic: 'Academic', Health: 'Health', Hygiene: 'Facilities', Other: 'Other' };
        const depts = ['Security', 'IT', 'Facilities', 'Academic', 'Health'];
        setDepartmentPerformance(depts.map(dept => {
          const dc = all.filter(c => deptMap[c.category] === dept);
          return { name: dept, resolved: dc.filter(c => c.status === 'resolved').length, pending: dc.filter(c => c.status !== 'resolved').length };
        }));
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const resolutionRate = totals.total > 0 ? Math.round((totals.resolved / totals.total) * 100) : 0;

  // Fetch personal analytics
  useEffect(() => {
    const loadPersonal = async () => {
      setPersonalLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (token && !token.startsWith('firebase_')) {
          const res = await fetch('http://localhost:5000/api/analytics/personal', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            setPersonalData(data.data || data);
            setPersonalLoading(false);
            return;
          }
        }
        // Firebase fallback
        const { db: firestoreDb } = await import('../lib/firebase');
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const userEmail = user?.email || user?.id || '';
        if (!userEmail) { setPersonalLoading(false); return; }
        const snap = await getDocs(query(collection(firestoreDb, 'complaints'), where('submittedBy', '==', userEmail)));
        const complaints = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const totalRaised = complaints.length;
        const resolved = complaints.filter(c => c.status === 'resolved').length;
        const inProgress = complaints.filter(c => c.status === 'in_progress').length;
        const pending = complaints.filter(c => c.status === 'pending').length;
        const rejected = complaints.filter(c => c.status === 'rejected').length;
        const catMap: Record<string, number> = {};
        complaints.forEach(c => { const cat = c.category || 'Other'; catMap[cat] = (catMap[cat] || 0) + 1; });
        const categoryBreakdown = Object.entries(catMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
        const now = new Date();
        const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now); d.setMonth(now.getMonth() - (5 - i));
          const monthName = d.toLocaleString('default', { month: 'short' });
          const count = complaints.filter(c => {
            const cd = c.createdAt?.toDate?.() || (c.createdAt ? new Date(c.createdAt) : null);
            return cd && cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
          }).length;
          return { month: monthName, count };
        });
        setPersonalData({
          totalRaised, resolved, inProgress, pending, rejected,
          resolutionRate: totalRaised > 0 ? Math.round((resolved / totalRaised) * 100) : 0,
          categoryBreakdown,
          statusDistribution: [
            { status: 'Pending', count: pending, color: '#F59E0B' },
            { status: 'In Progress', count: inProgress, color: '#3B82F6' },
            { status: 'Resolved', count: resolved, color: '#10B981' },
            { status: 'Rejected', count: rejected, color: '#EF4444' },
          ],
          monthlyTrend,
        });
      } catch {}
      setPersonalLoading(false);
    };
    loadPersonal();
  }, [user?.id]);

  const kpis = [
    { label: 'Total Raised', value: totals.total, color: '#7C3AED', trend: '+12% vs last month', trendColor: '#10B981', icon: '📈' },
    { label: 'Resolved', value: totals.resolved, color: '#8127cf', trend: 'On track', trendColor: '#6B7280', icon: '✅' },
    { label: 'In Progress', value: totals.inProgress, color: '#7c3aed', trend: 'Active now', trendColor: '#6B7280', icon: '⏳' },
    { label: 'Pending', value: totals.pending, color: '#7b7487', trend: 'Requires Attention', trendColor: '#EF4444', icon: '⚠️' },
  ];

  const statusItems = [
    { label: 'Pending', value: totals.pending, color: '#F59E0B', bg: '#FEF3C7' },
    { label: 'In Progress', value: totals.inProgress, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Resolved', value: totals.resolved, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Rejected', value: totals.rejected, color: '#EF4444', bg: '#FEF2F2' },
  ];

  if (loading) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', width: '100%' }}>
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url(/campus-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: -2 }} />
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.85)', zIndex: -1 }} />
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '80px' }}>
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-sm px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-black text-purple-700 italic tracking-tight">Campus Voice</h1>
          <Bell size={22} className="text-gray-500" />
        </header>
        <div className="px-4 pt-6 space-y-4 animate-pulse">
          <div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-[2rem]" />)}</div>
          <div className="h-64 bg-white rounded-[2.5rem]" />
        </div>
        <BottomNav />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url(/campus-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: -2 }} />
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.85)', zIndex: -1 }} />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Sticky header — bell only */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-purple-700 tracking-tight">Campus Voice</h1>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell size={22} className="text-gray-500" />
        </button>
      </header>

      <div className="px-4 pt-6 pb-6 space-y-8 max-w-2xl mx-auto">
        {/* Editorial header */}
        <section>
          <h2 className="font-extrabold tracking-tight text-gray-900 leading-none" style={{ fontSize: '2.25rem' }}>
            Insights &amp; Metrics
          </h2>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-md">
            Detailed breakdown of campus feedback performance and personal advocacy impact.
          </p>
        </section>

        {/* Tab switcher */}
        <div className="flex p-1.5 bg-gray-100 rounded-2xl w-full max-w-xs shadow-sm">
          <button
            onClick={() => setActiveTab('personal')}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeTab === 'personal' ? 'white' : 'transparent',
              color: activeTab === 'personal' ? '#7C3AED' : '#6B7280',
              boxShadow: activeTab === 'personal' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Personal
          </button>
          <button
            onClick={() => setActiveTab('campus')}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeTab === 'campus' ? 'white' : 'transparent',
              color: activeTab === 'campus' ? '#7C3AED' : '#6B7280',
              boxShadow: activeTab === 'campus' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Campus
          </button>
        </div>

        {/* KPI Cards 2x2 grid */}
        {activeTab === 'campus' && (<>
        <div className="grid grid-cols-2 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{k.label}</p>
              <h3 className="text-4xl font-black" style={{ color: k.color }}>{k.value}</h3>
              <div className="mt-3 flex items-center text-xs font-bold" style={{ color: k.trendColor }}>
                <span>{k.trend}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Resolution Rate Card */}
        <div
          className="p-8 rounded-[2.5rem] flex flex-col justify-between overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, #630ed4, #7C3AED)',
            boxShadow: '0 20px 40px rgba(99,14,212,0.15)',
          }}
        >
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80 mb-1">Resolution Rate</p>
            <h4 className="text-7xl font-black text-white mb-4 tracking-tighter">{resolutionRate}%</h4>
            <div className="space-y-3">
              <p className="text-sm text-white/90 leading-relaxed font-light">
                Campus efficiency is at an all-time high this semester.
              </p>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.3)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${resolutionRate}%`, background: 'white', boxShadow: '0 0 12px rgba(255,255,255,0.8)' }}
                />
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full blur-3xl" style={{ background: 'rgba(124,58,237,0.3)' }} />
        </div>

        {/* Weekly Line Chart */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-bold text-gray-900">Weekly Performance</h4>
              <p className="text-xs text-gray-500 mt-0.5">Submitted vs Resolved Trends</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#7C3AED]" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Raised</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ddb7ff]" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Resolved</span>
              </div>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f5" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#7C3AED" strokeWidth={3} dot={{ r: 4, fill: '#7C3AED' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#ddb7ff" strokeDasharray="8 4" strokeWidth={3} dot={{ r: 4, fill: '#ddb7ff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
          <h4 className="font-bold text-gray-900 mb-6">Status Distribution</h4>
          {statusItems.map(item => (
            <div key={item.label} className="mb-4">
              <div className="flex justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs font-medium text-gray-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
                  <span className="text-[11px] text-gray-400">
                    {totals.total > 0 ? Math.round((item.value / totals.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: item.bg }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${totals.total > 0 ? Math.round((item.value / totals.total) * 100) : 0}%`,
                    background: item.color,
                  }}
                />
              </div>
            </div>
          ))}
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-500">Total Complaints</span>
            <span className="text-base font-bold text-gray-900">{totals.total}</span>
          </div>
        </div>

        {/* Department Bar Chart */}
        {departmentPerformance.length > 0 && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
            <h4 className="font-bold text-gray-900 mb-6">Frequency by Sector</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f5" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="resolved" name="Resolved" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" fill="#9c48ea" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        </> )} {/* end campus tab */}

        {/* PERSONAL TAB */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            {personalLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-2xl" />)}</div>
                <div className="h-40 bg-white rounded-2xl" />
                <div className="h-48 bg-white rounded-2xl" />
              </div>
            ) : !personalData || personalData.totalRaised === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-gray-500 font-semibold">No complaints raised yet</p>
                <p className="text-gray-400 text-sm mt-1">Start raising complaints to see your analytics</p>
              </div>
            ) : (
              <>
                {/* Personal KPI Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Raised', value: personalData.totalRaised, color: '#3B82F6', icon: '📋' },
                    { label: 'Resolved', value: personalData.resolved, color: '#10B981', icon: '✅' },
                    { label: 'In Progress', value: personalData.inProgress, color: '#F59E0B', icon: '🔄' },
                    { label: 'Pending', value: personalData.pending, color: '#F97316', icon: '⏳' },
                  ].map(k => (
                    <div key={k.label} className="bg-white p-5 rounded-2xl shadow-sm">
                      <p className="text-lg mb-1">{k.icon}</p>
                      <h3 className="text-4xl font-black" style={{ color: k.color }}>{k.value}</h3>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-1">{k.label}</p>
                    </div>
                  ))}
                </div>

                {/* Status Distribution Bar Chart */}
                <div className="bg-white p-5 rounded-2xl shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-4">My Complaint Status</h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={personalData.statusDistribution} barSize={40}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f5" />
                        <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#374151' }}>
                          {personalData.statusDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white p-5 rounded-2xl shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-4">Complaints by Category</h4>
                  {personalData.categoryBreakdown.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No data yet</p>
                  ) : (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={personalData.categoryBreakdown} layout="vertical" barSize={16}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f5" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#4a4455', fontSize: 11 }} width={80} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="count" fill="#7C3AED" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11, fill: '#374151' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

              </>
            )}
          </div>
        )}
      </div>

      <BottomNav />
      </div>
    </div>
  );
};

export default Analytics;
