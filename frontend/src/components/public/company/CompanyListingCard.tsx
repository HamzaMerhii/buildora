'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PublicCompanySummary } from '@/lib/api/public.api';
import { GENERAL_COMPANY_DESCRIPTION } from '@/lib/public/company-copy';
import NeonPanel from '@/components/public/ui/NeonPanel';

export default function CompanyListingCard({ company, index }: { company: PublicCompanySummary; index: number }) {
  const apartmentCount = company.apartment_count;
  return <Link className="co-list-card-link" href={`/companies/${company.id}`} aria-label={`View ${company.name} company profile`}>
    <NeonPanel className="co-list-card">
      <span className="co-list-index" aria-hidden="true">{`0${index + 1}`}</span>
      <span className="co-list-logo">
        {company.logo ? (
          <Image src={company.logo} alt={`${company.name} logo`} fill sizes="200px" style={{ objectFit: 'contain' }} />
        ) : null}
      </span>
      <span className="co-list-name">{company.name}</span>
      <span className="co-list-desc">{GENERAL_COMPANY_DESCRIPTION}</span>
      <span className="co-list-meta">
        <span className="co-list-stat"><strong>{apartmentCount}</strong> {apartmentCount === 1 ? 'Residence' : 'Residences'}</span>
      </span>
      <span className="co-list-view" aria-hidden="true">View Company <ArrowRight size={13} /></span>
    </NeonPanel>
  </Link>;
}
