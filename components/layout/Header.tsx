'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../theme/ThemeToggle';
import { NotificationBell } from './NotificationBell';

export interface HeaderProps {
  onMenuClick: () => void;
  user?: {
    id?: number;
    fullName?: string;
    role?: string;
    email?: string;
  } | null;
}

export function Header({ onMenuClick, user }: HeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-[#0b1224]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between transition-colors duration-200">
      {/* Left side: hamburger for mobile */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
          aria-label="Toggle Navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">Enterprise Database</span>
          <span className="text-slate-400 dark:text-slate-600">/</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">DemandTrack</span>
        </div>
      </div>

      {/* Right side: Notification Bell + Theme Toggle + user info + logout */}
      <div className="flex items-center gap-2.5">
        {/* Notifications Bell for IT Admins & Super Admins */}
        {user?.role !== 'employee' && <NotificationBell />}

        {/* Global Dark / Light Theme Toggle */}
        <ThemeToggle />

        {user && (
          <div className="hidden md:flex flex-col text-right pl-1">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{user.fullName || 'User'}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{user.email}</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          isLoading={isLoggingOut}
          className="text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          title="Sign out"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
        >
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
