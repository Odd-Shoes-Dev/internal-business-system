'use client';

import Link from 'next/link';
import Image from 'next/image';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  DocumentTextIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

export default function Home() {
  const features = [
    {
      icon: ChartBarIcon,
      title: 'Financial Management',
      description: 'Comprehensive accounting and financial tracking for your business operations'
    },
    {
      icon: CurrencyDollarIcon,
      title: 'Multi-Currency Support',
      description: 'Handle transactions in multiple currencies with automatic conversion'
    },
    {
      icon: DocumentTextIcon,
      title: 'Invoice & Billing',
      description: 'Create professional invoices, track payments, and manage receivables'
    },
    {
      icon: UserGroupIcon,
      title: 'Customer Management',
      description: 'Organize customer data, track interactions, and manage relationships'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security with regular backups and data protection'
    },
    {
      icon: BuildingOfficeIcon,
      title: 'Multi-Tenant Architecture',
      description: 'Isolated company data with complete tenant separation and control'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Image
                src="/assets/logo.png"
                alt="BlueOx"
                width={180}
                height={72}
                className="-my-2"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-breco-navy hover:text-breco-navy/80 px-4 py-2 text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="btn-primary text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-breco-navy mb-6">
            Business Management
            <span className="block text-3xl sm:text-4xl lg:text-5xl mt-2 text-breco-navy/80">
              Made Simple
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            A comprehensive platform for financial management, operations tracking, 
            and business analytics. Everything you need to run your business efficiently.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="btn-primary text-lg px-8 py-3"
            >
              Start Free Trial
            </Link>
            <Link
              href="/login"
              className="btn-secondary text-lg px-8 py-3"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-breco-navy mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-gray-600">
            Built for modern businesses with everything you need in one place
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card bg-white border border-blue-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="card-body">
                <feature.icon className="h-10 w-10 text-breco-navy mb-4" />
                <h3 className="text-lg font-semibold text-breco-navy mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="card bg-gradient-to-r from-breco-navy to-breco-navy/90 border-0 shadow-xl">
          <div className="card-body text-center py-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Join businesses already using our platform to streamline their operations 
              and improve financial management.
            </p>
            <Link
              href="/signup"
              className="btn bg-white text-breco-navy hover:bg-gray-100 text-lg px-8 py-3 inline-block"
            >
              Create Your Account
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} BlueOx Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

