import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function NavbarUserMenu({ onOpenAuthModal }) {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <button
        onClick={onOpenAuthModal}
        className="inline-flex items-center px-4 py-2 border border-indigo-600 rounded-lg text-sm font-semibold text-indigo-600 bg-white hover:bg-indigo-50 transition-colors shadow-sm"
      >
        Sign In / Register
      </button>
    );
  }

  const roleStyles = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    staff: 'bg-blue-100 text-blue-800 border-blue-200',
    customer: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };

  const currentRoleStyle = roleStyles[user?.role] || 'bg-slate-100 text-slate-800 border-slate-200';
  const initials = (user?.username || 'U').substring(0, 2).toUpperCase();

  return (
    <div className="flex items-center space-x-3">
      {/* User Avatar Circle */}
      <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-sm">
        {initials}
      </div>

      <div className="hidden sm:block text-left">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-slate-900">{user?.username}</span>
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${currentRoleStyle}`}>
            {user?.role}
          </span>
        </div>
        <span className="text-xs text-slate-500 block leading-tight">{user?.email}</span>
      </div>

      <button
        onClick={logout}
        title="Log Out"
        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}

