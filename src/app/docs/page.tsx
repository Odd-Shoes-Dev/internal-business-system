'use client';

import { useState } from 'react';

interface DocumentationSection {
  title: string;
  description: string;
  items: DocumentationItem[];
}

interface DocumentationItem {
  name: string;
  description: string;
  path: string;
  category: 'api' | 'guide' | 'contract' | 'technical';
  audience: 'developer' | 'business' | 'admin' | 'all';
}

const documentationSections: DocumentationSection[] = [
  {
    title: 'API Documentation',
    description: 'Complete API integration guides and specifications',
    items: [
      {
        name: 'API Integration Guide',
        description: 'Complete integration guide with code examples',
        path: '/docs/api/API_INTEGRATION_GUIDE.md',
        category: 'api',
        audience: 'developer'
      },
      {
        name: 'OpenAPI Specification',
        description: 'Machine-readable API specification',
        path: '/docs/api/openapi.json',
        category: 'api',
        audience: 'developer'
      },
      {
        name: 'API Implementation Summary',
        description: 'Technical implementation details',
        path: '/docs/api/API_IMPLEMENTATION_SUMMARY.md',
        category: 'technical',
        audience: 'developer'
      }
    ]
  },
  {
    title: 'User Guides',
    description: 'User-facing documentation and guides',
    items: [
      {
        name: 'User Guide',
        description: 'Complete user manual for the platform',
        path: '/docs/USER_GUIDE.md',
        category: 'guide',
        audience: 'all'
      },
      {
        name: 'Multi-Currency Guide',
        description: 'How to work with multiple currencies',
        path: '/docs/MULTI_CURRENCY_GUIDE.md',
        category: 'guide',
        audience: 'business'
      }
    ]
  },
  {
    title: 'Business & Legal',
    description: 'Contracts, pricing, and business documentation',
    items: [
      {
        name: 'Pricing Guide',
        description: 'Complete pricing information',
        path: '/docs/contracts/PRICING_GUIDE.md',
        category: 'contract',
        audience: 'business'
      },
      {
        name: 'Terms of Service',
        description: 'Platform terms and conditions',
        path: '/docs/contracts/TERMS_OF_SERVICE.md',
        category: 'contract',
        audience: 'all'
      },
      {
        name: 'Privacy Policy',
        description: 'Data privacy and protection policy',
        path: '/docs/contracts/PRIVACY_POLICY.md',
        category: 'contract',
        audience: 'all'
      },
      {
        name: 'Service Level Agreement',
        description: 'Platform uptime and support commitments',
        path: '/docs/contracts/SLA.md',
        category: 'contract',
        audience: 'business'
      }
    ]
  },
  {
    title: 'Technical Documentation',
    description: 'System architecture and technical guides',
    items: [
      {
        name: 'SaaS Architecture Guide',
        description: 'Complete system architecture documentation',
        path: '/docs/SAAS_ARCHITECTURE_GUIDE.md',
        category: 'technical',
        audience: 'admin'
      },
      {
        name: 'Security Audit',
        description: 'Security implementation and audit results',
        path: '/docs/SECURITY_AUDIT.md',
        category: 'technical',
        audience: 'admin'
      },
      {
        name: 'Multi-Tenant Guide',
        description: 'Multi-tenancy implementation details',
        path: '/docs/MULTI_TENANT_GUIDE.md',
        category: 'technical',
        audience: 'admin'
      }
    ]
  }
];

export default function DocumentationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  
  const filteredSections = documentationSections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAudience = selectedAudience === 'all' || item.audience === selectedAudience;
      return matchesSearch && matchesAudience;
    })
  })).filter(section => section.items.length > 0);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'api': return 'bg-blue-100 text-blue-800';
      case 'guide': return 'bg-green-100 text-green-800';
      case 'contract': return 'bg-purple-100 text-purple-800';
      case 'technical': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            BlueOx Platform Documentation
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Complete documentation for developers, business users, and system administrators
          </p>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={selectedAudience}
                onChange={(e) => setSelectedAudience(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Audiences</option>
                <option value="developer">Developers</option>
                <option value="business">Business Users</option>
                <option value="admin">Administrators</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Access Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Started</h3>
            <p className="text-gray-600 mb-4">New to BlueOx? Start here</p>
            <a 
              href="/docs/USER_GUIDE.md" 
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              User Guide
            </a>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Integration</h3>
            <p className="text-gray-600 mb-4">Integrate with our APIs</p>
            <a 
              href="/docs/api/API_INTEGRATION_GUIDE.md"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              API Guide
            </a>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">System Status</h3>
            <p className="text-gray-600 mb-4">Check API availability</p>
            <a 
              href="/status"
              className="inline-block px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Status Page
            </a>
          </div>
        </div>

        {/* Documentation Sections */}
        {filteredSections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No documentation found matching your criteria</p>
          </div>
        ) : (
          filteredSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="bg-white rounded-lg shadow-sm mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-2xl font-semibold text-gray-900">{section.title}</h2>
                <p className="text-gray-600 mt-1">{section.description}</p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            <a 
                              href={item.path}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {item.name}
                            </a>
                          </h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(item.category)}`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="text-gray-600">{item.description}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Audience: {item.audience === 'all' ? 'All users' : item.audience}
                        </p>
                      </div>
                      <div>
                        <a 
                          href={item.path}
                          className="inline-block px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-600">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@blueox.app" className="text-blue-600 hover:underline">
              support@blueox.app
            </a>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Documentation last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}