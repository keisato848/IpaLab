import DashboardClient from '@/components/features/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ダッシュボード',
};

export default function DashboardPage() {
  return <DashboardClient />;
}
