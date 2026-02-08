'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  SparklesIcon,
  ClockIcon,
  ServerIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

interface ApiHealthCheck {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time: number;
  last_checked: string;
  error_message?: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  timestamp: string;
  database: ApiHealthCheck;
  endpoints: ApiHealthCheck[];
  rate_limiting: ApiHealthCheck;
  overall_performance: {
    avg_response_time: number;
    error_rate: number;
  };
}

export default function StatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealth(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-700 bg-green-100/80 border-green-200';
      case 'degraded': return 'text-yellow-700 bg-yellow-100/80 border-yellow-200';
      case 'down': return 'text-red-700 bg-red-100/80 border-red-200';
      default: return 'text-gray-700 bg-gray-100/80 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircleIcon;
      case 'degraded': return ExclamationTriangleIcon;
      case 'down': return XCircleIcon;
      default: return ExclamationTriangleIcon;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'Operational';
      case 'degraded': return 'Degraded Performance';
      case 'down': return 'Service Disruption';
      default: return 'Unknown Status';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        </div>
        
        <div className="relative bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blueox-primary border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-blueox-primary-dark mb-2">Loading System Status</h2>
          <p className="text-gray-600">Checking all services...</p>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-16 w-24 h-24 bg-red-500/10 rounded-full blur-lg"></div>
        </div>
        
        <div className="relative bg-white/80 backdrop-blur-xl border border-red-200 rounded-3xl p-8 shadow-xl text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircleIcon className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-800 mb-2">Status Unavailable</h1>
          <p className="text-gray-600 mb-6">Unable to fetch system status. Our monitoring systems may be experiencing issues.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-20 left-1/4 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
      </div>
      
      <div className="relative max-w-6xl mx-auto py-12 px-6 space-y-8">
        {/* Hero Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl px-6 py-3 shadow-lg mb-6">
            <SparklesIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">System Status Monitor</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-blueox-primary-dark mb-4 leading-tight">
            BlueOx Platform Status
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Real-time monitoring of our business management platform and API services
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-sm font-semibold ${getStatusColor(health.status)}`}>
              {health.status === 'healthy' && <CheckCircleIcon className="w-6 h-6" />}
              {health.status === 'degraded' && <ExclamationTriangleIcon className="w-6 h-6" />}
              {health.status === 'down' && <XCircleIcon className="w-6 h-6" />}
              <span className="text-lg">{getStatusText(health.status)}</span>
            </div>
            
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 px-4 py-2 rounded-xl">
              <ServerIcon className="w-4 h-4 text-blueox-primary" />
              <span className="text-sm font-medium text-gray-700">Version {health.version}</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <ClockIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-blueox-primary-dark">Response Time</h3>
            </div>
            <p className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {health.overall_performance.avg_response_time.toFixed(0)}<span className="text-lg text-gray-500 ml-1">ms</span>
            </p>
            <p className="text-sm text-gray-600 font-medium">Average over last hour</p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-blueox-primary-dark">Error Rate</h3>
            </div>
            <p className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {health.overall_performance.error_rate.toFixed(1)}<span className="text-lg text-gray-500 ml-1">%</span>
            </p>
            <p className="text-sm text-gray-600 font-medium">Over last hour</p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-blueox-primary-dark">Uptime</h3>
            </div>
            <p className="text-3xl lg:text-4xl font-bold text-green-600 mb-2">99.9<span className="text-lg text-gray-500 ml-1">%</span></p>
            <p className="text-sm text-gray-600 font-medium">Last 30 days</p>
          </div>
        </div>

        {/* Core Services Status */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 px-8 py-6 border-b border-blueox-primary/10">
            <div className="flex items-center gap-3">
              <ServerIcon className="w-6 h-6 text-blueox-primary" />
              <h2 className="text-2xl font-bold text-blueox-primary-dark">Core Services</h2>
            </div>
            <p className="text-gray-600 mt-1">Essential platform infrastructure</p>
          </div>
          
          <div className="divide-y divide-blueox-primary/10">
            {/* Database */}
            <div className="px-8 py-6 hover:bg-blueox-primary/5 transition-all duration-300 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blueox-primary transition-colors duration-300">Database</h3>
                    <p className="text-sm text-gray-600">PostgreSQL connection and query performance</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500 font-medium">Response Time</p>
                    <p className="text-lg font-bold text-gray-900">{health.database.response_time}ms</p>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-sm ${getStatusColor(health.database.status)}`}>
                    {health.database.status === 'healthy' && <CheckCircleIcon className="w-4 h-4" />}
                    {health.database.status === 'degraded' && <ExclamationTriangleIcon className="w-4 h-4" />}
                    {health.database.status === 'down' && <XCircleIcon className="w-4 h-4" />}
                    <span className="text-sm font-semibold">{getStatusText(health.database.status)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="px-8 py-6 hover:bg-blueox-primary/5 transition-all duration-300 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blueox-primary transition-colors duration-300">Rate Limiting</h3>
                    <p className="text-sm text-gray-600">API request throttling and quota management</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500 font-medium">Response Time</p>
                    <p className="text-lg font-bold text-gray-900">{health.rate_limiting.response_time}ms</p>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-sm ${getStatusColor(health.rate_limiting.status)}`}>
                    {health.rate_limiting.status === 'healthy' && <CheckCircleIcon className="w-4 h-4" />}
                    {health.rate_limiting.status === 'degraded' && <ExclamationTriangleIcon className="w-4 h-4" />}
                    {health.rate_limiting.status === 'down' && <XCircleIcon className="w-4 h-4" />}
                    <span className="text-sm font-semibold">{getStatusText(health.rate_limiting.status)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API Endpoints Status */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blueox-accent/5 to-blueox-primary/5 px-8 py-6 border-b border-blueox-primary/10">
            <div className="flex items-center gap-3">
              <ServerIcon className="w-6 h-6 text-blueox-accent" />
              <h2 className="text-2xl font-bold text-blueox-primary-dark">API Endpoints</h2>
            </div>
            <p className="text-gray-600 mt-1">Individual endpoint health and performance</p>
          </div>
          
          <div className="divide-y divide-blueox-primary/10 max-h-96 overflow-y-auto">
            {health.endpoints.map((endpoint, index) => (
              <div key={index} className="px-8 py-6 hover:bg-blueox-accent/5 transition-all duration-300 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-gradient-to-r from-blueox-accent/10 to-blueox-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                      <ServerIcon className="w-4 h-4 text-blueox-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 font-mono group-hover:text-blueox-primary transition-colors duration-300 truncate">
                        {endpoint.endpoint}
                      </h3>
                      {endpoint.error_message && (
                        <p className="text-sm text-red-600 mt-1 bg-red-50 px-2 py-1 rounded-lg border border-red-200 truncate">
                          {endpoint.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-medium">Response Time</p>
                      <p className="text-sm font-bold text-gray-900">{endpoint.response_time}ms</p>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-sm text-xs font-semibold ${getStatusColor(endpoint.status)}`}>
                      {endpoint.status === 'healthy' && <CheckCircleIcon className="w-3 h-3" />}
                      {endpoint.status === 'degraded' && <ExclamationTriangleIcon className="w-3 h-3" />}
                      {endpoint.status === 'down' && <XCircleIcon className="w-3 h-3" />}
                      <span>{getStatusText(endpoint.status)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Information */}
        <div className="bg-white/60 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm">
            <ClockIcon className="w-4 h-4 text-blueox-primary" />
            <span className="text-gray-700 font-medium">
              Last updated: {lastUpdated?.toLocaleTimeString()}
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-600">Auto-refreshes every 30 seconds</span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-blueox-primary/10">
            <p className="text-sm text-gray-600">
              Need help? Contact our support team:
            </p>
            <a 
              href="mailto:support@blueox.app" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-accent to-blueox-primary hover:from-blueox-primary-hover hover:to-blueox-accent text-black px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <ServerIcon className="w-4 h-4" />
              support@blueox.app
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}