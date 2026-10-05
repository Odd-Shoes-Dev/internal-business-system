'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { CompanyProvider, useCompany } from '@/contexts/company-context';
import { PageHeaderProvider, usePageHeaderState } from '@/components/page-header';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
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
  ChevronRightIcon,
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
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { FitNumber } from '@/components/ui/fit-number';

const NOTIFICATION_PAGE_SIZE = 10;

const isNavItemActive = (pathname: string, href: string) =>
  pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

type NavItem = {
  name: string;
  href: string;
  icon: typeof HomeIcon;
  module?: string; // hidden unless this module is enabled for the company
};

type NavGroup = {
  name: string;
  pinned?: boolean; // always expanded, no dropdown
  items: NavItem[];
};

// Sidebar navigation. Role visibility comes from ROUTE_ACCESS per item; groups with no visible items are hidden.
const navigationGroups: NavGroup[] = [
  {
    name: 'Overview',
    pinned: true,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    ]
  },
  {
    name: 'Operations',
    items: [
      { name: 'POS Manager', href: '/dashboard/pos', icon: ShoppingCartIcon, module: 'pos' },
      { name: 'Cafe', href: '/dashboard/cafe', icon: CakeIcon, module: 'cafe' },
      { name: 'Tour Packages', href: '/dashboard/tours', icon: GlobeAltIcon, module: 'tours' },
      { name: 'Bookings', href: '/dashboard/bookings', icon: CalendarDaysIcon, module: 'tours' },
      { name: 'Vehicles', href: '/dashboard/fleet', icon: TruckIcon, module: 'fleet' },
      { name: 'Hotels', href: '/dashboard/hotels', icon: BuildingStorefrontIcon, module: 'hotels' },
    ]
  },
  {
    name: 'Sales',
    items: [
      { name: 'Sales', href: '/dashboard/sales', icon: ShoppingBagIcon },
      { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
      { name: 'Invoices', href: '/dashboard/invoices', icon: DocumentTextIcon },
      { name: 'Receipts', href: '/dashboard/receipts', icon: ReceiptPercentIcon },
      { name: 'Price List', href: '/dashboard/products', icon: CubeIcon },
    ]
  },
  {
    name: 'Purchases',
    items: [
      { name: 'Vendors', href: '/dashboard/vendors', icon: TruckIcon },
      { name: 'Bills', href: '/dashboard/bills', icon: BanknotesIcon },
      { name: 'Expenses', href: '/dashboard/expenses', icon: CurrencyDollarIcon },
    ]
  },
  {
    name: 'Inventory',
    items: [
      { name: 'Products & Services', href: '/dashboard/inventory', icon: CubeIcon, module: 'inventory' },
      { name: 'Stock Requisitions', href: '/dashboard/requisitions', icon: ClipboardDocumentListIcon, module: 'inventory' },
      { name: 'Fixed Assets', href: '/dashboard/assets', icon: BuildingOfficeIcon, module: 'inventory' },
    ]
  },
  {
    name: 'People',
    items: [
      { name: 'Employees', href: '/dashboard/employees', icon: UsersIcon },
      { name: 'Payroll', href: '/dashboard/payroll', icon: CalculatorIcon, module: 'payroll' },
    ]
  },
  {
    name: 'Accounting',
    items: [
      { name: 'Bank & Cash', href: '/dashboard/bank', icon: BuildingLibraryIcon },
      { name: 'General Ledger', href: '/dashboard/general-ledger', icon: BookOpenIcon },
      { name: 'Reports', href: '/dashboard/reports', icon: ChartBarIcon },
    ]
  },
  {
    name: 'System',
    pinned: true,
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
  '/dashboard/requisitions': ['admin', 'accountant', 'operations'],
  '/dashboard/fleet': ['admin', 'operations'],
  '/dashboard/hotels': ['admin', 'operations'],
  '/dashboard/pos': ['admin', 'operations'],
  '/pos': ['admin', 'operations'],
  '/dashboard/cafe': ['admin', 'operations'],
  '/dashboard/destinations': ['admin', 'operations'],
  '/dashboard/tours': ['admin', 'operations', 'sales', 'guide'],
  '/dashboard/bookings': ['admin', 'operations', 'sales', 'guide'],
  '/dashboard/customers': ['admin', 'accountant', 'sales', 'operations'],
  '/dashboard/vendors': ['admin', 'accountant', 'operations'],
  '/dashboard/sales': ['admin', 'accountant', 'sales', 'operations'],
  '/dashboard/invoices': ['admin', 'accountant', 'sales', 'operations'],
  '/dashboard/products': ['admin', 'accountant', 'sales', 'operations'],
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
  return (
    <CompanyProvider>
      <DashboardShell>{children}</DashboardShell>
    </CompanyProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // User, companies and modules come from one /api/companies/me call made by CompanyProvider
  const {
    user,
    company,
    companies,
    companyModules: enabledModules,
    loading: isLoading,
    switchCompany: switchContextCompany,
  } = useCompany();
  const companyRole = company?.role || null;
  const subscriptionStatus = company?.subscription_status || '';
  const trialEndDate = company?.trial_ends_at || undefined;
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  // App header: breadcrumbs from the URL and menu; title and buttons from the page's <PageHeader>
  const { actionsSlot, setActionsSlot, title: pageTitle, setTitle: setPageTitle } = usePageHeaderState();
  const breadcrumbs = buildBreadcrumbs(
    pathname,
    navigationGroups.flatMap((group) => group.items.map((item) => ({ group: group.name, name: item.name, href: item.href }))),
    pageTitle
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navRole = companyRole ?? user?.role ?? '';
  const visibleNavGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.module || enabledModules.includes(item.module)) &&
          userHasAccess(item.href, navRole)
      ),
    }))
    .filter((group) => group.items.length > 0);
  // Only one collapsible nav group is expanded at a time — defaults to the group holding the active route
  const activeNavGroup =
    visibleNavGroups.find(
      (group) => !group.pinned && group.items.some((item) => isNavItemActive(pathname, item.href))
    )?.name ?? null;
  const [openNavGroup, setOpenNavGroup] = useState<string | null>(activeNavGroup);

  useEffect(() => {
    if (activeNavGroup) setOpenNavGroup(activeNavGroup);
  }, [activeNavGroup]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [visibleNotificationCount, setVisibleNotificationCount] = useState(NOTIFICATION_PAGE_SIZE);
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
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // Notifications load in the background; the page does not wait for them. Re-run when
  // modules change too, since stock alerts depend on the Inventory module.
  const modulesKey = enabledModules.join(',');
  useEffect(() => {
    if (company?.id) {
      fetchNotifications(company.id);
    }
  }, [company?.id, modulesKey]);

  const switchCompany = async (newCompany: any) => {
    setCompanySwitcherOpen(false);
    await switchContextCompany(newCompany.id);
  };

  const fetchNotifications = async (companyId: string) => {
    try {
      // Fetch recent notifications based on overdue invoices, bills, etc.
      const [overdueInvoicesResponse, overdueBillsResponse, requisitionActivityResponse, readsResponse] = await Promise.all([
        fetch(
          `/api/invoices?company_id=${encodeURIComponent(companyId)}&status=overdue&page=1&limit=25`,
          { credentials: 'include' }
        ),
        fetch(
          `/api/bills?company_id=${encodeURIComponent(companyId)}&status=overdue&page=1&limit=25`,
          { credentials: 'include' }
        ),
        fetch(
          `/api/requisitions/activity?company_id=${encodeURIComponent(companyId)}&limit=20`,
          { credentials: 'include' }
        ),
        fetch(
          `/api/notifications/reads?company_id=${encodeURIComponent(companyId)}`,
          { credentials: 'include' }
        ),
      ]);

      const overdueInvoices = overdueInvoicesResponse.ok
        ? (await overdueInvoicesResponse.json()).data || []
        : [];
      const overdueBills = overdueBillsResponse.ok
        ? (await overdueBillsResponse.json()).data || []
        : [];
      const requisitionActivity = requisitionActivityResponse.ok
        ? (await requisitionActivityResponse.json()).data || []
        : [];
      const readIds: string[] = readsResponse.ok
        ? (await readsResponse.json()).data || []
        : [];
      const readIdSet = new Set(readIds);

      // Stock alerts, when the company uses Inventory: low stock, batches expiring within a
      // week, and adjustments waiting for someone allowed to approve them
      const stockAlerts: any[] = [];
      if (enabledModules.includes('inventory')) {
        const id = encodeURIComponent(companyId);
        const [lowRes, expRes, adjRes] = await Promise.all([
          fetch(`/api/inventory?company_id=${id}&low_stock=true&limit=20`, { credentials: 'include' }),
          fetch(`/api/inventory/expiring?company_id=${id}&days=7`, { credentials: 'include' }),
          fetch(`/api/stock-adjustments?company_id=${id}&status=pending`, { credentials: 'include' }),
        ]);
        const low = lowRes.ok ? (await lowRes.json()).data || [] : [];
        const expiring = expRes.ok ? (await expRes.json()).data || [] : [];
        const adjustments = adjRes.ok ? await adjRes.json() : { data: [], can_approve: false };

        low.forEach((p: any) => stockAlerts.push({
          id: `low-stock-${p.id}-${Number(p.quantity_on_hand)}`,
          type: 'low_stock',
          title: Number(p.quantity_on_hand) <= 0 ? `${p.name} is out of stock` : `${p.name} is running low`,
          message: `${Number(p.quantity_on_hand)} ${p.unit_of_measure || ''} left (reorder at ${Number(p.reorder_point || 0)})`,
          time: new Date().toLocaleDateString(),
          href: '/dashboard/inventory/alerts',
        }));
        expiring.forEach((l: any) => stockAlerts.push({
          id: `expiring-${l.lot_id}`,
          type: 'expiring',
          title: l.days_left < 0 ? `${l.product_name} batch has expired` : `${l.product_name} expires in ${l.days_left} day(s)`,
          message: `${l.quantity} ${l.unit_of_measure || ''}${l.lot_number ? ` · batch ${l.lot_number}` : ''}`,
          time: l.expiry_date,
          href: '/dashboard/inventory/alerts',
        }));
        if (adjustments.can_approve) {
          (adjustments.data || []).forEach((a: any) => stockAlerts.push({
            id: `adjustment-${a.id}`,
            type: 'adjustment',
            title: `${a.adjustment_number} needs approval`,
            message: `${a.product_name}: ${a.quantity_change > 0 ? '+' : ''}${a.quantity_change} (${a.reason.replace('_', ' ')})`,
            time: new Date(a.created_at).toLocaleDateString(),
            href: '/dashboard/inventory/adjustments',
          }));
        }
      }

      const notificationList: any[] = [...stockAlerts];

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

      requisitionActivity.forEach((event: any) => {
        notificationList.push({
          id: event.id,
          type: event.type,
          title: event.title,
          message: event.message,
          time: new Date(event.time).toLocaleDateString(),
          href: event.href,
        });
      });

      const withReadStatus = notificationList
        .slice(0, 60)
        .map((n) => ({ ...n, read: readIdSet.has(n.id) }));

      setNotifications(withReadStatus);
      setVisibleNotificationCount(NOTIFICATION_PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!company?.id) return;
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    try {
      await fetch('/api/notifications/reads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id, notification_id: notificationId }),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!company?.id) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications/reads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id, notification_ids: unreadIds }),
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/login';
  };

  // Show skeleton layout (sidebar always visible) while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        {/* Sidebar skeleton — same structure as real sidebar */}
        <aside className="fixed top-0 left-0 z-50 h-full w-64 bg-white/90 backdrop-blur-xl border-r border-blueox-primary/20 shadow-2xl">
          <div className="h-16 flex items-center px-4 border-b border-blueox-primary/20 gap-3">
            <div className="w-9 h-9 rounded-xl bg-blueox-primary/10 animate-pulse" />
            <div className="h-4 w-32 rounded bg-blueox-primary/10 animate-pulse" />
          </div>
          <div className="p-4 space-y-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-blueox-primary/10 animate-pulse mb-3" />
                {[1,2,3].map(j => (
                  <div key={j} className="h-9 rounded-xl bg-blueox-primary/5 animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </aside>
        {/* Content area skeleton */}
        <div className="lg:ml-64 p-8 pt-24">
          <div className="h-6 w-48 rounded bg-blueox-primary/10 animate-pulse mb-8" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-white/80 animate-pulse shadow" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Don't render dashboard if no user (should redirect to login)
  if (!user) {
    return null;
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative">
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
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            {company?.logo_url ? (
              <Image
                src={company.logo_url}
                alt={company.name || 'Company Logo'}
                width={36}
                height={36}
                className="rounded object-contain flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-blueox-primary to-blueox-accent flex items-center justify-center text-black font-bold text-sm shadow-lg">
                {company?.name?.[0]?.toUpperCase() || 'C'}
              </div>
            )}
            <span className="font-semibold text-blueox-primary-dark truncate" title={company?.name || 'Company'}>
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
          {visibleNavGroups.map((group) => {
              const hasActiveItem = group.items.some((item) => isNavItemActive(pathname, item.href));
              // The section holding the current page can't be collapsed
              const expanded = group.pinned || hasActiveItem || openNavGroup === group.name;
              return (
            <div key={group.name}>
              {group.pinned ? (
                <p className="text-xs font-semibold text-blueox-primary/60 uppercase tracking-wider mb-2 px-2">
                  {group.name}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!hasActiveItem) setOpenNavGroup(expanded ? null : group.name);
                  }}
                  aria-expanded={expanded}
                  className={`w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-blueox-primary/5 transition-colors ${
                    hasActiveItem ? 'text-blueox-primary' : 'text-blueox-primary/60'
                  } ${expanded ? 'mb-2' : ''}`}
                >
                  {group.name}
                  <ChevronDownIcon
                    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
              {expanded && (
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href);
                  
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
              )}
            </div>
              );
            })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className={`fixed top-0 left-0 lg:left-64 right-0 z-30 h-14 bg-white/80 backdrop-blur-xl border-b border-blueox-primary/20 flex items-center justify-between gap-3 px-4 shadow-sm transition-transform duration-300 ease-in-out ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-blueox-primary/10 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex items-center gap-1.5 text-sm">
              {breadcrumbs.map((crumb, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <span key={i} className={`items-center gap-1.5 min-w-0 ${last ? 'flex' : 'hidden md:flex'}`}>
                    {i > 0 && <ChevronRightIcon className="w-3.5 h-3.5 text-blueox-primary/40 flex-shrink-0" />}
                    {last ? (
                      <h1 className="font-semibold text-blueox-primary-dark truncate text-base" title={crumb.label}>{crumb.label}</h1>
                    ) : crumb.href ? (
                      <Link href={crumb.href} className="text-blueox-primary/70 hover:text-blueox-primary whitespace-nowrap">{crumb.label}</Link>
                    ) : (
                      <span className="text-blueox-primary/50 whitespace-nowrap">{crumb.label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Page actions (from <PageHeader actions>) */}
            <div ref={setActionsSlot} className="flex items-center gap-2" />
            {/* Company Switcher */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setCompanySwitcherOpen(!companySwitcherOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-blueox-primary/10 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blueox-primary to-blueox-accent flex items-center justify-center flex-shrink-0">
                  <FitNumber value={company?.name?.[0]?.toUpperCase() || 'C'} className="text-black font-bold" />
                </div>
                <span className="text-sm font-semibold text-blueox-primary-dark max-w-[140px] truncate">{company?.name || 'Company'}</span>
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
                            <FitNumber value={c.name?.[0]?.toUpperCase() || 'C'} className="text-black font-bold" />
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

            {/* Notifications */}
            <div className="relative">
              <button 
                className="p-2 rounded-xl hover:bg-blueox-primary/10 relative transition-colors"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <BellIcon className="w-5 h-5 text-blueox-primary" />
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {notifications.filter((n) => !n.read).length > 99 ? '99+' : notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="bg-white/95 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-xl animate-fade-in absolute -right-20 sm:right-0 mt-2 w-60 sm:w-80 max-w-[calc(100vw-1rem)] z-50">
                    <div className="p-3 border-b border-blueox-primary/20">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium text-blueox-primary-dark">Notifications</h3>
                        <div className="flex items-center gap-2">
                          {notifications.some((n) => !n.read) && (
                            <button
                              onClick={markAllNotificationsRead}
                              className="text-xs text-blueox-primary hover:text-blueox-primary-dark hover:underline transition-colors"
                            >
                              Mark all as read
                            </button>
                          )}
                          <span className="text-xs text-blueox-primary/60">
                            {Math.min(visibleNotificationCount, notifications.length)} of {notifications.length}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="py-1 max-h-80 overflow-y-auto"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
                        if (nearBottom) {
                          setVisibleNotificationCount((prev) =>
                            Math.min(prev + NOTIFICATION_PAGE_SIZE, notifications.length)
                          );
                        }
                      }}
                    >
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-blueox-primary/60">
                          <BellIcon className="w-8 h-8 mx-auto text-blueox-primary/40 mb-2" />
                          <p className="text-sm">No new notifications</p>
                        </div>
                      ) : (
                        notifications.slice(0, visibleNotificationCount).map((notification) => (
                          <Link
                            key={notification.id}
                            href={notification.href}
                            className={`block px-4 py-3 hover:bg-blueox-primary/5 border-b border-blueox-primary/10 last:border-b-0 transition-colors ${
                              notification.read ? 'opacity-60' : 'bg-blueox-primary/5'
                            }`}
                            onClick={() => {
                              setNotificationsOpen(false);
                              if (!notification.read) markNotificationRead(notification.id);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                notification.read
                                  ? 'bg-transparent border border-blueox-primary/30'
                                  : notification.type === 'overdue_invoice' ? 'bg-red-500' : 'bg-yellow-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${notification.read ? 'font-normal text-blueox-primary-dark/80' : 'font-medium text-blueox-primary-dark'}`}>
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
                        disabled={signingOut}
                        className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left flex items-center gap-2 disabled:opacity-60"
                      >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        {signingOut ? 'Signing out...' : 'Sign Out'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="pt-[4.25rem] px-4 pb-4 lg:px-6 lg:pb-6">
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
            <PageHeaderProvider actionsSlot={actionsSlot} setTitle={setPageTitle}>
              {children}
            </PageHeaderProvider>
          )}
        </main>
      </div>
    </div>
  );
}


