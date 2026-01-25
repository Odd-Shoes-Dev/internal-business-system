import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { CompanyProvider } from '@/contexts/company-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Business Management Platform',
  description: 'Multi-tenant business management platform for tour operators, cafes, retail, and more',
  icons: {
    icon: [
      { url: '/assets/logo_no_text.jpg', sizes: '32x32', type: 'image/jpeg' },
      { url: '/assets/logo_no_text.jpg', sizes: '16x16', type: 'image/jpeg' },
      { url: '/assets/logo_no_text.jpg', sizes: '192x192', type: 'image/jpeg' },
    ],
    apple: [{ url: '/assets/logo_no_text.jpg', sizes: '180x180', type: 'image/jpeg' }],
    shortcut: '/assets/logo_no_text.jpg',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Business Platform',
  },
};

export const viewport: Viewport = {
  themeColor: '#1e3a5f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Business Platform" />
      </head>
      <body className={inter.className}>
        <CompanyProvider>
          {children}
        </CompanyProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e3a5f',
              color: '#fff',
            },
            success: {
              style: {
                background: '#0d9488',
              },
            },
            error: {
              style: {
                background: '#dc2626',
              },
            },
          }}
        />
      </body>
    </html>
  );
}

