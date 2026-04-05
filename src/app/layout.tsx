import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApiKeyModal } from '@/components/ui/ApiKeyModal';

export const metadata: Metadata = {
  title: 'ResearchGen v6 · AI UX Research',
  description: 'AI-powered UX Research SaaS Pipeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ApiKeyModal />
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
