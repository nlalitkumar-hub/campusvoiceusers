import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend
} from 'recharts';
import BottomNav from '@/components/BottomNav';

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, resolved: 0, inProgress: 0, pending: 0, rejected: 0 });
  const [weeklyTrends, setWeeklyTrends] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [departmentPerformance, setDepartmentPerformance] = useState<any[]>([]);

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (token && !token.startsWith('firebase_')) {
          const response = await fetch('http://localhost:5000/api/analytics/summary', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (response.ok) {
            const data = await response.json();
            const analytics = data.data || data;
            const t = analytics.totals || {};
            setTotals({
              total: t.total || 0,
              resolved: t.resolved || 0,
              inProgress: t.inProgress || 0,
              pending: t.pending || 0,
              rejected: t.rejected || 0,
            });
            setWeeklyTrends(analytics.weeklyTrends || []);
            setCategoryDistribution(analytics.categoryDistribution || []);
            setDepartmentPerformance(analytics.departmentPerformance || []);
            setLoading(false);
            return;
          }
        }

        // Fallback: calculate from Firebase directly
        const { db } = await import('../lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snapshot = await getDocs(collection(db, 'complaints'));
        const allComplaints = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const total = allComplaints.length;
        const resolved = allComplaints.filter(c => c.status === 'resolved').length;
        const inProgress = allComplaints.filter(c => c.status === 'in_progress').length;
        const pending = allComplaints.filter(c => c.status === 'pending').length;
        const rejected = allComplaints.filter(c => c.status === 'rejected').length;
        setTotals({ total, resolved, inProgress, pending, rejected });

        // Weekly trends — handle both Firestore Timestamps and ISO strings
        const now = new Date();
        const trends = Array.from({ length: 6 }, (_, i) => {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (5 - i) * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);

          const submitted = allComplaints.filter(c => {
            const d = c.createdAt?.toDate?.() || (c.createdAt ? new Date(c.createdAt) : null);
            return d && d >= weekStart && d < weekEnd;
          }).length;

          const weekResolved = allComplaints.filter(c => {
            if (c.status !== 'resolved') return false;
            const d = c.resolvedAt?.toDate?.() || (c.resolvedAt ? new Date(c.resolvedAt) : null)
              || c.createdAt?.toDate?.() || (c.createdAt ? new Date(c.createdAt) : null);
            return d && d >= weekStart && d < weekEnd;
          }).length;

          return { week: `Week ${i + 1}`, submitted, resolved: weekResolved };
        });
        setWeeklyTrends(trends);

        setCategoryDistribution([
          { name: 'Resolved', value: resolved, color: '#10B981' },
          { name: 'In Progress', value: inProgress, color: '#3B82F6' },
          { name: 'Rejected', value: rejected, color: '#EF4444' },
          { name: 'Pending', value: pending, color: '#F59E0B' },
        ]);

        const deptMap: Record<string, string> = {
          Infrastructure: 'Facilities', Safety: 'Security', Technology: 'IT Services',
          Academic: 'Academic', Health: 'Student Services', Hygiene: 'Facilities', Other: 'Student Services'
        };
        const depts = ['Security', 'IT Services', 'Facilities', 'Academic', 'Student Services'];
        setDepartmentPerformance(depts.map(dept => {
          const dc = allComplaints.filter(c => deptMap[c.category] === dept);
          return { department: dept, resolved: dc.filter(c => c.status === 'resolved').length, pending: dc.filter(c => c.status !== 'resolved').length };
        }));
      } catch (error: any) {
        console.error('Analytics error:', error.message);
      }
      setLoading(false);
    };
    loadAnalytics();
  }, []);

  const { total, resolved, inProgress, pending } = totals;

  // Department bar
  const deptData = departmentPerformance.length > 0
    ? departmentPerformance.map(d => ({ name: d.department, resolved: d.resolved, pending: d.pending }))
    : [];

  const KPI_COLORS = ['text-primary', 'text-cv-green', 'text-cv-amber', 'text-muted-foreground'];

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-4 space-y-4 max-w-4xl mx-auto animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-card rounded-2xl shadow-card" />)}
          </div>
          <div className="h-80 bg-card rounded-2xl shadow-card" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Analytics</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Raised', value: total },
            { label: 'Resolved', value: resolved },
            { label: 'In Progress', value: inProgress },
            { label: 'Pending', value: pending },
          ].map((stat, i) => (
            <div key={stat.label} className="bg-card p-5 rounded-2xl shadow-card">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <p className={`text-3xl font-extrabold mt-1 tabular-nums ${KPI_COLORS[i]}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Resolution Progress Bar */}
        <div className="bg-card p-5 rounded-2xl shadow-card">
          <p className="font-semibold text-foreground mb-3">Resolution Progress</p>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">{resolved} Resolved</span>
            <span className="text-sm text-muted-foreground">{pending} Pending</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div style={{
              height: '100%',
              width: `${total > 0 ? Math.round((resolved / total) * 100) : 0}%`,
              background: 'linear-gradient(90deg, #10B981, #34D399)',
              borderRadius: 6,
              transition: 'width 0.5s ease'
            }} />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {total > 0 ? Math.round((resolved / total) * 100) : 0}% Resolution Rate
          </p>
        </div>

        {/* Line Chart */}
        <div className="bg-card p-5 rounded-2xl shadow-card">
          <h3 className="text-base font-bold text-foreground mb-4">Submission vs Resolution</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#7C3AED" strokeWidth={3} dot={{ r: 4, fill: '#7C3AED' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontWeight: 600, fontSize: '16px', color: '#111827', marginBottom: '16px' }}>Status Distribution</h3>
            {[
              { label: 'Pending',     value: totals.pending,    color: '#F59E0B', bg: '#FEF3C7' },
              { label: 'In Progress', value: totals.inProgress, color: '#3B82F6', bg: '#EFF6FF' },
              { label: 'Resolved',    value: totals.resolved,   color: '#10B981', bg: '#ECFDF5' },
              { label: 'Rejected',    value: totals.rejected,   color: '#EF4444', bg: '#FEF2F2' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{item.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: item.color }}>{item.value}</span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      {totals.total > 0 ? Math.round((item.value / totals.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div style={{ height: '8px', background: item.bg, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${totals.total > 0 ? Math.round((item.value / totals.total) * 100) : 0}%`,
                    background: item.color,
                    borderRadius: '4px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>Total Complaints</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{totals.total}</span>
            </div>
            <div style={{ marginTop: '8px', padding: '10px', background: '#F9FAFB', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>Resolution Rate: </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#10B981', marginLeft: '4px' }}>
                {totals.total > 0 ? Math.round((totals.resolved / totals.total) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-card p-5 rounded-2xl shadow-card">
            <h3 className="text-base font-bold text-foreground mb-4">Departments</h3>
            <div className="h-[280px]">
              {deptData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="resolved" fill="#10B981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="pending" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Analytics;
