'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials. Please verify your username and password.');
      }

      let targetUrl = '/dashboard';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectParam = urlParams.get('redirect');
        if (redirectParam && redirectParam.startsWith('/') && redirectParam !== '/login') {
          targetUrl = redirectParam;
        }
      }

      window.location.href = targetUrl;
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials or network status.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#060b18] text-slate-100 relative overflow-hidden select-none">
      {/* Background Soft Glows (Cyan & Indigo) */}
      <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Main 2-Panel Dark Card with Cyan Glowing Border */}
      <div className="w-full max-w-4xl bg-[#0b1328]/95 backdrop-blur-xl rounded-3xl shadow-[0_0_55px_rgba(6,182,212,0.25),0_25px_60px_rgba(0,0,0,0.7)] border border-cyan-400/30 overflow-hidden relative z-10 transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
          
          {/* ============================================================== */}
          {/* LEFT PANEL: Taraj Global Logo, Stylized DemandTrack            */}
          {/* ============================================================== */}
          <div className="p-8 sm:p-12 flex flex-col justify-between items-center text-center bg-[#0b1328]">
            <div className="w-full flex-1 flex flex-col items-center justify-center py-4">
              {/* Taraj Global Official Logo */}
              <div className="mb-5 flex items-center justify-center">
                <img
                  src="/taraj-global-logo.png"
                  alt="Taraj Global - Business Simplified"
                  className="h-24 sm:h-28 w-auto max-w-[280px] object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
                />
              </div>

              {/* DemandTrack with Stylized Enlarged "D" */}
              <h1 className="flex items-baseline justify-center tracking-tight select-none mt-1">
                <span className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(249,115,22,0.45)] leading-none inline-block">
                  D
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight -ml-0.5">
                  emand
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent ml-0.5 tracking-tight">
                  Track
                </span>
              </h1>

              {/* Operations Tagline */}
              <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium max-w-xs leading-relaxed">
                Enterprise Asset & Ticket Lifecycle Management
              </p>
            </div>

            {/* Powered By Footer on Left Panel */}
            <div className="pt-4 border-t border-slate-800/80 w-full text-center">
              <p className="text-xs text-slate-500 font-medium">
                Powered By Taraj Global Solutions
              </p>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT PANEL: Welcome Back, Sign In Form                         */}
          {/* ============================================================== */}
          <div className="p-8 sm:p-12 flex flex-col justify-center bg-[#0b1328]">
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Please sign in to your account to continue
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Username
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-[#0e1832] border border-slate-700/80 hover:border-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all"
                />
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#0e1832] border border-slate-700/80 hover:border-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-white placeholder-slate-500 rounded-xl pl-4 pr-12 py-2.5 text-sm font-medium outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition-colors p-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0e1832] border-slate-700 text-cyan-500 focus:ring-cyan-400 accent-cyan-500"
                  />
                  <span>Remember me</span>
                </label>

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    setError('Please contact your IT Administrator or support desk to reset credentials.');
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl shadow-md hover:shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
