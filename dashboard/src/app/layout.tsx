import type { Metadata } from 'next';
import { AuthProvider } from '../contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Config Management Dashboard',
  description: 'Configuration management platform dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
