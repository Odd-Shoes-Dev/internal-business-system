'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Pages put their title and buttons in the app header (the bar at the top of the dashboard)
// instead of a header block of their own, so the page content starts at the top:
//
//   <PageHeader title="Invoices" actions={<Link href="/dashboard/invoices/new" className="btn-primary btn-sm">New invoice</Link>} />
//
// The title becomes the last breadcrumb; the actions render on the right of the app header,
// with the page's own state and handlers (they are rendered through a portal, not copied).

interface PageHeaderContextValue {
  actionsSlot: HTMLElement | null;
  setTitle: (title: string | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({
  actionsSlot,
  setTitle,
  children,
}: PageHeaderContextValue & { children: ReactNode }) {
  return <PageHeaderContext.Provider value={{ actionsSlot, setTitle }}>{children}</PageHeaderContext.Provider>;
}

export function PageHeader({ title, actions }: { title?: string | null; actions?: ReactNode }) {
  const ctx = useContext(PageHeaderContext);
  const setTitle = ctx?.setTitle;

  useEffect(() => {
    setTitle?.(title ?? null);
    return () => setTitle?.(null);
  }, [title, setTitle]);

  // Outside the dashboard layout (no app header): fall back to a compact inline header
  if (!ctx) {
    return (
      <div className="flex items-center justify-between gap-3 mb-4">
        {title && <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    );
  }
  if (!actions || !ctx.actionsSlot) return null;
  return createPortal(<div className="flex items-center gap-2">{actions}</div>, ctx.actionsSlot);
}

// For the layout: the element the actions render into, plus the current page title
export function usePageHeaderState() {
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  return { actionsSlot, setActionsSlot, title, setTitle };
}
