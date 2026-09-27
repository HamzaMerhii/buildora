import type { Metadata } from 'next';
import CompanyProfileView from '@/components/public/company/CompanyProfileView';

export const metadata: Metadata = {
  title: 'Company | Buildora Partner',
  description: 'View a Buildora construction partner and its public residences.',
};

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CompanyProfileView key={slug} companyId={slug} />;
}
