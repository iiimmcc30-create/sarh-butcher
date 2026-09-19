import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ملاحم سرح | Malahem Sarh — لوحة الإدارة',
  description: 'لوحة إدارة سوق الملاحم المستقل — ملاحم سرح',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
