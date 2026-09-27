import {
  getAllPublicApartments,
  getPublicCompanies,
  searchPublicAI,
  type PublicAIResult,
  type PublicApartmentListItem,
  type PublicCompanySummary,
} from '@/lib/api/public.api';

export type SearchInterpretation = {
  entityType: 'apartments' | 'companies' | 'both';
  status?: string;
  bedrooms?: number;
  bathrooms?: number;
  location?: string;
  company?: string;
  project?: string;
  maxPrice?: number;
  minPrice?: number;
  minArea?: number;
  maxArea?: number;
};

export type SearchResponse = {
  /**
   * 'hybrid' when the real public AI endpoint contributed apartment results.
   * 'local-fallback' when AI was unavailable/failed and only the
   * deterministic matcher over live public API data was used. Both modes
   * use real backend data only — never mock data, never fabricated answers.
   */
  mode: 'hybrid' | 'local-fallback';
  /** Backend AI answer text. Null when AI did not contribute. */
  answer: string | null;
  /** True when the AI call failed and local results are shown instead. */
  aiUnavailable: boolean;
  interpretation: SearchInterpretation;
  apartments: PublicApartmentListItem[];
  companies: PublicCompanySummary[];
};

const STATUS_WORDS = ['available', 'reserved', 'sold'] as const;
const LOCATION_WORDS = ['beirut', 'marina', 'lebanon', 'achrafieh', 'downtown', 'jounieh'];

function parsePrice(text: string): number | undefined {
  const m = text.match(/\$?\s*(\d[\d,]*)\s*(k\b|000\b)?/);
  if (!m) return undefined;
  if (!/\$|price|cost|under|below|max|budget/.test(text)) return undefined;
  let value = Number(m[1].replace(/,/g, ''));
  if (/k\b/i.test(m[2] ?? '')) value *= 1000;
  return value;
}

