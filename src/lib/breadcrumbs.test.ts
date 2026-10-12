import { describe, expect, it } from 'vitest';
import { buildBreadcrumbs, type NavEntry } from './breadcrumbs';

const nav: NavEntry[] = [
  { group: 'Overview', name: 'Dashboard', href: '/dashboard' },
  { group: 'Sales', name: 'Invoices', href: '/dashboard/invoices' },
  { group: 'Inventory', name: 'Products & Services', href: '/dashboard/inventory' },
  { group: 'System', name: 'Settings', href: '/dashboard/settings' },
];
const id = '5fe58863-16c6-4e26-8fe6-791d94cf9fcc';

describe('buildBreadcrumbs', () => {
  it('menu page: group then page, page not linked', () => {
    expect(buildBreadcrumbs('/dashboard/invoices', nav)).toEqual([{ label: 'Sales' }, { label: 'Invoices' }]);
  });

  it('sub pages link back up the trail', () => {
    expect(buildBreadcrumbs('/dashboard/inventory/receive', nav)).toEqual([
      { label: 'Inventory' },
      { label: 'Products & Services', href: '/dashboard/inventory' },
      { label: 'Receive stock' },
    ]);
  });

  it('ids show as Details, and the page title replaces the last crumb', () => {
    expect(buildBreadcrumbs(`/dashboard/invoices/${id}/edit`, nav)).toEqual([
      { label: 'Sales' },
      { label: 'Invoices', href: '/dashboard/invoices' },
      { label: 'Details', href: `/dashboard/invoices/${id}` },
      { label: 'Edit' },
    ]);
    expect(buildBreadcrumbs(`/dashboard/invoices/${id}`, nav, 'INV-2026-00002').at(-1)).toEqual({ label: 'INV-2026-00002' });
  });

  it('dashboard and pages outside the menu', () => {
    expect(buildBreadcrumbs('/dashboard', nav)).toEqual([{ label: 'Dashboard' }]);
    expect(buildBreadcrumbs('/dashboard/chart-of-accounts', nav)).toEqual([{ label: 'Chart of accounts' }]);
    expect(buildBreadcrumbs('/dashboard/settings/fiscal-periods', nav).at(-1)).toEqual({ label: 'Fiscal periods' });
  });
});
