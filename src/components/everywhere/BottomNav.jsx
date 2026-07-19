import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Send, Store, Clock, User } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/session', icon: Users, label: 'Persone' },
  { path: '/ev', icon: Send, label: 'EV' },
  { path: '/locale', icon: Store, label: 'Locale' },
  { path: '/memories', icon: Clock, label: 'Ricordi' },
  { path: '/profile', icon: User, label: 'Profilo' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[9px] font-medium ${isActive ? 'text-primary' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
