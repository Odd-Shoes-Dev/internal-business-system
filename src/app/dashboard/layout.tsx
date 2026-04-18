'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { CompanyProvider } from '@/contexts/company-context';
import TrialWarningBanner from '@/components/trial-warning-banner';
import {
  HomeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CubeIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CogIcon,
  UserGroupIcon,
  TruckIcon,
  BookOpenIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
  ReceiptPercentIcon,
  GlobeAltIcon,
  CalendarDaysIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  CalculatorIcon,
  CakeIcon,
  CreditCardIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

// Navigation grouped by category - with module and role requirements
const navigationGroups = [
  {
    name: 'Overview',
    module: null,
    roles: null, // all roles
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    ]
  },
  {
    name: 'Cafe Operations',
    module: 'cafe',
    roles: ['admin', 'operations'],
    items: [
      { name: 'Cafe Dashboard', href: '/dashboard/cafe', icon: CakeIcon },
    ]
  },
  {
    name: 'Tour Operations',
    module: 'tours',
    roles: ['admin', 'operations', 'sales', 'guide'],
    items: [
      { name: 'Tour Packages', href: '/dashboard/tours', icon: GlobeAltIcon },
      { name: 'Bookings', href: '/dashboard/bookings', icon: CalendarDaysIcon },
    ]
  },
  {
    name: 'Fleet Management',
    module: 'fleet',
    roles: ['admin', 'operations'],
    items: [
      { name: 'Vehicles', href: '/dashboard/fleet', icon: TruckIcon },
    ]
  },
  {
    name: 'Hotels Management',
    module: 'hotels',
    roles: ['admin', 'operations'],
    items: [
      { name: 'Hotels', href: '/dashboard/hotels', icon: BuildingStorefrontIcon },
    ]
  },
  {
    name: 'Sales & Revenue',
    module: null,
    roles: ['admin', 'accountant', 'sales', 'operations'],
    items: [
      { name: 'Invoices', href: '/dashboard/invoices', icon: DocumentTextIcon },
      { name: 'Receipts', href: '/dashboard/receipts', icon: ReceiptPercentIcon },
    ]
  },
  {
    name: 'Finance',
    module: null,
    roles: ['admin', 'accountant', 'operations'],
    items: [
      { name: 'Bills', href: '/dashboard/bills', icon: BanknotesIcon },
      { name: 'Expenses', href: '/dashboard/expenses', icon: CurrencyDollarIcon },
      { name: 'Bank & Cash', href: '/dashboard/bank', icon: BuildingLibraryIcon },
    ]
  },
  {
    name: 'People',
    module: null,
    roles: ['admin', 'accountant', 'operations'],
    items: [
      { name: 'Employees', href: '/dashboard/employees', icon: UsersIcon },
    ]
  },
  {
    name: 'Payroll',
    module: 'payroll',
    roles: ['admin', 'accountant', 'operations'],
    items: [
      { name: 'Payroll Processing', href: '/dashboard/payroll', icon: CalculatorIcon },
    ]
  },
  {
    name: 'Assets & Inventory',
    module: 'inventory',
    roles: ['admin', 'accountant', 'operations'],
    items: [
      { name: 'Inventory', href: '/dashboard/inventory', icon: CubeIcon },
      { name: 'Fixed Assets', href: '/dashboard/assets', icon: BuildingOfficeIcon },
    ]
  },
  {
    name: 'Relationships',
    module: null,
    roles: ['admin', 'accountant', 'sales', 'operations'],
    items: [
      { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
      { name: 'Vendors', href: '/dashboard/vendors', icon: TruckIcon },
    ]
  },
  {
    name: 'Accounting',
    module: null,
    roles: ['admin', 'accountant', 'operations'],
    items: [
      { name: 'General Ledger', href: '/dashboard/general-ledger', icon: BookOpenIcon },
      { name: 'Reports', href: '/dashboard/reports', icon: ChartBarIcon },
    ]
  },
  {
    name: 'System',
    module: null,
    roles: ['admin'],
    items: [
      { name: 'Billing & Subscription', href: '/dashboard/billing', icon: CreditCardIcon },
      { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
    ]
  },
];

// Route-level access control map — longest prefix match wins
const ROUTE_ACCESS: Record<string, string[]> = {
  '/dashboard/settings': ['admin'],
  '/dashboard/billing': ['admin'],
  '/dashboard/general-ledger': ['admin', 'accountant', 'operations'],
  '/dashboard/reports': ['admin', 'accountant', 'operations'],
  '/dashboard/bank': ['admin', 'accountant', 'operations'],
  '/dashboard/payroll': ['admin', 'accountant', 'operations'],
  '/dashboard/payslips': ['admin', 'accountant', 'operations'],
  '/dashboard/bills': ['admin', 'accountant', 'operations'],
  '/dashboard/expenses': ['admin', 'accountant', 'operations'],
  '/dashboard/employees': ['admin', 'accountant', 'operations'],
  '/dashboard/assets': ['admin', 'accountant', 'operations'],
  '/dashboard/inventory': ['admin', 'accountant', 'operations'],
  '/dashboard/fleet': ['admin', 'operations'],
  '/dashboard/hotels': ['admin', 'operations'],
  '/dashboard/cafe': ['admin', 'operations'],
  '/dashboard/destinations': ['admin', 'operations'],
  '/dashboard/tours': ['admin', 'operations', 'sales', 'guide'],
  '/dashboard/bookings': ['admin', 'operations', 'sales', 'guide'],
  '/dashboard/customers': ['admin', 'accountant', 'sales', 'operations'],
  '/dashboard/vendors': ['admin', 'accountant', 'operations'],
  '/dashboard/invoices': ['admin', 'accountant', 'sales', 'operations'],
  '/dashboard/receipts': ['admin', 'accountant', 'sales', 'operations'],
  '/dashboard/payments': ['admin', 'accountant', 'sales', 'operations'],
  '/dashboard/proformas': ['admin', 'accountant', 'sales', 'operations'],
};

function userHasAccess(pathname: string, userRole: string | null): boolean {
  if (!userRole || userRole === 'admin') return true;
  const sortedRoutes = Object.keys(ROUTE_ACCESS).sort((a, b) => b.length - a.length);
  for (const route of sortedRoutes) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return ROUTE_ACCESS[route].includes(userRole);
    }
  }
  return true; // unspecified routes default to accessible
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; full_name: string | null; role: string | null } | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyRole, setCompanyRole] = useState<string | null>(null);
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('');
  const [trialEndDate, setTrialEndDate] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    // Scroll detection for mobile header hide/show
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      // Keep header visible on desktop
      if (window.innerWidth >= 1024) {
        setShowHeader(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      // Keep header visible at top of page
      if (currentScrollY <= 16) {
        setShowHeader(true);
      }
      // Hide on downward scroll
      else if (delta > 6) {
        setShowHeader(false);
      }
      // Show on upward scroll (even slight)
      else if (delta < -2) {
        setShowHeader(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ensure header visible when sidebar opens
  useEffect(() => {
    if (sidebarOpen) {
      setShowHeader(true);
    }
  }, [sidebarOpen]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const meResponse = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (meResponse.status === 401) {
          router.push('/login');
          return;
        }

        if (!meResponse.ok) {
          const payload = await meResponse.json().catch(() => ({}));
          console.error('Session error:', payload?.error || 'Failed to load session');
          setIsLoading(false);
          router.push('/login');
          return;
        }

        const mePayload = await meResponse.json();
        const sessionUser = mePayload?.user;
        if (!sessionUser) {
          setIsLoading(false);
          router.push('/login');
          return;
        }

        setUser(sessionUser);

        const companiesResponse = await fetch('/api/companies/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (!companiesResponse.ok) {
          const payload = await companiesResponse.json().catch(() => ({}));
          console.error('Company load error:', payload?.error || 'Failed to load company');
          setIsLoading(false);
          return;
        }

        const companiesPayload = await companiesResponse.json();
        const companies = companiesPayload?.companies || [];

        if (!companies.length) {
          setIsLoading(false);
          router.push('/signup/select-plan');
          return;
        }

        const selectedCompany =
          companies.find((c: any) => c.id === companiesPayload?.currentCompanyId) ||
          companies.find((c: any) => c.is_primary) ||
          companies[0];

        setCompany(selectedCompany);
        setCompanies(companies);
        setCompanyRole(selectedCompany?.role || null);
        setEnabledModules(companiesPayload?.modules || []);
        setSubscriptionStatus(selectedCompany?.subscription_status || '');
        setTrialEndDate(selectedCompany?.trial_ends_at || undefined);

        if (selectedCompany?.id) {
          await fetchNotifications(selectedCompany.id);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error in getUser:', error);
        setIsLoading(false);
        router.push('/login');
      }
    };

    getUser();
  }, [router]);

  const switchCompany = async (newCompany: any) => {
    setCompanySwitcherOpen(false);
    setCompany(newCompany);
    setCompanyRole(newCompany.role || null);
    setSubscriptionStatus(newCompany.subscription_status || '');
    setTrialEndDate(newCompany.trial_ends_at || undefined);
    try {
      const modulesRes = await fetch(`/api/companies/me?company_id=${newCompany.id}`, {
        credentials: 'include',
      });
      if (modulesRes.ok) {
        const data = await modulesRes.json();
        setEnabledModules(data.modules || []);
      }
    } catch {
      setEnabledModules([]);
    }
    await fetchNotifications(newCompany.id);
  };

  const fetchNotifications = async (companyId: string) => {
    try {
      // Fetch recent notifications based on overdue invoices, bills, etc.
      const [overdueInvoicesResponse, overdueBillsResponse] = await Promise.all([
        fetch(
          `/api/invoices?company_id=${encodeURIComponent(companyId)}&status=overdue&page=1&limit=5`,
          { credentials: 'include' }
        ),
        fetch(
          `/api/bills?company_id=${encodeURIComponent(companyId)}&status=overdue&page=1&limit=5`,
          { credentials: 'include' }
        ),
      ]);

      const overdueInvoices = overdueInvoicesResponse.ok
        ? (await overdueInvoicesResponse.json()).data || []
        : [];
      const overdueBills = overdueBillsResponse.ok
        ? (await overdueBillsResponse.json()).data || []
        : [];

      const notificationList: any[] = [];
      
      overdueInvoices?.forEach((invoice: any) => {
        notificationList.push({
          id: `invoice-${invoice.id}`,
          type: 'overdue_invoice',
          title: `Invoice ${invoice.invoice_number} is overdue`,
          message: `From ${invoice.customers?.name || 'Unknown Customer'}`,
          time: new Date(invoice.due_date).toLocaleDateString(),
          href: `/dashboard/invoices/${invoice.id}`
        });
      });

      overdueBills?.forEach((bill: any) => {
        notificationList.push({
          id: `bill-${bill.id}`,
          type: 'overdue_bill',
          title: `Bill ${bill.bill_number} is overdue`,
          message: `To ${bill.vendors?.name || 'Unknown Vendor'}`,
          time: new Date(bill.due_date).toLocaleDateString(),
          href: `/dashboard/bills`
        });
      });

      setNotifications(notificationList.slice(0, 10));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    router.push('/login');
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blueox-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if no user (should redirect to login)
  if (!user) {
    return null;
  }

  return (
    <CompanyProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
          <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
          <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
        </div>
          {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white/90 backdrop-blur-xl border-r border-blueox-primary/20 transform transition-transform duration-300 lg:translate-x-0 shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-blueox-primary/20">
          <Link href="/dashboard" className="flex items-center gap-2">
            {company?.logo_url ? (
              <Image
                src={company.logo_url}
                alt={company.name || 'Company Logo'}
                width={36}
                height={36}
                className="rounded object-contain"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blueox-primary to-blueox-accent flex items-center justify-center text-black font-bold text-sm shadow-lg">
                {company?.name?.[0]?.toUpperCase() || 'C'}
              </div>
            )}
            <span className="font-semibold text-blueox-primary-dark truncate">
              {company?.name || 'Company'}
            </span>
          </Link>
          <button
            className="lg:hidden p-1 rounded-xl hover:bg-blueox-primary/10 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-4 overflow-y-auto h-[calc(100%-4rem)] scrollbar-thin">
          {navigationGroups
            .filter(group => !group.module || enabledModules.includes(group.module))
            .filter(group => !group.roles || group.roles.includes(companyRole ?? user?.role ?? ''))
            .map((group) => (
            <div key={group.name}>
              <p className="text-xs font-semibold text-blueox-primary/60 uppercase tracking-wider mb-2 px-2">
                {group.name}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className={`fixed top-0 left-0 right-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-blueox-primary/20 flex items-center justify-between px-4 shadow-sm transition-transform duration-300 ease-in-out ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-blueox-primary/10 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            {/* Company Switcher */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setCompanySwitcherOpen(!companySwitcherOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-blueox-primary/10 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blueox-primary to-blueox-accent flex items-center justify-center flex-shrink-0">
                  <span className="text-black text-xs font-bold">{company?.name?.[0]?.toUpperCase() || 'C'}</span>
                </div>
                <span className="text-sm font-semibold text-blueox-primary-dark max-w-[160px] truncate">{company?.name || 'Company'}</span>
                {companies.length > 1 && (
                  <ChevronDownIcon className={`w-4 h-4 text-blueox-primary/60 transition-transform ${companySwitcherOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {companySwitcherOpen && companies.length > 1 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCompanySwitcherOpen(false)} />
                  <div className="absolute left-0 mt-2 w-64 bg-white/95 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-blueox-primary/10">
                      <p className="text-xs font-semibold text-blueox-primary/60 uppercase tracking-wider">Switch Company</p>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                      {companies.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => switchCompany(c)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blueox-primary/5 transition-colors ${
                            c.id === company?.id ? 'bg-blueox-primary/10' : ''
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blueox-primary to-blueox-accent flex items-center justify-center flex-shrink-0">
                            <span className="text-black text-sm font-bold">{c.name?.[0]?.toUpperCase() || 'C'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-blueox-primary-dark truncate">{c.name}</p>
                            <p className="text-xs text-blueox-primary/60 capitalize">{c.role}</p>
                          </div>
                          {c.id === company?.id && (
                            <div className="w-2 h-2 rounded-full bg-blueox-accent flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button 
                className="p-2 rounded-xl hover:bg-blueox-primary/10 relative transition-colors"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <BellIcon className="w-5 h-5 text-blueox-primary" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blueox-primary rounded-full" />
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="bg-white/95 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-xl animate-fade-in w-60 sm:w-80 -right-20 sm:right-0 max-w-[calc(100vw-1rem)]">
                    <div className="p-3 border-b border-blueox-primary/20">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-blueox-primary-dark">Notifications</h3>
                        <span className="text-xs text-blueox-primary/60">{notifications.length} items</span>
                      </div>
                    </div>
                    <div className="py-1 max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-blueox-primary/60">
                          <BellIcon className="w-8 h-8 mx-auto text-blueox-primary/40 mb-2" />
                          <p className="text-sm">No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            href={notification.href}
                            className="block px-4 py-3 hover:bg-blueox-primary/5 border-b border-blueox-primary/10 last:border-b-0 transition-colors"
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                notification.type === 'overdue_invoice' ? 'bg-red-500' : 'bg-yellow-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-blueox-primary-dark truncate">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-blueox-primary/60 mt-1">
                                  {notification.message} • {notification.time}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-blueox-primary/20">
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            router.push('/dashboard/reports');
                          }}
                        className="text-sm text-blueox-primary hover:text-blueox-primary-dark hover:underline transition-colors">
                          View all reports
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-blueox-primary/10 transition-colors"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blueox-primary to-blueox-accent rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-black text-sm font-medium">
                    {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-blueox-primary-dark">
                    {user.full_name || user.email || 'User'}
                  </p>
                  <p className="text-xs text-blueox-primary/60 capitalize">{companyRole || user.role || 'User'}</p>
                </div>
                <ChevronDownIcon className="w-4 h-4 text-blueox-primary/60" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="bg-white/95 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-xl animate-fade-in absolute right-0 mt-2 w-56 z-50">
                    <div className="p-3 border-b border-blueox-primary/20">
                      <p className="text-sm font-medium text-blueox-primary-dark">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-blueox-primary/60">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/dashboard/settings/profile"
                        className="block px-4 py-2 text-sm text-blueox-primary-dark hover:bg-blueox-primary/10 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Profile Settings
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        className="block px-4 py-2 text-sm text-blueox-primary-dark hover:bg-blueox-primary/10 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Company Settings
                      </Link>
                    </div>
                    <div className="border-t border-blueox-primary/20 py-1">
                      <button
                        onClick={handleSignOut}
                        className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left flex items-center gap-2"
                      >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="pt-16 px-4 py-4 lg:pt-20 lg:px-6 lg:py-6">
          {/* Trial Warning Banner */}
          <TrialWarningBanner 
            subscriptionStatus={subscriptionStatus}
            trialEndDate={trialEndDate}
          />
          {!isLoading && user && !userHasAccess(pathname, companyRole ?? user.role) ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                <ShieldCheckIcon className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
              <p className="text-gray-500 max-w-md mb-6">
                Your role (<span className="font-semibold capitalize">{companyRole ?? user.role}</span>) does not have permission to view this page. Contact your administrator if you need access.
              </p>
              <Link href="/dashboard" className="btn-primary">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
    </CompanyProvider>
  );
}


