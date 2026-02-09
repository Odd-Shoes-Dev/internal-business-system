'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import { regionalPricing } from '@/lib/regional-pricing';
import { Check, Loader2, Package, AlertCircle, Map, Truck, Building, Coffee, Shield, Box } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  price: number;
}

export default function AddModulesPage() {
  const router = useRouter();
  const { company } = useCompany();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [currentModules, setCurrentModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [moduleQuota, setModuleQuota] = useState<any>(null);

  // Fetch current subscription and modules
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/billing/subscription');
        if (response.ok) {
          const data = await response.json();
          setSubscription(data);
          setCurrentModules((data.modules || []).map((m: any) => m.module_id));
          setModuleQuota(data.moduleQuota);
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      }
    };
    fetchData();
  }, []);

  const pricing = regionalPricing[company?.region || 'DEFAULT'];
  const currencySymbol = pricing.starter.currencySymbol;

  // Check if a module will be free (included in quota) or paid
  const getModuleStatus = (index: number) => {
    const totalIncluded = moduleQuota?.included || 0;
    const remaining = moduleQuota?.remaining || 0;
    const selectedIndex = selectedModules.length - index;
    
    return selectedIndex <= remaining ? 'included' : 'paid';
  };

  const availableModules: Module[] = [
    {
      id: 'tours',
      name: 'Tours & Safaris',
      description: 'Manage tour bookings, itineraries, and safari packages',
      icon: Map,
      price: pricing.modules.tours,
    },
    {
      id: 'fleet',
      name: 'Fleet Management',
      description: 'Track vehicles, maintenance, and fuel consumption',
      icon: Truck,
      price: pricing.modules.fleet,
    },
    {
      id: 'hotels',
      name: 'Hotel Management',
      description: 'Room bookings, reservations, and hospitality operations',
      icon: Building,
      price: pricing.modules.hotels,
    },
    {
      id: 'cafe',
      name: 'Cafe & Restaurant',
      description: 'POS, menu management, and table reservations',
      icon: Coffee,
      price: pricing.modules.cafe,
    },
    {
      id: 'security',
      name: 'Security Services',
      description: 'Guard scheduling, incident reporting, and patrol management',
      icon: Shield,
      price: pricing.modules.security,
    },
    {
      id: 'inventory',
      name: 'Inventory Management',
      description: 'Stock tracking, warehousing, and supply chain',
      icon: Box,
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
          module_ids: selectedModules,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add modules');
      }

      const result = await response.json();
      const includedCount = result.breakdown?.included || 0;
      const paidCount = result.breakdown?.paid || 0;
      
      let message = 'Modules added successfully!';
      if (includedCount > 0 && paidCount > 0) {
        message = `${includedCount} free module(s) and ${paidCount} paid module(s) added!`;
      } else if (includedCount > 0) {
        message = `${includedCount} free module(s) added!`;
      } else if (paidCount > 0) {
        message = `${paidCount} paid module(s) added!`;
      }

      alert(message);
      router.push('/dashboard/billing');
    } catch (error: any) {
      console.error('Add modules error:', error);
      alert(error.message || 'Failed to add modules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const remaining = moduleQuota?.remaining || 0;
    let paidCount = 0;
    
    return selectedModules.reduce((total, moduleId, index) => {
      const module = availableModules.find((m) => m.id === moduleId);
      const price = module?.price || 0;
      
      // First 'remaining' modules are free (included in quota)
      if (index >= remaining) {
        paidCount++;
        return total + price;
      }
      return total;
    }, 0);
  };

  const getFreeModulesCount = () => {
    const remaining = moduleQuota?.remaining || 0;
    return Math.min(selectedModules.length, remaining);
  };

  const getPaidModulesCount = () => {
    const remaining = moduleQuota?.remaining || 0;
    return Math.max(0, selectedModules.length - remaining);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-blueox-primary/5 rounded-full blur-3xl" />
      <div className="absolute top-60 left-10 w-80 h-80 bg-blueox-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-40 right-40 w-72 h-72 bg-purple-400/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        {/* Hero Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-blueox-primary/20 text-blueox-primary px-4 py-2 rounded-full mb-4">
            <Package className="w-5 h-5" />
            <span className="font-semibold text-sm">Add Modules</span>
          </div>
          <h1 className="text-4xl font-bold text-blueox-primary-dark mb-3">
            Expand Your System
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            Choose industry-specific modules to enhance your business operations
          </p>
          {moduleQuota && (
            <div className="mt-4 flex items-center gap-3">
              <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl font-bold text-sm">
                {moduleQuota.remaining} of {moduleQuota.total} free module slots available
              </div>
              {moduleQuota.paid > 0 && (
                <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold text-sm">
                  {moduleQuota.paid} paid modules active
                </div>
              )}
            </div>
          )}
        </div>

        {/* Plan Warning for Starter */}
        {subscription && !isProfessionalOrHigher() && currentModules.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 backdrop-blur-xl border border-amber-300/50 rounded-2xl p-6 flex items-start gap-4 shadow-lg">
            <div className="flex items-center justify-center w-12 h-12 bg-amber-100/80 rounded-xl flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 text-lg">Upgrade Required</h3>
              <p className="text-amber-700 mt-2 font-medium">
                Your Starter plan includes 1 module. To add more modules, please{' '}
                <button
                  onClick={() => router.push('/dashboard/billing/upgrade')}
                  className="underline font-bold hover:text-amber-900 transition-colors"
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
              className={`relative backdrop-blur-xl rounded-3xl border-2 p-8 transition-all duration-300 ${
                isCurrent
                  ? 'border-green-400 bg-gradient-to-br from-green-50/90 to-emerald-50/90 shadow-lg cursor-not-allowed'
                  : isSelected
                  ? 'border-blueox-primary bg-gradient-to-br from-blue-50/90 to-cyan-50/90 shadow-xl scale-105 cursor-pointer'
                  : canSelect
                  ? 'border-blueox-primary/20 bg-white/80 hover:border-blueox-primary/40 hover:shadow-lg hover:scale-105 cursor-pointer'
                  : 'border-gray-300/50 bg-gray-50/50 cursor-not-allowed opacity-60'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 right-6">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
                    <Check className="w-4 h-4" />
                    Active
                  </span>
                </div>
              )}

              {isSelected && !isCurrent && (
                <div className="absolute -top-3 right-6">
                  <span className="bg-gradient-to-r from-blueox-primary to-blueox-primary-dark text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
                    <Check className="w-4 h-4" />
                    Selected
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center w-16 h-16 bg-blueox-primary/10 rounded-2xl mb-4">
                <module.icon className="w-8 h-8 text-blueox-primary" />
              </div>

              <h3 className="text-xl font-bold text-blueox-primary-dark mb-3">
                {module.name}
              </h3>

              <p className="text-sm text-gray-600 mb-6 font-medium leading-relaxed">{module.description}</p>

              <div className="flex items-baseline justify-between pt-6 border-t border-blueox-primary/10">
                <div>
                  <span className="text-3xl font-bold text-gray-900">
                    {currencySymbol} {module.price.toLocaleString()}
                  </span>
                  <span className="text-gray-600 text-sm ml-2 font-semibold">/month</span>
                </div>
                {isCurrent && (
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-xl">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary and Actions */}
      {selectedModules.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 mb-8 shadow-xl">
          <h3 className="font-bold text-blueox-primary-dark text-xl mb-6">Order Summary</h3>

          <div className="space-y-3 mb-6">
            {selectedModules.map((moduleId, index) => {
              const module = availableModules.find((m) => m.id === moduleId);
              const remaining = moduleQuota?.remaining || 0;
              const isFree = index < remaining;
              
              return (
                <div key={moduleId} className={`flex justify-between items-center rounded-xl p-4 ${
                  isFree ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-700 font-semibold">{module?.name}</span>
                    {isFree && (
                      <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                        FREE
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 text-lg">
                    {isFree ? 'Included' : `${currencySymbol} ${module?.price.toLocaleString()}`}
                  </span>
                </div>
              );
            })}
          </div>

          {getFreeModulesCount() > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-green-800 font-semibold text-sm">
                ✨ {getFreeModulesCount()} module{getFreeModulesCount() !== 1 ? 's' : ''} included in your {subscription?.subscription?.plan_tier || 'Professional'} plan
              </p>
            </div>
          )}

          <div className="pt-6 border-t border-blueox-primary/10">
            {getPaidModulesCount() > 0 ? (
              <>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-gray-600">Additional Modules:</span>
                  <span className="text-xl font-bold text-gray-900">
                    {currencySymbol} {calculateTotal().toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  {getPaidModulesCount()} paid module{getPaidModulesCount() !== 1 ? 's' : ''} beyond your plan quota
                </p>
              </>
            ) : (
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">Free</p>
                <p className="text-sm text-gray-600 mt-1">All selected modules are included in your plan</p>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-4 font-medium">
            Modules will take effect immediately
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => router.back()}
          className="px-8 py-4 bg-white/80 backdrop-blur-xl border-2 border-blueox-primary/30 rounded-2xl text-gray-700 hover:bg-white hover:border-blueox-primary/50 hover:shadow-lg font-semibold transition-all duration-300"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={handleAddModules}
          disabled={loading || selectedModules.length === 0 || !canSelectModules()}
          className="px-10 py-4 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark text-white rounded-2xl hover:shadow-xl hover:scale-105 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3 transition-all duration-300"
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          Add {selectedModules.length > 0 && `(${selectedModules.length})`} Module
          {selectedModules.length !== 1 && 's'}
        </button>
      </div>

      {/* Current Modules */}
      {currentModules.length > 0 && (
        <div className="mt-12 pt-8 border-t border-blueox-primary/10">
          <h3 className="font-bold text-blueox-primary-dark text-xl mb-6">Your Current Modules</h3>
          <div className="flex flex-wrap gap-3">
            {currentModules.map((moduleId) => {
              const module = availableModules.find((m) => m.id === moduleId);
              const IconComponent = module?.icon;
              return (
                <span
                  key={moduleId}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300/50 text-green-800 rounded-2xl font-bold shadow-md"
                >
                  {IconComponent && <IconComponent className="w-5 h-5" />}
                  {module?.name}
                </span>
              );
            })}
          </div>
          <p className="text-gray-600 mt-6 font-medium">
            To remove modules, visit the{' '}
            <button
              onClick={() => router.push('/dashboard/billing')}
              className="text-blueox-primary hover:text-blueox-primary-dark font-bold hover:underline transition-colors"
            >
              billing dashboard
            </button>
            .
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
