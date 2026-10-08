'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface AssetOverviewData {
  total: number;
  assigned: number;
  available: number;
  missing: number;
  under_repair: number;
  disposal: number;
}

interface TicketSummaryData {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closing: number;
  remaining: number;
}

interface TicketDateRow {
  date: string;
  isoDate?: string;
  created: number;
  resolved: number;
  remaining: number;
}

interface SpecialistOption {
  id: number;
  name: string;
  email: string;
  designation: string;
}

interface AffectedAssetIssueRow {
  id: number;
  ticket_id: string;
  asset_affected: string;
  asset_model: string;
  emp_name: string;
  emp_initial: string;
  workstation_loc: string;
  workstation: string;
  location: string;
  issue: string;
  issue_description?: string;
  status: string;
  priority?: string;
  created_at?: string;
}

export function SuperAdminDashboard() {
  const [assetOverview, setAssetOverview] = useState<AssetOverviewData>({
    total: 0,
    assigned: 0,
    available: 0,
    missing: 0,
    under_repair: 0,
    disposal: 0,
  });

  const [ticketSummary, setTicketSummary] = useState<TicketSummaryData>({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closing: 0,
    remaining: 0,
  });

  const [ticketsByDate, setTicketsByDate] = useState<TicketDateRow[]>([]);

  const [ticketDateTotals, setTicketDateTotals] = useState({
    created: 0,
    resolved: 0,
    remaining: 0,
  });

  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>('all');

  // Real-time Date Filter State
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-10-06');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isLoadingDateData, setIsLoadingDateData] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [ticketIssues, setTicketIssues] = useState<AffectedAssetIssueRow[]>([]);

  // Format ISO date (e.g., '2026-10-01' -> '01 Oct 2026')
  const formatDisplayDate = (isoStr: string) => {
    try {
      const parts = isoStr.split('-');
      if (parts.length !== 3) return isoStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parts[2]} ${months[mIdx] || parts[1]} ${parts[0]}`;
    } catch {
      return isoStr;
    }
  };

  // Fetch real-time dashboard data
  const fetchDashboardData = useCallback(async (start: string, end: string, specId: string) => {
    setIsLoadingDateData(true);
    try {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      if (specId && specId !== 'all') {
        params.set('specialistId', specId);
      }

      const res = await fetch(`/api/admin/superadmin-dashboard?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.assetOverview) setAssetOverview(data.assetOverview);
        if (data.ticketSummary) setTicketSummary(data.ticketSummary);
        if (data.ticketsByDate) setTicketsByDate(data.ticketsByDate);
        if (data.ticketDateTotals) setTicketDateTotals(data.ticketDateTotals);
        if (data.specialists) setSpecialists(data.specialists);
        if (data.affectedAssetIssues) {
          setTicketIssues(data.affectedAssetIssues);
        }
      }
    } catch (err) {
      console.error('Real-time dashboard fetch error:', err);
    } finally {
      setIsLoadingDateData(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboardData(startDate, endDate, selectedSpecialist);

    // Close dropdown on outside click
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fetchDashboardData, startDate, endDate, selectedSpecialist]);

  // Auto-refresh in background every 20 seconds for real-time live data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(startDate, endDate, selectedSpecialist);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchDashboardData, startDate, endDate, selectedSpecialist]);

  // Date range presets
  const applyPreset = (presetStart: string, presetEnd: string) => {
    setStartDate(presetStart);
    setEndDate(presetEnd);
    fetchDashboardData(presetStart, presetEnd, selectedSpecialist);
    setIsFilterDropdownOpen(false);
  };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen bg-slate-100/70 dark:bg-[#070b18] text-slate-900 dark:text-slate-100 space-y-6 transition-colors duration-200">
      
      {/* ======================================================== */}
      {/* SUPER ADMIN TOP COMMAND BAR WITH THEME TOGGLE            */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-600/25 border border-blue-500/20 dark:border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Super Admin Command Center
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live DB
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 font-medium">
              Real-time enterprise asset tracking, IT workload analysis, and issue monitoring
            </p>
          </div>
        </div>

        {/* Dashboard Header Theme Switcher Pill */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <ThemeToggle variant="pill" />
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: ASSET OVERVIEW                                */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#0b1224] border border-slate-200/90 dark:border-[#162138] hover:border-slate-300 dark:hover:border-slate-700/80 hover:shadow-[0_12px_36px_-8px_rgba(11,19,40,0.8)] rounded-2xl p-5 sm:p-6 shadow-xs dark:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-600/25 border border-blue-200 dark:border-blue-500/40 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">Asset Overview</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Total assets and their current status</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. Total Assets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-blue-200 dark:border-[#1e3a8a] hover:border-blue-500/80 hover:shadow-[0_8px_25px_-4px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Total Assets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{assetOverview.total}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">All assets in system</p>
          </div>

          {/* 2. Assigned Assets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-emerald-200 dark:border-[#065f46] hover:border-emerald-500/80 hover:shadow-[0_8px_25px_-4px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Assigned Assets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{assetOverview.assigned}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Currently allocated</p>
          </div>

          {/* 3. Available Assets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-purple-200 dark:border-[#581c87] hover:border-purple-500/80 hover:shadow-[0_8px_25px_-4px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Available Assets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{assetOverview.available}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Ready for assignment</p>
          </div>

          {/* 4. Missing Assets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-rose-200 dark:border-[#881337] hover:border-rose-500/80 hover:shadow-[0_8px_25px_-4px_rgba(244,63,94,0.35)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Missing Assets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{assetOverview.missing}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Not found / Unavailable</p>
          </div>

          {/* 5. Under Repair Assets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-amber-200 dark:border-[#854d0e] hover:border-amber-500/80 hover:shadow-[0_8px_25px_-4px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Under Repair Assets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{assetOverview.under_repair}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">In service / Repairing</p>
          </div>

          {/* 6. Disposal Assets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-slate-300 dark:border-[#334155] hover:border-cyan-500/80 hover:shadow-[0_8px_25px_-4px_rgba(6,182,212,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-500/20 border border-slate-300 dark:border-slate-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Disposal Assets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{assetOverview.disposal}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Marked for disposal</p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: IT ADMIN WORK (TICKET SUMMARY)                */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#0b1224] border border-slate-200/90 dark:border-[#162138] hover:border-slate-300 dark:hover:border-slate-700/80 hover:shadow-[0_12px_36px_-8px_rgba(11,19,40,0.8)] rounded-2xl p-5 sm:p-6 shadow-xs dark:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-600/25 border border-blue-200 dark:border-blue-500/40 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">IT Admin Work <span className="text-slate-500 dark:text-slate-300 font-normal">(Ticket Summary)</span></h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Current ticket status overview</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. Total Tickets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-blue-200 dark:border-[#1e3a8a] hover:border-blue-500/80 hover:shadow-[0_8px_25px_-4px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Total Tickets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{ticketSummary.total}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">All tickets</p>
          </div>

          {/* 2. Open Tickets */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-rose-200 dark:border-[#881337] hover:border-rose-500/80 hover:shadow-[0_8px_25px_-4px_rgba(244,63,94,0.35)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Open Tickets</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{ticketSummary.open}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">New requests</p>
          </div>

          {/* 3. In Progress */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-amber-200 dark:border-[#854d0e] hover:border-amber-500/80 hover:shadow-[0_8px_25px_-4px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">In Progress</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{ticketSummary.in_progress}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Being worked on</p>
          </div>

          {/* 4. Resolved */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-emerald-200 dark:border-[#065f46] hover:border-emerald-500/80 hover:shadow-[0_8px_25px_-4px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Resolved</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{ticketSummary.resolved}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Fixed & closed</p>
          </div>

          {/* 5. Closing */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-purple-200 dark:border-[#581c87] hover:border-purple-500/80 hover:shadow-[0_8px_25px_-4px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Closing</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{ticketSummary.closing}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Awaiting closure</p>
          </div>

          {/* 6. Remaining */}
          <div className="group relative overflow-hidden bg-slate-50/80 dark:bg-[#090f20] border border-slate-300 dark:border-[#334155] hover:border-orange-500/80 hover:shadow-[0_8px_25px_-4px_rgba(249,115,22,0.3)] hover:-translate-y-0.5 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ease-out cursor-default">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-orange-500/10 rounded-full blur-xl group-hover:bg-orange-500/25 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-500/20 border border-slate-300 dark:border-slate-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">Remaining</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 mb-1 tracking-tight">{ticketSummary.remaining}</h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Pending action</p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: TICKETS BY DATE (TILL NOW)                    */}
      {/* Interactive Real-Time Date & Specialist Filter           */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#0b1224] border border-slate-200/90 dark:border-[#162138] hover:border-slate-300 dark:hover:border-blue-500/40 hover:shadow-[0_12px_36px_-8px_rgba(11,19,40,0.8)] rounded-2xl p-5 sm:p-6 shadow-xs dark:shadow-2xl relative transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-600/25 border border-blue-200 dark:border-blue-500/40 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">Tickets By Date <span className="text-slate-500 dark:text-slate-300 font-normal">(Till Now)</span></h2>
                {isLoadingDateData && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                    Updating...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Daily ticket count (created, resolved, remaining)</p>
            </div>
          </div>

          {/* Interactive Date Range Filter Dropdown Pill */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-slate-100 hover:bg-slate-200/80 dark:bg-[#0d162a] dark:hover:bg-[#121e38] text-xs text-slate-800 dark:text-slate-100 font-semibold self-start sm:self-auto shadow-2xs transition-all focus:outline-none cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>From {formatDisplayDate(startDate)} &nbsp;→&nbsp; {formatDisplayDate(endDate)}</span>
              <svg className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-300 ml-1 transition-transform ${isFilterDropdownOpen ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Popover / Date Range Selector Modal */}
            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#0c1428] border border-slate-200 dark:border-[#1e2f52] shadow-2xl p-4 z-50 text-slate-800 dark:text-slate-100">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1b2b4b]">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide uppercase">Select Real-Time Date Range</h4>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live DB
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-2 gap-1.5 my-3">
                  <button
                    type="button"
                    onClick={() => applyPreset('2026-10-01', '2026-10-06')}
                    className="px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 dark:bg-[#111c36] dark:hover:bg-blue-600 dark:hover:text-white dark:text-slate-200 font-medium text-left transition-colors border border-slate-200 dark:border-slate-700/40 cursor-pointer"
                  >
                    📅 Default (01 - 06 Oct)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const past = new Date();
                      past.setDate(today.getDate() - 6);
                      applyPreset(past.toISOString().slice(0, 10), today.toISOString().slice(0, 10));
                    }}
                    className="px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 dark:bg-[#111c36] dark:hover:bg-blue-600 dark:hover:text-white dark:text-slate-200 font-medium text-left transition-colors border border-slate-200 dark:border-slate-700/40 cursor-pointer"
                  >
                    🕒 Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const past = new Date();
                      past.setDate(today.getDate() - 13);
                      applyPreset(past.toISOString().slice(0, 10), today.toISOString().slice(0, 10));
                    }}
                    className="px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 dark:bg-[#111c36] dark:hover:bg-blue-600 dark:hover:text-white dark:text-slate-200 font-medium text-left transition-colors border border-slate-200 dark:border-slate-700/40 cursor-pointer"
                  >
                    🗓️ Last 14 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('2026-10-01', '2026-10-31')}
                    className="px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 dark:bg-[#111c36] dark:hover:bg-blue-600 dark:hover:text-white dark:text-slate-200 font-medium text-left transition-colors border border-slate-200 dark:border-slate-700/40 cursor-pointer"
                  >
                    📊 All October 2026
                  </button>
                </div>

                {/* Custom Date Pickers */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-[#1b2b4b]">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-200 mb-1">From Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#080e1c] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-200 mb-1">To Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#080e1c] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Optional Specialist Filter ("How many he solved") */}
                {specialists.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-[#1b2b4b]">
                    <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-200 mb-1">
                      Filter by IT Admin (Who Solved)
                    </label>
                    <select
                      value={selectedSpecialist}
                      onChange={(e) => setSelectedSpecialist(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#080e1c] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="all" className="dark:bg-[#0c1428] dark:text-white">All IT Admins (Entire System)</option>
                      {specialists.map((sp) => (
                        <option key={sp.id} value={String(sp.id)} className="dark:bg-[#0c1428] dark:text-white">
                          {sp.name} ({sp.designation})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-[#1b2b4b]">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('2026-10-01');
                      setEndDate('2026-10-06');
                      setSelectedSpecialist('all');
                      fetchDashboardData('2026-10-01', '2026-10-06', 'all');
                      setIsFilterDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer font-medium"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fetchDashboardData(startDate, endDate, selectedSpecialist);
                      setIsFilterDropdownOpen(false);
                    }}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#162138] bg-white dark:bg-[#080d1b]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0e172e] border-b border-slate-200 dark:border-[#162138] text-xs font-bold text-slate-700 dark:text-slate-100">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Created Tickets</th>
                <th className="py-3 px-4">Resolved Tickets</th>
                <th className="py-3 px-4">Remaining Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#131b2e] text-xs">
              {ticketsByDate.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-300 font-medium">
                    No tickets found for selected date range.
                  </td>
                </tr>
              ) : (
                ticketsByDate.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[#0c1426] transition-colors">
                    <td className="py-2.5 px-4 text-slate-800 dark:text-slate-100 font-semibold">{row.date}</td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-white font-bold">{row.created}</td>
                    <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{row.resolved}</td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-white font-bold">{row.remaining}</td>
                  </tr>
                ))
              )}
              {/* Total Footer Row */}
              <tr className="bg-slate-100/90 dark:bg-[#0c1426] border-t-2 border-slate-200 dark:border-[#162138] text-xs font-black text-slate-900 dark:text-white">
                <td className="py-3 px-4">Total</td>
                <td className="py-3 px-4">{ticketDateTotals.created}</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{ticketDateTotals.resolved}</td>
                <td className="py-3 px-4">{ticketDateTotals.remaining}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 4: TICKET & ASSET ISSUES LOG                     */}
      {/* (Asset Affected, Emp Name, Workstation/Loc, Issue, Status)*/}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#0b1224] border border-slate-200/90 dark:border-[#162138] hover:border-slate-300 dark:hover:border-blue-500/40 hover:shadow-[0_12px_36px_-8px_rgba(11,19,40,0.8)] rounded-2xl p-5 sm:p-6 shadow-xs dark:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-600/25 border border-blue-200 dark:border-blue-500/40 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">Active Ticket Issues & Affected Assets</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Asset affected, employee name, workstation / location, reported issue, and status</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#162138] bg-white dark:bg-[#080d1b]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0e172e] border-b border-slate-200 dark:border-[#162138] text-xs font-bold text-slate-700 dark:text-slate-100">
                <th className="py-3 px-4 w-12 text-slate-500 dark:text-slate-300 font-bold">#</th>
                <th className="py-3 px-4">Asset Affected</th>
                <th className="py-3 px-4">Emp Name</th>
                <th className="py-3 px-4">Workstation / Loc</th>
                <th className="py-3 px-4">Issue</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#131b2e] text-xs">
              {ticketIssues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 dark:text-slate-300 font-medium">
                    No ticket issues reported in the system.
                  </td>
                </tr>
              ) : (
                ticketIssues.map((row) => {
                  let statusBadgeClass = 'bg-blue-50 dark:bg-blue-900/60 border-blue-200 dark:border-blue-400/50 text-blue-700 dark:text-blue-200';
                  let statusLabel = 'New';
                  if (row.status === 'in_progress') {
                    statusBadgeClass = 'bg-amber-50 dark:bg-amber-900/60 border-amber-200 dark:border-amber-400/50 text-amber-700 dark:text-amber-200';
                    statusLabel = 'In Progress';
                  } else if (row.status === 'resolved') {
                    statusBadgeClass = 'bg-emerald-50 dark:bg-emerald-900/60 border-emerald-200 dark:border-emerald-400/50 text-emerald-700 dark:text-emerald-200';
                    statusLabel = 'Resolved';
                  } else if (row.status === 'closed') {
                    statusBadgeClass = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200';
                    statusLabel = 'Closed';
                  }

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-[#0c1426] transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">{row.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{row.asset_affected}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">{row.asset_model}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[11px] font-bold text-slate-800 dark:text-white shrink-0">
                            {row.emp_initial}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">{row.emp_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-300">{row.workstation}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">{row.location}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">{row.issue}</span>
                          {row.issue_description && row.issue_description !== row.issue && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-300 line-clamp-1">{row.issue_description}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-3.5 pl-1 font-medium">
          Showing 1 - {ticketIssues.length} of {ticketIssues.length} reported tickets
        </p>
      </div>
    </div>
  );
}
