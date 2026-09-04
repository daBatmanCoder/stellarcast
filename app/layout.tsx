import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stellarcast - Private Livestream Events on Sepolia',
  description: 'Pay for exclusive livestream access using ERC-5564 stealth addresses. Privacy-preserving payments on Sepolia testnet.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
