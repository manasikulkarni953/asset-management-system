'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      // Read redirect query parameter if user came from a protected route
      let targetUrl = '/dashboard';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectParam = urlParams.get('redirect');
        if (redirectParam && redirectParam.startsWith('/') && redirectParam !== '/login') {
          targetUrl = redirectParam;
        }
      }

      // Hard redirect to ensure browser carries fresh cookies across network origins
      window.location.href = targetUrl;
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials or database status.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-blue-600 items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AssetFlow Enterprise</h1>
          <p className="text-sm text-slate-400 mt-1">IT Asset Management & Barcode Lifecycle System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Sign In to Dashboard</h2>
          <p className="text-xs text-slate-500 mb-6">Enter your authorized administrator or staff credentials.</p>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <span className="font-bold text-rose-600">!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} method="POST" className="space-y-4">
            <Input
              name="identifier"
              label="Username or Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. admin or admin@enterprise.com"
              required
            />

            <Input
              name="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              Sign In
            </Button>
          </form>

          {/* Seed credentials hint */}
          <div className="mt-6 pt-5 border-t border-slate-100 bg-slate-50/80 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-4 rounded-b-2xl text-xs text-slate-600">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              <span>Default Credentials</span>
              <span className="text-blue-600">Pre-seeded</span>
            </div>
            <div className="font-mono text-slate-600 flex justify-between">
              <span>Username: <strong className="text-slate-900">admin</strong></span>
              <span>Password: <strong className="text-slate-900">Admin@123</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
