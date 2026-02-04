'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  DocumentTextIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  SparklesIcon,
  RocketLaunchIcon,
  TruckIcon,
  ShoppingBagIcon,
  HomeModernIcon,
  UsersIcon,
  CakeIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  AcademicCapIcon,
  HeartIcon,
  ScaleIcon,
  BanknotesIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline';
import { getPrice, formatPrice, detectRegion, getRegionName, type Region } from '@/lib/regional-pricing';

export default function Home() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annually'>('monthly');
  const [userRegion, setUserRegion] = useState<Region>('DEFAULT');
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);

  useEffect(() => {
    // Detect user's region on mount
    const region = detectRegion();
    setUserRegion(region);
    
    // Add small delay for fade-in effect (only if no cached region)
    const hasCachedRegion = typeof window !== 'undefined' && localStorage.getItem('blueox_region');
    
    if (hasCachedRegion) {
      // Instant load for returning visitors
      setIsLoadingPrices(false);
    } else {
      // Smooth fade-in for first-time visitors
      setTimeout(() => setIsLoadingPrices(false), 200);
    }
  }, []);

  // Get prices for current region
  const starterPrice = getPrice('starter', userRegion);
  const professionalPrice = getPrice('professional', userRegion);
  const enterprisePrice = getPrice('enterprise', userRegion);
  const features = [
    {
      icon: ChartBarIcon,
      title: 'Financial Management',
      description: 'Save 15+ hours/week on bookings and invoicing with automated workflows'
    },
    {
      icon: CurrencyDollarIcon,
      title: 'Multi-Currency Support',
      description: 'Process payments in USD, EUR, GBP, UGX with automatic conversion'
    },
    {
      icon: DocumentTextIcon,
      title: 'Invoice & Billing',
      description: '95% faster invoice generation with professional templates and tracking'
    },
    {
      icon: UserGroupIcon,
      title: 'Customer Management',
      description: 'Track 1000+ bookings per month with complete customer relationship tools'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Bank-Level Security',
      description: '99.9% uptime with GDPR compliance and enterprise-grade data protection'
    },
    {
      icon: BuildingOfficeIcon,
      title: 'Multi-Tenant Architecture',
      description: 'Industry-specific features built for tour operators, not generic spreadsheets'
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
        <div className="card bg-gradient-to-br from-blue-50 via-white to-purple-50 border border-blue-100 shadow-xl">
          <div className="card-body text-center py-12">
            <h2 className="text-3xl font-bold text-breco-navy mb-2">
              Ready to Get Started?
            </h2>
            <p className="text-gray-700 text-xl mb-3 font-semibold">
              Start your 30-day free trial today
            </p>
            <p className="text-gray-600 text-base mb-8 max-w-2xl mx-auto">
              Full access to all features. No credit card required. 
              Cancel anytime during your trial period.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/signup"
                className="btn bg-breco-navy text-white hover:bg-breco-navy/90 text-lg px-8 py-3 inline-block shadow-lg hover:shadow-xl transition-shadow"
              >
                Start Free Trial
              </Link>
              <div className="text-gray-600 text-sm">
                Questions? Contact us for a demo
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why BlueOx Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-breco-navy mb-3">
              Why BlueOx vs Excel or QuickBooks?
            </h2>
            <p className="text-gray-600 text-lg">Purpose-built for modern businesses, not adapted from generic tools</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <SparklesIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg text-breco-navy mb-2">Smart Business Features</h3>
              <p className="text-gray-600 text-sm">
                Invoicing, inventory, CRM, and financial reporting built-in. Add industry modules only when you need them. No complex spreadsheets or workarounds.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CurrencyDollarIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg text-breco-navy mb-2">Multi-Currency Built-In</h3>
              <p className="text-gray-600 text-sm">
                Handle USD, EUR, GBP, UGX seamlessly with automatic conversion. No manual exchange rate calculations or currency confusion.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BoltIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg text-breco-navy mb-2">Automated Workflows</h3>
              <p className="text-gray-600 text-sm">
                From quote to invoice to payment to reporting - streamlined for how real businesses work, saving 15+ hours every week.
              </p>
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
          <p className="text-lg text-gray-600 mb-6">
            Choose the plan that fits your business needs
          </p>
          
          {/* Billing Period Toggle */}
          <div className="flex items-center justify-center gap-3">
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-breco-navy shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annually')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  billingPeriod === 'annually'
                    ? 'bg-white text-breco-navy shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Annually
              </button>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-opacity ${
              billingPeriod === 'annually' 
                ? 'bg-green-100 text-green-800 opacity-100' 
                : 'bg-green-100 text-green-800 opacity-0'
            }`}>
              Save 10%
            </span>
          </div>
        </div>
        
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 transition-opacity duration-300 ${
          isLoadingPrices ? 'opacity-0' : 'opacity-100'
        }`}>
          {/* Loading Skeleton */}
          {isLoadingPrices && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="card bg-white border border-blue-100 shadow-sm">
                  <div className="card-body text-center">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-4 animate-pulse"></div>
                    <div className="h-12 bg-gray-200 rounded w-2/3 mx-auto mb-4 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-6 animate-pulse"></div>
                    <div className="space-y-3 mb-6">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                      ))}
                    </div>
                    <div className="h-10 bg-gray-200 rounded w-full animate-pulse"></div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Actual Pricing Cards */}
          {!isLoadingPrices && (
            <>
          {/* Starter Plan */}
          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body text-center">
              <h3 className="text-xl font-semibold text-breco-navy mb-2">Starter</h3>
              {billingPeriod === 'monthly' ? (
                <div className="text-4xl font-bold text-breco-navy mb-4">
                  {formatPrice(starterPrice.monthly, starterPrice.currency)}<span className="text-lg font-normal text-gray-600">/month</span>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="text-4xl font-bold text-breco-navy">
                    {formatPrice(starterPrice.annually, starterPrice.currency)}<span className="text-lg font-normal text-gray-600">/month</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatPrice(starterPrice.annually * 12, starterPrice.currency)} billed annually</p>
                </div>
              )}
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
              {billingPeriod === 'monthly' ? (
                <div className="text-4xl font-bold text-breco-navy mb-4">
                  {formatPrice(professionalPrice.monthly, professionalPrice.currency)}<span className="text-lg font-normal text-gray-600">/month</span>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="text-4xl font-bold text-breco-navy">
                    {formatPrice(professionalPrice.annually, professionalPrice.currency)}<span className="text-lg font-normal text-gray-600">/month</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatPrice(professionalPrice.annually * 12, professionalPrice.currency)} billed annually</p>
                </div>
              )}
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
              <p className="text-xs text-gray-500 mt-3">{formatPrice(professionalPrice.setupFee, professionalPrice.currency)} one-time setup fee</p>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body text-center">
              <h3 className="text-xl font-semibold text-breco-navy mb-2">Enterprise</h3>
              {billingPeriod === 'monthly' ? (
                <div className="text-4xl font-bold text-breco-navy mb-4">
                  {formatPrice(enterprisePrice.monthly, enterprisePrice.currency)}<span className="text-lg font-normal text-gray-600">/month</span>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="text-4xl font-bold text-breco-navy">
                    {formatPrice(enterprisePrice.annually, enterprisePrice.currency)}<span className="text-lg font-normal text-gray-600">/month</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatPrice(enterprisePrice.annually * 12, enterprisePrice.currency)} billed annually</p>
                </div>
              )}
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
              <p className="text-xs text-gray-500 mt-3">{formatPrice(enterprisePrice.setupFee, enterprisePrice.currency)} one-time setup fee</p>
            </div>
          </div>
          </>
          )}
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

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-breco-navy mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600">
            Everything you need to know about BlueOx
          </p>
        </div>

        <div className="space-y-6">
          {/* FAQ 1 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-breco-navy mb-2">
              Is BlueOx only for tour operators?
            </h3>
            <p className="text-gray-600 mb-4">
              No! BlueOx is a complete business management platform that works for ANY business. The core includes accounting, invoicing, inventory, expenses, and customer management. Tour operators, hotels, transport companies, retail shops, and restaurants can add industry-specific modules as needed. You get powerful financial management regardless of your industry.
            </p>
            
            {/* Business Categories Grid */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Businesses using BlueOx:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <SparklesIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Tour Operators</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TruckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Transport & Logistics</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <HomeModernIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Hotels & Lodges</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ShoppingBagIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Retail Shops</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CakeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Restaurants & Cafes</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <UsersIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Security Services</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <WrenchScrewdriverIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Construction</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BeakerIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Healthcare</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AcademicCapIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Education</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <HeartIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Salons & Spas</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ScaleIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Legal & Consulting</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BanknotesIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Finance & Accounting</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BuildingStorefrontIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Wholesalers</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BuildingOfficeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Real Estate</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ChartBarIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Any Business</span>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-breco-navy mb-2">
              What currencies do you support?
            </h3>
            <p className="text-gray-600">
              We support USD, EUR, GBP, and UGX with automatic currency conversion. You can invoice clients in one currency, pay suppliers in another, and run reports in your preferred currency. Exchange rates update automatically.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-breco-navy mb-2">
              Is my data secure?
            </h3>
            <p className="text-gray-600">
              Yes. We use bank-level encryption, maintain 99.9% uptime, and are GDPR compliant. Your company's data is completely isolated from other companies (multi-tenant architecture). We perform daily backups and have enterprise-grade security protocols.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-breco-navy mb-2">
              Can I try it before paying?
            </h3>
            <p className="text-gray-600">
              Absolutely! We offer a 30-day free trial with full access to all core platform features (accounting, invoicing, inventory, expenses, CRM, reporting). Industry modules can also be tested free during the trial. No credit card required to start.
            </p>
          </div>

          {/* FAQ 5 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-breco-navy mb-2">
              Do I need multiple modules?
            </h3>
            <p className="text-gray-600">
              Not at all. The core platform (Starter/Professional/Enterprise plans) includes everything most businesses need: accounting, invoicing, expenses, and reporting. Industry modules are optional add-ons. Start with just the core, and add modules later if you need specialized features.
            </p>
          </div>

          {/* FAQ 6 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-breco-navy mb-2">
              Can I cancel anytime?
            </h3>
            <p className="text-gray-600">
              Yes. There are no long-term contracts. You can cancel your subscription anytime with one month's notice. If you cancel during your trial period, you won't be charged at all. We also provide data export so you can take your information with you.
            </p>
          </div>
        </div>

        {/* Still have questions CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <a 
            href="mailto:admin@blueoxjobs.eu?subject=BlueOx Question" 
            className="inline-flex items-center gap-2 text-breco-navy hover:text-breco-navy/80 font-semibold"
          >
            <EnvelopeIcon className="w-5 h-5" />
            Contact our team
          </a>
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
              <a href="mailto:admin@blueoxjobs.eu" className="hover:text-breco-navy transition-colors flex items-center gap-1">
                <EnvelopeIcon className="w-4 h-4" />
                admin@blueoxjobs.eu
              </a>
              <a href="https://wa.me/48666250547" target="_blank" rel="noopener noreferrer" className="hover:text-breco-navy transition-colors flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                +48 666 250 547
              </a>
              <a href="https://wa.me/3197010209759" target="_blank" rel="noopener noreferrer" className="hover:text-breco-navy transition-colors flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                +31 970 102 09759
              </a>
              <a href="https://wa.me/256726315664" target="_blank" rel="noopener noreferrer" className="hover:text-breco-navy transition-colors flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                +256 726 315 664
              </a>
              <a href="tel:+256783728865" className="hover:text-breco-navy transition-colors flex items-center gap-1">
                <PhoneIcon className="w-4 h-4" />
                +256 783 728 865
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

