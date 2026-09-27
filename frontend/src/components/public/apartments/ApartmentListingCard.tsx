'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  apartmentDisplayName,
  formatApartmentArea,
  formatApartmentPrice,
  formatApartmentStatus,
  type PublicApartmentListItem,
} from '@/lib/api/public.api';
import NeonPanel from '@/components/public/ui/NeonPanel';

export default function ApartmentListingCard({ apartment }: { apartment: PublicApartmentListItem }) {
  const [logoHidden, setLogoHidden] = useState(false);
  const name = apartmentDisplayName(apartment.unit_number);
  const specs = [
    apartment.bedrooms != null && `${apartment.bedrooms} Beds`,
    apartment.bathrooms != null && `${apartment.bathrooms} Baths`,
    formatApartmentArea(apartment.area_sqm),
  ].filter(Boolean).join(' · ');
  const price = formatApartmentPrice(apartment.price);
  return <Link className="apt-list-card-link" href={`/apartments/${apartment.id}`} aria-label={`View details of ${name}`}>
    <NeonPanel className="apt-list-card">
      <span className="apt-list-media">
        {apartment.primary_image ? (
          <Image src={apartment.primary_image} alt={name} fill sizes="(max-width: 640px) 92vw, (max-width: 1050px) 44vw, 30vw" style={{ objectFit: 'cover' }} />
        ) : null}
        {apartment.status && <span className={`apt-status is-${apartment.status.toLowerCase()}`}>{formatApartmentStatus(apartment.status)}</span>}
      </span>
      <span className="apt-list-body">
        <span className="apt-list-name">{name}</span>
        <span className="apt-list-company">
          {apartment.company_logo && !logoHidden && (
            <span className="apt-list-logo">
              <Image src={apartment.company_logo} alt="" fill sizes="72px" style={{ objectFit: 'contain' }} onError={() => setLogoHidden(true)} />
            </span>
          )}
          {apartment.company_name}
        </span>
        <span className="apt-list-location">{apartment.project_location ?? apartment.project_name}</span>
        {specs && <span className="apt-list-specs">{specs}</span>}
        {price && <span className="apt-list-price">{price}</span>}
      </span>
    </NeonPanel>
  </Link>;
}
