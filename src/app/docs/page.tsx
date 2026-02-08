'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  UsersIcon,
  SparklesIcon,
  RocketLaunchIcon,
  ServerIcon,
  ExclamationCircleIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

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
      case 'api': return 'bg-blue-100/80 text-blue-700 border-blue-200';
      case 'guide': return 'bg-green-100/80 text-green-700 border-green-200';
      case 'contract': return 'bg-purple-100/80 text-purple-700 border-purple-200';
      case 'technical': return 'bg-gray-100/80 text-gray-700 border-gray-200';
      default: return 'bg-gray-100/80 text-gray-700 border-gray-200';
    }
  };
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'api': return CodeBracketIcon;
      case 'guide': return BookOpenIcon;
      case 'contract': return DocumentTextIcon;
      case 'technical': return ServerIcon;
      default: return DocumentTextIcon;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto py-12 px-6 space-y-8">
        {/* Hero Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl px-6 py-3 shadow-lg mb-6">
            <BookOpenIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Documentation Center</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-blueox-primary-dark mb-4 leading-tight">
            BlueOx Platform Documentation
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Complete guides, API references, and technical documentation for developers, business users, and administrators
          </p>
        </div>

        {/* Search and Filter */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <MagnifyingGlassIcon className="w-6 h-6 text-blueox-primary" />
            <h2 className="text-xl font-bold text-blueox-primary-dark">Find Documentation</h2>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search guides, API docs, contracts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-lg focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                />
              </div>
            </div>
            
            <div className="lg:w-64">
              <div className="relative">
                <UsersIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-lg focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
                >
                  <option value="all">All Audiences</option>
                  <option value="developer">Developers</option>
                  <option value="business">Business Users</option>
                  <option value="admin">Administrators</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <RocketLaunchIcon className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-blueox-primary-dark">Get Started</h3>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              New to BlueOx? Start your journey with our comprehensive user guide
            </p>
            <a 
              href="/docs/USER_GUIDE.md" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <BookOpenIcon className="w-4 h-4" />
              User Guide
              <ArrowTopRightOnSquareIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </a>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <CodeBracketIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-blueox-primary-dark">API Integration</h3>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Build powerful integrations with our RESTful APIs and webhooks
            </p>
            <a 
              href="/docs/api/API_INTEGRATION_GUIDE.md"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <CodeBracketIcon className="w-4 h-4" />
              API Guide
              <ArrowTopRightOnSquareIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </a>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blueox-primary/10 to-blueox-accent/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <ServerIcon className="w-6 h-6 text-blueox-primary" />
              </div>
              <h3 className="text-xl font-bold text-blueox-primary-dark">System Status</h3>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Monitor real-time API health and platform performance metrics
            </p>
            <a 
              href="/status"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-accent hover:from-blueox-primary-hover hover:to-blueox-accent text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <EyeIcon className="w-4 h-4" />
              Status Page
              <ArrowTopRightOnSquareIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </a>
          </div>
        </div>

        {/* Documentation Sections */}
        {filteredSections.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-12 shadow-xl text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blueox-primary/10 to-blueox-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ExclamationCircleIcon className="w-8 h-8 text-blueox-primary" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              No documentation found matching your search criteria. Try adjusting your filters or search terms.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredSections.map((section, sectionIndex) => {
              const CategoryIcon = getCategoryIcon(section.items[0]?.category || 'guide');
              return (
                <div key={sectionIndex} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 px-8 py-6 border-b border-blueox-primary/10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blueox-primary/10 to-blueox-accent/10 rounded-xl flex items-center justify-center">
                        <CategoryIcon className="w-5 h-5 text-blueox-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-blueox-primary-dark">{section.title}</h2>
                        <p className="text-gray-600 mt-1">{section.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-blueox-primary/10">
                    {section.items.map((item, itemIndex) => {
                      const ItemCategoryIcon = getCategoryIcon(item.category);
                      return (
                        <div key={itemIndex} className="px-8 py-6 hover:bg-blueox-primary/5 transition-all duration-300 group">
                          <div className="flex items-start justify-between gap-6">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="w-8 h-8 bg-gradient-to-r from-blueox-accent/10 to-blueox-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0 mt-1">
                                <ItemCategoryIcon className="w-4 h-4 text-blueox-accent" />
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-blueox-primary transition-colors duration-300">
                                    <a 
                                      href={item.path}
                                      className="hover:underline"
                                    >
                                      {item.name}
                                    </a>
                                  </h3>
                                  <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-xl border backdrop-blur-sm ${getCategoryColor(item.category)}`}>
                                    <ItemCategoryIcon className="w-3 h-3" />
                                    {item.category}
                                  </span>
                                </div>
                                
                                <p className="text-gray-600 mb-3 leading-relaxed">{item.description}</p>
                                
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <UsersIcon className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-500 font-medium">
                                      {item.audience === 'all' ? 'All users' : 
                                       item.audience === 'developer' ? 'Developers' :
                                       item.audience === 'business' ? 'Business Users' :
                                       item.audience === 'admin' ? 'Administrators' : item.audience}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0">
                              <a 
                                href={item.path}
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-accent to-blueox-primary hover:from-blueox-primary-hover hover:to-blueox-accent text-black px-4 py-2 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
                              >
                                <EyeIcon className="w-4 h-4" />
                                View
                                <ArrowTopRightOnSquareIcon className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-300" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="bg-white/60 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-8 shadow-lg text-center space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <p className="text-gray-600">
              Need help? Contact our support team:
            </p>
            <a 
              href="mailto:support@blueox.app" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-accent to-blueox-primary hover:from-blueox-primary-hover hover:to-blueox-accent text-black px-4 py-2 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <SparklesIcon className="w-4 h-4" />
              support@blueox.app
            </a>
          </div>
          
          <div className="pt-4 border-t border-blueox-primary/10">
            <p className="text-sm text-gray-500">
              Documentation last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}