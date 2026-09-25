import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import './portrait.css';
import './chat-wager.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata: Metadata = {
  title: 'Poker Texas Hold’em',
  description: 'Poker Texas Hold’em cho nhóm riêng',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
