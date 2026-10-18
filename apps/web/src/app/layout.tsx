import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Relay — Support, in sync.', template: '%s · Relay' },
  description:
    'An intelligent support workspace for better customer conversations.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
