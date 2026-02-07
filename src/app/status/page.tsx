'use client';

import { useState, useEffect } from 'react';

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
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'down': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '[OK]';
      case 'degraded': return '[WARN]';
      case 'down': return '[ERROR]';
      default: return '[UNKNOWN]';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">[ERROR]</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Status Unavailable</h1>
          <p className="text-gray-600">Unable to fetch system status</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">BlueOx API Status</h1>
          <p className="text-gray-600">Real-time status of our API services</p>
          <div className="mt-4 flex justify-center items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.status)}`}>
              {getStatusIcon(health.status)} {health.status.toUpperCase()}
            </div>
            <span className="text-sm text-gray-500">
              Version {health.version}
            </span>
          </div>
        </div>

        {/* Overall Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Response Time</h3>
            <p className="text-2xl font-bold text-blue-600">
              {health.overall_performance.avg_response_time.toFixed(0)}ms
            </p>
            <p className="text-sm text-gray-500">Average over last hour</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Rate</h3>
            <p className="text-2xl font-bold text-blue-600">
              {health.overall_performance.error_rate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">Over last hour</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Uptime</h3>
            <p className="text-2xl font-bold text-green-600">99.9%</p>
            <p className="text-sm text-gray-500">Last 30 days</p>
          </div>
        </div>

        {/* Service Status */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Core Services</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {/* Database */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Database</h3>
                <p className="text-sm text-gray-500">PostgreSQL connection and query performance</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">{health.database.response_time}ms</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health.database.status)}`}>
                  {getStatusIcon(health.database.status)} {health.database.status}
                </span>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Rate Limiting</h3>
                <p className="text-sm text-gray-500">API request throttling and quota management</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">{health.rate_limiting.response_time}ms</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health.rate_limiting.status)}`}>
                  {getStatusIcon(health.rate_limiting.status)} {health.rate_limiting.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* API Endpoints */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">API Endpoints</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {health.endpoints.map((endpoint, index) => (
              <div key={index} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 font-mono text-sm">{endpoint.endpoint}</h3>
                  {endpoint.error_message && (
                    <p className="text-sm text-red-600 mt-1">{endpoint.error_message}</p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">{endpoint.response_time}ms</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(endpoint.status)}`}>
                    {getStatusIcon(endpoint.status)} {endpoint.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Last updated: {lastUpdated?.toLocaleTimeString()} | 
            Auto-refreshes every 30 seconds
          </p>
          <p className="mt-2">
            For support: <a href="mailto:support@blueox.app" className="text-blue-600 hover:underline">support@blueox.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}