'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { CompanyProvider } from '@/contexts/company-context';
import TrialWarningBanner from '@/components/trial-warning-banner';
import type { UserProfile } from '@/types/database';
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
} from '@heroicons/react/24/outline';

// Navigation grouped by category - with module requirements
const navigationGroups = [
  {
    name: 'Overview',
    module: null, // Always visible
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    ]
  },
  {
    name: 'Cafe Operations',
    module: 'cafe', // Requires cafe module
    items: [
      { name: 'Cafe Dashboard', href: '/dashboard/cafe', icon: CakeIcon },
    ]
  },
  {
    name: 'Tour Operations',
    module: 'tours', // Requires tours module
    items: [
      { name: 'Tour Packages', href: '/dashboard/tours', icon: GlobeAltIcon },
      { name: 'Bookings', href: '/dashboard/bookings', icon: CalendarDaysIcon },
      { name: 'Hotels', href: '/dashboard/hotels', icon: BuildingStorefrontIcon },
      { name: 'Fleet', href: '/dashboard/fleet', icon: TruckIcon },
    ]
  },
  {
    name: 'Finance',
    module: null, // Always visible (core module)
    items: [
      { name: 'Invoices', href: '/dashboard/invoices', icon: DocumentTextIcon },
      { name: 'Receipts', href: '/dashboard/receipts', icon: ReceiptPercentIcon },
      { name: 'Bills', href: '/dashboard/bills', icon: BanknotesIcon },
      { name: 'Expenses', href: '/dashboard/expenses', icon: CurrencyDollarIcon },
      { name: 'Bank & Cash', href: '/dashboard/bank', icon: BuildingLibraryIcon },
    ]
  },
  {
    name: 'HR & Payroll',
    module: 'payroll', // Requires payroll module
    items: [
      { name: 'Employees', href: '/dashboard/employees', icon: UsersIcon },
      { name: 'Payroll', href: '/dashboard/payroll', icon: CalculatorIcon },
    ]
  },
  {
    name: 'Assets & Inventory',
    module: 'inventory', // Requires inventory module
    items: [
      { name: 'Inventory', href: '/dashboard/inventory', icon: CubeIcon },
      { name: 'Fixed Assets', href: '/dashboard/assets', icon: BuildingOfficeIcon },
    ]
  },
  {
    name: 'Relationships',
    module: null, // Always visible (core module)
    items: [
      { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
      { name: 'Vendors', href: '/dashboard/vendors', icon: TruckIcon },
    ]
  },
  {
    name: 'Accounting',
    module: null, // Always visible (core module)
    items: [
      { name: 'General Ledger', href: '/dashboard/general-ledger', icon: BookOpenIcon },
      { name: 'Reports', href: '/dashboard/reports', icon: ChartBarIcon },
      { name: 'Billing & Subscription', href: '/dashboard/billing', icon: CreditCardIcon },
      { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
    ]
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('');
  const [trialEndDate, setTrialEndDate] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          router.push('/login');
          return;
        }
        
        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            console.error('Profile error:', profileError);
            // If profile doesn't exist, redirect to login
            if (profileError.code === 'PGRST116') {
              setIsLoading(false);
              router.push('/login');
              return;
            }
          }
          
          setUser(profile);

          // Fetch company information and subscription status
          if (profile?.company_id) {
            const { data: companyData } = await supabase
              .from('companies')
              .select('id, name, logo_url')
              .eq('id', profile.company_id)
              .single();
            
            setCompany(companyData);

            // Fetch subscription status (wrapped in try-catch to handle missing columns)
            try {
              const { data: settings, error: settingsError } = await supabase
                .from('company_settings')
                .select('subscription_status, trial_end_date, company_id')
                .eq('company_id', profile.company_id)
                .maybeSingle();
              
              if (!settingsError && settings) {
                setSubscriptionStatus(settings.subscription_status || '');
                setTrialEndDate(settings.trial_end_date || undefined);
              }
            } catch (error) {
              // If columns don't exist or schema cache not updated, silently continue
              // This can happen right after migrations - will resolve automatically
              console.debug('Subscription status fetch skipped (schema cache updating):', error);
            }
          }

          // Fetch enabled modules
          if (profile?.company_id) {
            const { data: modulesData } = await supabase
              .from('company_modules')
              .select('module_id')
              .eq('company_id', profile.company_id)
              .eq('enabled', true);
            
            const modules = modulesData?.map(m => m.module_id) || [];
            setEnabledModules(modules);
          }
          
          setIsLoading(false);
        } else {
          // No session, redirect to login
          setIsLoading(false);
          router.push('/login');
        }
      } catch (error) {
        console.error('Error in getUser:', error);
        setIsLoading(false);
        router.push('/login');
      }
    };

    getUser();
    fetchNotifications();
  }, [router]);

  const fetchNotifications = async () => {
    try {
      // Fetch recent notifications based on overdue invoices, bills, etc.
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select(`
          id, 
          invoice_number, 
          customer_id, 
          due_date,
          customers!inner(name)
        `)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(5);

      const { data: overdueBills } = await supabase
        .from('bills')
        .select(`
          id, 
          bill_number, 
          vendor_id, 
          due_date,
          vendors!inner(name)
        `)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(5);

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
    await supabase.auth.signOut();
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
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-blueox-primary/20 flex items-center justify-between px-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-blueox-primary/10 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-blueox-primary-dark hidden sm:block">
              {company?.name || 'Dashboard'} - Operations
            </h1>
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
                  <p className="text-xs text-blueox-primary/60 capitalize">{user.role || 'User'}</p>
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
        <main className="p-4 lg:p-6">
          {/* Trial Warning Banner */}
          <TrialWarningBanner 
            subscriptionStatus={subscriptionStatus}
            trialEndDate={trialEndDate}
          />
          {children}
        </main>
      </div>
    </div>
    </CompanyProvider>
  );
}


