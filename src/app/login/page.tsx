'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { SparklesIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Get redirect path from URL or default to dashboard
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirectTo') || '/dashboard';
      
      toast.success('Welcome back!');
      
      // Wait a bit longer for cookies to be set properly
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force a full page reload with the redirect
      window.location.href = redirectTo;
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex flex-col justify-center p-4 py-12">
      <div className="w-full max-w-lg mx-auto space-y-8">
        
        {/* Logo Section */}
        <div className="text-center space-y-6">
          <Link href="/" className="inline-block">
            <Image
              src="/assets/logo.png"
              alt="BlueOx"
              width={140}
              height={56}
              className="mx-auto"
            />
          </Link>
          
          {/* System Title with Visual Hierarchy */}
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-bold text-blueox-primary">
              Welcome Back
            </h1>
            <p className="text-xl text-gray-600 font-medium">
              Business Management System
            </p>
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500">
              <LockClosedIcon className="w-4 h-4 text-blueox-primary" />
              Secure Access Portal
            </div>
          </div>
        </div>

        {/* Login Form Card with Generous Spacing */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-8 shadow-lg">
          <div className="space-y-6">
            
            {/* Form Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-blueox-primary-dark">Sign In</h2>
              <p className="text-base text-gray-600">
                Access your operations dashboard
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-blueox-primary">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-4 border border-gray-300 rounded-2xl text-lg placeholder-gray-500 focus:border-black focus:ring-2 focus:ring-black/20 transition-all duration-300 shadow-sm hover:shadow-md backdrop-blur-sm bg-white/80 hover:bg-white"
                  placeholder="you@company.com"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-blueox-primary">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 border border-blueox-primary/20 rounded-2xl text-lg placeholder-gray-500 focus:border-blueox-primary focus:ring-2 focus:ring-blueox-primary/20 transition-all duration-300 shadow-sm hover:shadow-md backdrop-blur-sm bg-white/80 hover:bg-white"
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-blueox-primary/30 text-blueox-primary focus:ring-blueox-primary"
                  />
                  Remember me
                </label>
              </div>

              {/* Sign In Button with Large Size for Visual Hierarchy */}
              <button
                type="submit"
                disabled={loading}
                className="group w-full px-8 py-4 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black text-lg font-semibold rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
              
            </form>
          </div>
        </div>

        {/* Sign Up Link */}
        <div className="text-center">
          <p className="text-base text-gray-600">
            Need an account?{' '}
            {process.env.NEXT_PUBLIC_SIGNUPS_ENABLED === 'true' ? (
              <Link 
                href="/signup" 
                className="text-blueox-primary hover:text-blueox-primary-hover font-semibold underline underline-offset-2 transition-colors duration-200"
              >
                Sign up
              </Link>
            ) : (
              <span className="text-gray-500">Contact administrator</span>
            )}
          </p>
        </div>

        {/* Footer with Proper Visual Hierarchy */}
        <div className="text-center space-y-2 pt-4">
          <div className="flex items-center justify-center gap-2">
            <SparklesIcon className="w-4 h-4 text-blueox-primary" />
            <p className="text-sm font-medium text-blueox-primary">
              Powered by BlueOx
            </p>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} BlueOx. All rights reserved.
          </p>
        </div>
        
      </div>
    </div>
  );
}


