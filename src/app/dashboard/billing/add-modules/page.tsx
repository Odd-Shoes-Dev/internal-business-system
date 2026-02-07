'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import { regionalPricing } from '@/lib/regional-pricing';
import { Check, Loader2, Package, AlertCircle } from 'lucide-react';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
}

export default function AddModulesPage() {
  const router = useRouter();
  const { company } = useCompany();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [currentModules, setCurrentModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  // Fetch current subscription and modules
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/billing/subscription');
        if (response.ok) {
          const data = await response.json();
          setSubscription(data);
          setCurrentModules(data.modules || []);
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      }
    };
    fetchData();
  }, []);

  const pricing = regionalPricing[company?.region || 'DEFAULT'];
  const currencySymbol = pricing.starter.currencySymbol;

  const availableModules: Module[] = [
    {
      id: 'tours',
      name: 'Tours & Safaris',
      description: 'Manage tour bookings, itineraries, and safari packages',
      icon: '🗺️',
      price: pricing.modules.tours,
    },
    {
      id: 'fleet',
      name: 'Fleet Management',
      description: 'Track vehicles, maintenance, and fuel consumption',
      icon: '🚗',
      price: pricing.modules.fleet,
    },
    {
      id: 'hotels',
      name: 'Hotel Management',
      description: 'Room bookings, reservations, and hospitality operations',
      icon: '🏨',
      price: pricing.modules.hotels,
    },
    {
      id: 'cafe',
      name: 'Cafe & Restaurant',
      description: 'POS, menu management, and table reservations',
      icon: '☕',
      price: pricing.modules.cafe,
    },
    {
      id: 'security',
      name: 'Security Services',
      description: 'Guard scheduling, incident reporting, and patrol management',
      icon: '🛡️',
      price: pricing.modules.security,
    },
    {
      id: 'inventory',
      name: 'Inventory Management',
      description: 'Stock tracking, warehousing, and supply chain',
      icon: '📦',
      price: pricing.modules.inventory,
    },
  ];

  const toggleModule = (moduleId: string) => {
    if (currentModules.includes(moduleId)) {
      // Can't deselect current modules from this page
      return;
    }

    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleAddModules = async () => {
    if (selectedModules.length === 0) {
      alert('Please select at least one module to add');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/billing/add-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modules: selectedModules,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add modules');
      }

      alert('Modules added successfully!');
      router.push('/dashboard/billing');
    } catch (error: any) {
      console.error('Add modules error:', error);
      alert(error.message || 'Failed to add modules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return selectedModules.reduce((total, moduleId) => {
      const module = availableModules.find((m) => m.id === moduleId);
      return total + (module?.price || 0);
    }, 0);
  };

  const isModuleCurrent = (moduleId: string) => {
    return currentModules.includes(moduleId);
  };

  const isProfessionalOrHigher = () => {
    return subscription?.plan_tier === 'professional' || subscription?.plan_tier === 'enterprise';
  };

  const canSelectModules = () => {
    if (!subscription) return false;
    if (isProfessionalOrHigher()) return true;
    // Starter plan can only have 1 module
    return currentModules.length === 0;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add Modules</h1>
        <p className="text-gray-600 mt-2">
          Expand your system with industry-specific modules
        </p>
      </div>

      {/* Plan Warning for Starter */}
      {subscription && !isProfessionalOrHigher() && currentModules.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-amber-900">Upgrade Required</h3>
            <p className="text-sm text-amber-700 mt-1">
              Your Starter plan includes 1 module. To add more modules, please{' '}
              <button
                onClick={() => router.push('/dashboard/billing/upgrade')}
                className="underline font-medium hover:text-amber-900"
              >
                upgrade to Professional or Enterprise
              </button>
              .
            </p>
          </div>
        </div>
      )}

      {/* Modules Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {availableModules.map((module) => {
          const isCurrent = isModuleCurrent(module.id);
          const isSelected = selectedModules.includes(module.id);
          const canSelect = canSelectModules() && !isCurrent;

          return (
            <div
              key={module.id}
              onClick={() => canSelect && toggleModule(module.id)}
              className={`relative rounded-lg border-2 p-6 transition-all ${
                isCurrent
                  ? 'border-green-500 bg-green-50 cursor-not-allowed'
                  : isSelected
                  ? 'border-blue-500 bg-blue-50 cursor-pointer'
                  : canSelect
                  ? 'border-gray-200 hover:border-gray-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                </div>
              )}

              {isSelected && !isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Selected
                  </span>
                </div>
              )}

              <div className="text-4xl mb-3">{module.icon}</div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {module.name}
              </h3>

              <p className="text-sm text-gray-600 mb-4">{module.description}</p>

              <div className="flex items-baseline justify-between pt-4 border-t border-gray-200">
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    {currencySymbol}{module.price}
                  </span>
                  <span className="text-gray-600 text-sm ml-1">/month</span>
                </div>
                {isCurrent && (
                  <Package className="w-5 h-5 text-green-600" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary and Actions */}
      {selectedModules.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>

          <div className="space-y-2 mb-4">
            {selectedModules.map((moduleId) => {
              const module = availableModules.find((m) => m.id === moduleId);
              return (
                <div key={moduleId} className="flex justify-between text-sm">
                  <span className="text-gray-700">{module?.name}</span>
                  <span className="font-medium text-gray-900">
                    {currencySymbol}{module?.price}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-gray-300 flex justify-between items-baseline">
            <span className="font-semibold text-gray-900">Total Monthly:</span>
            <span className="text-2xl font-bold text-gray-900">
              {currencySymbol}{calculateTotal()}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Modules will be added to your next billing cycle
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={handleAddModules}
          disabled={loading || selectedModules.length === 0 || !canSelectModules()}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Add {selectedModules.length > 0 && `(${selectedModules.length})`} Module
          {selectedModules.length !== 1 && 's'}
        </button>
      </div>

      {/* Current Modules */}
      {currentModules.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Your Current Modules</h3>
          <div className="flex flex-wrap gap-2">
            {currentModules.map((moduleId) => {
              const module = availableModules.find((m) => m.id === moduleId);
              return (
                <span
                  key={moduleId}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                >
                  <span>{module?.icon}</span>
                  {module?.name}
                </span>
              );
            })}
          </div>
          <p className="text-sm text-gray-600 mt-4">
            To remove modules, visit the{' '}
            <button
              onClick={() => router.push('/dashboard/billing')}
              className="text-blue-600 hover:underline font-medium"
            >
              billing dashboard
            </button>
            .
          </p>
        </div>
      )}
    </div>
  );
}
