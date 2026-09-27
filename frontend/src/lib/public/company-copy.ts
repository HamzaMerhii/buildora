/**
 * Intentionally static, general marketing copy for public company surfaces.
 * Company descriptions are NOT backend-driven: this wording is neutral and
 * applies to every construction partner. Do NOT add company-specific claims.
 */
export const GENERAL_COMPANY_DESCRIPTION =
  'Construction partner delivering residential projects through Buildora.';

export function partnerMonogram(name: string): string {
  const words = name.split(' ').filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
