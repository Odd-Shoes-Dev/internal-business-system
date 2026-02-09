'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ModuleGuard } from '@/components/module-guard';
import type { TourPackage, Destination } from '@/types/breco';
import { formatCurrency, type SupportedCurrency } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  GlobeAltIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  StarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

interface TourPackageImage {
  id: string;
  tour_package_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  caption?: string;
}

interface TourPackageWithImages extends TourPackage {
  primary_destination?: Destination;
  images?: TourPackageImage[];
  primary_image?: TourPackageImage;
}

export default function TourPackagesPage() {
  const [packages, setPackages] = useState<TourPackageWithImages[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchPackages();
    fetchDestinations();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/tours');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch tour packages');
      }
      
      // Fetch images for all tour packages
      const packagesPromises = (result.data || []).map(async (pkg: TourPackage) => {
        try {
          const detailResponse = await fetch(`/api/tours/${pkg.id}`);
          const detailResult = await detailResponse.json();
          return {
            ...pkg,
            images: detailResult.data?.images || [],
            primary_image: detailResult.data?.images?.find((img: any) => img.is_primary),
          };
        } catch {
          return pkg;
        }
      });
      
      const packagesWithImages = await Promise.all(packagesPromises);
      setPackages(packagesWithImages);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Failed to load tour packages');
    } finally {
      setLoading(false);
    }
  };

  const fetchDestinations = async () => {
    try {
      // TODO: Create dedicated destinations API endpoint
      setDestinations([]);
    } catch (error) {
      console.error('Error fetching destinations:', error);
    }
  };

  const toggleFeatured = async (pkg: TourPackage) => {
    try {
      const response = await fetch(`/api/tours/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !pkg.is_featured }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update');
      }
      
      setPackages(prev => 
        prev.map(p => p.id === pkg.id ? { ...p, is_featured: !p.is_featured } : p)
      );
      
      toast.success(pkg.is_featured ? 'Removed from featured' : 'Marked as featured');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  const deletePackage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tour package?')) return;

    try {
      const response = await fetch(`/api/tours/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete');
      }
      
      setPackages(prev => prev.filter(p => p.id !== id));
      toast.success('Tour package deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = 
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.package_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || pkg.tour_type === filterType;
    
    return matchesSearch && matchesType;
  });

  const tourTypes = [...new Set(packages.map(p => p.tour_type).filter(Boolean))];

  const formatPrice = (price: number, currency: SupportedCurrency = 'USD') => {
    return formatCurrency(price, currency);
  };

  if (loading) {
    return (
      <ModuleGuard module="tours">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blueox-primary"></div>
        </div>
      </ModuleGuard>
    );
  }

  return (
    <ModuleGuard module="tours">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
          <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
          <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto py-8 px-6 space-y-8">
          {/* Hero Header */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl px-6 py-3 shadow-lg mb-6">
              <GlobeAltIcon className="w-6 h-6 text-blueox-primary" />
              <span className="text-blueox-primary font-semibold">Tour Package Management</span>
            </div>
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                  Tour Packages & Safaris
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl">
                  Manage your tour packages, safari itineraries, and travel offerings
                </p>
              </div>
              
              <Link
                href="/dashboard/tours/new"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
              >
                <PlusIcon className="w-5 h-5" />
                New Package
                <SparklesIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blueox-primary/10 rounded-lg">
              <GlobeAltIcon className="w-6 h-6 text-blueox-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{packages.length}</p>
              <p className="text-sm text-gray-500">Total Packages</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blueox-warning/20 rounded-lg">
              <StarSolidIcon className="w-6 h-6 text-blueox-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {packages.filter(p => p.is_featured).length}
              </p>
              <p className="text-sm text-gray-500">Featured</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ClockIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {packages.filter(p => p.is_active).length}
              </p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(Math.round(packages.reduce((sum, p) => sum + p.base_price_usd, 0) / packages.length || 0))}
              </p>
              <p className="text-sm text-gray-500">Avg. Price</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <FunnelIcon className="w-5 h-5 text-blueox-primary" />
          <h3 className="text-lg font-bold text-blueox-primary-dark">Search & Filter</h3>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tour packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="lg:w-48 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
          >
            <option value="all">All Types</option>
            {tourTypes.map(type => (
              <option key={type} value={type || ''}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Packages Grid */}
      {filteredPackages.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blueox-primary/10 rounded-full mb-6">
            <GlobeAltIcon className="w-10 h-10 text-blueox-primary" />
          </div>
          <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No tour packages found</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Get started by creating your first tour package to offer to customers.
          </p>
          <Link 
            href="/dashboard/tours/new" 
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            Create Package
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => (
            <div key={pkg.id} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl overflow-hidden hover:shadow-xl hover:border-blueox-primary/40 transition-all duration-300">
              {/* Image placeholder */}
              <div className="h-52 bg-gradient-to-br from-blueox-primary/80 to-blueox-primary-dark flex items-center justify-center relative overflow-hidden">
                {pkg.image_url || pkg.primary_image?.image_url || pkg.images?.[0]?.image_url ? (
                  <img
                    src={pkg.image_url || pkg.primary_image?.image_url || pkg.images?.[0]?.image_url}
                    alt={pkg.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GlobeAltIcon className="w-16 h-16 text-white/50" />
                )}
                
                {/* Featured badge */}
                {pkg.is_featured && (
                  <div className="absolute top-3 left-3 bg-yellow-500 text-white text-xs font-semibold px-3 py-1 rounded-xl flex items-center gap-1 shadow-lg">
                    <StarSolidIcon className="w-3 h-3" />
                    Featured
                  </div>
                )}
                
                {/* Duration badge */}
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-blueox-primary text-sm font-semibold px-3 py-1 rounded-xl shadow-lg">
                  {pkg.duration_days}D / {pkg.duration_nights}N
                </div>
              </div>

              <div className="p-5">
                {/* Package code and type */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-gray-500 font-semibold">{pkg.package_code}</span>
                  {pkg.tour_type && (
                    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-blueox-primary/10 text-blueox-primary">{pkg.tour_type}</span>
                  )}
                </div>

                {/* Name */}
                <h3 className="font-bold text-lg text-blueox-primary-dark mb-3 line-clamp-2">{pkg.name}</h3>

                {/* Destination */}
                {pkg.primary_destination && (
                  <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                    <GlobeAltIcon className="w-4 h-4 text-blueox-primary/60" />
                    {pkg.primary_destination.name}
                  </p>
                )}

                {/* Price and group size */}
                <div className="flex items-center justify-between mb-5 pb-5 border-b border-blueox-primary/10">
                  <div>
                    <p className="text-2xl font-bold text-blueox-primary">
                      {formatPrice(pkg.base_price_usd)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {pkg.price_per_person ? 'per person' : 'per group'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-gray-900">
                      <UserGroupIcon className="w-5 h-5 text-blueox-primary/60" />
                      <span className="text-sm font-semibold">{pkg.min_group_size}-{pkg.max_group_size}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">guests</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/tours/${pkg.id}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary px-3 py-2 rounded-xl font-medium transition-all duration-200"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View
                  </Link>
                  <Link
                    href={`/dashboard/tours/${pkg.id}/edit`}
                    className="flex items-center justify-center bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary p-2 rounded-xl transition-all duration-200"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => toggleFeatured(pkg)}
                    className={`flex items-center justify-center p-2 rounded-xl transition-all duration-200 ${
                      pkg.is_featured ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary'
                    }`}
                  >
                    <StarIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePackage(pkg.id)}
                    className="flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-xl transition-all duration-200"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
    </ModuleGuard>
  );
}

