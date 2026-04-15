'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ShieldCheckIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface InvitationData {
  id: string;
  email: string;
  role: string;
  company_name: string;
  invited_by_name: string;
  expires_at: string;
  user_exists: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accountant: 'Accountant',
  operations: 'Operations',
  sales: 'Sales',
  guide: 'Guide',
  viewer: 'Viewer',
};

export default function AcceptInvitePage() {
  const params = useParams();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/${token}`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.error) setLoadError(payload.error);
        else setInvitation(payload.data);
      })
      .catch(() => setLoadError('Failed to load invitation'))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation?.user_exists && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!invitation?.user_exists && password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, password }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to accept invitation');
      setAccepted(true);
      toast.success('Welcome aboard!');
      await new Promise((r) => setTimeout(r, 1200));
      window.location.href = '/dashboard';
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blueox-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-xl border border-red-200 rounded-2xl p-10 shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invitation Invalid</h2>
          <p className="text-gray-500 mb-6">{loadError}</p>
          <Link href="/login" className="btn-primary inline-block">Go to Login</Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-xl border border-green-200 rounded-2xl p-10 shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You're in!</h2>
          <p className="text-gray-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[invitation?.role ?? ''] || invitation?.role || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex flex-col justify-center p-4 py-12">
      <div className="w-full max-w-lg mx-auto space-y-8">

        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-blueox-primary">You're Invited!</h1>
            <p className="text-xl text-gray-600 font-medium">
              Join {invitation?.company_name} on BlueOx
            </p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blueox-primary to-blueox-accent p-5 text-center">
            <p className="text-white/80 text-sm">
              <span className="font-semibold text-white">{invitation?.invited_by_name}</span> invited you to join
            </p>
            <p className="text-white text-xl font-bold mt-1">{invitation?.company_name}</p>
            <span className="inline-block mt-2 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {roleLabel}
            </span>
          </div>

          <div className="p-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold text-blueox-primary-dark">
                {invitation?.user_exists ? 'Log in to accept' : 'Create your account'}
              </h2>
              <p className="text-sm text-gray-500">
                Joining as <span className="font-medium text-gray-700">{invitation?.email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!invitation?.user_exists && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blueox-primary">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className="w-full px-4 py-4 border border-gray-300 rounded-2xl text-base placeholder-gray-400 focus:border-blueox-primary focus:ring-2 focus:ring-blueox-primary/20 transition-all bg-white/80"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-blueox-primary">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={invitation?.user_exists ? 'Your existing password' : 'Choose a password (min 8 chars)'}
                  className="w-full px-4 py-4 border border-gray-300 rounded-2xl text-base placeholder-gray-400 focus:border-blueox-primary focus:ring-2 focus:ring-blueox-primary/20 transition-all bg-white/80"
                />
              </div>

              {!invitation?.user_exists && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blueox-primary">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat your password"
                    className="w-full px-4 py-4 border border-gray-300 rounded-2xl text-base placeholder-gray-400 focus:border-blueox-primary focus:ring-2 focus:ring-blueox-primary/20 transition-all bg-white/80"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-8 py-4 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black text-lg font-semibold rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {submitting ? 'Joining...' : invitation?.user_exists ? 'Log In & Accept' : 'Create Account & Join'}
              </button>
            </form>
          </div>
        </div>

        <div className="text-center space-y-2 pt-2">
          <div className="flex items-center justify-center gap-2">
            <SparklesIcon className="w-4 h-4 text-blueox-primary" />
            <p className="text-sm font-medium text-blueox-primary">Powered by BlueOx</p>
          </div>
          <p className="text-xs text-gray-400">
            Invitation expires {invitation?.expires_at ? new Date(invitation.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
