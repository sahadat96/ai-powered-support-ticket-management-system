import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Relay — Support, in sync', template: '%s · Relay' },
  description:
    'A calmer workspace for customer support. Organize tickets, work together, and find clarity with smart triage.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
