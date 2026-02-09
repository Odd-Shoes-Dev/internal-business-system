'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ModuleGuard } from '@/components/module-guard';
import type { Booking, BookingStatus } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  EyeIcon,
  PencilIcon,
  ChevronDownIcon,
  FunnelIcon,
  MapIcon,
  BuildingOffice2Icon,
  TruckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<BookingStatus, string> = {
  inquiry: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-blueox-primary text-white',
  deposit_paid: 'bg-blueox-warning text-white',
  fully_paid: 'bg-green-100 text-green-800',
  completed: 'bg-green-500 text-white',
  cancelled: 'bg-gray-200 text-gray-600',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: 'Inquiry',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit Paid',
  fully_paid: 'Fully Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const BOOKING_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  tour: MapIcon,
  hotel: BuildingOffice2Icon,
  car_hire: TruckIcon,
  custom: SparklesIcon,
};

const BOOKING_TYPE_LABELS: Record<string, string> = {
  tour: 'Tour Package',
  hotel: 'Hotel',
  car_hire: 'Car Hire',
  custom: 'Custom',
};

interface BookingWithRelations extends Booking {
  customer?: { id: string; name: string; email: string | null };
  tour_package?: { id: string; name: string; package_code: string };
  hotel?: { id: string; name: string; star_rating: number | null };
  vehicle?: { id: string; vehicle_type: string; registration_number: string };
}

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/bookings');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch bookings');
      }
      
      setBookings(result.data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update status');
      }
      
      setBookings(prev => 
        prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
      );
      
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const filteredBookings = bookings.filter(booking => {
    // Search filter
    const matchesSearch = 
      booking.booking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.tour_package?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const travelDate = new Date(booking.travel_start_date);
    const matchesDate = 
      dateFilter === 'all' ||
      (dateFilter === 'upcoming' && travelDate >= today) ||
      (dateFilter === 'past' && travelDate < today);
    
    // Type filter
    const matchesType = bookingTypeFilter === 'all' || booking.booking_type === bookingTypeFilter;
    
    return matchesSearch && matchesStatus && matchesDate && matchesType;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysUntilTravel = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const travelDate = new Date(dateString);
    const diffTime = travelDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Stats
  const stats = {
    total: bookings.length,
    upcoming: bookings.filter(b => getDaysUntilTravel(b.travel_start_date) > 0 && !['cancelled', 'completed', 'refunded'].includes(b.status)).length,
    pendingPayment: bookings.filter(b => ['confirmed', 'deposit_paid'].includes(b.status) && b.balance_due > 0).length,
    totalRevenue: bookings.filter(b => !['cancelled', 'refunded'].includes(b.status)).reduce((sum, b) => sum + b.amount_paid, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blueox-primary"></div>
      </div>
    );
  }

  return (
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
            <CalendarDaysIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Booking Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Tour Bookings & Reservations
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Manage tour bookings, track reservations, and coordinate travel arrangements
              </p>
            </div>
            
            <Link
              href="/dashboard/bookings/new"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              New Booking
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blueox-primary/10 rounded-xl">
              <CalendarDaysIcon className="w-6 h-6 text-blueox-primary" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">{stats.total}</p>
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CalendarDaysIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-green-600">{stats.upcoming}</p>
              <p className="text-sm font-medium text-gray-600">Upcoming</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-yellow-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <CurrencyDollarIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-yellow-600">{stats.pendingPayment}</p>
              <p className="text-sm font-medium text-gray-600">Pending Payment</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-accent/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blueox-accent/20 rounded-xl">
              <CurrencyDollarIcon className="w-6 h-6 text-blueox-accent" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-sm font-medium text-gray-600">Revenue</p>
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
              placeholder="Search by booking #, customer, or tour..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
            />
          </div>
          <div className="flex gap-4 flex-wrap lg:flex-nowrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 lg:w-44 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={bookingTypeFilter}
              onChange={(e) => setBookingTypeFilter(e.target.value)}
              className="flex-1 lg:w-36 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
            >
              <option value="all">All Types</option>
              {Object.entries(BOOKING_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="flex-1 lg:w-36 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
            >
              <option value="all">All Dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blueox-primary/10 rounded-full mb-6">
              <CalendarDaysIcon className="w-10 h-10 text-blueox-primary" />
            </div>
            <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No bookings found</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Create your first booking to start managing tour reservations and travel arrangements.
            </p>
            <Link 
              href="/dashboard/bookings/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              New Booking
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blueox-primary/10">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Booking</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Type</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Customer</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Details</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Travel Dates</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Guests</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Total</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Balance</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Status</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => {
                    const daysUntil = getDaysUntilTravel(booking.travel_start_date);
                    
                    return (
                      <tr 
                        key={booking.id}
                        onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                        className="border-b border-blueox-primary/5 hover:bg-blueox-primary/5 transition-colors duration-200 cursor-pointer"
                      >
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-semibold text-blueox-primary">{booking.booking_number}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(booking.booking_date)}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {(() => {
                            const Icon = BOOKING_TYPE_ICONS[booking.booking_type];
                            return (
                              <div className="flex items-center gap-2">
                                <Icon className="w-5 h-5 text-blueox-primary/60" />
                                <span className="text-sm text-gray-700 font-medium">{BOOKING_TYPE_LABELS[booking.booking_type]}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-medium text-gray-900">{booking.customer?.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{booking.customer?.email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            {booking.booking_type === 'tour' && booking.tour_package && (
                              <>
                                <p className="font-medium text-gray-900 line-clamp-1">
                                  {booking.tour_package.name}
                                </p>
                                <p className="text-xs text-gray-500 font-mono mt-1">
                                  {booking.tour_package.package_code}
                                </p>
                              </>
                            )}
                            {booking.booking_type === 'hotel' && booking.hotel && (
                              <>
                                <p className="font-medium text-gray-900 line-clamp-1">
                                  {booking.hotel.name}
                                </p>
                                {booking.hotel.star_rating && (
                                  <p className="text-xs text-yellow-600 mt-1">
                                    {'★'.repeat(booking.hotel.star_rating)}
                                  </p>
                                )}
                              </>
                            )}
                            {booking.booking_type === 'car_hire' && booking.vehicle && (
                              <>
                                <p className="font-medium text-gray-900 line-clamp-1">
                                  {booking.vehicle.vehicle_type}
                                </p>
                                <p className="text-xs text-gray-500 font-mono mt-1">
                                  {booking.vehicle.registration_number}
                                </p>
                              </>
                            )}
                            {booking.booking_type === 'custom' && (
                              <p className="font-medium text-gray-900">Custom Booking</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-sm text-gray-900">
                              {formatDate(booking.travel_start_date)} - {formatDate(booking.travel_end_date)}
                            </p>
                            {daysUntil > 0 && !['cancelled', 'completed', 'refunded'].includes(booking.status) && (
                              <p className={`text-xs mt-1 font-semibold ${daysUntil <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                                {daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <UserGroupIcon className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{booking.num_adults + booking.num_children}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-semibold text-gray-900">
                          {formatCurrency(booking.total, booking.currency)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {booking.balance_due > 0 ? (
                            <span className="text-red-600 font-semibold">
                              {formatCurrency(booking.balance_due, booking.currency)}
                            </span>
                          ) : (
                            <span className="text-green-600 font-semibold">Paid</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="relative group" onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`${STATUS_COLORS[booking.status]} px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1`}
                            >
                              {STATUS_LABELS[booking.status]}
                              <ChevronDownIcon className="w-3 h-3" />
                            </button>
                            <div className="absolute left-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-blueox-primary/20 z-10 hidden group-hover:block overflow-hidden">
                              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                                <button
                                  key={status}
                                  onClick={() => updateStatus(booking.id, status as BookingStatus)}
                                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-blueox-primary/5 transition-colors ${
                                    status === booking.status ? 'bg-blueox-primary/10 font-semibold text-blueox-primary' : 'text-gray-700'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/dashboard/bookings/${booking.id}`}
                              className="p-2 hover:bg-blueox-primary/10 rounded-xl transition-all duration-200"
                              title="View"
                            >
                              <EyeIcon className="w-5 h-5 text-blueox-primary" />
                            </Link>
                            <Link
                              href={`/dashboard/bookings/${booking.id}/edit`}
                              className="p-2 hover:bg-blueox-primary/10 rounded-xl transition-all duration-200"
                              title="Edit"
                            >
                              <PencilIcon className="w-5 h-5 text-blueox-primary" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredBookings.map((booking) => {
                const daysUntil = getDaysUntilTravel(booking.travel_start_date);
                const Icon = BOOKING_TYPE_ICONS[booking.booking_type];
                
                return (
                  <div 
                    key={booking.id}
                    onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                    className="bg-white/90 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl p-5 hover:shadow-lg hover:border-blueox-primary/40 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <p className="text-lg font-bold text-blueox-primary">{booking.booking_number}</p>
                        <p className="text-sm text-gray-600 mt-1">{booking.customer?.name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Icon className="w-4 h-4 text-blueox-primary/60" />
                          <span className="text-xs font-medium text-gray-700">{BOOKING_TYPE_LABELS[booking.booking_type]}</span>
                        </div>
                      </div>
                      <div className="relative group" onClick={(e) => e.stopPropagation()}>
                        <button className={`${STATUS_COLORS[booking.status]} px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1`}>
                          {STATUS_LABELS[booking.status]}
                          <ChevronDownIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blueox-primary/10">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Travel Dates</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(booking.travel_start_date)}</p>
                        {daysUntil > 0 && !['cancelled', 'completed', 'refunded'].includes(booking.status) && (
                          <p className={`text-xs mt-1 font-semibold ${daysUntil <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                            {daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Guests</p>
                        <div className="flex items-center gap-2">
                          <UserGroupIcon className="w-4 h-4 text-gray-400" />
                          <p className="text-sm font-medium text-gray-900">{booking.num_adults + booking.num_children}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                        <p className="text-sm font-bold text-blueox-primary">{formatCurrency(booking.total, booking.currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Balance Due</p>
                        {booking.balance_due > 0 ? (
                          <p className="text-sm font-bold text-red-600">{formatCurrency(booking.balance_due, booking.currency)}</p>
                        ) : (
                          <p className="text-sm font-bold text-green-600">Paid</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4 pt-4 border-t border-blueox-primary/10" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/bookings/${booking.id}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary px-4 py-2 rounded-xl font-medium transition-all duration-200"
                      >
                        <EyeIcon className="w-4 h-4" />
                        View
                      </Link>
                      <Link
                        href={`/dashboard/bookings/${booking.id}/edit`}
                        className="flex-1 flex items-center justify-center gap-2 bg-blueox-primary/10 hover:bg-blueox-primary/20 text-blueox-primary px-4 py-2 rounded-xl font-medium transition-all duration-200"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

