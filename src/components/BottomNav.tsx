import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, PlusCircle, BarChart3, Trophy, User } from 'lucide-react';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: Home, label: 'Feed', path: '/feed' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: PlusCircle, label: 'Raise', path: '/raise-complaint', isCenter: true },
    { icon: Trophy, label: 'Board', path: '/leaderboard' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-5 bg-primary rounded-full w-14 h-14 shadow-indigo transition-transform active:scale-95"
              >
                <item.icon className="w-6 h-6 text-primary-foreground" />
              </button>
            );
          }
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
