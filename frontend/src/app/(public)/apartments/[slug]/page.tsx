import type { Metadata } from 'next';
import ApartmentDetailView from '@/components/public/apartment-detail/ApartmentDetailView';

export const metadata: Metadata = {
  title: 'Residence | Buildora Residences',
  description: 'View a public Buildora residence — specifications, photos, and company details.',
};

export default async function ApartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ApartmentDetailView key={slug} apartmentId={slug} />;
}
