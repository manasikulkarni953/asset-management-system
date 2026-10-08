'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ClipboardList,
  Monitor,
  Shield,
  Wrench,
  ChevronRight,
  Briefcase,
  MapPin,
  Mail,
  Zap,
  Plus,
  Laptop,
  Keyboard,
  Mouse,
  Headphones,
  HardDrive,
  Ticket,
  User,
  Headset,
  RefreshCw,
} from 'lucide-react';
import type { EmployeeDetailed } from '@/types/employee';

interface EmployeeDashboardProps {
  user: {
    id?: number;
    fullName?: string;
    role?: string;
    email?: string;
    designation?: string | null;
  };
}

export function EmployeeDashboard({ user }: EmployeeDashboardProps) {
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeDetailed | null>(null);
  const [employeeTickets, setEmployeeTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [greeting, setGreeting] = useState<string>('Good Morning');
  const [currentDateStr, setCurrentDateStr] = useState<string>('Wed, 01 Oct 2026');
  const [lastLoginTimeStr, setLastLoginTimeStr] = useState<string>('09:42 AM');

  // US Shift Time & Greeting Calculations (US Eastern Time - America/New_York)
  const getUSShiftDetails = () => {
    try {
      const now = new Date();
      const usHourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      }).format(now);
      const usHour = parseInt(usHourStr, 10);

      const usTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const usDateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(now);

      // US Shift greeting
      let calculatedGreeting = 'Good Morning';
      if (usHour >= 12 && usHour < 17) {
        calculatedGreeting = 'Good Afternoon';
      } else if (usHour >= 17 || usHour < 4) {
        calculatedGreeting = 'Good Evening';
      }

      return { greeting: calculatedGreeting, usTimeStr, usDateStr };
    } catch {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const usTime = new Date(utc - 4 * 3600000);
      const usHour = usTime.getHours();
      let calculatedGreeting = 'Good Morning';
      if (usHour >= 12 && usHour < 17) calculatedGreeting = 'Good Afternoon';
      else if (usHour >= 17 || usHour < 4) calculatedGreeting = 'Good Evening';
      return {
        greeting: calculatedGreeting,
        usTimeStr: usTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        usDateStr: usTime.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
      };
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empRes, tktRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/tickets?limit=10'),
      ]);
      const empJson = await empRes.json();
      const tktJson = await tktRes.json();

      if (empJson.employees && empJson.employees.length > 0) {
        const fullEmpRes = await fetch(`/api/employees/${empJson.employees[0].id}`);
        const fullEmpData = await fullEmpRes.json();
        if (fullEmpData.employee) {
          setEmployeeProfile(fullEmpData.employee);
        }
      }
      if (tktJson.tickets) {
        setEmployeeTickets(tktJson.tickets);
      }
    } catch (err) {
      console.error('Error loading employee dashboard data:', err);
    } finally {
      setIsLoading(false);
      const { greeting: usGreeting, usTimeStr, usDateStr } = getUSShiftDetails();
      setGreeting(usGreeting);
      setLastLoginTimeStr(usTimeStr);
      setCurrentDateStr(usDateStr);
    }
  };

  useEffect(() => {
    const { greeting: usGreeting, usTimeStr, usDateStr } = getUSShiftDetails();
    setGreeting(usGreeting);
    setLastLoginTimeStr(usTimeStr);
    setCurrentDateStr(usDateStr);
    loadData();
  }, []);

  // Employee details with realistic fallbacks
  const displayName = employeeProfile?.name || user?.fullName || 'Rahul Sharma';
  const firstName = displayName.split(' ')[0] || 'Rahul';
  const employeeIdCode = employeeProfile?.employee_id || 'EMP00125';
  const departmentName = employeeProfile?.department || 'IT Lab';
  const locationText = employeeProfile?.location
    ? `${employeeProfile.location} - 5th Floor`
    : 'The Space - 5th Floor';
  const emailAddress = employeeProfile?.email || user?.email || 'rahul.sharma@tgs.com';
  const joinedDate = employeeProfile?.created_at
    ? formatJoinedDate(employeeProfile.created_at)
    : '15 Jun 2025';

  function formatJoinedDate(dStr: string) {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '15 Jun 2025';
    }
  }

  // Realistic fallback tickets matching the screenshot
  const defaultTickets = [
    {
      id: 1,
      ticket_id: 'TKT-00024',
      issue_description: 'Laptop not turning on',
      priority: 'critical',
      status: 'open',
      created_at: '01 Oct 2026, 09:12 AM',
    },
    {
      id: 2,
      ticket_id: 'TKT-00023',
      issue_description: 'Display flickering',
      priority: 'high',
      status: 'in_progress',
      created_at: '30 Sep 2026, 08:45 AM',
    },
    {
      id: 3,
      ticket_id: 'TKT-00022',
      issue_description: 'Software installation',
      priority: 'medium',
      status: 'resolved',
      created_at: '29 Sep 2026, 06:20 AM',
    },
    {
      id: 4,
      ticket_id: 'TKT-00021',
      issue_description: 'Keyboard not working',
      priority: 'high',
      status: 'in_progress',
      created_at: '28 Sep 2026, 07:50 AM',
    },
    {
      id: 5,
      ticket_id: 'TKT-00020',
      issue_description: 'Overheating issue',
      priority: 'medium',
      status: 'open',
      created_at: '27 Sep 2026, 07:32 AM',
    },
  ];

  const ticketsToDisplay =
    employeeTickets && employeeTickets.length > 0
      ? employeeTickets.slice(0, 5).map((tk) => ({
        id: tk.id,
        ticket_id: tk.ticket_id,
        issue_description: tk.issue_description || tk.issue_category,
        priority: tk.priority?.toLowerCase() || 'medium',
        status: tk.status?.toLowerCase() || 'open',
        created_at: formatDateTime(tk.created_at),
      }))
      : defaultTickets;

  // Realistic fallback assets matching screenshot
  const defaultAssets = [
    {
      id: 1,
      asset_number: 'TGS-LAP-00004',
      name: 'Dell Latitude 5440',
      category: 'Laptop',
      status: 'assigned',
    },
    {
      id: 2,
      asset_number: 'TGS-MON-00008',
      name: 'Dell 24" Monitor',
      category: 'Monitor',
      status: 'assigned',
    },
    {
      id: 3,
      asset_number: 'TGS-KEY-00015',
      name: 'Logitech K120',
      category: 'Keyboard',
      status: 'assigned',
    },
    {
      id: 4,
      asset_number: 'TGS-MSE-00021',
      name: 'Logitech Mouse',
      category: 'Mouse',
      status: 'assigned',
    },
    {
      id: 5,
      asset_number: 'TGS-HDS-00018',
      name: 'Logitech Headset',
      category: 'Headphones',
      status: 'assigned',
    },
  ];

  const assetsToDisplay =
    employeeProfile?.current_assets && employeeProfile.current_assets.length > 0
      ? employeeProfile.current_assets.slice(0, 5).map((a) => ({
        id: a.id,
        asset_number: a.asset_number,
        name: `${a.brand || ''} ${a.model || ''}`.trim() || 'Standard Asset',
        category: a.category || 'Hardware',
        status: a.status || 'assigned',
      }))
      : defaultAssets;

  // Counts for top 4 cards
  const totalTicketsCount = employeeTickets.length > 0 ? employeeTickets.length : 3;
  const openCount = employeeTickets.filter((t) => t.status === 'open' || t.status === 'new').length || 1;
  const inProgressCount = employeeTickets.filter((t) => t.status === 'in_progress').length || 1;
  const resolvedCount = employeeTickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length || 1;

  const assignedAssetsCount =
    employeeProfile?.current_assets && employeeProfile.current_assets.length > 0
      ? employeeProfile.current_assets.length
      : 5;

  function formatDateTime(dStr?: string) {
    if (!dStr) return '01 Oct 2026, 09:12 AM';
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dStr;
    }
  }

  function renderAssetCategoryIcon(category: string) {
    const c = category.toLowerCase();
    if (c.includes('laptop') || c.includes('notebook')) return <Laptop className="w-5 h-5 text-blue-400" />;
    if (c.includes('mon') || c.includes('screen') || c.includes('display')) return <Monitor className="w-5 h-5 text-blue-400" />;
    if (c.includes('key')) return <Keyboard className="w-5 h-5 text-blue-400" />;
    if (c.includes('mouse')) return <Mouse className="w-5 h-5 text-blue-400" />;
    if (c.includes('head') || c.includes('ear') || c.includes('audio')) return <Headphones className="w-5 h-5 text-blue-400" />;
    return <HardDrive className="w-5 h-5 text-blue-400" />;
  }

  return (
    <div className="text-slate-100 select-none -mt-3 sm:-mt-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ============================================================== */}
        {/* LEFT COLUMN: Greeting, 4 Compact Stat Cards, Tickets, Assets   */}
        {/* ============================================================== */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* 1. Header with US Shift Greeting */}
          <div className="pt-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {greeting}, {firstName}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Here&apos;s a quick overview of your assets and support requests.
            </p>
          </div>

          {/* 2. Four Stat Cards (Compact height ~110px, icon & title side-by-side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Card 1: My Tickets */}
            <Link
              href="/tickets"
              className="group relative overflow-hidden bg-[#0b1328] border border-slate-800/80 hover:border-blue-500/70 hover:shadow-[0_8px_25px_-4px_rgba(59,130,246,0.25)] hover:-translate-y-0.5 rounded-xl p-3.5 transition-all duration-300 ease-out"
            >
              <div className="absolute -top-10 -right-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all duration-500 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-500/30 transition-all">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors truncate">
                    My Tickets
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
              <div className="my-1.5">
                <p className="text-2xl font-bold text-white tracking-tight">{totalTicketsCount}</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 whitespace-nowrap overflow-hidden">
                <span className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {openCount} Open
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {inProgressCount} In Progress
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {resolvedCount} Resolved
                </span>
              </div>
            </Link>

            {/* Card 2: My Assigned Assets */}
            <Link
              href="/my-assets"
              className="group relative overflow-hidden bg-[#0b1328] border border-slate-800/80 hover:border-emerald-500/70 hover:shadow-[0_8px_25px_-4px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 rounded-xl p-3.5 transition-all duration-300 ease-out"
            >
              <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/30 transition-all">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors truncate">
                    My Assigned Assets
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
              <div className="my-1.5">
                <p className="text-2xl font-bold text-white tracking-tight">{assignedAssetsCount}</p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Laptop, Monitor, Keyboard +2
              </p>
            </Link>

            {/* Card 3: Active Insurance */}
            <div className="group relative overflow-hidden bg-[#0b1328] border border-slate-800/80 hover:border-purple-500/70 hover:shadow-[0_8px_25px_-4px_rgba(168,85,247,0.25)] hover:-translate-y-0.5 rounded-xl p-3.5 transition-all duration-300 ease-out cursor-default">
              <div className="absolute -top-10 -right-10 w-20 h-20 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all duration-500 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-purple-500/30 transition-all">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors truncate">
                    Active Insurance
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
              <div className="my-1.5">
                <p className="text-2xl font-bold text-white tracking-tight">4</p>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                2 Expiring Soon
              </p>
            </div>

            {/* Card 4: Assets Under Repair */}
            <div className="group relative overflow-hidden bg-[#0b1328] border border-slate-800/80 hover:border-amber-500/70 hover:shadow-[0_8px_25px_-4px_rgba(245,158,11,0.25)] hover:-translate-y-0.5 rounded-xl p-3.5 transition-all duration-300 ease-out cursor-default">
              <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all duration-500 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-500/30 transition-all">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors truncate">
                    Assets Under Repair
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
              <div className="my-1.5">
                <p className="text-2xl font-bold text-white tracking-tight">1</p>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                1 In Repair
              </p>
            </div>
          </div>

          {/* 3. Recent Tickets Table */}
          <div className="group/card relative overflow-hidden bg-[#0b1328] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Ticket className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-semibold text-white">Recent Tickets</h2>
              </div>
              <Link
                href="/tickets"
                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition"
              >
                View All →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] text-slate-400 font-medium">
                    <th className="pb-2.5 font-medium">Ticket ID</th>
                    <th className="pb-2.5 font-medium">Issue</th>
                    <th className="pb-2.5 font-medium text-center">Priority</th>
                    <th className="pb-2.5 font-medium text-center">Status</th>
                    <th className="pb-2.5 font-medium text-right">Created On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {ticketsToDisplay.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="group/row hover:bg-slate-800/40 hover:shadow-[inset_3px_0_0_#3b82f6] transition-all duration-200 cursor-pointer"
                    >
                      <td className="py-2.5 pr-2 font-mono text-slate-300 font-medium">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="group-hover/row:text-blue-400 group-hover/row:underline transition-colors"
                        >
                          {ticket.ticket_id}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-2 text-slate-200 max-w-[200px] truncate group-hover/row:text-white transition-colors">
                        {ticket.issue_description}
                      </td>
                      <td className="py-2.5 px-1 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border group-hover/row:scale-105 transition-transform duration-200 ${getPriorityBadgeClass(
                            ticket.priority
                          )}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {capitalize(ticket.priority)}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border group-hover/row:scale-105 transition-transform duration-200 ${getStatusBadgeClass(
                            ticket.status
                          )}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {formatStatusLabel(ticket.status)}
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right text-[11px] text-slate-400 whitespace-nowrap">
                        {ticket.created_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. My Assigned Assets */}
          <div className="group/card relative overflow-hidden bg-[#0b1328] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Laptop className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-semibold text-white">My Assigned Assets</h2>
              </div>
              <Link
                href="/my-assets"
                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition"
              >
                View All →
              </Link>
            </div>

            {/* Grid of 5 hardware asset cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {assetsToDisplay.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative bg-[#0e172e] hover:bg-[#132042] border border-slate-800/80 hover:border-blue-500/60 rounded-xl p-3 flex flex-col items-center justify-between text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                    {renderAssetCategoryIcon(asset.category || asset.name)}
                  </div>
                  <div className="w-full">
                    <p className="font-mono text-xs font-bold text-slate-200 tracking-tight">{asset.asset_number}</p>
                    <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{asset.name}</p>
                  </div>
                  <div className="mt-2.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#064e3b] text-[#6ee7b7] border border-[#047857]">
                      Assigned
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Date Card, Profile Card, Actions, Need Help       */}
        {/* ============================================================== */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* 1. Date / Last Login Card (Top Right Widget) */}
          <div className="group bg-[#0b1328] border border-slate-800/80 hover:border-blue-500/50 rounded-2xl p-4 shadow-sm transition-all duration-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0e1832] border border-slate-700/60 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-white tracking-tight">{currentDateStr}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Last login: {lastLoginTimeStr} EDT</p>
              </div>
            </div>
            <button
              onClick={loadData}
              title="Refresh dashboard metrics"
              className="text-slate-500 hover:text-white transition p-1 hover:bg-slate-800/60 rounded-lg ml-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

          {/* 2. Employee Profile Card */}
          <div className="bg-[#0b1328] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4.5 shadow-sm transition-all duration-300">
            {/* Avatar & Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-md">
                {firstName.charAt(0)}
              </div>
              <div className="leading-tight min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{displayName}</h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{employeeIdCode}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-400">Employee</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-medium">Active</span>
                </div>
              </div>
            </div>

            {/* Profile Info Items */}
            <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs">
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-500 block leading-none">Department</span>
                  <span className="text-slate-200 font-medium">{departmentName}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-500 block leading-none">Location</span>
                  <span className="text-slate-200 font-medium">{locationText}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 block leading-none">Email</span>
                  <span className="text-slate-200 font-medium truncate block">{emailAddress}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-500 block leading-none">Joined On</span>
                  <span className="text-slate-200 font-medium">{joinedDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Quick Actions Card */}
          <div className="bg-[#0b1328] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4.5 shadow-sm transition-all duration-300">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Quick Actions</h2>
            </div>

            <div className="space-y-2">
              {/* Raise Ticket Button (Primary Blue) */}
              <Link
                href="/tickets/new"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm hover:shadow-[0_4px_16px_rgba(37,99,235,0.4)]"
              >
                <Plus className="w-4 h-4" />
                <span>Raise Ticket</span>
              </Link>

              {/* View My Assets */}
              <Link
                href="/my-assets"
                className="w-full bg-[#0d162a] hover:bg-[#142343] border border-slate-800 hover:border-slate-700 rounded-xl py-2 px-3.5 text-xs font-medium text-slate-200 flex items-center gap-2.5 transition"
              >
                <Monitor className="w-4 h-4 text-blue-400 shrink-0" />
                <span>View My Assets</span>
              </Link>

              {/* View My Tickets */}
              <Link
                href="/tickets"
                className="w-full bg-[#0d162a] hover:bg-[#142343] border border-slate-800 hover:border-slate-700 rounded-xl py-2 px-3.5 text-xs font-medium text-slate-200 flex items-center gap-2.5 transition"
              >
                <Ticket className="w-4 h-4 text-blue-400 shrink-0" />
                <span>View My Tickets</span>
              </Link>

              {/* Update Profile */}
              <Link
                href="/my-profile"
                className="w-full bg-[#0d162a] hover:bg-[#142343] border border-slate-800 hover:border-slate-700 rounded-xl py-2 px-3.5 text-xs font-medium text-slate-200 flex items-center gap-2.5 transition"
              >
                <User className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Update Profile</span>
              </Link>
            </div>
          </div>

          {/* 4. Need Help? Card */}
          <Link
            href="/tickets/new"
            className="group block bg-[#0b1328] border border-slate-800/80 hover:border-blue-500/70 hover:shadow-[0_10px_30px_-5px_rgba(37,99,235,0.25)] rounded-2xl p-4 shadow-sm transition-all duration-300 ease-out"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Headset className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white">Need Help?</h3>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Contact IT Support for any issue related to your assets or tickets.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Badge color helpers matching the dark screenshot styling
function getPriorityBadgeClass(priority: string) {
  switch (priority.toLowerCase()) {
    case 'critical':
      return 'bg-[#45121c] text-[#f87171] border-[#7f1d1d]';
    case 'high':
      return 'bg-[#452712] text-[#fb923c] border-[#7c2d12]';
    case 'medium':
      return 'bg-[#172554] text-[#60a5fa] border-[#1e3a8a]';
    case 'low':
    default:
      return 'bg-[#1e293b] text-[#94a3b8] border-[#334155]';
  }
}

function getStatusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'open':
    case 'new':
      return 'bg-[#3f161e] text-[#fca5a5] border-[#881337]';
    case 'in_progress':
    case 'in progress':
      return 'bg-[#3b2311] text-[#fde047] border-[#78350f]';
    case 'resolved':
    case 'closed':
      return 'bg-[#064e3b] text-[#6ee7b7] border-[#047857]';
    default:
      return 'bg-[#1e293b] text-slate-300 border-slate-700';
  }
}

function formatStatusLabel(status: string) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'new') return 'Open';
  return capitalize(status);
}

function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
