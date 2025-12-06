import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Schema Explorer - Hygraph App',
  description: 'Analyze your Hygraph schema and find content references',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

