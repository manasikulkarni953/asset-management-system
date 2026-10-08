'use client';

import React, { useEffect, useState } from 'react';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { ITAdminDashboard } from '@/components/dashboard/ITAdminDashboard';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';

export default function DashboardPage() {
  const [user, setUser] = useState<{
    id?: number;
    fullName?: string;
    role?: 'super_admin' | 'admin' | 'employee';
    email?: string;
    designation?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((authData) => {
        if (authData?.user) {
          setUser(authData.user);
        }
      })
      .catch((err) => console.error('Dashboard auth verification error:', err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Verifying authorization & loading dashboard...</p>
        </div>
      </div>
    );
  }

  // 1. Super Admin: Executive Oversight Command Center (Dedicated dark theme)
  if (user?.role === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  // 2. Employee: Employee Self-Service Portal (Personal assets, tickets & workstation)
  if (user?.role === 'employee') {
    return <EmployeeDashboard user={user} />;
  }

  // 3. IT Admin: Operational Service Desk Command Center (Triage, metrics & audit trail)
  return <ITAdminDashboard />;
}
