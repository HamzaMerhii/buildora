import type { Metadata } from 'next';
import CompaniesListView from '@/components/public/company/CompaniesListView';

export const metadata: Metadata = {
  title: 'Construction Partners | Buildora Network',
  description: 'Meet the construction companies working with Buildora to deliver reliable, modern, and high-quality projects.',
};

export default function CompaniesPage() {
  return <CompaniesListView />;
}
