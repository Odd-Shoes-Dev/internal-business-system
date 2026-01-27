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
                width={70}
                height={24}
                className="object-contain"
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
          <div className="mb-4">
            <span className="inline-block text-sm font-medium text-breco-navy/70 bg-white px-4 py-2 rounded-full border border-blue-100">
              Powered by BlueOx
            </span>
          </div>
          <div className="mb-6">
            <span className="inline-block text-base font-semibold text-white bg-gradient-to-r from-breco-navy to-breco-navy/90 px-6 py-2.5 rounded-full shadow-md">
              30-Day Free Trial • Full Access • No Credit Card Required
            </span>
          </div>
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
            <h2 className="text-3xl font-bold text-white mb-2">
              Ready to Get Started?
            </h2>
            <p className="text-blue-100 text-xl mb-3 font-semibold">
              Start your 30-day free trial today
            </p>
            <p className="text-blue-100 text-base mb-8 max-w-2xl mx-auto">
              Full access to all features. No credit card required. 
              Cancel anytime during your trial period.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/signup"
                className="btn bg-white text-breco-navy hover:bg-gray-100 text-lg px-8 py-3 inline-block"
              >
                Start Free Trial
              </Link>
              <div className="text-blue-100 text-sm">
                Questions? Contact us for a demo
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-breco-navy mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600">
            Choose the plan that fits your business needs
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
          {/* Starter Plan */}
          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body text-center">
              <h3 className="text-xl font-semibold text-breco-navy mb-2">Starter</h3>
              <div className="text-4xl font-bold text-breco-navy mb-4">
                $29<span className="text-lg font-normal text-gray-600">/month</span>
              </div>
              <p className="text-gray-600 text-sm mb-6">Perfect for solo operators and small businesses</p>
              <ul className="text-left space-y-3 mb-6 text-sm">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Up to 5 users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>1GB storage</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Core accounting & invoicing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>1 industry module</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Email support (48-hour response)</span>
                </li>
              </ul>
              <Link href="/signup" className="btn-secondary w-full">
                Start Trial
              </Link>
              <p className="text-xs text-gray-500 mt-3">Free setup • No onboarding fee</p>
            </div>
          </div>

          {/* Professional Plan */}
          <div className="card bg-white border-2 border-breco-navy shadow-lg relative overflow-visible">
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
              <span className="bg-breco-navy text-white px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap">
                Most Popular
              </span>
            </div>
            <div className="card-body text-center pt-6">
              <h3 className="text-xl font-semibold text-breco-navy mb-2">Professional</h3>
              <div className="text-4xl font-bold text-breco-navy mb-4">
                $99<span className="text-lg font-normal text-gray-600">/month</span>
              </div>
              <p className="text-gray-600 text-sm mb-6">For growing businesses and tour operators</p>
              <ul className="text-left space-y-3 mb-6 text-sm">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Up to 25 users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>10GB storage</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Full accounting suite</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Up to 3 industry modules</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Priority support & live chat</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Custom branding</span>
                </li>
              </ul>
              <Link href="/signup" className="btn-primary w-full">
                Start Trial
              </Link>
              <p className="text-xs text-gray-500 mt-3">$99 one-time setup fee</p>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body text-center">
              <h3 className="text-xl font-semibold text-breco-navy mb-2">Enterprise</h3>
              <div className="text-4xl font-bold text-breco-navy mb-4">
                $299<span className="text-lg font-normal text-gray-600">/month</span>
              </div>
              <p className="text-gray-600 text-sm mb-6">For large operations and multi-branch businesses</p>
              <ul className="text-left space-y-3 mb-6 text-sm">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Unlimited users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>100GB storage</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Up to 7 industry modules</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>White-label option</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>24/7 emergency hotline</span>
                </li>
              </ul>
              <a href="mailto:admin@blueoxjobs.eu?subject=Enterprise Plan Inquiry - BlueOx Business Platform" className="btn-secondary w-full text-center">
                Contact Sales
              </a>
              <p className="text-xs text-gray-500 mt-3">$499 one-time setup fee</p>
            </div>
          </div>
        </div>
      </div>

      {/* Industry Modules Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-breco-navy mb-4">
            Industry-Specific Modules
          </h2>
          <p className="text-lg text-gray-600">
            Extend your system with specialized modules for your industry
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-breco-navy mb-2">Tours & Safari Management</h3>
              <p className="text-sm text-gray-600 mb-3">$39/month</p>
              <p className="text-sm text-gray-600">Tour packages, itineraries, bookings, vehicle assignment, and guide scheduling</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-breco-navy mb-2">Fleet Management</h3>
              <p className="text-sm text-gray-600 mb-3">$35/month</p>
              <p className="text-sm text-gray-600">Vehicle tracking, maintenance scheduling, fuel monitoring, and driver management</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-breco-navy mb-2">Hotel Management</h3>
              <p className="text-sm text-gray-600 mb-3">$45/month</p>
              <p className="text-sm text-gray-600">Room inventory, bookings, check-in/out, housekeeping, and occupancy reports</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-breco-navy mb-2">Cafe & Restaurant POS</h3>
              <p className="text-sm text-gray-600 mb-3">$49/month</p>
              <p className="text-sm text-gray-600">Point of sale, menu management, table orders, and kitchen display system</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-breco-navy mb-2">Retail & Shop Management</h3>
              <p className="text-sm text-gray-600 mb-3">$35/month</p>
              <p className="text-sm text-gray-600">Product catalog, inventory, barcode scanning, and POS system</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-breco-navy mb-2">Security Services</h3>
              <p className="text-sm text-gray-600 mb-3">$29/month</p>
              <p className="text-sm text-gray-600">Guard scheduling, site assignment, patrol logs, and incident reporting</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-breco-navy mb-2">Inventory & Assets</h3>
              <p className="text-sm text-gray-600 mb-3">$39/month</p>
              <p className="text-sm text-gray-600">Asset tracking, depreciation, maintenance scheduling, and multi-location warehouse support</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-2">
              Built and powered by <span className="font-semibold text-breco-navy">BlueOx</span>
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600 mb-3">
              <a href="mailto:admin@blueoxjobs.eu" className="hover:text-breco-navy transition-colors">
                📧 admin@blueoxjobs.eu
              </a>
              <a href="https://wa.me/48666250547" target="_blank" rel="noopener noreferrer" className="hover:text-breco-navy transition-colors">
                💬 +48 666 250 547
              </a>
              <a href="https://wa.me/256726315664" target="_blank" rel="noopener noreferrer" className="hover:text-breco-navy transition-colors">
                💬 +256 726 315 664
              </a>
              <a href="tel:+256783728865" className="hover:text-breco-navy transition-colors">
                📞 +256 783 728 865
              </a>
            </div>
            <p className="text-gray-500 text-xs">
              &copy; {new Date().getFullYear()} BlueOx. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

