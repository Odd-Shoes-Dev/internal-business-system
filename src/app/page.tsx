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
  FireIcon,
  EyeIcon,
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
import { getPrice, formatPrice, detectRegion, getRegionName, MODULE_PRICING, type Region } from '@/lib/regional-pricing';

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
  const modulePrice = MODULE_PRICING[userRegion] ?? MODULE_PRICING.DEFAULT;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-2xl"></div>
      </div>

      {/* Navigation - Floating Design */}
      <nav className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm">
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
                className="text-blueox-primary hover:text-blueox-primary-hover px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg hover:bg-white/50"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-blueox-primary hover:bg-blueox-primary-hover text-black px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Asymmetrical Adventure Layout */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[80vh]">
            
            {/* Left Side - Main Content (Larger) */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-6">
                <div className="inline-block">
                  <span className="text-sm font-medium text-blueox-primary bg-white/80 px-4 py-2 rounded-full border border-blueox-primary/20 shadow-sm backdrop-blur-sm flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-blueox-primary" />
                    Powered by BlueOx
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div className="overflow-hidden">
                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
                      <span className="block text-blueox-primary blueox-animate-slide-up">Business</span>
                      <span className="block text-blueox-primary-dark blueox-animate-slide-up" style={{animationDelay: '0.2s'}}>Management</span>
                      <span className="block text-2xl sm:text-3xl lg:text-4xl font-medium text-blueox-accent blueox-animate-slide-up mt-2 flex items-center gap-3" style={{animationDelay: '0.4s'}}>
                        Made Simple
                        <RocketLaunchIcon className="w-8 h-8 text-blueox-accent" />
                      </span>
                    </h1>
                  </div>
                  
                  <p className="text-xl sm:text-2xl text-gray-600 max-w-2xl leading-relaxed blueox-animate-slide-up" style={{animationDelay: '0.6s'}}>
                    Transform your business with our comprehensive platform for 
                    <span className="font-semibold text-blueox-primary"> financial management</span>,
                    <span className="font-semibold text-blueox-accent"> operations tracking</span>, and
                    <span className="font-semibold text-blueox-primary-dark"> business analytics</span>.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 blueox-animate-slide-up" style={{animationDelay: '0.8s'}}>
                  <Link
                    href="/signup"
                    className="group bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    Start Your Journey
                    <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                  </Link>
                  <Link
                    href="/login"
                    className="bg-white/80 backdrop-blur-sm hover:bg-white text-blueox-primary border-2 border-blueox-primary/20 hover:border-blueox-primary/40 px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 hover:shadow-lg"
                  >
                    Sign In
                  </Link>
                </div>

                {/* Trial Badge */}
                <div className="blueox-animate-slide-up" style={{animationDelay: '1s'}}>
                  <div className="inline-block bg-white border-2 border-blueox-primary text-blueox-primary px-6 py-3 rounded-xl font-medium shadow-lg flex items-center gap-2">
                    30-Day Free Trial • No Credit Card Required
                    <SparklesIcon className="w-5 h-5 text-blueox-primary" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Visual Elements (Smaller but Engaging) */}
            <div className="lg:col-span-5 relative">
              <div className="relative blueox-animate-fade-in" style={{animationDelay: '1.2s'}}>
                {/* Stats Cards - Floating Effect */}
                <div className="space-y-4">
                  <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blueox-primary rounded-xl flex items-center justify-center">
                        <ChartBarIcon className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blueox-primary">15+</div>
                        <div className="text-sm text-gray-600">Hours Saved Weekly</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ml-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blueox-accent rounded-xl flex items-center justify-center">
                        <CurrencyDollarIcon className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blueox-primary">95%</div>
                        <div className="text-sm text-gray-600">Faster Invoicing</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blueox-primary-dark rounded-xl flex items-center justify-center">
                        <ShieldCheckIcon className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blueox-primary">99.9%</div>
                        <div className="text-sm text-gray-600">Uptime Guarantee</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 blueox-animate-fade-in" style={{animationDelay: '1.5s'}}>
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-blueox-primary font-medium">Discover More</span>
            <div className="w-6 h-10 border-2 border-blueox-primary rounded-full flex justify-center">
              <div className="w-1 h-3 bg-blueox-primary rounded-full mt-2 animate-bounce"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section - Dynamic Zigzag Flow */}
      <div className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-transparent"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Section Header - Center */}
          <div className="text-center mb-20">
            <div className="inline-block blueox-animate-fade-in">
              <span className="text-sm font-medium text-blueox-accent bg-blueox-accent/10 px-4 py-2 rounded-full flex items-center gap-2">
                <RocketLaunchIcon className="w-4 h-4 text-blueox-accent" />
                Powerful Features
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-blueox-primary mt-6 mb-4 blueox-animate-slide-up" style={{animationDelay: '0.2s'}}>
              Everything You Need 
              <span className="block text-blueox-primary-dark">In One Platform</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto blueox-animate-slide-up" style={{animationDelay: '0.4s'}}>
              Built for modern businesses with advanced features that grow with you
            </p>
          </div>

          {/* Feature 1 - Start Left */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 blueox-animate-slide-up" style={{animationDelay: '0.6s'}}>
                <div className="bg-gradient-to-br from-blueox-primary/10 to-blueox-accent/10 p-8 rounded-3xl border border-blueox-primary/20">
                  <div className="w-16 h-16 bg-blueox-primary rounded-2xl flex items-center justify-center mb-6">
                    <ChartBarIcon className="w-8 h-8 text-black" />
                  </div>
                  <h3 className="text-2xl font-bold text-blueox-primary mb-4">Financial Management</h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Save 15+ hours per week with automated bookkeeping and invoicing. 
                    Real-time financial insights with professional reports that help you make better business decisions.
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="bg-blueox-success/10 text-blueox-success px-3 py-1 rounded-full font-medium">
                      ✓ Automated Workflows
                    </span>
                    <span className="bg-blueox-success/10 text-blueox-success px-3 py-1 rounded-full font-medium">
                      ✓ Real-time Reports
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 flex justify-center relative">
                {/* Visual Arrow */}
                <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 hidden lg:block">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-blueox-primary to-blueox-accent"></div>
                  <div className="absolute right-0 top-0 w-0 h-0 border-l-4 border-l-blueox-accent border-t-2 border-b-2 border-t-transparent border-b-transparent transform translate-y-[-50%]"></div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-blueox-primary/10 hover:shadow-3xl transition-all duration-300 blueox-animate-fade-in" style={{animationDelay: '0.8s'}}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Revenue Growth</span>
                      <span className="text-blueox-success text-sm font-semibold">↗ +24%</span>
                    </div>
                    <div className="text-3xl font-bold text-blueox-primary">$45,280</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blueox-primary to-blueox-accent h-2 rounded-full w-3/4"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 - Transition Right */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1 flex justify-center relative">
                {/* Visual Arrow */}
                <div className="absolute -right-8 top-1/2 transform -translate-y-1/2 rotate-180 hidden lg:block">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-blueox-accent to-blueox-primary-dark"></div>
                  <div className="absolute right-0 top-0 w-0 h-0 border-l-4 border-l-blueox-primary-dark border-t-2 border-b-2 border-t-transparent border-b-transparent transform translate-y-[-50%]"></div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-blueox-accent/10 hover:shadow-3xl transition-all duration-300 blueox-animate-fade-in" style={{animationDelay: '1s'}}>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blueox-accent mb-2">4</div>
                    <div className="text-sm text-gray-600 mb-4">Supported Currencies</div>
                    <div className="flex gap-2 justify-center">
                      <span className="bg-blueox-accent/10 text-blueox-accent px-2 py-1 rounded text-xs font-medium">USD</span>
                      <span className="bg-blueox-accent/10 text-blueox-accent px-2 py-1 rounded text-xs font-medium">EUR</span>
                      <span className="bg-blueox-accent/10 text-blueox-accent px-2 py-1 rounded text-xs font-medium">GBP</span>
                      <span className="bg-blueox-accent/10 text-blueox-accent px-2 py-1 rounded text-xs font-medium">UGX</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2 blueox-animate-slide-up" style={{animationDelay: '1.2s'}}>
                <div className="bg-gradient-to-br from-blueox-accent/10 to-blueox-primary-dark/10 p-8 rounded-3xl border border-blueox-accent/20">
                  <div className="w-16 h-16 bg-blueox-accent rounded-2xl flex items-center justify-center mb-6">
                    <CurrencyDollarIcon className="w-8 h-8 text-black" />
                  </div>
                  <h3 className="text-2xl font-bold text-blueox-accent mb-4">Multi-Currency Support</h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Process payments in USD, EUR, GBP, UGX with automatic conversion. 
                    No more manual calculations or currency confusion - everything handled seamlessly.
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="bg-blueox-success/10 text-blueox-success px-3 py-1 rounded-full font-medium">
                      ✓ Auto Conversion
                    </span>
                    <span className="bg-blueox-success/10 text-blueox-success px-3 py-1 rounded-full font-medium">
                      ✓ Real-time Rates
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3 - Back to Left */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 blueox-animate-slide-up" style={{animationDelay: '1.4s'}}>
                <div className="bg-gradient-to-br from-blueox-primary-dark/10 to-blueox-success/10 p-8 rounded-3xl border border-blueox-primary-dark/20">
                  <div className="w-16 h-16 bg-blueox-primary-dark rounded-2xl flex items-center justify-center mb-6">
                    <DocumentTextIcon className="w-8 h-8 text-black" />
                  </div>
                  <h3 className="text-2xl font-bold text-blueox-primary-dark mb-4">Smart Invoicing & Billing</h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Generate professional invoices 95% faster with automated templates, 
                    payment tracking, and follow-up reminders. Your cash flow will thank you.
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="bg-blueox-success/10 text-blueox-success px-3 py-1 rounded-full font-medium">
                      ✓ Auto Templates
                    </span>
                    <span className="bg-blueox-success/10 text-blueox-success px-3 py-1 rounded-full font-medium">
                      ✓ Payment Tracking
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 flex justify-center relative">
                {/* Visual Arrow */}
                <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 hidden lg:block">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-blueox-primary-dark to-blueox-success"></div>
                  <div className="absolute right-0 top-0 w-0 h-0 border-l-4 border-l-blueox-success border-t-2 border-b-2 border-t-transparent border-b-transparent transform translate-y-[-50%]"></div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-blueox-success/10 hover:shadow-3xl transition-all duration-300 blueox-animate-fade-in" style={{animationDelay: '1.6s'}}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Invoice Processing</span>
                      <span className="bg-white border border-blueox-success text-blueox-success text-xs px-2 py-1 rounded-full">95% Faster</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blueox-primary-dark to-blueox-success rounded-full w-full animate-pulse"></div>
                    </div>
                    <div className="text-center text-sm text-gray-600">
                      From 2 hours → 6 minutes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action with Flow Animation */}
          <div className="text-center mt-20 blueox-animate-fade-in" style={{animationDelay: '1.8s'}}>
            <div className="bg-gradient-to-r from-blueox-primary via-blueox-accent to-blueox-primary-dark p-1 rounded-3xl inline-block">
              <div className="bg-white rounded-3xl px-12 py-8">
                <h3 className="text-3xl font-bold text-blueox-primary mb-4 flex items-center justify-center gap-3">
                  Ready for the Adventure?
                  <RocketLaunchIcon className="w-8 h-8 text-blueox-primary" />
                </h3>
                <p className="text-gray-600 text-lg mb-6">
                  Join thousands of businesses already transforming their operations
                </p>
                <Link
                  href="/signup"
                  className="bg-gradient-to-r from-blueox-primary to-blueox-accent hover:from-blueox-primary-hover hover:to-blueox-primary-dark text-black px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] inline-flex items-center gap-2 group"
                >
                  Start Your Journey
                  <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why BlueOx Section - Floating Cards Layout */}
      <div className="relative py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Curved Background Element */}
          <div className="absolute inset-0 bg-gradient-to-br from-blueox-primary/5 via-transparent to-blueox-accent/5 rounded-[3rem]"></div>
          
          <div className="relative">
            {/* Header with Adventure Theme */}
            <div className="text-center mb-16 blueox-animate-slide-up">
              <span className="text-sm font-medium text-blueox-primary bg-blueox-primary/10 px-4 py-2 rounded-full flex items-center gap-2">
                <BoltIcon className="w-4 h-4 text-blueox-primary" />
                Why Choose BlueOx?
              </span>
              <h2 className="text-4xl sm:text-5xl font-bold text-blueox-primary mt-6 mb-4">
                Beyond Spreadsheets
                <span className="block text-blueox-accent">& Generic Tools</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Purpose-built for modern businesses, not adapted from outdated solutions
              </p>
            </div>

            {/* Staggered Feature Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">
              {/* Card 1 - Higher */}
              <div className="lg:mt-0 blueox-animate-slide-up" style={{animationDelay: '0.2s'}}>
                <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-blueox-primary/10 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] relative">
                  <div className="w-20 h-20 bg-white border-2 border-blueox-primary rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                    <SparklesIcon className="w-10 h-10 text-blueox-primary" />
                    {/* Floating indicator */}
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blueox-success rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-black">1</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-blueox-primary mb-4 text-center">Smart Business Features</h3>
                  <p className="text-gray-600 leading-relaxed text-center">
                    Invoicing, inventory, CRM, and financial reporting built-in. Add industry modules only when you need them. No complex spreadsheets or workarounds.
                  </p>
                  <div className="mt-6 text-center">
                    <span className="text-blueox-accent font-semibold text-sm">All-in-One Solution →</span>
                  </div>
                </div>
              </div>

              {/* Card 2 - Lower */}
              <div className="lg:mt-12 blueox-animate-slide-up" style={{animationDelay: '0.4s'}}>
                <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-blueox-accent/10 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] relative">
                  <div className="w-20 h-20 bg-blueox-primary rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                    <CurrencyDollarIcon className="w-10 h-10 text-black" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blueox-success rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-black">2</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-blueox-accent mb-4 text-center">Multi-Currency Built-In</h3>
                  <p className="text-gray-600 leading-relaxed text-center">
                    Handle USD, EUR, GBP, UGX seamlessly with automatic conversion. No manual exchange rate calculations or currency confusion.
                  </p>
                  <div className="mt-6 text-center">
                    <span className="text-blueox-primary font-semibold text-sm">Global Business Ready →</span>
                  </div>
                </div>
              </div>

              {/* Card 3 - Higher again */}
              <div className="lg:mt-6 blueox-animate-slide-up" style={{animationDelay: '0.6s'}}>
                <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-blueox-primary-dark/10 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] relative">
                  <div className="w-20 h-20 bg-blueox-primary-dark rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                    <BoltIcon className="w-10 h-10 text-black" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blueox-success rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-black">3</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-blueox-primary-dark mb-4 text-center">Automated Workflows</h3>
                  <p className="text-gray-600 leading-relaxed text-center">
                    From quote to invoice to payment to reporting - streamlined for how real businesses work, saving 15+ hours every week.
                  </p>
                  <div className="mt-6 text-center">
                    <span className="text-blueox-success font-semibold text-sm">Save 15+ Hours Weekly →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center connecting element */}
            <div className="flex justify-center mt-16 blueox-animate-fade-in" style={{animationDelay: '0.8s'}}>
              <div className="bg-gradient-to-r from-blueox-primary to-blueox-accent p-1 rounded-2xl">
                <div className="bg-white rounded-2xl px-8 py-4 flex items-center gap-4">
                  <RocketLaunchIcon className="w-6 h-6 text-blueox-primary" />
                  <span className="text-blueox-primary font-semibold">Ready to experience the difference?</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section - Adventure Layout */}
      <div className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Pricing Header */}
          <div className="text-center mb-16 blueox-animate-slide-up">
            <span className="text-sm font-medium text-blueox-accent bg-blueox-accent/10 px-4 py-2 rounded-full flex items-center gap-2">
              <CurrencyDollarIcon className="w-4 h-4 text-blueox-accent" />
              Simple Pricing
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-blueox-primary mt-6 mb-4">
              Choose Your 
              <span className="block text-blueox-accent">Adventure Level</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Transparent pricing that grows with your business journey
            </p>
            
            {/* Enhanced Billing Toggle */}
            <div className="flex items-center justify-center gap-4 blueox-animate-fade-in" style={{animationDelay: '0.2s'}}>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-1 border border-blueox-primary/20 shadow-lg">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                    billingPeriod === 'monthly'
                      ? 'bg-blueox-primary text-black shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('annually')}
                  className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                    billingPeriod === 'annually'
                      ? 'bg-blueox-primary text-black shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Annually
                </button>
              </div>
              <span className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                billingPeriod === 'annually' 
                  ? 'bg-blueox-success/10 text-blueox-success opacity-100 scale-100' 
                  : 'bg-blueox-success/10 text-blueox-success opacity-0 scale-95'
              }`}>
                <EyeIcon className="w-4 h-4" />
                Save 10%
              </span>
            </div>
          </div>
          
          {/* Pricing Cards - Asymmetrical Layout */}
          <div className={`transition-opacity duration-500 ${
            isLoadingPrices ? 'opacity-0' : 'opacity-100'
          }`}>
            {/* Loading State */}
            {isLoadingPrices && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-6 animate-pulse"></div>
                    <div className="h-12 bg-gray-200 rounded w-2/3 mx-auto mb-6 animate-pulse"></div>
                    <div className="space-y-3 mb-8">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                      ))}
                    </div>
                    <div className="h-12 bg-gray-200 rounded w-full animate-pulse"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Actual Pricing Cards */}
            {!isLoadingPrices && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-end">
                
                {/* Starter Plan - Smaller */}
                <div className="lg:mb-8 blueox-animate-slide-up" style={{animationDelay: '0.2s'}}>
                  <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 border border-blueox-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 relative">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-blueox-primary mb-4">Starter</h3>
                      {billingPeriod === 'monthly' ? (
                        <div className="text-4xl font-bold text-blueox-primary mb-2">
                          {formatPrice(starterPrice.monthly, starterPrice.currency)}
                          <span className="text-lg font-normal text-gray-600">/month</span>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <div className="text-4xl font-bold text-blueox-primary">
                            {formatPrice(starterPrice.annually, starterPrice.currency)}
                            <span className="text-lg font-normal text-gray-600">/month</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{formatPrice(starterPrice.annually * 12, starterPrice.currency)} billed annually</p>
                        </div>
                      )}
                      <p className="text-gray-600 mb-6">Perfect for solo operators</p>
                      
                      <ul className="text-left space-y-3 mb-8 text-sm">
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>Up to 5 users</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>1GB storage</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>Complete platform (accounting, invoicing, CRM, reports)</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>+ 1 industry module of your choice</span>
                        </li>
                      </ul>
                      
                      <Link href="/signup" className="w-full bg-white border-2 border-blueox-primary text-blueox-primary hover:bg-blueox-primary hover:text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 inline-block">
                        Start Journey
                      </Link>
                      <p className="text-xs text-gray-500 mt-3">30-day free trial</p>
                    </div>
                  </div>
                </div>

                {/* Professional Plan - Largest (Featured) */}
                <div className="lg:mb-0 relative blueox-animate-slide-up" style={{animationDelay: '0.4s'}}>
                  {/* Popular Badge */}
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-white border-2 border-blueox-primary text-blueox-primary px-6 py-2 rounded-full font-semibold text-sm shadow-lg flex items-center gap-2">
                      <FireIcon className="w-4 h-4 text-blueox-primary" />
                      Most Popular
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-white to-blueox-primary/5 rounded-3xl p-10 border-2 border-blueox-primary shadow-2xl relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blueox-accent/10 to-transparent rounded-full blur-2xl"></div>
                    
                    <div className="text-center relative z-10">
                      <h3 className="text-3xl font-bold text-blueox-primary mb-4">Professional</h3>
                      {billingPeriod === 'monthly' ? (
                        <div className="text-5xl font-bold text-blueox-primary mb-2">
                          {formatPrice(professionalPrice.monthly, professionalPrice.currency)}
                          <span className="text-xl font-normal text-gray-600">/month</span>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <div className="text-5xl font-bold text-blueox-primary">
                            {formatPrice(professionalPrice.annually, professionalPrice.currency)}
                            <span className="text-xl font-normal text-gray-600">/month</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{formatPrice(professionalPrice.annually * 12, professionalPrice.currency)} billed annually</p>
                        </div>
                      )}
                      <ul className="text-left space-y-3 mb-8 text-lg">
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-sm">✓</span>
                          </span>
                          <span>Up to 25 users</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-sm">✓</span>
                          </span>
                          <span>10GB storage</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-sm">✓</span>
                          </span>
                          <span>Complete platform (all accounting, invoicing, CRM, reports)</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-sm">✓</span>
                          </span>
                          <span>+ Up to 3 industry modules included</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-sm">✓</span>
                          </span>
                          <span>API Access & Integrations</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-sm">✓</span>
                          </span>
                          <span>Priority support & live chat</span>
                        </li>
                      </ul>
                      
                      <Link href="/signup" className="w-full bg-gradient-to-r from-blueox-primary to-blueox-accent hover:from-blueox-primary-hover hover:to-blueox-primary-dark text-black px-6 py-4 rounded-2xl font-semibold transition-all duration-300 inline-block text-center shadow-xl hover:shadow-2xl">
                        Start Adventure
                      </Link>
                      <p className="text-xs text-gray-500 mt-3">Most popular choice • 30-day free trial</p>
                    </div>
                  </div>
                </div>

                {/* Enterprise Plan - Smaller */}
                <div className="lg:mb-6 blueox-animate-slide-up" style={{animationDelay: '0.6s'}}>
                  <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 border border-blueox-primary-dark/20 shadow-lg hover:shadow-xl transition-all duration-300 relative">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-blueox-primary-dark mb-4">Enterprise</h3>
                      {billingPeriod === 'monthly' ? (
                        <div className="text-4xl font-bold text-blueox-primary-dark mb-2">
                          {formatPrice(enterprisePrice.monthly, enterprisePrice.currency)}
                          <span className="text-lg font-normal text-gray-600">/month</span>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <div className="text-4xl font-bold text-blueox-primary-dark">
                            {formatPrice(enterprisePrice.annually, enterprisePrice.currency)}
                            <span className="text-lg font-normal text-gray-600">/month</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{formatPrice(enterprisePrice.annually * 12, enterprisePrice.currency)} billed annually</p>
                        </div>
                      )}
                      <p className="text-gray-600 mb-6">For large operations</p>
                      
                      <ul className="text-left space-y-3 mb-8 text-sm">
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>Unlimited users</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>100GB storage</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>Complete platform + All 7 industry modules</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>White-label option</span>
                        </li>
                        <li className="flex items-center">
                          <span className="w-5 h-5 bg-blueox-success/10 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blueox-success text-xs">✓</span>
                          </span>
                          <span>24/7 dedicated support</span>
                        </li>
                      </ul>
                      
                      <a href="mailto:admin@blueoxjobs.eu?subject=Enterprise Plan Inquiry - BlueOx Business Platform" className="w-full bg-white border-2 border-blueox-primary-dark text-blueox-primary-dark hover:bg-blueox-primary-dark hover:text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 inline-block text-center">
                        Contact Sales
                      </a>
                      <p className="text-xs text-gray-500 mt-3">Custom pricing available</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Industry Modules Section */}
      <div className="max-w-7xl mx-auto px-4 mt-8 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-blueox-primary mb-4">
            Industry-Specific Modules
          </h2>
          <p className="text-lg text-gray-600">
            Extend your system with specialized modules for your industry
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Tours & Safari Operations</h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.tours.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Tour packages, booking management, itineraries, destinations, and seasonal pricing</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Fleet Management</h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.fleet.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Vehicle tracking, maintenance scheduling, fuel monitoring, and driver management</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Hotel Management</h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.hotels.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Room inventory, reservations, check-in/out, housekeeping, and occupancy reports</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Inventory & Assets</h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.inventory.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Stock tracking, FIFO valuation, asset depreciation, and multi-location warehouse support</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Payroll Processing</h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.payroll.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Automated payroll, tax calculations, payslip generation, and compliance reporting</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Cafe & Restaurant</h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.cafe.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Sales tracking, revenue reports, food & beverage sales, and profit analysis</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm opacity-60">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Retail & Shop POS <span className="text-xs bg-gray-200 px-2 py-1 rounded ml-2">Coming Soon</span></h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.retail.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Product catalog, barcode scanning, POS system, and inventory tracking</p>
            </div>
          </div>

          <div className="card bg-white border border-blue-100 shadow-sm opacity-60">
            <div className="card-body">
              <h3 className="text-lg font-semibold text-blueox-primary mb-2">Security Services <span className="text-xs bg-gray-200 px-2 py-1 rounded ml-2">Coming Soon</span></h3>
              <p className="text-sm text-gray-600 mb-3">{modulePrice.currencySymbol} {modulePrice.security.toLocaleString()}/month</p>
              <p className="text-sm text-gray-600">Guard scheduling, site management, patrol logs, and incident reporting</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-blueox-primary mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600">
            Everything you need to know about BlueOx Business Platform
          </p>
        </div>

        <div className="space-y-6">
          {/* FAQ 1 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-blueox-primary mb-2">
              Is BlueOx Business Platform only for tour operators?
            </h3>
            <p className="text-gray-600 mb-4">
              No! BlueOx Business Platform is a complete business management system that works for ANY business. The core includes accounting, invoicing, inventory, expenses, and customer management. Tour operators, hotels, transport companies, retail shops, and restaurants can add industry-specific modules as needed. You get powerful financial management regardless of your industry.
            </p>
            
            {/* Business Categories Grid */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Businesses using BlueOx Business Platform:</p>
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
            <h3 className="font-semibold text-lg text-blueox-primary mb-2">
              What currencies do you support?
            </h3>
            <p className="text-gray-600">
              We support USD, EUR, GBP, and UGX with automatic currency conversion. You can invoice clients in one currency, pay suppliers in another, and run reports in your preferred currency. Exchange rates update automatically.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-blueox-primary mb-2">
              Is my data secure?
            </h3>
            <p className="text-gray-600">
              Yes. We use bank-level encryption, maintain 99.9% uptime, and are GDPR compliant. Your company's data is completely isolated from other companies (multi-tenant architecture). We perform daily backups and have enterprise-grade security protocols.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-blueox-primary mb-2">
              Can I try it before paying?
            </h3>
            <p className="text-gray-600">
              Absolutely! We offer a 30-day free trial with the Professional plan - full access to the complete platform (accounting, invoicing, inventory, expenses, customers, vendors, financial reports, multi-currency) plus your choice of up to 3 optional industry-specific modules. No credit card required to start.
            </p>
          </div>

          {/* FAQ 5 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-blueox-primary mb-2">
              Do I need multiple modules?
            </h3>
            <p className="text-gray-600">
              Not at all. Every plan includes the complete platform with all essential business features: accounting, invoicing, customers, vendors, expenses, bank accounts, multi-currency, and financial reports. Industry modules (Tours, Fleet, Hotels, etc.) are optional add-ons for specialized needs. Many businesses run successfully with just the base platform.
            </p>
          </div>

          {/* FAQ 6 */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-6">
            <h3 className="font-semibold text-lg text-blueox-primary mb-2">
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
            className="inline-flex items-center gap-2 text-blueox-primary hover:text-blueox-primary-hover font-semibold"
          >
            <EnvelopeIcon className="w-5 h-5" />
            Contact our team
          </a>
        </div>
      </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-2">
              Built and powered by <span className="font-semibold text-blueox-primary">BlueOx</span>
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600 mb-3">
              <a href="mailto:admin@blueoxjobs.eu" className="hover:text-blueox-primary transition-colors flex items-center gap-1">
                <EnvelopeIcon className="w-4 h-4" />
                admin@blueoxjobs.eu
              </a>
              <a href="https://wa.me/48666250547" target="_blank" rel="noopener noreferrer" className="hover:text-blueox-primary transition-colors flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                +48 666 250 547
              </a>
              <a href="https://wa.me/3197010209759" target="_blank" rel="noopener noreferrer" className="hover:text-blueox-primary transition-colors flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                +31 970 102 09759
              </a>
              <a href="https://wa.me/256726315664" target="_blank" rel="noopener noreferrer" className="hover:text-blueox-primary transition-colors flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                +256 726 315 664
              </a>
              <a href="tel:+256783728865" className="hover:text-blueox-primary transition-colors flex items-center gap-1">
                <PhoneIcon className="w-4 h-4" />
                +256 783 728 865
              </a>
            </div>
            <p className="text-gray-500 text-xs">
              &copy; {new Date().getFullYear()} BlueOx Business Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

