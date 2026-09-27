import {
  apartmentDisplayName,
  formatApartmentArea,
  formatApartmentPrice,
  formatApartmentStatus,
  isSoldStatus,
  type PublicApartmentDetails,
  type PublicApartmentListItem,
} from '@/lib/api/public.api';

/**
 * View model for the public apartment detail page.
 *
 * The standalone UI shape stays stable here: backend field names
 * (unit_number, area_sqm, ...) are normalized once in
 * `toApartmentDetailViewModel`, so JSX never depends on the wire format.
 * Only fields the backend actually provides are included — anything the
 * standalone design shows but the API lacks (features, balcony, parking)
 * is omitted upstream instead of faked.
 */
export interface ApartmentSpec {
  label: string;
  value: string;
}

export interface ApartmentGalleryImage {
  src: string;
  alt: string;
}

export interface ApartmentDetailViewModel {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  statusClass: string;
  sold: boolean;
  location: string | null;
  companyName: string;
  price: string | null;
  specsLine: string;
  specs: ApartmentSpec[];
  description: string | null;
  heroImage: string | null;
  gallery: ApartmentGalleryImage[];
  company: {
    id: string;
    name: string;
    logo: string | null;
  };
}

export interface RelatedApartmentCardModel {
  id: string;
  name: string;
  meta: string;
  status: string | null;
  statusClass: string | null;
  image: string | null;
  alt: string;
}

function specsLineFor(
  bedrooms: number | null,
  bathrooms: number | null,
  area: string | null,
): string {
  return [
    bedrooms != null && `${bedrooms} Beds`,
    bathrooms != null && `${bathrooms} Baths`,
    area,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function toApartmentDetailViewModel(
  apartment: PublicApartmentDetails,
): ApartmentDetailViewModel {
  const name = apartmentDisplayName(apartment.unit_number);
  const area = formatApartmentArea(apartment.area_sqm);
  const seen = new Set<string>();
  const gallery: ApartmentGalleryImage[] = [];
  for (const image of apartment.images) {
    if (!image.image_url || seen.has(image.image_url)) continue;
    seen.add(image.image_url);
    gallery.push({ src: image.image_url, alt: `${name} photo ${gallery.length + 1}` });
  }
  const specs = (
    [
      apartment.bedrooms != null && { label: 'Bedrooms', value: String(apartment.bedrooms) },
      apartment.bathrooms != null && { label: 'Bathrooms', value: String(apartment.bathrooms) },
      area && { label: 'Area', value: area },
      { label: 'Floor', value: String(apartment.floor_number) },
    ].filter(Boolean) as ApartmentSpec[]
  );
  return {
    id: apartment.id,
    name,
    status: apartment.status,
    statusLabel: formatApartmentStatus(apartment.status),
    statusClass: `apt-status is-${apartment.status.toLowerCase()}`,
    sold: isSoldStatus(apartment.status),
    location: apartment.project_location ?? apartment.project_name,
    companyName: apartment.company_name,
    price: formatApartmentPrice(apartment.price),
    specsLine: specsLineFor(apartment.bedrooms, apartment.bathrooms, area),
    specs,
    description: apartment.description?.trim() ? apartment.description : null,
    heroImage: gallery[0]?.src ?? null,
    gallery,
    company: {
      id: apartment.company_id,
      name: apartment.company_name,
      logo: apartment.company_logo,
    },
  };
}

export function toRelatedCardModel(
  item: PublicApartmentListItem,
): RelatedApartmentCardModel {
  const name = apartmentDisplayName(item.unit_number);
  return {
    id: item.id,
    name,
    meta: specsLineFor(item.bedrooms, item.bathrooms, formatApartmentArea(item.area_sqm)),
    status: item.status ? formatApartmentStatus(item.status) : null,
    statusClass: item.status ? 'co-apartment-status' : null,
    image: item.primary_image,
    alt: name,
  };
}
