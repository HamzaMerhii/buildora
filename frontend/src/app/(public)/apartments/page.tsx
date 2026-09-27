import type { Metadata } from 'next';
import ApartmentsListView from '@/components/public/apartments/ApartmentsListView';

export const metadata: Metadata = {
  title: 'Apartments | Buildora Residences',
  description: 'Browse residences delivered by Buildora’s construction partners — availability, specifications, and company details.',
};

export default function ApartmentsPage() {
  return <ApartmentsListView />;
}
