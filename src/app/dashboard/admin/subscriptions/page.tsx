'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, TrendingUp, Users, CreditCard, Mail } from 'lucide-react';

interface Stats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  pastDueSubscriptions: number;
  cancelledSubscriptions: number;
  totalRevenue: number;
  monthlyRecurringRevenue: number;
}

interface RecentActivity {
  id: string;
  action: string;
  company_name: string;
  created_at: string;
  metadata: any;
}

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  types: { [key: string]: number };
}

export default function SubscriptionMonitorPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  async function fetchMonitoringData() {
    try {
      setLoading(true);

      // Fetch subscription stats
      const statsResponse = await fetch('/api/admin/subscription-stats');
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data);
      }

      // Fetch recent activity
      const activityResponse = await fetch('/api/admin/recent-activity');
      if (activityResponse.ok) {
        const data = await activityResponse.json();
        setRecentActivity(data.activities || []);
      }

      // Fetch email stats
      const emailResponse = await fetch('/api/admin/email-stats');
      if (emailResponse.ok) {
        const data = await emailResponse.json();
        setEmailStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    if (action.includes('created') || action.includes('success')) return 'text-green-600';
    if (action.includes('failed') || action.includes('cancelled')) return 'text-red-600';
    if (action.includes('trial') || action.includes('warning')) return 'text-yellow-600';
    return 'text-blue-600';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('created')) return <CheckCircle className="w-5 h-5" />;
    if (action.includes('failed')) return <AlertCircle className="w-5 h-5" />;
    if (action.includes('trial')) return <Clock className="w-5 h-5" />;
    return <Activity className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Subscription Monitoring</h1>
          <p className="text-gray-600 mt-2">Real-time overview of subscriptions and system health</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Active Subscriptions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Active</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.activeSubscriptions || 0}</div>
            <p className="text-sm text-gray-600 mt-1">Paying customers</p>
          </div>

          {/* Trial Subscriptions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Trials</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.trialSubscriptions || 0}</div>
            <p className="text-sm text-gray-600 mt-1">In trial period</p>
          </div>

          {/* Past Due */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-sm text-gray-500">Past Due</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.pastDueSubscriptions || 0}</div>
            <p className="text-sm text-gray-600 mt-1">Payment issues</p>
          </div>

          {/* MRR */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm text-gray-500">MRR</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              ${((stats?.monthlyRecurringRevenue || 0) / 100).toFixed(0)}
            </div>
            <p className="text-sm text-gray-600 mt-1">Monthly recurring</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              {recentActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              ) : (
                <div className="space-y-4">
                  {recentActivity.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={getActionColor(activity.action)}>
                        {getActionIcon(activity.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {activity.company_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {activity.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Email Stats */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Email Statistics (Last 30 Days)</h2>
            </div>
            <div className="p-6">
              {emailStats ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Total Emails</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{emailStats.total}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700 font-medium">Sent</p>
                      <p className="text-2xl font-bold text-green-900">{emailStats.sent}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700 font-medium">Failed</p>
                      <p className="text-2xl font-bold text-red-900">{emailStats.failed}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">By Type:</p>
                    {Object.entries(emailStats.types).map(([type, count]) => (
                      <div key={type} className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600 capitalize">
                          {type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No email data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Subscriptions</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats?.totalSubscriptions || 0}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats?.activeSubscriptions || 0}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats?.trialSubscriptions || 0}</div>
              <div className="text-sm text-gray-600">Trial</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats?.pastDueSubscriptions || 0}</div>
              <div className="text-sm text-gray-600">Past Due</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats?.expiredSubscriptions || 0}</div>
              <div className="text-sm text-gray-600">Expired</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats?.cancelledSubscriptions || 0}</div>
              <div className="text-sm text-gray-600">Cancelled</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
