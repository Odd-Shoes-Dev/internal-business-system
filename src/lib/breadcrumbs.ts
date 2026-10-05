// Breadcrumbs for the app header, worked out from the URL and the sidebar menu so every page
// gets them without doing anything. A page can name itself (e.g. an invoice number) through
// <PageHeader title=...>; that replaces the last crumb.

export interface NavEntry {
  group: string;
  name: string;
  href: string;
}

export interface Crumb {
  label: string;
  href?: string; // no link for the current page and for menu group names
}

// Names for path parts that are not menu items
const SEGMENT_LABELS: Record<string, string> = {
  new: 'New',
  edit: 'Edit',
  receive: 'Receive stock',
  adjust: 'Adjust stock',
  adjustments: 'Stock adjustments',
  promotions: 'Promotions',
  labels: 'Print labels',
  alerts: 'Low stock & expiring',
  movements: 'Stock movements',
  'stock-takes': 'Stock takes',
  categories: 'Categories',
  locations: 'Locations',
  transfers: 'Transfers',
  'goods-receipts': 'Goods receipts',
  'purchase-orders': 'Purchase orders',
  'chart-of-accounts': 'Chart of accounts',
  'journal-entries': 'Journal entries',
  'fiscal-periods': 'Fiscal periods',
  'add-modules': 'Add modules',
  payment: 'Payment',
  payments: 'Payments',
  reconcile: 'Reconcile',
  transfer: 'Transfer',
  accounts: 'Accounts',
  transactions: 'Transactions',
  maintenance: 'Maintenance',
  depreciation: 'Depreciation',
  assignments: 'Assignments',
  profile: 'Profile',
  admin: 'Admin',
  subscriptions: 'Subscriptions',
};

const looksLikeId = (segment: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || /^\d+$/.test(segment);

export function humanizeSegment(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  const words = segment.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildBreadcrumbs(pathname: string, nav: NavEntry[], title?: string | null): Crumb[] {
  const path = pathname.replace(/\/+$/, '') || '/dashboard';
  if (path === '/dashboard') return [{ label: title || 'Dashboard' }];

  // The menu item the page belongs to: the longest menu href that the path starts with
  const item = [...nav]
    .filter((n) => n.href !== '/dashboard' && (path === n.href || path.startsWith(n.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const crumbs: Crumb[] = [];
  let consumed = '/dashboard';
  if (item) {
    if (item.group && item.group !== item.name) crumbs.push({ label: item.group });
    crumbs.push({ label: item.name, href: item.href });
    consumed = item.href;
  }

  const rest = path.slice(consumed.length).split('/').filter(Boolean);
  let href = consumed;
  rest.forEach((segment) => {
    href += `/${segment}`;
    crumbs.push({ label: looksLikeId(segment) ? 'Details' : humanizeSegment(segment), href });
  });

  if (!crumbs.length) crumbs.push({ label: humanizeSegment(path.split('/').pop() || '') });

  // The current page is not a link, and takes the page's own title when it gives one
  const last = crumbs[crumbs.length - 1];
  crumbs[crumbs.length - 1] = { label: title || last.label };
  return crumbs;
}