function priceValue(price: string | number | null | undefined): number | undefined {
  if (price === null || price === undefined) return undefined;
  const numeric = typeof price === 'number' ? price : Number(String(price).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function matchCompany(text: string, companies: PublicCompanySummary[]): PublicCompanySummary | undefined {
  const lower = text.toLowerCase();
  return companies.find((c) => lower.includes(c.name.toLowerCase()));
}

/**
 * Deterministic matcher over live public API records. This is NOT AI: it
 * tokenizes the query for status, counts, location, company, and price, then
 * filters local copies of the API arrays. Clearly labeled in the UI.
 */
export function localSearch(
  rawQuery: string,
  apartments: PublicApartmentListItem[],
  companies: PublicCompanySummary[],
): SearchResponse {
  const text = rawQuery.toLowerCase();
  const wantsCompanies = /compan|contractor|builder|firm|partner/.test(text);
  const wantsApartments = /apartment|residence|unit|bed|bath|flat|loft|suite|penthouse|rent|buy|live/.test(text);
  const entityType = wantsCompanies && !wantsApartments ? 'companies' : !wantsCompanies && wantsApartments ? 'apartments' : 'both';

  const status = STATUS_WORDS.find((s) => text.includes(s));
  const bedrooms = text.match(/(\d+)[\s-]*(?:bed|bedroom|br\b)/)?.[1];
  const bathrooms = text.match(/(\d+)[\s-]*(?:bath|bathroom)/)?.[1];
  const location = LOCATION_WORDS.find((l) => text.includes(l));
  const company = matchCompany(text, companies);
  const maxPrice = parsePrice(text);

  const interpretation: SearchInterpretation = {
    entityType,
    ...(status && { status }),
    ...(bedrooms && { bedrooms: Number(bedrooms) }),
    ...(bathrooms && { bathrooms: Number(bathrooms) }),
    ...(location && { location }),
    ...(company && { company: company.name }),
    ...(maxPrice !== undefined && { maxPrice }),
  };

  const matched = apartments.filter((a) => {
    if (status && a.status.toLowerCase() !== status) return false;
    if (bedrooms && a.bedrooms !== Number(bedrooms)) return false;
    if (bathrooms && a.bathrooms !== Number(bathrooms)) return false;
    if (location) {
      const hay = `${a.project_name} ${a.company_name}`.toLowerCase();
      if (!hay.includes(location)) return false;
    }
    if (company && a.company_id !== company.id) return false;
    if (maxPrice !== undefined) {
      const price = priceValue(a.price);
      if (price === undefined || price > maxPrice) return false;
    }
    return true;
  });

  const companyResults = entityType === 'apartments' ? [] : companies.filter((c) => {
    if (company && c.id !== company.id) return false;
    if (!company && (wantsCompanies || entityType === 'both')) {
      const hay = `${c.name} ${c.address ?? ''}`.toLowerCase();
      const tokens = text.split(/[^a-z]+/).filter((t) => t.length > 3 && !['with', 'from', 'show', 'find', 'that', 'have'].includes(t));
      if (tokens.length > 0 && !tokens.some((t) => hay.includes(t))) return false;
    }
    return true;
  });

  return {
    mode: 'local-fallback',
    answer: null,
    aiUnavailable: false,
    interpretation,
    apartments: entityType === 'companies' ? [] : matched,
    companies: companyResults,
  };
}

/** Backend AI result mapped onto the list-item shape used by cards. */
function mapAiResult(result: PublicAIResult): PublicApartmentListItem {
  return {
    id: result.id,
    unit_number: result.unit_number,
    price: result.price,
    area_sqm: result.area_sqm,
    bedrooms: result.bedrooms,
    bathrooms: result.bathrooms,
    status: result.status,
    // AI results carry no floor number; cards tolerate a 0 fallback.
    floor_number: 0,
    project_id: result.project_id,
    project_name: result.project_name,
    project_location: result.location,
    company_id: result.company_id,
    company_name: result.company_name,
    company_logo: null,
    primary_image: result.image,
  };
}

function dedupeById(
  primary: PublicApartmentListItem[],
  secondary: PublicApartmentListItem[],
): PublicApartmentListItem[] {
  const seen = new Set(primary.map((a) => a.id));
  return [...primary, ...secondary.filter((a) => !seen.has(a.id))];
}

/**
 * Hybrid public search entry point for the UI.
 *
 * 1. Loads live public companies/apartments (needed for local company
 *    search and for reserved/sold coverage the AI endpoint lacks).
 * 2. Calls POST /public/ai/search for natural-language apartment results.
 * 3. Merges AI apartments with local matches, deduplicated by UUID.
 * 4. Company results always come from the local matcher over live data,
 *    because the AI endpoint returns apartments only.
 * 5. If the AI call fails, falls back explicitly to the local matcher over
 *    live data (flagged via `aiUnavailable`) — never mock data, and the UI
 *    labels the fallback truthfully.
 */
export async function searchBuildora(query: string): Promise<SearchResponse> {
  const trimmed = query.trim();
  // Local matching needs the complete apartment set: status and company
  // filters must see matches on every backend page, not just the first.
  const [apartments, companies] = await Promise.all([getAllPublicApartments(), getPublicCompanies()]);
  const local = localSearch(trimmed, apartments, companies);

  let ai: Awaited<ReturnType<typeof searchPublicAI>> | null = null;
  try {
    ai = await searchPublicAI(trimmed);
  } catch {
    ai = null;
  }

  if (!ai) {
    return { ...local, aiUnavailable: true };
  }

  if (ai.intent === 'UNKNOWN') {
    // Backend found nothing apartment-related. Keep local company matches
    // (company search is local-only) plus local apartment matches only when
    // the query is clearly about apartments — never dump the catalog.
    return {
      mode: 'hybrid',
      answer: ai.answer,
      aiUnavailable: false,
      interpretation: {
        entityType: local.interpretation.entityType,
        ...(local.interpretation.entityType === 'apartments'
          ? {
              status: local.interpretation.status,
              bedrooms: local.interpretation.bedrooms,
              bathrooms: local.interpretation.bathrooms,
              location: local.interpretation.location,
              company: local.interpretation.company,
              maxPrice: local.interpretation.maxPrice,
            }
          : {}),
      },
      apartments: local.interpretation.entityType === 'apartments' ? local.apartments : [],
      companies: local.companies,
    };
  }

  const f = ai.filters ?? {};
  const interpretation: SearchInterpretation = {
    entityType: 'apartments',
    ...(f.location ? { location: f.location } : {}),
    ...(f.company_name ? { company: f.company_name } : {}),
    ...(f.project_name ? { project: f.project_name } : {}),
    ...(f.bedrooms != null ? { bedrooms: f.bedrooms } : {}),
    ...(f.bathrooms != null ? { bathrooms: f.bathrooms } : {}),
    ...(f.max_price != null ? { maxPrice: f.max_price } : {}),
    ...(f.min_price != null ? { minPrice: f.min_price } : {}),
    ...(f.min_area != null ? { minArea: f.min_area } : {}),
    ...(f.max_area != null ? { maxArea: f.max_area } : {}),
  };

  // AI covers available apartments only; local matches preserve
  // reserved/sold coverage. Deduplicated by UUID, AI results first.
  const aiApartments = ai.results.map(mapAiResult);
  const localExtras = local.apartments.filter(
    (a) => a.status.toLowerCase() !== 'available',
  );

  return {
    mode: 'hybrid',
    answer: ai.answer,
    aiUnavailable: false,
    interpretation,
    apartments: dedupeById(aiApartments, localExtras),
    companies: local.companies,
  };
}
