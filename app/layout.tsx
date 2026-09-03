import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'STELLARCAST - Private Livestream Events',
  description: 'Pay-to-view livestreams with privacy-preserving stealth addresses. Watch without revealing your identity.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
