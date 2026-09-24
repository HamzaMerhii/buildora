import { apiJson } from './client';

/**
 * Payment category endpoints (verified against
 * backend/app/routers/payment_category.py, mounted in main.py).
 * Base path: /payment-categories (global scope, no company/project).
 *
 * Only existing backend endpoints are implemented here (all JSON):
 * - GET    /  (name ASC, require_authenticated_user = any login)
 * - POST   /  (201, require_super_admin = platform SUPER_ADMIN only,
 *   409 on duplicate name)
 *
 * Company workspace surfaces consume getPaymentCategories() only.
 * Category creation is unavailable to company roles, so no
 * create/edit/delete UI is offered there. createPaymentCategory is
 * implemented for completeness (platform use) but intentionally
 * unwired from company pages.
 */

/** Raw wire shape. */
export interface BackendPaymentCategory {
  id: string;
  name: string;
  created_at: string;
}

/** Frontend-shaped category built only from real backend fields. */
export interface ApiPaymentCategory {
  id: string;
  name: string;
  createdAt: string;
}

export function mapPaymentCategoryResponseToFrontend(
  c: BackendPaymentCategory,
): ApiPaymentCategory {
  return { id: c.id, name: c.name, createdAt: c.created_at };
}

/** All categories (global, name ASC). Any authenticated user may call. */
export async function getPaymentCategories(): Promise<ApiPaymentCategory[]> {
  const raw = await apiJson<BackendPaymentCategory[]>('/payment-categories/');
  return raw.map(mapPaymentCategoryResponseToFrontend);
}

/** SUPER_ADMIN platform role only. Not used by company workspace UI. */
export async function createPaymentCategory(name: string): Promise<ApiPaymentCategory> {
  const raw = await apiJson<BackendPaymentCategory>('/payment-categories/', {
    method: 'POST',
    body: { name: name.trim() },
  });
  return mapPaymentCategoryResponseToFrontend(raw);
}

/** Lookup by category UUID for O(1) resolution in lists. */
export function buildCategoriesById(
  categories: ApiPaymentCategory[],
): Map<string, ApiPaymentCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}
