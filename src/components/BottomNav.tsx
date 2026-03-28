import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BarChart3, Plus, Trophy, User } from 'lucide-react';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: Home, label: 'Feed', path: '/feed' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { label: 'Raise', path: '/raise-complaint', isCenter: true },
    { icon: Trophy, label: 'Board', path: '/leaderboard' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
      style={{ height: 64, boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center justify-around h-full px-2">
        {items.map((item) => {
          const isActive = location.pathname === item.path;

          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-5 w-14 h-14 rounded-full active:scale-95 transition-transform"
                style={{
                  background: '#7C3AED',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                }}
              >
                <Plus size={26} color="white" strokeWidth={2.5} />
              </button>
            );
          }

          const Icon = item.icon!;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center py-2 px-3 gap-0.5 transition-colors"
              style={{ color: isActive ? '#7C3AED' : '#9CA3AF' }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium uppercase tracking-widest mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
