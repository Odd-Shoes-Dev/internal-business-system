'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  GlobeAltIcon,
  TruckIcon,
  HomeModernIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface IndustryModule {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  features: string[];
}

const INDUSTRY_MODULES: IndustryModule[] = [
  {
    id: 'tours',
    name: 'Tours & Safari Operations',
    description: 'Tour packages, booking system, destinations, and seasonal pricing',
    price: 39,
    icon: GlobeAltIcon,
    features: ['Tour Packages', 'Booking Management', 'Destinations', 'Seasonal Pricing'],
  },
  {
    id: 'fleet',
    name: 'Fleet Management',
    description: 'Vehicle tracking, maintenance scheduling, and driver management',
    price: 35,
    icon: TruckIcon,
    features: ['Vehicle Registry', 'Maintenance Tracking', 'Fuel Management', 'Driver Assignment'],
  },
  {
    id: 'hotels',
    name: 'Hotel Management',
    description: 'Room reservations, occupancy tracking, and housekeeping',
    price: 45,
    icon: HomeModernIcon,
    features: ['Hotel Directory', 'Room Types', 'Reservations', 'Occupancy Tracking'],
  },
  {
    id: 'inventory',
    name: 'Inventory & Assets',
    description: 'Stock tracking, asset depreciation, and multi-location support',
    price: 39,
    icon: CubeIcon,
    features: ['Product Inventory', 'Asset Tracking', 'Depreciation', 'Multi-location'],
  },
  {
    id: 'payroll',
    name: 'Payroll Processing',
    description: 'Automated payroll, tax calculations, and payslip generation',
    price: 35,
    icon: ShoppingBagIcon,
    features: ['Payroll Processing', 'Tax Calculations', 'Payslips', 'Compliance Reports'],
  },
  {
    id: 'cafe',
    name: 'Cafe & Restaurant',
    description: 'Sales tracking, revenue reports, and profit analysis',
    price: 49,
    icon: ShoppingBagIcon,
    features: ['Sales Tracking', 'Revenue Reports', 'Food & Beverage', 'Profit Analysis'],
  },
];

export default function SelectModulesPage() {
  const router = useRouter();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const MAX_MODULES = 3;

  useEffect(() => {
    void checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        router.push('/login');
        return;
      }
    } catch {
      router.push('/login');
      return;
    }

    setIsAuthChecked(true);
  };

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) => {
      if (prev.includes(moduleId)) {
        // Remove module
        return prev.filter((id) => id !== moduleId);
      } else {
        // Add module if under limit
        if (prev.length < MAX_MODULES) {
          return [...prev, moduleId];
        } else {
          toast.error(`You can select up to ${MAX_MODULES} modules for your trial`);
          return prev;
        }
      }
    });
  };

  const handleContinue = async () => {
    if (!isAuthChecked) return;

    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modules: selectedModules }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save module selection');
      }

      toast.success(`${selectedModules.length > 0 ? 'Modules activated!' : 'Starting with core platform'} Welcome to BlueOx!`);
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error saving modules:', error);
      toast.error(error.message || 'Failed to save module selection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!isAuthChecked) return;

    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modules: [] }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to continue');
      }

      toast.success('Starting with core platform. You can add modules later!');
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error skipping modules:', error);
      toast.error('Failed to continue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/assets/logo.png"
              alt="BlueOx"
              width={90}
              height={36}
              className="mx-auto"
            />
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blueox-primary mb-3">
            Choose Your Industry Modules (Optional)
          </h1>
          <p className="text-gray-600 text-lg mb-2">
            Your 30-day trial includes the <span className="font-semibold text-blueox-primary">complete platform</span> + up to <span className="font-semibold text-blueox-primary">3 industry modules</span>
          </p>
          <p className="text-sm text-gray-500">
            The base platform with all accounting, invoicing, and CRM features is already included. Select 0-3 optional industry modules below.
          </p>
        </div>

        {/* Selection Counter */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-6 py-3 shadow-sm border border-blue-100">
            <span className="text-gray-600">Selected:</span>
            <span className={`font-bold text-lg ${selectedModules.length === MAX_MODULES ? 'text-green-600' : 'text-blueox-primary'}`}>
              {selectedModules.length} / {MAX_MODULES}
            </span>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {INDUSTRY_MODULES.map((module) => {
            const isSelected = selectedModules.includes(module.id);
            const Icon = module.icon;

            return (
              <div
                key={module.id}
                onClick={() => toggleModule(module.id)}
                className={`relative card cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-2 border-green-500 shadow-lg bg-green-50'
                    : 'border border-gray-200 hover:border-blue-300 hover:shadow-md bg-white'
                }`}
              >
                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <CheckCircleIcon className="w-8 h-8 text-green-600" />
                  </div>
                )}

                <div className="card-body">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-green-600' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-blueox-primary mb-1">
                        {module.name}
                      </h3>
                      <div className="text-sm text-gray-500">
                        ${module.price}/month after trial
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    {module.description}
                  </p>

                  <div className="space-y-1">
                    {module.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={handleContinue}
            disabled={loading}
            className="btn-primary px-8 py-3 text-lg min-w-[200px]"
          >
            {loading ? 'Saving...' : selectedModules.length > 0 ? `Continue with ${selectedModules.length} ${selectedModules.length === 1 ? 'Module' : 'Modules'}` : 'Continue with Core Only'}
          </button>
          <button
            onClick={handleSkip}
            disabled={loading}
            className="text-gray-600 hover:text-blueox-primary transition-colors text-sm"
          >
            Skip for now, I'll add modules later
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-8 max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blueox-primary mb-2">What's included in your trial:</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span><strong>Complete platform (Always Included):</strong> Accounting, invoicing, customers, vendors, expenses, employees, bank accounts, multi-currency, financial reports</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span><strong>+ Up to 3 industry modules (Optional):</strong> Choose specialized features for your specific business type</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span><strong>30 days free:</strong> No credit card required, cancel anytime</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span><strong>Full support:</strong> Email and chat support during your trial</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
