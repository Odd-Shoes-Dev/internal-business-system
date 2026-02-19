'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { SparklesIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SignUpPage() {
  const signupsEnabled = process.env.NEXT_PUBLIC_SIGNUPS_ENABLED === 'true';
  if (!signupsEnabled) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-8 shadow-lg">
            <div className="space-y-4">
              <div className="flex justify-center">
                <UserPlusIcon className="w-12 h-12 text-blueox-primary" />
              </div>
              <h1 className="text-3xl font-bold text-blueox-primary">Signups Currently Disabled</h1>
              <p className="text-lg text-gray-600">Account creation is temporarily disabled. Please contact your administrator for access.</p>
              <Link 
                href="/login" 
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
              >
                Return to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName,
          },
        },
      });

      if (error) throw error;

      if (data.user && !data.session) {
        // Email confirmation required
        toast.success('Check your email to confirm your account!');
        router.push('/login');
      } else {
        // Auto-confirmed (for development)
        toast.success(`Welcome! Let's set up your subscription.`);
        
        // Store company name for later use in payment flow
        localStorage.setItem('companyName', companyName);
        
        // Wait for session and trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to plan selection
        router.push('/signup/select-plan');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        
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
              Get Started
            </h1>
            <p className="text-xl text-gray-600 font-medium">
              Business Management System
            </p>
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500">
              <UserPlusIcon className="w-4 h-4 text-blueox-primary" />
              Create Your Account
            </div>
          </div>
        </div>

        {/* Sign Up Form Card with Generous Spacing */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="space-y-6">
            
            {/* Form Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-blueox-primary-dark">Create Account</h2>
              <p className="text-base text-gray-600">
                Get started with BlueOx Management System
              </p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-5">
              
              {/* Company Name Field */}
              <div className="space-y-2">
                <label htmlFor="companyName" className="block text-sm font-medium text-blueox-primary">
                  Company Name
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-4 border border-gray-300 rounded-2xl text-lg placeholder-gray-500 focus:border-black focus:ring-2 focus:ring-black/20 transition-all duration-300 shadow-sm hover:shadow-md backdrop-blur-sm bg-white/80 hover:bg-white"
                  placeholder="Your Company Ltd"
                  required
                />
                <p className="text-xs text-gray-500">
                  This will be your company name in the system
                </p>
              </div>

              {/* Full Name Field */}
              <div className="space-y-2">
                <label htmlFor="fullName" className="block text-sm font-medium text-blueox-primary">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-4 border border-blueox-primary/20 rounded-2xl text-lg placeholder-gray-500 focus:border-blueox-primary focus:ring-2 focus:ring-blueox-primary/20 transition-all duration-300 shadow-sm hover:shadow-md backdrop-blur-sm bg-white/80 hover:bg-white"
                  placeholder="John Doe"
                  required
                />
              </div>

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
                  className="w-full px-4 py-4 border border-blueox-primary/20 rounded-2xl text-lg placeholder-gray-500 focus:border-blueox-primary focus:ring-2 focus:ring-blueox-primary/20 transition-all duration-300 shadow-sm hover:shadow-md backdrop-blur-sm bg-white/80 hover:bg-white"
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
                  minLength={6}
                />
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-blueox-primary">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-4 border border-blueox-primary/20 rounded-2xl text-lg placeholder-gray-500 focus:border-blueox-primary focus:ring-2 focus:ring-blueox-primary/20 transition-all duration-300 shadow-sm hover:shadow-md backdrop-blur-sm bg-white/80 hover:bg-white"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {/* Create Account Button with Large Size for Visual Hierarchy */}
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
                    Creating account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
              
            </form>
          </div>
        </div>

        {/* Sign In Link */}
        <div className="text-center">
          <p className="text-base text-gray-600">
            Already have an account?{' '}
            <Link 
              href="/login" 
              className="text-blueox-primary hover:text-blueox-primary-hover font-semibold underline underline-offset-2 transition-colors duration-200"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Back to Home Link */}
        <div className="text-center">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm transition-colors duration-200">
            ← Back to home
          </Link>
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


